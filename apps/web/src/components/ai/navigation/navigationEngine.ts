// navigationEngine.ts — Singleton that handles AI-driven page navigation.
// Finds sections by keyword, smooth-scrolls to them, and dispatches lifecycle events.

export interface SectionDef {
  id: string;
  label: string;
  keywords: string[];
}

// ---------------------------------------------------------------------------
// Section registry — edit keywords here to improve matching
// ---------------------------------------------------------------------------

const SECTIONS: SectionDef[] = [
  {
    id: "hero",
    label: "Introduction",
    keywords: [
      "hero",
      "home",
      "start",
      "top",
      "intro",
      "introduction",
      "beginning",
      "hammad",
      "who are you",
      "about",
    ],
  },
  {
    id: "skills",
    label: "Skills",
    keywords: [
      "skills",
      "skill",
      "technologies",
      "tech stack",
      "stack",
      "tools",
      "languages",
      "frameworks",
      "expertise",
      "proficiency",
      "what can you do",
      "capabilities",
      "nestjs",
      "nextjs",
      "typescript",
      "postgresql",
      "redis",
      "docker",
    ],
  },
  {
    id: "experience",
    label: "Experience",
    keywords: [
      "experience",
      "work",
      "career",
      "job",
      "employment",
      "history",
      "background",
      "roles",
      "positions",
      "worked",
      "companies",
      "resume",
      "cv",
      "years",
      "professional",
    ],
  },
  {
    id: "projects",
    label: "Projects",
    keywords: [
      "projects",
      "project",
      "portfolio",
      "work",
      "built",
      "case studies",
      "case study",
      "examples",
      "showcase",
      "demo",
      "crm",
      "saas",
      "platform",
      "apps",
      "applications",
    ],
  },
  {
    id: "availability",
    label: "Availability",
    keywords: [
      "availability",
      "available",
      "hire",
      "hiring",
      "open to work",
      "looking",
      "freelance",
      "contract",
      "full-time",
      "part-time",
      "remote",
      "location",
      "when",
      "status",
      "open",
    ],
  },
  {
    id: "contact",
    label: "Contact",
    keywords: [
      "contact",
      "reach",
      "email",
      "message",
      "get in touch",
      "talk",
      "connect",
      "linkedin",
      "github",
      "social",
      "say hello",
    ],
  },
];

// ---------------------------------------------------------------------------
// NavigationEngine — singleton
// ---------------------------------------------------------------------------

class NavigationEngine {
  private static _instance: NavigationEngine | null = null;
  private sectionElements: Map<string, Element> = new Map();
  private activeObserver: IntersectionObserver | null = null;
  private activeSectionId: string | null = null;

  // Prevent direct construction — use NavigationEngine.instance
  private constructor() {}

  static get instance(): NavigationEngine {
    if (!NavigationEngine._instance) {
      NavigationEngine._instance = new NavigationEngine();
    }
    return NavigationEngine._instance;
  }

  // -------------------------------------------------------------------------
  // init — call once when the page mounts (client-side only)
  // -------------------------------------------------------------------------

  init(): void {
    this.sectionElements.clear();

    for (const def of SECTIONS) {
      const el = document.getElementById(def.id);
      if (el) {
        this.sectionElements.set(def.id, el);
      }
    }

    // Track active section via IntersectionObserver
    if (this.activeObserver) {
      this.activeObserver.disconnect();
    }

    this.activeObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.activeSectionId = entry.target.id || null;
          }
        }
      },
      { threshold: 0.3 }
    );

    this.sectionElements.forEach((el) => {
      this.activeObserver!.observe(el);
    });
  }

  // -------------------------------------------------------------------------
  // findSection — keyword matching (case-insensitive, partial match)
  // -------------------------------------------------------------------------

  findSection(query: string): { id: string; label: string } | null {
    const q = query.toLowerCase().trim();
    if (!q) return null;

    let bestMatch: SectionDef | null = null;
    let bestScore = 0;

    for (const def of SECTIONS) {
      let score = 0;

      // Direct id match = highest confidence
      if (q === def.id) {
        score = 100;
      } else {
        for (const kw of def.keywords) {
          if (q === kw) {
            score = Math.max(score, 90);
          } else if (q.includes(kw) || kw.includes(q)) {
            score = Math.max(score, 60);
          } else {
            // Check individual words in the query against each keyword word
            const qWords = q.split(/\s+/);
            const kwWords = kw.split(/\s+/);
            for (const qw of qWords) {
              for (const kword of kwWords) {
                if (qw === kword) score = Math.max(score, 50);
                else if (kword.startsWith(qw) || qw.startsWith(kword)) score = Math.max(score, 30);
              }
            }
          }
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = def;
      }
    }

    if (!bestMatch || bestScore < 25) return null;

    return { id: bestMatch.id, label: bestMatch.label };
  }

  // -------------------------------------------------------------------------
  // navigateTo — smooth-scroll + lifecycle events
  // -------------------------------------------------------------------------

  async navigateTo(id: string): Promise<void> {
    const el = this.sectionElements.get(id) ?? document.getElementById(id);
    if (!el) {
      console.warn(`NavigationEngine: section #${id} not found in DOM`);
      return;
    }

    // Dispatch "ai-navigate" so AIPresence can react (switch to navigating state)
    window.dispatchEvent(
      new CustomEvent("ai-navigate", { detail: { section: id } })
    );

    // Perform the scroll
    el.scrollIntoView({ behavior: "smooth", block: "start" });

    // Wait for scroll to complete (approximated by transition duration + buffer)
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));

    // Dispatch "ai-arrived" so consumers know scrolling is complete
    window.dispatchEvent(
      new CustomEvent("ai-arrived", { detail: { section: id } })
    );
  }

  // -------------------------------------------------------------------------
  // getActiveSectionId
  // -------------------------------------------------------------------------

  getActiveSectionId(): string | null {
    return this.activeSectionId;
  }
}

// Export the singleton instance directly for convenience
export const navigationEngine = NavigationEngine.instance;
export default NavigationEngine;
