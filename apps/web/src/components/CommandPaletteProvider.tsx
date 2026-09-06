"use client";
import { useEffect } from "react";
import { usePaletteStore } from "./CommandPalette";

export function CommandPaletteProvider() {
  const { open } = usePaletteStore();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // ⌘K / Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        open();
        return;
      }
      // "/" when not focused on an input / textarea / select / contenteditable
      if (e.key === "/") {
        const tag = (e.target as HTMLElement).tagName;
        const isEditable = (e.target as HTMLElement).isContentEditable;
        if (!["INPUT", "TEXTAREA", "SELECT"].includes(tag) && !isEditable) {
          e.preventDefault();
          open();
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return null;
}
