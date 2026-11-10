import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    if (!process.env.APP_ACCESS_TOKEN) {
      return NextResponse.json({ error: "Conexões de provedores estão desabilitadas até a administração configurar APP_ACCESS_TOKEN." }, { status: 503 });
    }
    if (req.headers.get("x-app-token") !== process.env.APP_ACCESS_TOKEN) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const { id } = await context.params;
    const { key } = await req.json();
    if (!/^[a-zA-Z0-9._-]+$/.test(id) || typeof key !== "string" || key.trim().length < 8) {
      return NextResponse.json({ error: "Provedor ou credencial inválida." }, { status: 400 });
    }
    const baseUrl = (process.env.EXECUTOR_SERVER_URL || "http://127.0.0.1:4096").replace(/\/$/, "");
    const password = process.env.EXECUTOR_SERVER_PASSWORD;
    const response = await fetch(`${baseUrl}/auth/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(password ? { Authorization: `Basic ${Buffer.from(`opencode:${password}`).toString("base64")}` } : {}),
      },
      body: JSON.stringify({ type: "api", key: key.trim() }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json({ error: detail || `O motor de execução recusou a credencial (${response.status}).` }, { status: response.status });
    }
    return NextResponse.json({ ok: true, provider: id, message: "Credencial enviada ao motor de execução." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao conectar provedor." }, { status: 502 });
  }
}
