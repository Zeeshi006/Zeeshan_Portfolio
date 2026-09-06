import { Sk } from "@/components/Skeleton";

export default function BlogPostLoading() {
  return (
    <main className="min-h-screen pt-32 pb-32">
      <div className="max-w-[720px] mx-auto px-6">

        {/* Back link */}
        <Sk className="h-3 w-24 mb-10" />

        {/* Tags */}
        <div className="flex gap-1.5 mb-4">
          <Sk className="h-6 w-20 rounded" />
          <Sk className="h-6 w-16 rounded" />
        </div>

        {/* Title */}
        <Sk className="h-12 w-full mb-3" />
        <Sk className="h-12 w-4/5 mb-4" />

        {/* Excerpt */}
        <Sk className="h-5 w-full mb-2" />
        <Sk className="h-5 w-3/4 mb-5" />

        {/* Meta row */}
        <div className="flex flex-wrap gap-4 pb-6 border-b border-line mb-10">
          <Sk className="h-3 w-16" />
          <Sk className="h-3 w-28" />
          <Sk className="h-3 w-16" />
        </div>

        {/* Body paragraphs */}
        {[
          "w-full", "w-full", "w-5/6",
          "w-full", "w-full", "w-2/3",
          "w-full", "w-full", "w-4/5",
          "w-full", "w-3/4",
        ].map((w, i) => (
          <Sk key={i} className={`h-4 ${w} mb-3`} />
        ))}

        {/* Code block placeholder */}
        <div className="bg-ink-700 border border-ink-600 rounded-lg px-5 py-4 my-6">
          <Sk className="h-3 w-3/4 mb-2" style={{ background: "var(--ink-600)" }} />
          <Sk className="h-3 w-1/2 mb-2" style={{ background: "var(--ink-600)" }} />
          <Sk className="h-3 w-2/3" style={{ background: "var(--ink-600)" }} />
        </div>

        {/* More body */}
        {["w-full", "w-full", "w-4/5", "w-full", "w-2/3"].map((w, i) => (
          <Sk key={`b${i}`} className={`h-4 ${w} mb-3`} />
        ))}
      </div>
    </main>
  );
}
