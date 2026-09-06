"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearTokenCache } from "@/lib/admin-api";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster } from "sonner";

const NAV = [
  { label: "Dashboard",        href: "/admin/dashboard",              exact: true  },
  { label: "Skills",           href: "/admin/dashboard/skills",       exact: false },
  { label: "Experience",       href: "/admin/dashboard/experience",   exact: false },
  { label: "Projects",         href: "/admin/dashboard/projects",     exact: false },
  { label: "Site Content",     href: "/admin/dashboard/content",      exact: false },
  { label: "Knowledge Base",   href: "/admin/dashboard/knowledge-base", exact: false },
  { label: "Blog",             href: "/admin/dashboard/blog",         exact: false },
  { label: "GitHub",           href: "/admin/dashboard/github",       exact: false },
  { label: "Analytics",        href: "/admin/dashboard/analytics",    exact: false },
  { label: "Conversations",    href: "/admin/dashboard/conversations", exact: false },
  { label: "Chatbot Settings", href: "/admin/dashboard/chatbot-settings", exact: false },
  { label: "Voice Settings",   href: "/admin/dashboard/voice-settings",  exact: false },
  { label: "Security",         href: "/admin/dashboard/security",     exact: false },
];

function SidebarContent({ onNav }: { onNav?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    clearTokenCache();
    await fetch("/api/admin-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear" }),
    });
    // Hard redirect — forces middleware to re-evaluate cookie absence
    window.location.href = "/admin/login";
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-line">
        <span className="font-mono text-mono-label text-text-lo uppercase tracking-widest">Admin</span>
        <p className="text-text-hi font-display text-h3 mt-1">Portfolio</p>
      </div>
      <nav className="flex-1 py-4 overflow-y-auto">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            {...(onNav ? { onClick: () => onNav() } : {})}
            className={`block px-6 py-2.5 font-mono text-mono-label uppercase tracking-widest transition-colors ${
              (item.exact ? pathname === item.href : pathname.startsWith(item.href))
                ? "text-signal border-l-2 border-signal bg-ink-800"
                : "text-text-mid hover:text-text-hi hover:bg-ink-800"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="px-6 py-4 border-t border-line">
        <button
          onClick={handleLogout}
          className="font-mono text-mono-label text-text-lo uppercase tracking-widest hover:text-danger transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-ink-900">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-56 flex-shrink-0 border-r border-line flex-col bg-ink-900">
        <SidebarContent />
      </aside>

      {/* Mobile overlay sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-ink-900/80 backdrop-blur-sm lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            {/* Drawer */}
            <motion.aside
              key="drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="fixed inset-y-0 left-0 z-50 w-64 bg-ink-900 border-r border-line flex flex-col lg:hidden"
            >
              <SidebarContent onNav={() => setSidebarOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-4 px-4 py-3 border-b border-line bg-ink-900 sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
            className="flex flex-col gap-[5px] p-1"
          >
            <span className="block w-5 h-[1.5px] bg-text-hi" />
            <span className="block w-5 h-[1.5px] bg-text-hi" />
            <span className="block w-5 h-[1.5px] bg-text-hi" />
          </button>
          <span className="font-mono text-mono-label text-text-lo uppercase tracking-widest">Admin</span>
        </div>

        <main className="flex-1 overflow-auto p-4 lg:p-8">
          {children}
        </main>
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: "var(--ink-800)",
              border: "1px solid var(--ink-600)",
              color: "var(--text-hi)",
              fontFamily: "var(--font-mono, monospace)",
              fontSize: "0.75rem",
              letterSpacing: "0.05em",
            },
          }}
        />
      </div>
    </div>
  );
}
