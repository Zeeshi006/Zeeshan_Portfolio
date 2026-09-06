import { SectionReveal } from "@/components/SectionReveal";

const STACK = [
  { layer: "Frontend", value: "Next.js 15 (App Router) + TypeScript strict" },
  {
    layer: "Backend",
    value: "NestJS — clean architecture, Swagger at /api/docs",
  },
  {
    layer: "Database",
    value: "PostgreSQL + pgvector (content, analytics, embeddings)",
  },
  {
    layer: "Cache / RT",
    value: "Redis + WebSockets — rate-limiting + live counter",
  },
  {
    layer: "AI",
    value: "DeepSeek V4 Flash via LLMProvider adapter (swappable)",
  },
  {
    layer: "Infra",
    value: "Contabo VPS — Docker Compose, nginx, automatic TLS",
  },
  {
    layer: "CI/CD",
    value: "GitHub Actions — lint → type-check → build → deploy",
  },
  { layer: "Monorepo", value: "Turborepo + pnpm workspaces" },
];

export function HowBuilt() {
  return (
    <section
      id="how-built"
      className="py-24 md:py-32 border-t border-line overflow-hidden"
    >
      <div className="max-w-content mx-auto px-6">
        <div className="flex flex-col gap-6 md:grid md:grid-cols-[200px_1fr] md:gap-16 md:items-start">
          <div className="hidden md:block">
            <SectionReveal>
              <p className="section-index">05 / How this is built</p>
            </SectionReveal>
          </div>

          <div className="space-y-10">
            <SectionReveal>
              <div>
                <h2 className="text-display-l font-display text-text-hi">
                  The meta-flex
                </h2>
                <p className="text-text-mid mt-3 max-w-2xl">
                  This site is deliberately over-engineered for a portfolio —
                  and that's the point. A recruiter for a backend role doesn't
                  need a CMS to read a bio. But when they open the admin panel,
                  see the clean module boundaries, watch the chatbot answer from
                  a real RAG pipeline, and notice the analytics tracking their
                  own visit — they're no longer reading claims about
                  architecture skills. They're using them.
                </p>
              </div>
            </SectionReveal>

            <SectionReveal delay={0.1}>
              <div className="bg-ink-800 border border-ink-600 rounded-card overflow-hidden">
                {STACK.map(({ layer, value }, i) => (
                  <div
                    key={layer}
                    className={`flex gap-6 px-6 py-4 ${i < STACK.length - 1 ? "border-b border-line" : ""}`}
                  >
                    <span className="font-mono text-mono-label text-text-lo uppercase tracking-widest w-32 flex-shrink-0">
                      {layer}
                    </span>
                    <span className="text-text-mid text-small">{value}</span>
                  </div>
                ))}
              </div>
            </SectionReveal>

            <SectionReveal delay={0.15}>
              <div className="flex flex-wrap gap-4">
                <a
                  href={`${process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001"}/api/docs`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center bg-signal text-signal-ink font-mono text-mono-label uppercase tracking-widest rounded-btn px-6 py-3 hover:bg-signal-dim active:scale-[0.98] transition-all"
                >
                  Live API Docs →
                </a>
                <a
                  href="https://github.com/HammadAfzalCode"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center border border-ink-600 text-text-hi font-mono text-mono-label uppercase tracking-widest rounded-btn px-6 py-3 hover:border-text-lo transition-all"
                >
                  GitHub →
                </a>
              </div>
            </SectionReveal>
          </div>
        </div>
      </div>
    </section>
  );
}
