"use client";
import dynamic from "next/dynamic";
import { CommandPalette } from "./CommandPalette";
import { CommandPaletteProvider } from "./CommandPaletteProvider";

const SpeedDial = dynamic(() => import("@/components/SpeedDial"), { ssr: false });

export function ClientWidgets() {
  return (
    <>
      <SpeedDial />
      <CommandPalette />
      <CommandPaletteProvider />
    </>
  );
}
