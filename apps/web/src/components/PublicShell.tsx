"use client";
import { usePathname } from "next/navigation";
import { Nav } from "@/components/Nav";
import { ClientWidgets } from "@/components/ClientWidgets";
import { SessionTracker } from "@/components/SessionTracker";

export function PublicShell() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;
  return (
    <>
      <Nav />
      <ClientWidgets />
      <SessionTracker />
    </>
  );
}
