import { revalidateTag } from "next/cache";
import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const VALID_TAGS = ["skills", "experiences", "projects", "case-studies", "hero", "about", "availability"] as const;

export async function POST(request: NextRequest) {
  // Dual auth: httpOnly cookie (admin dashboard) OR X-Revalidate-Token header (CI/webhook)
  const cookieToken = request.cookies.get("admin_token")?.value;
  const headerSecret = request.headers.get("x-revalidate-token") ?? "";
  const envSecret = process.env["REVALIDATE_SECRET"] ?? "";

  const secretMatches =
    envSecret.length > 0 &&
    headerSecret.length === envSecret.length &&
    timingSafeEqual(Buffer.from(headerSecret), Buffer.from(envSecret));

  if (!cookieToken && !secretMatches) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { tags } = await request.json() as { tags: string[] };
  const validTags = (tags ?? []).filter((t): t is typeof VALID_TAGS[number] =>
    (VALID_TAGS as readonly string[]).includes(t)
  );

  for (const tag of validTags) {
    revalidateTag(tag);
  }

  return NextResponse.json({ ok: true, revalidated: validTags });
}
