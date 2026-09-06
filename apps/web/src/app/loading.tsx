import { Sk } from "@/components/Skeleton";

export default function HomeLoading() {
  return (
    <>
      {/* Hero skeleton */}
      <div className="min-h-screen flex flex-col justify-center max-w-content mx-auto px-6 pt-24 pb-16">
        <Sk className="h-3 w-52 mb-6" />

        {/* Headline — two lines */}
        <Sk className="h-14 w-4/5 mb-3 sm:h-[4.5rem]" />
        <Sk className="h-14 w-3/5 mb-8 sm:h-[4.5rem]" />

        {/* Subheadline */}
        <Sk className="h-5 w-2/3 mb-2" />
        <Sk className="h-5 w-1/2 mb-10" />

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <Sk className="h-12 w-full sm:w-36 rounded-btn" />
          <Sk className="h-12 w-full sm:w-36 rounded-btn" />
        </div>
      </div>

      {/* Section stubs — gives page a sense of depth while data loads */}
      <div className="max-w-content mx-auto px-6 space-y-1 pb-32">
        {[120, 96, 112, 80].map((h, i) => (
          <div key={i} className="border-t border-line py-20">
            <div className="flex flex-col md:grid md:grid-cols-[140px_1fr] md:gap-10">
              <Sk className="hidden md:block h-3 w-24 mt-1" />
              <div className="space-y-3">
                <Sk className="h-3 w-24 mb-4 md:hidden" />
                <Sk className={`h-10 w-56`} />
                <Sk className="h-4 w-full max-w-lg" />
                <Sk className="h-4 w-4/5 max-w-md" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
