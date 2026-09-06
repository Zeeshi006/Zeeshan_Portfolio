import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  ILLMProvider,
  ChatMessage,
  Tool,
  ToolCall,
  LLMUsage,
  StreamWithToolsEvent,
} from '../../domain/ports/llm-provider.port';

// Routes through OpenRouter — single API key for all models
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const MODEL = 'deepseek/deepseek-chat';

@Injectable()
export class DeepSeekAdapter implements ILLMProvider {
  private readonly client: OpenAI;

  constructor(private readonly config: ConfigService) {
    this.client = new OpenAI({
      baseURL: OPENROUTER_BASE,
      apiKey: this.config.get<string>('OPENROUTER_API_KEY') ?? '',
      defaultHeaders: {
        'HTTP-Referer': 'https://hammad.cloud',
        'X-Title': 'Hammad Afzal Portfolio',
      },
    });
  }

  async chat(messages: ChatMessage[], systemPrompt: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ],
      max_tokens: 500,
      stream: false,
    });
    return response.choices[0]?.message?.content ?? '';
  }

  async *streamWithTools(
    messages: ChatMessage[],
    systemPrompt: string,
    tools: Tool[],
  ): AsyncIterable<StreamWithToolsEvent> {
    const stream = await this.client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ],
      tools: tools as unknown as OpenAI.Chat.Completions.ChatCompletionTool[],
      tool_choice: 'auto',
      max_tokens: 800,
      stream: true,
      stream_options: { include_usage: true },
    });

    // Accumulate tool call argument deltas keyed by index
    const acc = new Map<number, { id: string; name: string; arguments: string }>();

    for await (const chunk of stream) {
      // Usage-only chunk (no choices) arrives as the final chunk with include_usage
      if (!chunk.choices.length) {
        if (chunk.usage) {
          yield { usage: { promptTokens: chunk.usage.prompt_tokens, completionTokens: chunk.usage.completion_tokens } };
        }
        continue;
      }

      const choice = chunk.choices[0];
      if (!choice) continue;
      const delta = choice.delta;

      if (delta.content) yield { token: delta.content };

      for (const tc of delta.tool_calls ?? []) {
        const entry = acc.get(tc.index) ?? { id: '', name: '', arguments: '' };
        if (tc.id) entry.id = tc.id;
        if (tc.function?.name) entry.name = tc.function.name;
        if (tc.function?.arguments) entry.arguments += tc.function.arguments;
        acc.set(tc.index, entry);
      }

      if (choice.finish_reason === 'tool_calls' || choice.finish_reason === 'stop') {
        for (const [, tc] of acc) {
          yield { toolCall: { id: tc.id, type: 'function', function: { name: tc.name, arguments: tc.arguments } } };
        }
      }
    }
  }

  async chatWithTools(
    messages: ChatMessage[],
    systemPrompt: string,
    tools: Tool[],
  ): Promise<{ content: string; toolCalls: ToolCall[]; usage: LLMUsage }> {
    const response = await this.client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ],
      tools: tools as unknown as OpenAI.Chat.Completions.ChatCompletionTool[],
      tool_choice: 'auto',
      max_tokens: 300,
      stream: false,
    });
    const choice = response.choices[0];
    const content = choice?.message?.content ?? '';
    const toolCalls: ToolCall[] = (choice?.message?.tool_calls ?? []).map((tc) => ({
      id: tc.id,
      type: 'function',
      function: { name: tc.function.name, arguments: tc.function.arguments },
    }));
    const usage: LLMUsage = {
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
    };
    return { content, toolCalls, usage };
  }
}
