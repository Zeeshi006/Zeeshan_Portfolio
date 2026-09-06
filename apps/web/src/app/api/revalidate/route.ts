import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const VALID_TAGS = ["skills", "experiences", "projects", "case-studies", "hero", "about"];

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-revalidate-secret");
  if (secret !== process.env["REVALIDATE_SECRET"]) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { tag } = await request.json() as { tag: string };
  if (!VALID_TAGS.includes(tag)) {
    return NextResponse.json({ ok: false, error: "Unknown tag" }, { status: 400 });
  }

  revalidateTag(tag);
  return NextResponse.json({ ok: true, revalidated: tag });
}
