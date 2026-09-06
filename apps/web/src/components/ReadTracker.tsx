"use client";

import { useEffect } from "react";
import { trackCaseStudyRead } from "@/lib/analytics";

export function ReadTracker({ slug }: { slug: string }) {
  useEffect(() => {
    trackCaseStudyRead(slug);
  }, [slug]);

  return null;
}
