import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",  // keep at root so middleware always sees it
};

// GET — return the token from the httpOnly cookie so the in-memory cache can be restored after a refresh
export async function GET(request: NextRequest) {
  const token = request.cookies.get("admin_token")?.value;
  if (!token) return NextResponse.json({ token: null }, { status: 401 });
  return NextResponse.json({ token });
}

// POST — set or clear the httpOnly cookie
export async function POST(request: NextRequest) {
  const { action, token } = await request.json() as { action: string; token?: string };

  if (action === "set" && token) {
    const response = NextResponse.json({ ok: true });
    response.cookies.set("admin_token", token, {
      ...COOKIE_OPTS,
      maxAge: 60 * 60 * 2, // 2h — matches JWT expiry
    });
    return response;
  }

  if (action === "clear") {
    const response = NextResponse.json({ ok: true });
    // Must match exact same path used when setting, otherwise browser ignores the deletion
    response.cookies.set("admin_token", "", {
      ...COOKIE_OPTS,
      maxAge: 0,  // maxAge: 0 = delete immediately
    });
    return response;
  }

  return NextResponse.json({ ok: false }, { status: 400 });
}
