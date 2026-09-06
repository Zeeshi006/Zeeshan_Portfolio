import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IVoiceKBSync } from '../../domain/ports/voice-kb-sync.port';

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';

@Injectable()
export class ElevenLabsKBAdapter implements IVoiceKBSync {
  private readonly logger = new Logger(ElevenLabsKBAdapter.name);
  private readonly apiKey: string | undefined;
  private readonly agentId: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('ELEVENLABS_API_KEY');
    this.agentId = this.config.get<string>('ELEVENLABS_AGENT_ID');
  }

  private get isConfigured(): boolean {
    return !!(this.apiKey && this.agentId);
  }

  async createDoc(title: string, content: string): Promise<string | null> {
    if (!this.isConfigured) {
      this.logger.warn('ElevenLabs not configured — skipping KB sync (create)');
      return null;
    }

    try {
      const res = await fetch(`${ELEVENLABS_BASE}/convai/knowledge-base/text`, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: title, text: content }),
      });

      if (!res.ok) {
        this.logger.error(`ElevenLabs KB create failed: ${res.status} ${await res.text()}`);
        return null;
      }

      const data = (await res.json()) as { id: string };
      await this.addDocToAgent(data.id, title);
      this.logger.log(`ElevenLabs KB doc created: ${data.id} "${title}"`);
      return data.id;
    } catch (err) {
      this.logger.error('ElevenLabs KB create error', err);
      return null;
    }
  }

  async deleteDoc(elevenLabsDocId: string): Promise<void> {
    if (!this.isConfigured) return;

    try {
      await this.removeDocFromAgent(elevenLabsDocId);

      const res = await fetch(`${ELEVENLABS_BASE}/convai/knowledge-base/${elevenLabsDocId}`, {
        method: 'DELETE',
        headers: { 'xi-api-key': this.apiKey! },
      });

      if (!res.ok) {
        this.logger.error(`ElevenLabs KB delete failed: ${res.status}`);
      } else {
        this.logger.log(`ElevenLabs KB doc deleted: ${elevenLabsDocId}`);
      }
    } catch (err) {
      this.logger.error('ElevenLabs KB delete error', err);
    }
  }

  private async addDocToAgent(docId: string, title: string): Promise<void> {
    const current = await this.getAgentKB();
    if (!current) return;

    const already = current.some((d: { id: string }) => d.id === docId);
    if (already) return;

    await this.patchAgentKB([...current, { type: 'text', id: docId, name: title }]);
  }

  private async removeDocFromAgent(docId: string): Promise<void> {
    const current = await this.getAgentKB();
    if (!current) return;

    const filtered = current.filter((d: { id: string }) => d.id !== docId);
    if (filtered.length === current.length) return;

    await this.patchAgentKB(filtered);
  }

  private async getAgentKB(): Promise<Array<{ type: string; id: string; name: string }> | null> {
    try {
      const res = await fetch(`${ELEVENLABS_BASE}/convai/agents/${this.agentId!}`, {
        headers: { 'xi-api-key': this.apiKey! },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        conversation_config?: { agent?: { prompt?: { knowledge_base?: Array<{ type: string; id: string; name: string }> } } };
      };
      return data.conversation_config?.agent?.prompt?.knowledge_base ?? [];
    } catch {
      return null;
    }
  }

  private async patchAgentKB(kb: Array<{ type: string; id: string; name: string }>): Promise<void> {
    try {
      const body = {
        conversation_config: { agent: { prompt: { knowledge_base: kb } } },
      };
      const res = await fetch(`${ELEVENLABS_BASE}/convai/agents/${this.agentId!}`, {
        method: 'PATCH',
        headers: {
          'xi-api-key': this.apiKey!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        this.logger.error(`ElevenLabs agent KB patch failed: ${res.status}`);
      }
    } catch (err) {
      this.logger.error('ElevenLabs agent KB patch error', err);
    }
  }
}
