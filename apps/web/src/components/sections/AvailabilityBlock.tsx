"use client";
import { SectionReveal } from "@/components/SectionReveal";

interface AvailabilityData {
  status: "open" | "not-looking" | "selective";
  statusLabel: string;
  location: string;
  hours: string;
  notice: string;
  response: string;
}

const DEFAULT: AvailabilityData = {
  status: "open",
  statusLabel: "Open to senior backend / full-stack remote roles",
  location: "Karachi, Pakistan · PKT (UTC+5)",
  hours: "Available across US / EU / UK business hours",
  notice: "Available immediately",
  response: "Same business day",
};

export function AvailabilityBlock({ data = DEFAULT }: { data?: AvailabilityData }) {
  const isOpen = data.status === "open";
  const rows = [
    { label: "STATUS",   value: data.statusLabel, highlight: true },
    { label: "LOCATION", value: data.location },
    { label: "HOURS",    value: data.hours },
    { label: "NOTICE",   value: data.notice },
    { label: "RESPONSE", value: data.response },
  ];

  return (
    <section id="availability" className="py-24 md:py-32 border-t border-line overflow-hidden">
      <div className="max-w-content mx-auto px-6">
        <div className="flex flex-col gap-6 md:grid md:grid-cols-[140px_1fr] md:gap-10 md:items-start">

          {/* Left column - section index (desktop only) */}
          <div className="hidden md:block">
            <SectionReveal>
              <p className="section-index">04 / AVAILABILITY</p>
            </SectionReveal>
          </div>

          {/* Right column - content */}
          <div className="space-y-6 min-w-0">
            <SectionReveal>
              <p className="section-index md:hidden mb-2">04 / AVAILABILITY</p>
              <div className="flex items-center gap-3">
                <span className={isOpen
                  ? "w-2 h-2 rounded-full bg-signal animate-pulse-lime flex-shrink-0"
                  : "w-2 h-2 rounded-full bg-text-lo flex-shrink-0"}
                />
                <h2 className="text-display-l font-display text-text-hi">
                  {isOpen ? "Available for hire" : "Not currently looking"}
                </h2>
              </div>
            </SectionReveal>

            <SectionReveal delay={0.05}>
              <div className="bg-ink-800 border border-ink-600 rounded-card divide-y divide-line">
                {rows.map(({ label, value, highlight }) => (
                  <div key={label} className="grid grid-cols-[6rem_1fr] sm:grid-cols-[8rem_1fr] gap-4 px-5 py-4 items-baseline">
                    <span className="font-mono text-xs text-text-lo uppercase tracking-widest">
                      {label}
                    </span>
                    <span className={`text-base break-words leading-relaxed ${highlight && isOpen ? "text-signal font-mono" : "text-text-mid"}`}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </SectionReveal>
          </div>
        </div>
      </div>
    </section>
  );
}
