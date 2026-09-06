"use client";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

// ── Store ──────────────────────────────────────────────────────────────────────

type PaletteStore = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  _listeners: Set<() => void>;
};

const store: PaletteStore = {
  isOpen: false,
  open() { store.isOpen = true; store._listeners.forEach((fn) => fn()); },
  close() { store.isOpen = false; store._listeners.forEach((fn) => fn()); },
  _listeners: new Set(),
};

export function openPalette()  { store.open(); }
export function closePalette() { store.close(); }

export function usePaletteStore() {
  const [isOpen, setIsOpen] = useState(store.isOpen);
  useEffect(() => {
    const sync = () => setIsOpen(store.isOpen);
    store._listeners.add(sync);
    return () => { store._listeners.delete(sync); };
  }, []);
  return { isOpen, open: store.open, close: store.close };
}

// ── Types ──────────────────────────────────────────────────────────────────────

type Mode = "navigate" | "search";

type NavCommand = {
  id: string;
  label: string;
  description?: string;
  action: () => void;
};

type SearchHit = {
  type: "project" | "skill" | "experience" | "post";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  meta?: string;
};

type SearchResults = {
  projects: SearchHit[];
  skills: SearchHit[];
  experiences: SearchHit[];
  posts: SearchHit[];
  total: number;
};

// ── Nav helpers ────────────────────────────────────────────────────────────────

function navToSection(id: string) {
  const el = document.getElementById(id);
  if (el) { el.scrollIntoView({ behavior: "smooth" }); }
  else { window.location.href = `/#${id}`; }
}

// ── Nav commands ───────────────────────────────────────────────────────────────

const NAV_SECTIONS: NavCommand[] = [
  { id: "skills",       label: "Skills",       description: "Tech stack & proficiencies",   action: () => navToSection("skills") },
  { id: "experience",   label: "Experience",   description: "Work history & roles",          action: () => navToSection("experience") },
  { id: "projects",     label: "Projects",     description: "Selected work",                 action: () => navToSection("projects") },
  { id: "open-source",  label: "GitHub",       description: "Contribution activity & repos", action: () => navToSection("open-source") },
  { id: "availability", label: "Availability", description: "Hire status & timezone",        action: () => navToSection("availability") },
  { id: "contact",      label: "Contact",      description: "Get in touch",                  action: () => navToSection("contact") },
];

const NAV_ACTIONS: NavCommand[] = [
  { id: "chat",   label: "Open Chat",       description: "Ask the AI about Hammad", action: () => window.dispatchEvent(new CustomEvent("open-chat")) },
  { id: "resume", label: "Download Resume", description: "Open PDF resume",         action: () => window.open("/resume.pdf", "_blank") },
  { id: "blog",   label: "Writing",         description: "Technical blog posts",    action: () => { window.location.href = "/blog"; } },
];

// ── Recents ────────────────────────────────────────────────────────────────────

const ALL_COMMANDS = [...NAV_SECTIONS, ...NAV_ACTIONS];

function readRecents(): string[] {
  try { return JSON.parse(localStorage.getItem("palette_recents") ?? "[]") as string[]; }
  catch { return []; }
}

function writeRecent(id: string): void {
  try {
    const updated = [id, ...readRecents().filter((r) => r !== id)].slice(0, 3);
    localStorage.setItem("palette_recents", JSON.stringify(updated));
  } catch {}
}

function getRecentCommands(): NavCommand[] {
  return readRecents()
    .map((id) => ALL_COMMANDS.find((c) => c.id === id))
    .filter(Boolean) as NavCommand[];
}

// ── Search API URL ─────────────────────────────────────────────────────────────

