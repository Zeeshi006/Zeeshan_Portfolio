import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Proxy login to NestJS — browser calls this route (same origin, no CORS),
// server calls NestJS (server-to-server, always localhost-reachable).
// This fixes mobile/devtunnel setups where the browser can't reach port 3001.
export async function POST(request: NextRequest) {
  const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

  try {
    const body = await request.json() as { email: string; password: string };

    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json() as { access_token?: string; message?: string };

    if (!res.ok) {
      return NextResponse.json(
        { message: "Invalid credentials" },
        { status: 401 },
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch {
    return NextResponse.json(
      { message: "Unable to reach authentication server" },
      { status: 502 },
    );
  }
}
