import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from '../app.module';
import { LLM_PROVIDER } from '../modules/chat/domain/ports/llm-provider.port';
import { EMBEDDING_PROVIDER } from '../modules/chat/domain/ports/embedding-provider.port';

// Builds a full NestJS test application with real DB/Redis (via Testcontainers env vars)
// but with external API providers (LLM, embeddings) mocked so tests are deterministic.
export async function buildTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(LLM_PROVIDER)
    .useValue({
      chatWithTools: jest.fn().mockResolvedValue({
        content: 'Hammad uses NestJS, PostgreSQL, and Redis.',
        toolCalls: [],
      }),
    })
    .overrideProvider(EMBEDDING_PROVIDER)
    .useValue({
      embed: jest.fn().mockResolvedValue(new Array(1536).fill(0.1)),
    })
    .compile();

  const app = moduleRef.createNestApplication();
  app.useWebSocketAdapter(new IoAdapter(app));
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.init();
  return app;
}
