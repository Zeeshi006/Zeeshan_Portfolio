import { SectionReveal } from "@/components/SectionReveal";
import type { ExperienceDto } from "@portfolio/types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function Experience({ experiences }: { experiences: ExperienceDto[] }) {
  return (
    <section id="experience" className="py-24 md:py-32 border-t border-line overflow-hidden">
      <div className="max-w-content mx-auto px-6">
        <div className="flex flex-col gap-6 md:grid md:grid-cols-[140px_1fr] md:gap-10 md:items-start">
          <div className="hidden md:block">
            <SectionReveal>
              <p className="section-index">02 / Experience</p>
            </SectionReveal>
          </div>

          <div className="space-y-10">
            <SectionReveal>
              <h2 className="text-display-l font-display text-text-hi">Where I&apos;ve worked</h2>
            </SectionReveal>

            <div className="relative space-y-0">
              {/* Static timeline line */}
              <div className="absolute left-0 top-2 bottom-2 w-px bg-line" />

              {experiences.map((exp, i) => (
                <SectionReveal key={exp.id} delay={i * 0.07}>
                  <div className={`relative pl-8 ${i < experiences.length - 1 ? "pb-20" : "pb-0"}`}>
                    {/* Static dot */}
                    <div className="absolute w-2 h-2 rounded-full bg-signal" style={{ left: 0, top: '6px', transform: 'translateX(-50%)' }} />

                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-4">
                      <div>
                        <h3 className="text-h3 font-display text-text-hi">{exp.role}</h3>
                        <p className="font-mono text-xs text-signal uppercase tracking-widest mt-1">
                          {exp.company}
                        </p>
                      </div>
                      <p className="font-mono text-small text-text-mid flex-shrink-0">
                        {formatDate(exp.startDate)} — {exp.endDate ? formatDate(exp.endDate) : "Present"}
                      </p>
                    </div>

                    <p className="text-text-mid text-base leading-relaxed mb-6 max-w-2xl">{exp.summary}</p>

                    {exp.highlights.length > 0 && (
                      <ul className="space-y-3">
                        {exp.highlights.map((h, idx) => (
                          <li key={idx} className="flex gap-3 text-text-mid text-base leading-relaxed">
                            <span className="text-signal flex-shrink-0 mt-0.5">—</span>
                            <span>{h}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </SectionReveal>
              ))}

              {experiences.length === 0 && (
                <p className="pl-8 text-text-lo font-mono text-mono-label">Experience loading...</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
