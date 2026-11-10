import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { apiKey } = await req.json();
    if (typeof apiKey !== "string" || !apiKey.trim()) {
      return NextResponse.json({ error: "Informe sua API key da Groq." }, { status: 400 });
    }
    const response = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey.trim()}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      return NextResponse.json({ error: payload.error?.message || `A Groq recusou a chave (${response.status}).` }, { status: response.status });
    }
    const payload = await response.json();
    return NextResponse.json({ ok: true, modelsAvailable: Array.isArray(payload.data) ? payload.data.length : 0 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao validar a Groq." }, { status: 502 });
  }
}
