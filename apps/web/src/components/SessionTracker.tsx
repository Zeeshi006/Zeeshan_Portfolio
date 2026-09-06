"use client";

import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { trackEvent } from "@/lib/analytics";
import { updateOnlineCount } from "@/lib/online-visitors";

export function SessionTracker() {
  const lastSectionRef = useRef<string>("");

  // Connect to /online namespace — backend counts this visitor and broadcasts live count
  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    const socket = io(`${apiUrl}/online`, { path: "/socket.io" });
    socket.on("count", (data: { count: number }) => updateOnlineCount(data.count));
    return () => { socket.disconnect(); };
  }, []);

  useEffect(() => {
    // 1. Read or create session start time
    const SS_KEY = "_ss";
    const stored = sessionStorage.getItem(SS_KEY);
    let sessionStart: number;
    if (stored) {
      sessionStart = parseInt(stored, 10);
    } else {
      sessionStart = Date.now();
      sessionStorage.setItem(SS_KEY, String(sessionStart));
    }

    // 2. Observe section elements with IntersectionObserver
    const SECTION_IDS = ["skills", "experience", "projects", "case-studies", "open-source", "availability", "contact"];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            lastSectionRef.current = id;
            trackEvent("section_view", { section: id });
          }
        }
      },
      { threshold: 0.3 }
    );

    for (const id of SECTION_IDS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    // 3. Track session end on beforeunload
    function handleBeforeUnload() {
      const now = Date.now();
      const duration_seconds = Math.round((now - sessionStart) / 1000);
      trackEvent("session_end", {
        duration_seconds,
        last_section: lastSectionRef.current,
      });
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      observer.disconnect();
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  return null;
}
