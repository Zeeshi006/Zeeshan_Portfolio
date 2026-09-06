import { redirect } from "next/navigation";

// Case studies are now merged into projects — redirect to the unified detail page
export default async function CaseStudyRedirectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/projects/${slug}`);
}
