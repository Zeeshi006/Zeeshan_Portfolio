import { SectionReveal } from "@/components/SectionReveal";

const DEFAULT_NARRATIVE =
  "I solve hard problems in real-time systems and applied AI. Voice agents that work, knowledge bases that learn, architectures that don\u0027t collapse under load. I obsess over the constraints \u2014 latency, reliability, cost \u2014 because that\u0027s where the real engineering lives.";

export function About({ narrative }: { narrative: string }) {
  return (
    <section id="about" className="py-24 md:py-32 border-t border-line overflow-hidden">
      <div className="max-w-content mx-auto px-6">
        <div className="flex flex-col gap-6 md:grid md:grid-cols-[140px_1fr] md:gap-10 md:items-start">
          <div className="hidden md:block">
            <SectionReveal>
              <p className="section-index">00 / ABOUT</p>
            </SectionReveal>
          </div>
          <SectionReveal delay={0.1}>
            <h2 className="sr-only">About</h2>
            <p className="text-h2 font-display text-text-hi leading-snug max-w-2xl">
              {narrative || DEFAULT_NARRATIVE}
            </p>
          </SectionReveal>
        </div>
      </div>
    </section>
  );
}