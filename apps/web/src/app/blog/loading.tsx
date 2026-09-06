import { Sk } from "@/components/Skeleton";

export default function BlogLoading() {
  return (
    <main className="min-h-screen pt-32 pb-24">
      <div className="max-w-content mx-auto px-6">

        {/* Header */}
        <div className="mb-16">
          <Sk className="h-3 w-20 mb-3" />
          <Sk className="h-12 w-64 mb-3" />
          <Sk className="h-4 w-96 max-w-full" />
        </div>

        {/* Tag strip */}
        <div className="flex flex-wrap gap-2 mb-10">
          {[80, 60, 90, 70, 55].map((w, i) => (
            <Sk key={i} className="h-7 rounded" style={{ width: w }} />
          ))}
        </div>

        {/* Post grid — 6 skeleton cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-ink-800 border border-ink-600 rounded-card p-6">
              <div className="flex gap-1.5 mb-3">
                <Sk className="h-5 w-16" />
                <Sk className="h-5 w-14" />
              </div>
              <Sk className="h-6 w-full mb-2" />
              <Sk className="h-6 w-4/5 mb-3" />
              <Sk className="h-4 w-full mb-1.5" />
              <Sk className="h-4 w-5/6 mb-1.5" />
              <Sk className="h-4 w-3/4 mb-5" />
              <div className="flex items-center justify-between pt-3 border-t border-line">
                <div className="flex gap-3">
                  <Sk className="h-3 w-12" />
                  <Sk className="h-3 w-20" />
                </div>
                <Sk className="h-3 w-4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
