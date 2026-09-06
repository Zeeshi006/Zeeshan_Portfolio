import { NextRequest, NextResponse } from 'next/server';

// Returns a signed ElevenLabs WebSocket URL so the client can open
// an authenticated Conversational AI session without exposing the API key.
export async function POST(_req: NextRequest): Promise<NextResponse> {
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!agentId || !apiKey) {
    return NextResponse.json(
      { error: 'Voice agent not configured. Set ELEVENLABS_AGENT_ID and ELEVENLABS_API_KEY.' },
      { status: 503 },
    );
  }

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
      {
        method: 'GET',
        headers: { 'xi-api-key': apiKey },
      },
    );

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('[voice-token] ElevenLabs error:', res.status, detail);
      return NextResponse.json(
        { error: 'Voice agent temporarily unavailable.' },
        { status: 502 },
      );
    }

    const data = (await res.json()) as { signed_url: string };
    return NextResponse.json({ signedUrl: data.signed_url });
  } catch (err) {
    console.error('[voice-token] Unexpected error:', err);
    return NextResponse.json({ error: 'Voice agent temporarily unavailable.' }, { status: 500 });
  }
}
