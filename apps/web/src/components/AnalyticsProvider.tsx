"use client";
import { useEffect } from "react";
import { trackPageView } from "@/lib/analytics";

export function AnalyticsProvider() {
  useEffect(() => { trackPageView(); }, []);
  return null;
}
