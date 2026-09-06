import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { execSync } from 'child_process';
import * as path from 'path';

let pg: StartedPostgreSqlContainer;
let redis: StartedRedisContainer;

export async function startContainers(): Promise<void> {
  [pg, redis] = await Promise.all([
    new PostgreSqlContainer('pgvector/pgvector:pg17').start(),
    new RedisContainer('redis:7-alpine').start(),
  ]);

  process.env['DATABASE_URL'] =
    `postgresql://${pg.getUsername()}:${pg.getPassword()}@${pg.getHost()}:${pg.getMappedPort(5432)}/${pg.getDatabase()}?schema=public`;
  process.env['REDIS_URL'] =
    `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`;

  // Provide dummy values for required config vars
  process.env['JWT_SECRET']          = 'test-jwt-secret-min-32-chars-long!!';
  process.env['ADMIN_EMAIL']         = 'admin@test.com';
  process.env['ADMIN_PASSWORD_HASH'] = '$2a$12$MrxOE/FZX6caJSQYS/IRYu7aIuu2dnvzapyNg30s71W6yg6nIpp8u';
  process.env['ALLOWED_ORIGINS']     = 'http://localhost:3000';
  process.env['REVALIDATE_SECRET']   = 'test-revalidate-secret';
  process.env['OPENROUTER_API_KEY']  = 'test-key';
  process.env['GITHUB_TOKEN']        = 'test-token';
  process.env['GITHUB_USERNAME']     = 'test-user';
  process.env['RP_ID']               = 'localhost';
  process.env['RP_ORIGIN']           = 'http://localhost:3000';

  // Apply Prisma migrations to the test database
  const apiDir = path.resolve(__dirname, '..', '..', '..');
  const prismaBin = path.join(apiDir, 'node_modules', '.bin', 'prisma');
  execSync(`"${prismaBin}" migrate deploy`, {
    cwd: apiDir,
    env: { ...process.env },
    stdio: 'pipe',
  });
}

export async function stopContainers(): Promise<void> {
  await Promise.all([pg?.stop(), redis?.stop()]);
}

export async function clearDatabase(prisma: { $transaction: (...args: unknown[]) => Promise<unknown> }): Promise<void> {
  // Delete in dependency order (children before parents)
  await prisma.$transaction([
    (prisma as any).chatMessage.deleteMany(),
    (prisma as any).chatSession.deleteMany(),
    (prisma as any).analyticsEvent.deleteMany(),
    (prisma as any).kBDocument.deleteMany(),
    (prisma as any).skill.deleteMany(),
    (prisma as any).experience.deleteMany(),
    (prisma as any).project.deleteMany(),
    (prisma as any).caseStudy.deleteMany(),
    (prisma as any).passkeyCredential.deleteMany(),
  ]);
}
