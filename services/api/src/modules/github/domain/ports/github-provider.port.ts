export const GITHUB_PROVIDER = Symbol('GITHUB_PROVIDER');

export interface GitHubRepo {
  name: string;
  description: string | null;
  language: string | null;
  stars: number;
  url: string;
  updatedAt: string;
}

export interface GitHubActivity {
  type: string;
  repo: string;
  message: string;
  createdAt: string;
}

export interface GitHubProfile {
  login: string;
  name: string | null;
  publicRepos: number;
  followers: number;
}

export interface ContributionDay {
  date: string;        // "2025-03-12"
  count: number;       // contribution count
}

export interface GitHubData {
  profile: GitHubProfile;
  repos: GitHubRepo[];
  recentActivity: GitHubActivity[];
  languages: { name: string; percent: number }[];
  contributions: {
    totalThisYear: number;
    weeks: ContributionDay[][];  // 52 weeks × up to 7 days
  } | null;
}

export interface IGitHubProvider {
  getData(): Promise<GitHubData | null>;
  invalidateCache(): Promise<void>;
}
