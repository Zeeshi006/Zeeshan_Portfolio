import { Module } from '@nestjs/common';
import { GITHUB_PROVIDER } from './domain/ports/github-provider.port';
import { GitHubApiAdapter } from './infrastructure/adapters/github-api.adapter';
import { GitHubController } from './presentation/controllers/github.controller';

@Module({
  controllers: [GitHubController],
  providers: [
    { provide: GITHUB_PROVIDER, useClass: GitHubApiAdapter },
  ],
})
export class GitHubModule {}
