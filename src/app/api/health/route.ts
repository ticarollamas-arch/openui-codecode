import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const configured = Boolean(process.env.EXECUTOR_SERVER_URL);
  if (!configured) {
    return NextResponse.json(
      { ok: false, error: "EXECUTOR_SERVER_URL não configurada" },
      { status: 503 }
    );
  }
  try {
    const { opencode } = await import("@/lib/opencode");
    let result: any = null;
    if (typeof (opencode as any).health?.get === "function") {
      result = await (opencode as any).health.get();
    } else if (typeof (opencode as any).global?.health === "function") {
      result = await (opencode as any).global.health();
    }
    const healthy = Boolean(result?.data?.healthy ?? true);
    return NextResponse.json({ ok: healthy, version: result?.data?.version });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Motor de execução indisponível" },
      { status: 503 }
    );
  }
}
