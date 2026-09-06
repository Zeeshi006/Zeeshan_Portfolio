"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { trackConversion } from "@/lib/analytics";
import { openPalette } from "./CommandPalette";

const LINKS = [
  { label: "Skills",       href: "/#skills" },
  { label: "Experience",   href: "/#experience" },
  { label: "Projects",     href: "/#projects" },
  { label: "GitHub",       href: "/#open-source" },
  { label: "Writing",      href: "/blog" },
  { label: "Availability", href: "/#availability" },
  { label: "Contact",      href: "/#contact" },
  { label: "System",       href: "/system", live: true },
];

export function Nav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive]     = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    try { localStorage.removeItem("admin_token"); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const sectionIds = LINKS.map((l) => l.href.split("#")[1] ?? "");
    const update = () => {
      const trigger = window.scrollY + window.innerHeight * 0.35;
      let current = "";
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (el && trigger >= el.offsetTop) current = id;
      }
      setActive(current);
    };
    window.addEventListener("scroll", update, { passive: true });
    update();
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    if (menuOpen) setMenuOpen(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 transition-all duration-300 ${menuOpen ? "z-[302]" : "z-50"} ${
          scrolled || menuOpen
            ? "bg-ink-900/96 backdrop-blur-md border-b border-line"
            : "bg-transparent"
        }`}
      >
        {/* Subtle lime accent line at top — only when scrolled */}
        <AnimatePresence>
          {scrolled && (
            <motion.div
              key="accent"
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              exit={{ scaleX: 0, opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="absolute top-0 left-0 right-0 h-[1px] origin-left"
              style={{ background: "linear-gradient(to right, transparent, rgba(198,255,58,0.35) 30%, rgba(198,255,58,0.35) 70%, transparent)" }}
            />
          )}
        </AnimatePresence>

        <div className="max-w-content mx-auto px-6 h-12 lg:h-16 flex items-center justify-between gap-6">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group flex-shrink-0">
            <span className="font-mono text-sm font-bold text-signal leading-none tracking-tight border border-signal/40 rounded px-2.5 py-1.5 group-hover:border-signal/70 group-hover:bg-signal/5 transition-all duration-200">
              HA
            </span>
            <span className="hidden xl:block font-mono text-xs text-text-mid uppercase tracking-[0.14em] group-hover:text-text-hi transition-colors">
              Hammad Afzal
            </span>
          </Link>

          {/* Desktop nav — at lg (1024px+); Resume/⌘K still hidden until xl so no crowding */}
          <nav className="hidden lg:flex items-center gap-5 flex-1 justify-center">
            {LINKS.map((link) => {
              const sectionId = link.href.split("#")[1];
              const isActive = sectionId ? active === sectionId : false;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => trackConversion("nav_click", { section: link.label.toLowerCase() })}
                  className={`relative flex items-center gap-1.5 font-mono text-mono-label uppercase tracking-widest whitespace-nowrap transition-colors duration-150 ${
                    isActive ? "text-text-hi" : "text-text-mid hover:text-text-hi"
                  }`}
                >
                  {"live" in link && link.live && (
                    <span className="w-1.5 h-1.5 rounded-full bg-signal animate-pulse shrink-0" />
                  )}
                  {link.label}
                  {isActive && (
                    <motion.span
                      layoutId="nav-indicator"
                      className="absolute -bottom-[1px] left-0 right-0 h-[2px] bg-signal rounded-full"
                      transition={{ type: "spring", stiffness: 380, damping: 35 }}
                    />
                  )}
                </a>
              );
            })}
          </nav>

          {/* Right side: ⌘K chip + Resume + Hamburger */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* ⌘K palette trigger — desktop only */}
            <button
              onClick={openPalette}
              aria-label="Open command palette"
              className="hidden xl:flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-text-lo border border-line rounded px-2.5 py-1.5 hover:border-signal/40 hover:text-text-mid transition-all duration-200"
            >
              <kbd className="not-italic">Ctrl</kbd><span className="text-text-lo/60">+</span>K
            </button>

            <a
              href="/resume.pdf"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackConversion("resume_download", { source: "nav" })}
              className="hidden xl:inline-flex items-center gap-1.5 font-mono text-mono-label text-signal uppercase tracking-widest border border-signal/50 hover:bg-signal hover:text-signal-ink rounded px-4 py-2 transition-all duration-200 active:scale-[.97]"
            >
              Resume ↓
            </a>

            {/* Hamburger — below lg */}
            <button
              className="lg:hidden flex flex-col gap-[5px] p-1.5 -mr-1"
              onClick={() => { setMenuOpen((o) => { if (!o) trackConversion("hamburger_open"); return !o; }); }}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
            >
              <motion.span
                animate={menuOpen ? { rotate: 45, y: 7 } : { rotate: 0, y: 0 }}
                className="block w-5 h-[1.5px] bg-text-hi origin-center"
                transition={{ duration: 0.2 }}
              />
              <motion.span
                animate={menuOpen ? { opacity: 0 } : { opacity: 1 }}
                className="block w-5 h-[1.5px] bg-text-hi"
                transition={{ duration: 0.2 }}
              />
              <motion.span
                animate={menuOpen ? { rotate: -45, y: -7 } : { rotate: 0, y: 0 }}
                className="block w-5 h-[1.5px] bg-text-hi origin-center"
                transition={{ duration: 0.2 }}
              />
            </button>
          </div>
        </div>

        {/* Mobile / tablet dropdown — below lg */}
        <AnimatePresence>
          {menuOpen && (
            <motion.nav
              key="mobile-menu"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden overflow-hidden border-t border-line bg-ink-900/98 max-h-[calc(100vh-48px)] overflow-y-auto"
            >
              <div className="px-6 py-4 flex flex-col gap-1">
                {LINKS.map((link) => {
                  const isActive = active === link.href.split("#")[1];
                  return (
                    <a
                      key={link.href}
                      href={link.href}
                      onClick={(e) => {
                        const id = link.href.split("#")[1];
                        if (!id) { setMenuOpen(false); return; }
                        // On non-home pages let the href (e.g. /#skills) navigate normally
                        if (pathname !== "/") { setMenuOpen(false); return; }
                        e.preventDefault();
                        setMenuOpen(false);
                        setTimeout(() => {
                          document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
                        }, 200);
                      }}
                      className={`font-mono text-mono-label uppercase tracking-widest py-3 border-b border-line last:border-0 transition-colors flex items-center justify-between ${
                        isActive ? "text-signal" : "text-text-mid hover:text-text-hi"
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        {"live" in link && link.live && (
                          <span className="w-1.5 h-1.5 rounded-full bg-signal animate-pulse shrink-0" />
                        )}
                        {link.label}
                      </span>
                      {isActive && <span className="w-1.5 h-1.5 rounded-full bg-signal" />}
                    </a>
                  );
                })}
                <div className="pt-3">
                  <a
                    href="/resume.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-mono text-mono-label text-signal uppercase tracking-widest border border-signal/40 rounded px-4 py-2 hover:bg-signal hover:text-signal-ink transition-all duration-200"
                  >
                    Resume ↓
                  </a>
                </div>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>
    </>
  );
}
