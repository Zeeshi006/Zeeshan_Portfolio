import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live Infrastructure — Hammad Afzal",
  description: "Real-time view of the portfolio backend: API latency, database connections, Redis hit rate, and live visitor count.",
};

export default function SystemLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
