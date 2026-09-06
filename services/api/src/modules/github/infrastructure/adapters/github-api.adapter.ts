import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../../../infrastructure/redis/redis.module';
import type {
  IGitHubProvider,
  GitHubData,
  GitHubRepo,
  GitHubActivity,
} from '../../domain/ports/github-provider.port';

const NULL_SENTINEL = '__NULL__';
const NULL_CACHE_TTL = 300; // 5 minutes for null/error state

interface GitHubApiUser {
  login: string;
  name: string | null;
  public_repos: number;
  followers: number;
}

interface GitHubApiRepo {
  name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  html_url: string;
  updated_at: string;
}

interface GitHubApiEvent {
  type: string;
  repo: { name: string };
  payload: {
    commits?: { message: string }[];
    action?: string;
    ref?: string;
  };
  created_at: string;
}

@Injectable()
export class GitHubApiAdapter implements IGitHubProvider {
  private readonly username: string;
  private readonly token: string;
  private readonly cacheTtl: number;
  private readonly cacheKey = 'github:data';

  constructor(
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    this.username = this.config.get<string>('GITHUB_USERNAME') ?? '';
    this.token = this.config.get<string>('GITHUB_TOKEN') ?? '';
    this.cacheTtl = this.config.get<number>('GITHUB_CACHE_TTL_SECONDS') ?? 3600;
    console.log(`[GitHub] Adapter init: username="${this.username}" token="${this.token ? this.token.slice(0,12)+'...' : 'EMPTY'}"`);
  }

  async getData(): Promise<GitHubData | null> {
    // Graceful no-token state: return null immediately
    if (!this.token || !this.username) {
      return null;
    }

    // Check cache
    const cached = await this.redis.get(this.cacheKey);
    if (cached !== null) {
      if (cached === NULL_SENTINEL) return null;
      return JSON.parse(cached) as GitHubData;
    }

    // Fetch from GitHub REST API v3
    try {
      const headers = {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      };

      const graphqlHeaders = {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      };

      // Explicit from/to = last 365 days up to today.
      // Without these, GitHub uses the account anniversary year which can exclude
      // recent months (e.g. June activity missing when anniversary is in July).
      const now = new Date();
      const oneYearAgo = new Date(now);
      oneYearAgo.setFullYear(now.getFullYear() - 1);
      const fromISO = oneYearAgo.toISOString();
      const toISO = now.toISOString();

      const contributionQuery = `{
        user(login: "${this.username}") {
          contributionsCollection(from: "${fromISO}", to: "${toISO}") {
            contributionCalendar {
              totalContributions
              weeks {
                contributionDays {
                  contributionCount
                  date
                }
              }
            }
          }
        }
      }`;

      const [userRes, reposRes, eventsRes, graphqlRes] = await Promise.all([
        fetch(`https://api.github.com/users/${this.username}`, { headers }),
        fetch(
          `https://api.github.com/users/${this.username}/repos?sort=updated&per_page=8&type=public`,
          { headers },
        ),
        fetch(
          `https://api.github.com/users/${this.username}/events/public?per_page=10`,
          { headers },
        ),
        fetch('https://api.github.com/graphql', {
          method: 'POST',
          headers: graphqlHeaders,
          body: JSON.stringify({ query: contributionQuery }),
        }),
      ]);

      if (!userRes.ok || !reposRes.ok || !eventsRes.ok) {
        console.error(`[GitHub] API status: user=${userRes.status} repos=${reposRes.status} events=${eventsRes.status}`);
        const errBody = await (!userRes.ok ? userRes : !reposRes.ok ? reposRes : eventsRes).text();
        console.error(`[GitHub] Error body: ${errBody.slice(0, 300)}`);
        await this.cacheNull();
        return null;
      }

      const [user, repos, events] = await Promise.all([
        userRes.json() as Promise<GitHubApiUser>,
        reposRes.json() as Promise<GitHubApiRepo[]>,
        eventsRes.json() as Promise<GitHubApiEvent[]>,
      ]);

      // Parse GraphQL contribution data (non-fatal if it fails)
      let contributions: GitHubData['contributions'] = null;
      try {
        if (graphqlRes.ok) {
          const gql = await graphqlRes.json() as {
            data?: {
              user?: {
                contributionsCollection?: {
                  contributionCalendar?: {
                    totalContributions: number;
                    weeks: { contributionDays: { contributionCount: number; date: string }[] }[];
                  };
                };
              };
            };
          };
          const cal = gql.data?.user?.contributionsCollection?.contributionCalendar;
          if (cal) {
            contributions = {
              totalThisYear: cal.totalContributions,
              weeks: cal.weeks.map((w) =>
                w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount })),
              ),
            };
          }
        } else {
          console.warn(`[GitHub] GraphQL contributions returned ${graphqlRes.status} — heatmap will be hidden`);
        }
      } catch (e) {
        console.warn(`[GitHub] GraphQL parse error: ${String(e)}`);
      }

      const mappedRepos: GitHubRepo[] = repos.map((r) => ({
        name: r.name,
        description: r.description,
        language: r.language,
        stars: r.stargazers_count,
        url: r.html_url,
        updatedAt: r.updated_at,
      }));

      const recentActivity: GitHubActivity[] = events
        .filter((e) => e.type !== null)
        .map((e) => {
          let message = '';
          if (e.type === 'PushEvent' && e.payload.commits?.length) {
            message = e.payload.commits[0].message.split('\n')[0];
          } else if (e.type === 'CreateEvent' && e.payload.ref) {
            message = `Created ref: ${e.payload.ref}`;
          } else if (e.payload.action) {
            message = e.payload.action;
          }
          return {
            type: e.type,
            repo: e.repo.name,
            message,
            createdAt: e.created_at,
          };
        });

      // Language breakdown — aggregate across repos
      const langCounts: Record<string, number> = {};
      for (const repo of repos) {
        if (repo.language) {
          langCounts[repo.language] = (langCounts[repo.language] ?? 0) + 1;
        }
      }
      const total = Object.values(langCounts).reduce((s, n) => s + n, 0);
      const languages =
        total === 0
          ? []
          : Object.entries(langCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([name, count]) => ({
                name,
                percent: Math.round((count / total) * 100),
              }));

      const data: GitHubData = {
        profile: {
          login: user.login,
          name: user.name,
          publicRepos: user.public_repos,
          followers: user.followers,
        },
        repos: mappedRepos,
        recentActivity,
        languages,
        contributions,
      };

      await this.redis.setex(this.cacheKey, this.cacheTtl, JSON.stringify(data));
      return data;
    } catch (err) {
      console.error(`[GitHub] Fetch exception: ${String(err)}`);
      await this.cacheNull();
      return null;
    }
  }

  async invalidateCache(): Promise<void> {
    await this.redis.del(this.cacheKey);
  }

  private async cacheNull(): Promise<void> {
    await this.redis.setex(this.cacheKey, NULL_CACHE_TTL, NULL_SENTINEL);
  }
}
