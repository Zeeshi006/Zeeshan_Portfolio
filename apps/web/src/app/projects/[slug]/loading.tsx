import { Sk } from "@/components/Skeleton";

export default function ProjectLoading() {
  return (
    <>
      <main className="pt-24 pb-32">
        <div className="max-w-[800px] mx-auto px-6">

          {/* Status + title */}
          <div className="mb-10">
            <div className="flex gap-3 mb-5">
              <Sk className="h-6 w-20 rounded" />
            </div>
            <Sk className="h-14 w-full mb-3" />
            <Sk className="h-14 w-3/4 mb-4" />
            <Sk className="h-5 w-full max-w-lg mb-2" />
            <Sk className="h-3 w-48" />
          </div>

          {/* Link buttons */}
          <div className="flex gap-3 mb-12">
            <Sk className="h-10 w-28 rounded" />
            <Sk className="h-10 w-28 rounded" />
          </div>

          {/* Case study sections */}
          {[
            { labelW: "w-28", lines: ["w-full", "w-5/6", "w-4/5"] },
            { labelW: "w-32", lines: ["w-full", "w-full", "w-2/3"] },
            { labelW: "w-24", lines: ["w-full", "w-3/4"] },
          ].map((s, i) => (
            <div key={i} className="mb-12">
              <Sk className={`h-3 ${s.labelW} mb-3`} />
              {s.lines.map((w, j) => (
                <Sk key={j} className={`h-4 ${w} mb-2`} />
              ))}
            </div>
          ))}

          {/* Tech stack card */}
          <div className="bg-ink-800 border border-ink-600 rounded-card p-6 mb-12">
            <Sk className="h-3 w-24 mb-4" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 7 }).map((_, i) => (
                <Sk key={i} className="h-7 w-20 rounded" />
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
