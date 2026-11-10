import { NextResponse } from "next/server";
import { fetchNineRouterModels, getNineRouterConfig } from "@/lib/ninerouter";

export const runtime = "nodejs";

export async function GET() {
  const config = getNineRouterConfig();
  if (!config.configured) {
    return NextResponse.json({ configured: false, connected: false, models: [], message: "Configure NINEROUTER_BASE_URL no servidor." });
  }
  try {
    const result = await fetchNineRouterModels();
    return NextResponse.json({ configured: true, connected: true, models: result.models, source: "9Router" });
  } catch (error) {
    return NextResponse.json({ configured: true, connected: false, models: [], error: error instanceof Error ? error.message : "Falha ao consultar 9Router." }, { status: 502 });
  }
}
