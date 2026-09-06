"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { revalidate } from "@/lib/revalidate";
import { apiFetch } from "@/lib/admin-api";
import { PageHeader } from "@/components/admin/PageHeader";
import { SaveButton } from "@/components/admin/SaveButton";

type HeroContent = {
  headline: string;
  subheadline: string;
  ctaPrimary: string;
  ctaPrimaryHref: string;
  ctaSecondary: string;
  ctaSecondaryHref: string;
};
type AboutContent = { narrative: string };
type AvailabilityContent = {
  status: "open" | "not-looking" | "selective";
  statusLabel: string;
  location: string;
  hours: string;
  notice: string;
  response: string;
};

const SECTION_OPTIONS = [
  { label: "Projects",     value: "#projects" },
  { label: "Skills",       value: "#skills" },
  { label: "Experience",   value: "#experience" },
  { label: "GitHub",       value: "#open-source" },
  { label: "Availability", value: "#availability" },
  { label: "Contact",      value: "#contact" },
];

const HERO_DEFAULTS: HeroContent = {
  headline: "", subheadline: "",
  ctaPrimary: "View Work", ctaPrimaryHref: "#projects",
  ctaSecondary: "Get in Touch", ctaSecondaryHref: "#contact",
};

export default function SiteContentPage() {
  const [hero, setHero] = useState<HeroContent>(HERO_DEFAULTS);
  const [about, setAbout] = useState<AboutContent>({ narrative: "" });
  const [availability, setAvailability] = useState<AvailabilityContent>({
    status: "open", statusLabel: "Open to senior backend / full-stack remote roles",
    location: "Karachi, Pakistan · PKT (UTC+5)", hours: "Available across US / EU / UK business hours",
    notice: "Available immediately", response: "Same business day",
  });
  const [fetching, setFetching]         = useState(true);
  const [savingHero, setSavingHero]     = useState(false);
  const [savingAbout, setSavingAbout]   = useState(false);
  const [savingAvail, setSavingAvail]   = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch<HeroContent>("/content/site/hero").then((v) => { if (v) setHero({ ...HERO_DEFAULTS, ...v }); }),
      apiFetch<AboutContent>("/content/site/about").then((v) => { if (v) setAbout(v); }),
      apiFetch<AvailabilityContent>("/content/site/availability").then((v) => { if (v) setAvailability(v); }),
    ])
      .catch(() => toast.error("Failed to load site content"))
      .finally(() => setFetching(false));
  }, []);

  async function saveHero() {
    setSavingHero(true);
    try {
      await apiFetch("/content/site/hero", { method: "PUT", body: JSON.stringify({ value: hero }) });
      void revalidate("hero");
      toast.success("Hero saved — public site updating");
    } catch {
      toast.error("Failed to save hero");
    } finally {
      setSavingHero(false);
    }
  }

  async function saveAbout() {
    setSavingAbout(true);
    try {
      await apiFetch("/content/site/about", { method: "PUT", body: JSON.stringify({ value: about }) });
      void revalidate("about");
      toast.success("About saved — public site updating");
    } catch {
      toast.error("Failed to save about");
    } finally {
      setSavingAbout(false);
    }
  }

  async function saveAvailability() {
    setSavingAvail(true);
    try {
      await apiFetch("/content/site/availability", { method: "PUT", body: JSON.stringify({ value: availability }) });
      void revalidate("availability");
      toast.success("Availability saved — public site updating");
    } catch {
      toast.error("Failed to save availability");
    } finally {
      setSavingAvail(false);
    }
  }

  return (
    <div>
      <PageHeader index="00 / SITE CONTENT" title="Site Content" />

      {fetching && (
        <div className="mb-6 flex items-center gap-2.5 font-mono text-mono-label text-text-lo">
          <span className="inline-block w-2 h-2 rounded-full bg-signal animate-pulse flex-shrink-0" />
          Loading current values…
        </div>
      )}

      <div className={`space-y-8 transition-opacity duration-200 ${fetching ? "opacity-50 pointer-events-none select-none" : ""}`}>
        {/* Hero */}
        <div className="bg-ink-800 border border-ink-600 rounded-card p-6">
          <h2 className="font-mono text-mono-label text-text-lo uppercase tracking-widest mb-4">Hero Section</h2>
          <div className="space-y-4">
            {(["headline", "subheadline"] as const).map((key) => (
              <div key={key}>
                <label className="block font-mono text-mono-label text-text-lo uppercase tracking-widest mb-1">
                  {key === "headline" ? "Headline" : "Subheadline"}
                </label>
                <input
                  value={hero[key]}
                  onChange={(e) => setHero({ ...hero, [key]: e.target.value })}
                  className="w-full bg-ink-900 border border-ink-600 rounded-btn px-3 py-2 text-text-hi"
                />
              </div>
            ))}

            <div className="bg-ink-900 border border-ink-600 rounded-btn p-4 space-y-3">
              <p className="font-mono text-mono-label text-signal uppercase tracking-widest">Primary CTA</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-mono-label text-text-lo uppercase tracking-widest mb-1 text-xs">Label</label>
                  <input value={hero.ctaPrimary} onChange={(e) => setHero({ ...hero, ctaPrimary: e.target.value })}
                    placeholder="View Work" className="w-full bg-ink-800 border border-ink-600 rounded-btn px-3 py-2 text-text-hi text-sm" />
                </div>
                <div>
                  <label className="block font-mono text-mono-label text-text-lo uppercase tracking-widest mb-1 text-xs">Navigates to</label>
                  <select value={hero.ctaPrimaryHref} onChange={(e) => setHero({ ...hero, ctaPrimaryHref: e.target.value })}
                    className="w-full bg-ink-800 border border-ink-600 rounded-btn px-3 py-2 text-text-hi text-sm">
                    {SECTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-ink-900 border border-ink-600 rounded-btn p-4 space-y-3">
              <p className="font-mono text-mono-label text-text-mid uppercase tracking-widest">Secondary CTA</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-mono-label text-text-lo uppercase tracking-widest mb-1 text-xs">Label</label>
                  <input value={hero.ctaSecondary} onChange={(e) => setHero({ ...hero, ctaSecondary: e.target.value })}
                    placeholder="Get in Touch" className="w-full bg-ink-800 border border-ink-600 rounded-btn px-3 py-2 text-text-hi text-sm" />
                </div>
                <div>
                  <label className="block font-mono text-mono-label text-text-lo uppercase tracking-widest mb-1 text-xs">Navigates to</label>
                  <select value={hero.ctaSecondaryHref} onChange={(e) => setHero({ ...hero, ctaSecondaryHref: e.target.value })}
                    className="w-full bg-ink-800 border border-ink-600 rounded-btn px-3 py-2 text-text-hi text-sm">
                    {SECTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <span className="inline-flex items-center justify-center bg-signal text-signal-ink font-mono text-mono-label uppercase tracking-widest rounded-btn px-5 py-2 text-xs opacity-80">
                {hero.ctaPrimary || "View Work"} → {hero.ctaPrimaryHref}
              </span>
              <span className="inline-flex items-center justify-center border border-ink-600 text-text-mid font-mono text-mono-label uppercase tracking-widest rounded-btn px-5 py-2 text-xs opacity-80">
                {hero.ctaSecondary || "Get in Touch"} → {hero.ctaSecondaryHref}
              </span>
            </div>

            <SaveButton loading={savingHero} onClick={() => void saveHero()} type="button">Save Hero</SaveButton>
          </div>
        </div>

        {/* About */}
        <div className="bg-ink-800 border border-ink-600 rounded-card p-6">
          <h2 className="font-mono text-mono-label text-text-lo uppercase tracking-widest mb-4">About / Story</h2>
          <div className="space-y-4">
            <div>
              <label className="block font-mono text-mono-label text-text-lo uppercase tracking-widest mb-1">Narrative</label>
              <textarea
                rows={8}
                value={about.narrative}
                onChange={(e) => setAbout({ narrative: e.target.value })}
                className="w-full bg-ink-900 border border-ink-600 rounded-btn px-3 py-2 text-text-hi font-body"
              />
            </div>
            <SaveButton loading={savingAbout} onClick={() => void saveAbout()} type="button">Save About</SaveButton>
          </div>
        </div>

        {/* Availability */}
        <div className="bg-ink-800 border border-ink-600 rounded-card p-6">
          <h2 className="font-mono text-mono-label text-text-lo uppercase tracking-widest mb-4">Availability &amp; Fit Status</h2>
          <div className="space-y-4">
            <div>
              <label className="block font-mono text-mono-label text-text-lo uppercase tracking-widest mb-1">Status</label>
              <select
                value={availability.status}
                onChange={(e) => setAvailability({ ...availability, status: e.target.value as AvailabilityContent["status"] })}
                className="w-full bg-ink-900 border border-ink-600 rounded-btn px-3 py-2 text-text-hi"
              >
                <option value="open">Open</option>
                <option value="selective">Selective</option>
                <option value="not-looking">Not Looking</option>
              </select>
            </div>
            {([
              ["Status Label", "statusLabel"],
              ["Location", "location"],
              ["Hours / Timezone Overlap", "hours"],
              ["Notice Period", "notice"],
              ["Response Time", "response"],
            ] as const).map(([label, key]) => (
              <div key={key}>
                <label className="block font-mono text-mono-label text-text-lo uppercase tracking-widest mb-1">{label}</label>
                <input
                  value={availability[key]}
                  onChange={(e) => setAvailability({ ...availability, [key]: e.target.value })}
                  className="w-full bg-ink-900 border border-ink-600 rounded-btn px-3 py-2 text-text-hi"
                />
              </div>
            ))}
            <SaveButton loading={savingAvail} onClick={() => void saveAvailability()} type="button">Save Availability</SaveButton>
          </div>
        </div>
      </div>
    </div>
  );
}
