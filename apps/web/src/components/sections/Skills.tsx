"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { SectionReveal } from "@/components/SectionReveal";
import type { SkillDto } from "@portfolio/types";

// ── Spotlight bar: wide horizontal segments shown on feature cards ────────────
function SpotlightBar({ level }: { level: number }) {
  return (
    <div className="flex gap-1 mt-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={`h-[3px] flex-1 rounded-full transition-colors ${
            i < level ? "bg-signal" : "bg-ink-600"
          }`}
        />
      ))}
    </div>
  );
}

// ── Tiny proficiency dots used inside chips ───────────────────────────────────
function ProficiencyDots({ level }: { level: number }) {
  return (
    <span className="inline-flex gap-0.5 ml-1.5 align-middle">
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={`inline-block w-1 h-1.5 rounded-sm ${
            i < level ? "bg-signal" : "bg-ink-600"
          }`}
        />
      ))}
    </span>
  );
}

export function Skills({ skills, categoryOrder = [] }: { skills: SkillDto[]; categoryOrder?: string[] }) {
  const reduced = useReducedMotion();

  // Spotlight: featured skills first (admin-curated), fill remaining slots by proficiency/category
  const spotlight = (() => {
    const featured = skills.filter(s => s.featured).slice(0, 4);
    if (featured.length >= 4) return featured;
    const seen = new Set(featured.map(s => s.category));
    const sorted = [...skills]
      .filter(s => !s.featured)
      .sort((a, b) =>
        b.proficiencyLevel !== a.proficiencyLevel
          ? b.proficiencyLevel - a.proficiencyLevel
          : a.name.localeCompare(b.name)
      );
    const fills: typeof skills = [];
    for (const s of sorted) {
      if (!seen.has(s.category) && featured.length + fills.length < 4) {
        seen.add(s.category);
        fills.push(s);
      }
    }
    return [...featured, ...fills];
  })();

  // Use sortOrder from categories API; fall back to first-seen order for any uncategorised skills
  const seenCats = [...new Set(skills.map((s) => s.category))];
  const ordered = categoryOrder.length
    ? [...categoryOrder.filter(c => seenCats.includes(c)), ...seenCats.filter(c => !categoryOrder.includes(c))]
    : seenCats;
  const categories = ordered;

  const grouped = categories.reduce<Record<string, SkillDto[]>>((acc, cat) => {
    acc[cat] = skills.filter((s) => s.category === cat);
    return acc;
  }, {});
  const [activeTab, setActiveTab] = useState<string>(categories[0] ?? "");
  const [highlightedSkill, setHighlightedSkill] = useState<string | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listen for voice agent highlight-skill events
  useEffect(() => {
    const handler = (e: Event) => {
      const skill = (e as CustomEvent<{ skill: string }>).detail?.skill;
      if (!skill) return;
      // Find which tab contains this skill and switch to it
      for (const cat of categories) {
        const found = (grouped[cat] ?? []).find(s => s.name.toLowerCase() === skill.toLowerCase());
        if (found) { setActiveTab(cat); break; }
      }
      setHighlightedSkill(skill.toLowerCase());
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = setTimeout(() => setHighlightedSkill(null), 2500);
    };
    window.addEventListener("highlight-skill", handler);
    return () => {
      window.removeEventListener("highlight-skill", handler);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, [categories, grouped]);

  return (
    <section id="skills" className="py-24 md:py-32 border-t border-line overflow-x-hidden">
      <div className="max-w-content mx-auto px-6">

        {/* Header row — index label inline with heading, full width */}
        <SectionReveal>
          <div className="flex items-baseline gap-4 mb-10">
            <p className="section-index shrink-0">01 / SKILLS</p>
            <h2 className="text-display-l font-display text-text-hi">What I work with</h2>
          </div>
        </SectionReveal>

        <div className="space-y-10">
            {/* ── Spotlight cards ─────────────────────────────────────────── */}
            {spotlight.length > 0 && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 auto-rows-fr">
                {spotlight.map((skill, i) => (
                  <motion.div
                    key={skill.id}
                    initial={reduced ? false : { opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ duration: 0.4, delay: i * 0.08, ease: "easeOut" }}
                    className="flex flex-col bg-ink-800 border border-ink-600 rounded-xl p-4 hover:border-signal/30 transition-colors"
                  >
                    <p className="section-index mb-2 line-clamp-1">
                      {skill.category}
                    </p>
                    <p className="font-display text-h3 text-text-hi leading-tight line-clamp-2 flex-1">{skill.name}</p>
                    <SpotlightBar level={skill.proficiencyLevel} />
                  </motion.div>
                ))}
              </div>
            )}

            {/* ── Tabbed full list ─────────────────────────────────────────── */}
            {categories.length > 0 && (
              <SectionReveal delay={0.15}>
                <div>
                  {/* Tab strip */}
                  <div className="relative border-b border-line overflow-x-auto no-scrollbar">
                    <div role="tablist" className="flex min-w-max">
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          role="tab"
                          aria-selected={activeTab === cat}
                          onClick={() => setActiveTab(cat)}
                          className={`relative px-4 py-2.5 font-mono text-mono-label uppercase tracking-widest whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal focus-visible:ring-inset ${
                            activeTab === cat
                              ? "text-text-hi"
                              : "text-text-lo hover:text-text-mid"
                          }`}
                        >
                          {cat}
                          {activeTab === cat && (
                            <motion.div
                              layoutId="tab-underline"
                              className="absolute bottom-0 left-0 right-0 h-px bg-signal"
                              transition={{ duration: 0.2, ease: "easeOut" }}
                            />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tab content */}
                  <div className="pt-5 min-h-[96px]">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeTab}
                        initial={reduced ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        {...(reduced ? {} : { exit: { opacity: 0, y: -6 } })}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        className="flex flex-wrap gap-2"
                      >
                        {(grouped[activeTab] ?? []).map((skill) => {
                          const isHighlighted = highlightedSkill === skill.name.toLowerCase();
                          return (
                            <motion.span
                              key={skill.id}
                              animate={isHighlighted ? { scale: [1, 1.06, 1] } : {}}
                              transition={{ duration: 0.4 }}
                              className={`inline-flex items-center rounded font-mono text-mono-label px-3 py-1.5 transition-all duration-300 ${
                                isHighlighted
                                  ? "bg-signal/10 border border-signal text-text-hi"
                                  : "bg-ink-800 border border-ink-600 text-text-mid hover:border-signal/40"
                              }`}
                            >
                              {skill.name}
                              <ProficiencyDots level={skill.proficiencyLevel} />
                            </motion.span>
                          );
                        })}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              </SectionReveal>
            )}

            {skills.length === 0 && (
              <p className="text-text-lo font-mono text-mono-label">Skills loading from API…</p>
            )}
        </div>
      </div>
    </section>
  );
}
