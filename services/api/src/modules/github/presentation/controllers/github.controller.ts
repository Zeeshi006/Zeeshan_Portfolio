import { Controller, Delete, Get, HttpCode, HttpStatus, Inject, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import {
  GITHUB_PROVIDER,
  IGitHubProvider,
  GitHubData,
} from '../../domain/ports/github-provider.port';

@ApiTags('github')
@Controller('github')
export class GitHubController {
  constructor(
    @Inject(GITHUB_PROVIDER) private readonly github: IGitHubProvider,
  ) {}

  @Get()
  @ApiOperation({ summary: 'GitHub proof-of-work data (repos, activity, contributions)' })
  async getGitHubData(): Promise<GitHubData | null> {
    return this.github.getData();
  }

  @Delete('cache')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Invalidate GitHub Redis cache — next GET will re-fetch live from GitHub' })
  async invalidateCache(): Promise<{ ok: boolean; message: string }> {
    await this.github.invalidateCache();
    return { ok: true, message: 'GitHub cache cleared — next request will re-fetch from GitHub API' };
  }
}
