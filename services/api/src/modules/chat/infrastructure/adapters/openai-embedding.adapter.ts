import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import type Redis from "ioredis";
import { IEmbeddingProvider } from "../../domain/ports/embedding-provider.port";
import { REDIS_CLIENT } from "../../../../infrastructure/redis/redis.module";

// Routes through OpenRouter — same key as LLM, no separate OPENAI_API_KEY needed
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const EMBEDDING_MODEL = "openai/text-embedding-3-small";

@Injectable()
export class OpenAIEmbeddingAdapter implements IEmbeddingProvider {
  private readonly client: OpenAI;

  constructor(
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    this.client = new OpenAI({
      baseURL: OPENROUTER_BASE,
      apiKey: this.config.get<string>("OPENROUTER_API_KEY") ?? "",
      defaultHeaders: {
        "HTTP-Referer": "https://hammad.cloud",
        "X-Title": "Hammad Afzal Portfolio",
      },
    });
  }

  async embed(text: string): Promise<number[]> {
    const start = Date.now();
    const response = await this.client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
    });
    const ms = Date.now() - start;
    void this.redis
      .pipeline()
      .lpush("rag:embed_times", ms)
      .ltrim("rag:embed_times", 0, 99) // keep last 100 samples
      .exec();
    return response.data[0]?.embedding ?? [];
  }
}
