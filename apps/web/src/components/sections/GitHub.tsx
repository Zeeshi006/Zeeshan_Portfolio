import { SectionReveal, StaggerChildren, StaggerItem } from "@/components/SectionReveal";
import { ContributionHeatmap } from "@/components/ContributionHeatmap";
import { trackConversion } from "@/lib/analytics";

interface GitHubRepo {
  name: string;
  description: string | null;
  language: string | null;
  stars: number;
  url: string;
  updatedAt: string;
}

interface GitHubActivity {
  type: string;
  repo: string;
  message: string;
  createdAt: string;
}

interface GitHubData {
  profile: {
    login: string;
    name: string | null;
    publicRepos: number;
    followers: number;
  };
  repos: GitHubRepo[];
  recentActivity: GitHubActivity[];
  languages: { name: string; percent: number }[];
  contributions: {
    totalThisYear: number;
    weeks: { date: string; count: number }[][];
  } | null;
}

function relativeDate(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function formatEventType(type: string): string {
  switch (type) {
    case "PushEvent": return "PUSH";
    case "PullRequestEvent": return "PR";
    case "CreateEvent": return "CREATE";
    case "IssuesEvent": return "ISSUE";
    case "ForkEvent": return "FORK";
    case "WatchEvent": return "STAR";
    case "ReleaseEvent": return "RELEASE";
    default: return type.replace("Event", "").toUpperCase();
  }
}

function RepoCard({ repo }: { repo: GitHubRepo }) {
  return (
    <a
      href={repo.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackConversion("github_repo_click", { name: repo.name, url: repo.url })}
      className="group block bg-ink-800 border border-ink-600 rounded-card p-6 hover:border-signal/40 hover:-translate-y-1 transition-all duration-200"
    >
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-h3 font-display text-text-hi group-hover:text-signal transition-colors truncate mr-2">
          {repo.name}
        </h3>
        <span className="font-mono text-mono-label text-signal opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity shrink-0">
          → VIEW
        </span>
      </div>

      {repo.description && (
        <p className="text-small text-text-mid mb-4 line-clamp-2">{repo.description}</p>
      )}

      <div className="flex items-center gap-3 mt-auto">
        {repo.language && (
          <span className="font-mono text-mono-label text-text-lo bg-ink-900 border border-line rounded px-2 py-0.5">
            {repo.language}
          </span>
        )}
        {repo.stars > 0 && (
          <span className="font-mono text-mono-label text-signal">
            ★ {repo.stars}
          </span>
        )}
        <span className="font-mono text-mono-label text-text-lo ml-auto">
          {relativeDate(repo.updatedAt)}
        </span>
      </div>
    </a>
  );
}

function ActivityRow({ activity }: { activity: GitHubActivity }) {
  const repoName = activity.repo.includes("/")
    ? activity.repo.split("/")[1]
    : activity.repo;

  return (
    <div className="flex items-start gap-3 py-3 border-b border-line last:border-0">
      <span className="font-mono text-mono-label text-signal bg-signal/10 border border-signal/20 rounded px-1.5 py-0.5 shrink-0 mt-0.5">
        {formatEventType(activity.type)}
      </span>
      <div className="flex-1 min-w-0">
        <span className="font-mono text-mono-label text-text-mid">{repoName}</span>
        {activity.message && (
          <p className="text-small text-text-lo mt-0.5 truncate">{activity.message}</p>
        )}
      </div>
      <span className="font-mono text-mono-label text-text-lo shrink-0">
        {relativeDate(activity.createdAt)}
      </span>
    </div>
  );
}

export function GitHub({ data }: { data: GitHubData | null }) {
  if (!data) return null;
  // NEXT_PUBLIC_GITHUB_FULL=true = full section
  // NEXT_PUBLIC_GITHUB_FULL=false (default) = heatmap only
  const fullMode = process.env.NEXT_PUBLIC_GITHUB_FULL === "true";

  return (
    <section id="open-source" className="py-24 md:py-32 border-t border-line overflow-hidden">
      <div className="max-w-content mx-auto px-6">
        <div className="flex flex-col gap-6 md:grid md:grid-cols-[140px_1fr] md:gap-10 md:items-start">
          <div className="hidden md:block">
            <SectionReveal>
              <p className="section-index">05 / GITHUB</p>
            </SectionReveal>
          </div>

          <div className="space-y-12 min-w-0">
            {/* Heading + profile stats — always shown */}
            <SectionReveal>
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div>
                  <p className="section-index md:hidden mb-2">05 / GITHUB</p>
                  <h2 className="text-[1.75rem] sm:text-[2.25rem] md:text-display-l font-display text-text-hi">GitHub Activity</h2>
                  <p className="font-mono text-small text-text-mid mt-1">
                    All contributions — public &amp; private repos
                  </p>
                </div>
                {fullMode && (
                  <div className="flex gap-6">
                    <div>
                      <p className="font-mono text-mono-label text-text-lo uppercase tracking-widest">Repos</p>
                      <p className="font-mono text-h3 text-signal">{data.profile.publicRepos}</p>
                    </div>
                    <div>
                      <p className="font-mono text-mono-label text-text-lo uppercase tracking-widest">Followers</p>
                      <p className="font-mono text-h3 text-signal">{data.profile.followers}</p>
                    </div>
                  </div>
                )}
              </div>
            </SectionReveal>

            {/* Language breakdown — full mode only */}
            {fullMode && data.languages.length > 0 && (
              <SectionReveal>
                <div>
                  <p className="section-index mb-3">LANGUAGES</p>
                  <div className="flex flex-wrap gap-2">
                    {data.languages.map((lang) => (
                      <span key={lang.name}
                        className="inline-flex items-center gap-1.5 bg-ink-800 border border-ink-600 rounded font-mono text-mono-label text-text-mid px-3 py-1.5">
                        {lang.name}
                        <span className="text-signal">{lang.percent}%</span>
                      </span>
                    ))}
                  </div>
                </div>
              </SectionReveal>
            )}

            {/* Contribution heatmap — always shown */}
            {data.contributions && (
              <SectionReveal>
                <div className="bg-ink-800 border border-ink-600 rounded-card p-4 sm:p-6 min-w-0 overflow-hidden">
                  <ContributionHeatmap
                    weeks={data.contributions.weeks}
                    totalThisYear={data.contributions.totalThisYear}
                  />
                </div>
              </SectionReveal>
            )}

            {/* Repo cards — full mode only */}
            {fullMode && data.repos.length > 0 && (
              <div>
                <SectionReveal>
                  <p className="section-index mb-4">RECENT REPOS</p>
                </SectionReveal>
                <StaggerChildren className="grid sm:grid-cols-2 gap-4">
                  {data.repos.map((repo) => (
                    <StaggerItem key={repo.name}>
                      <RepoCard repo={repo} />
                    </StaggerItem>
                  ))}
                </StaggerChildren>
              </div>
            )}

            {/* Activity feed — full mode only */}
            {fullMode && data.recentActivity.length > 0 && (
              <SectionReveal>
                <div className="bg-ink-800 border border-ink-600 rounded-card p-6">
                  <p className="section-index mb-4">RECENT ACTIVITY</p>
                  <div>
                    {data.recentActivity.map((activity, i) => (
                      <ActivityRow key={`${activity.type}-${activity.createdAt}-${i}`} activity={activity} />
                    ))}
                  </div>
                </div>
              </SectionReveal>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