const API_URL = typeof window !== "undefined"
  ? (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001")
  : "http://localhost:3001";

// ── Type icon labels ───────────────────────────────────────────────────────────

const TYPE_LABELS: Record<SearchHit["type"], string> = {
  project: "PROJ",
  skill: "SKILL",
  experience: "EXP",
  post: "POST",
};

// ── CommandPalette component ───────────────────────────────────────────────────

export function CommandPalette() {
  const { isOpen, close } = usePaletteStore();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef  = useRef<HTMLUListElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trimmed = query.trim();
  const mode: Mode = trimmed ? "search" : "navigate";

  // ── Navigate mode data ────────────────────────────────────────────────────────

  const recentCmds = useMemo(() => isOpen ? getRecentCommands() : [], [isOpen]);
  const recentIds  = useMemo(() => new Set(recentCmds.map((c) => c.id)), [recentCmds]);
  const flatNav: NavCommand[] = useMemo(() => [
    ...recentCmds,
    ...NAV_SECTIONS.filter((c) => !recentIds.has(c.id)),
    ...NAV_ACTIONS.filter((c) => !recentIds.has(c.id)),
  ], [recentCmds, recentIds]);

  // ── Search mode flat list ─────────────────────────────────────────────────────

  const flatSearch: SearchHit[] = searchResults
    ? [...searchResults.projects, ...searchResults.skills, ...searchResults.experiences, ...searchResults.posts]
    : [];

  // ── Reset on open ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setSearchResults(null);
      setSearchLoading(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  // ── Search debounce ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (mode !== "search") return;
    setSearchLoading(true);
    setSearchResults(null);
    setSelectedIndex(0);

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => { void doSearch(trimmed); }, 300);

    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed, mode]);

  async function doSearch(q: string) {
    try {
      const res = await fetch(`${API_URL}/search?q=${encodeURIComponent(q)}&limit=4`);
      if (res.ok) {
        const data = await res.json() as SearchResults;
        setSearchResults(data);
        setSelectedIndex(0);
      }
    } catch { /* silent — empty state shows */ }
    setSearchLoading(false);
  }

  // ── Global Escape ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); close(); } };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [isOpen, close]);

  // ── Outside-click ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const panel = document.getElementById("command-palette-panel");
      if (panel && !panel.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, close]);

  // ── Scroll selected into view ─────────────────────────────────────────────────

  useEffect(() => {
    const selected = listRef.current?.querySelector('[aria-selected="true"]');
    (selected as HTMLElement | null)?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // ── Bounds guard when list shrinks ────────────────────────────────────────────

  useEffect(() => {
    const len = mode === "navigate" ? flatNav.length : flatSearch.length;
    setSelectedIndex((prev) => Math.min(prev, Math.max(len - 1, 0)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flatNav.length, flatSearch.length, mode]);

  // ── Activate nav command ──────────────────────────────────────────────────────

  const activateNav = useCallback((cmd: NavCommand) => {
    close();
    writeRecent(cmd.id);
    cmd.action();
  }, [close]);

  // ── Activate search hit ───────────────────────────────────────────────────────

  const activateSearchHit = useCallback((hit: SearchHit) => {
    close();
    void router.push(hit.href);
  }, [close, router]);

  // ── Keyboard handler ──────────────────────────────────────────────────────────

  function handleKeyDown(e: React.KeyboardEvent) {
    const flatList = mode === "navigate" ? flatNav : flatSearch;
    const maxIdx   = flatList.length - 1;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, maxIdx));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (mode === "navigate") {
          const cmd = flatNav[selectedIndex];
          if (cmd) activateNav(cmd);
        } else {
          const hit = flatSearch[selectedIndex];
          if (hit) activateSearchHit(hit);
        }
        break;
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────────

  function NavGroup({ title, commands, indexOffset }: { title: string; commands: NavCommand[]; indexOffset: number }) {
    if (commands.length === 0) return null;
    return (
      <>
        <li className="px-4 pt-3 pb-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-lo">{title}</span>
        </li>
        {commands.map((cmd, i) => {
          const idx = indexOffset + i;
          const isSelected = idx === selectedIndex;
          return (
            <li
              key={cmd.id}
              id={`palette-item-${cmd.id}`}
              role="option"
              aria-selected={isSelected}
              onClick={() => activateNav(cmd)}
              onMouseEnter={() => setSelectedIndex(idx)}
              className={`flex items-center justify-between px-4 py-2 cursor-pointer transition-colors border-l-2 ${
                isSelected ? "bg-signal/10 border-signal" : "border-transparent hover:bg-ink-700"
              }`}
            >
              <div>
                <span className={`font-mono text-sm ${isSelected ? "text-signal" : "text-text-hi"}`}>
                  {cmd.label}
                </span>
                {cmd.description && (
                  <span className="block font-mono text-xs text-text-lo mt-0.5">{cmd.description}</span>
                )}
              </div>
              {isSelected && (
                <span className="font-mono text-[10px] text-text-lo border border-line rounded px-1.5 py-0.5 flex-shrink-0">
                  ↵
                </span>
              )}
            </li>
          );
        })}
      </>
    );
  }

  function SearchGroup({ title, hits, indexOffset }: { title: string; hits: SearchHit[]; indexOffset: number }) {
    if (hits.length === 0) return null;
    return (
      <>
        <li className="px-4 pt-3 pb-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-lo">{title}</span>
        </li>
        {hits.map((hit, i) => {
          const idx = indexOffset + i;
          const isSelected = idx === selectedIndex;
          return (
            <li
              key={hit.id}
              role="option"
              aria-selected={isSelected}
              onClick={() => activateSearchHit(hit)}
              onMouseEnter={() => setSelectedIndex(idx)}
              className={`flex items-center justify-between px-4 py-2 cursor-pointer transition-colors border-l-2 ${
                isSelected ? "bg-signal/10 border-signal" : "border-transparent hover:bg-ink-700"
              }`}
            >
              <div className="min-w-0 flex-1">
                <span className={`font-mono text-sm block truncate ${isSelected ? "text-signal" : "text-text-hi"}`}>
                  {hit.title}
                </span>
                <span className="font-mono text-xs text-text-lo block truncate mt-0.5">{hit.subtitle}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                {hit.meta && (
                  <span className="font-mono text-[10px] text-text-lo hidden sm:block">{hit.meta}</span>
                )}
                <span className="font-mono text-[10px] text-text-lo border border-line rounded px-1.5 py-0.5">
                  {TYPE_LABELS[hit.type]}
                </span>
              </div>
            </li>
          );
        })}
      </>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────────

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="palette-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[9999] bg-ink-900/80 backdrop-blur-sm"
            aria-hidden
          />

          <div
            id="command-palette-panel"
            className="fixed left-1/2 top-[18vh] z-[10000] w-full max-w-xl -translate-x-1/2 px-4"
          >
            <motion.div
              key="palette-panel"
              role="dialog"
              aria-modal
              aria-label="Command palette"
              initial={{ opacity: 0, scale: 0.97, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -8 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              onKeyDown={handleKeyDown}
            >
              <div className="bg-ink-800 border border-ink-600 rounded-card overflow-hidden shadow-2xl">

                {/* Input row */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-line">
                  <span className="text-text-lo font-mono text-sm select-none" aria-hidden>⌘</span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
                    placeholder="Type a command or search content…"
                    className="flex-1 bg-transparent text-text-hi font-mono text-sm placeholder:text-text-lo outline-none"
                    aria-label="Search commands"
                    aria-autocomplete="list"
                    aria-controls="palette-list"
                    aria-activedescendant={
                      mode === "navigate" && flatNav[selectedIndex]
                        ? `palette-item-${flatNav[selectedIndex].id}`
                        : undefined
                    }
                  />
                  {searchLoading && (
                    <span className="w-3 h-3 rounded-full border border-signal border-t-transparent animate-spin flex-shrink-0" aria-hidden />
                  )}
                  <kbd
                    onClick={close}
                    className="font-mono text-mono-label text-text-lo border border-line rounded px-1.5 py-0.5 cursor-pointer hover:text-text-mid transition-colors flex-shrink-0"
                  >
                    ESC
                  </kbd>
                </div>

                {/* Navigate mode */}
                {mode === "navigate" && (
                  <ul
                    id="palette-list"
                    ref={listRef}
                    role="listbox"
                    aria-label="Commands"
                    className="max-h-80 overflow-y-auto pb-1"
                  >
                    <NavGroup title="Recent"   commands={recentCmds}                                    indexOffset={0} />
                    <NavGroup title="Sections" commands={NAV_SECTIONS.filter((c) => !recentIds.has(c.id))} indexOffset={recentCmds.length} />
                    <NavGroup title="Actions"  commands={NAV_ACTIONS.filter((c) => !recentIds.has(c.id))}  indexOffset={recentCmds.length + NAV_SECTIONS.filter((c) => !recentIds.has(c.id)).length} />
                  </ul>
                )}

                {/* Search mode */}
                {mode === "search" && (
                  <ul
                    id="palette-list"
                    ref={listRef}
                    role="listbox"
                    aria-label="Search results"
                    className="max-h-80 overflow-y-auto pb-1"
                  >
                    {searchLoading && (
                      <li className="px-4 py-6 text-center font-mono text-xs text-text-lo">Searching…</li>
                    )}
                    {!searchLoading && searchResults && searchResults.total === 0 && (
                      <li className="px-4 py-6 text-center font-mono text-xs text-text-lo">
                        No results for &ldquo;{trimmed}&rdquo;
                      </li>
                    )}
                    {!searchLoading && searchResults && searchResults.total > 0 && (() => {
                      const projOffset  = 0;
                      const skillOffset = projOffset  + searchResults.projects.length;
                      const expOffset   = skillOffset + searchResults.skills.length;
                      const postOffset  = expOffset   + searchResults.experiences.length;
                      return (
                        <>
                          <SearchGroup title="Projects"   hits={searchResults.projects}    indexOffset={projOffset} />
                          <SearchGroup title="Skills"     hits={searchResults.skills}      indexOffset={skillOffset} />
                          <SearchGroup title="Experience" hits={searchResults.experiences} indexOffset={expOffset} />
                          <SearchGroup title="Writing"    hits={searchResults.posts}       indexOffset={postOffset} />
                        </>
                      );
                    })()}
                  </ul>
                )}

                {/* Footer */}
                <div className="px-4 py-2 border-t border-line flex items-center gap-3">
                  <span className="font-mono text-mono-label text-text-lo flex items-center gap-1">
                    <kbd className="border border-line rounded px-1 text-xs">↑↓</kbd>
                    navigate
                  </span>
                  <span className="font-mono text-mono-label text-text-lo flex items-center gap-1">
                    <kbd className="border border-line rounded px-1 text-xs">↵</kbd>
                    select
                  </span>
                  <span className="font-mono text-mono-label text-text-lo flex items-center gap-1">
                    <kbd className="border border-line rounded px-1 text-xs">ESC</kbd>
                    close
                  </span>
                </div>

              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
