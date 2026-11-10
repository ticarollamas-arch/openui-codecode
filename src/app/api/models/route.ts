import { NextRequest, NextResponse } from "next/server";
import { fetchNineRouterModels, getNineRouterConfig } from "@/lib/ninerouter";

export const runtime = "nodejs";

async function readCatalog() {
  const baseUrl = (process.env.EXECUTOR_SERVER_URL || "http://127.0.0.1:4096").replace(/\/$/, "");
  const password = process.env.EXECUTOR_SERVER_PASSWORD;
  const headers: Record<string, string> = password
    ? { Authorization: `Basic ${Buffer.from(`opencode:${password}`).toString("base64")}` }
    : {};

  let providers: any[] = [];
  let connected: string[] = [];
  let executorError = "";
  try {
    const response = await fetch(`${baseUrl}/provider`, { headers, cache: "no-store", signal: AbortSignal.timeout(9000) });
    if (!response.ok) throw new Error(`Motor de execução respondeu ${response.status}`);
    const payload = await response.json();
    connected = payload.connected || [];
    const authResponse = await fetch(`${baseUrl}/provider/auth`, { headers, cache: "no-store", signal: AbortSignal.timeout(9000) }).catch(() => null);
    const authMethods = authResponse?.ok ? await authResponse.json() : {};
    providers = (payload.all || []).map((provider: any) => ({
      id: provider.id,
      name: provider.name || provider.id,
      connected: connected.includes(provider.id),
      authMethods: authMethods[provider.id] || [],
      models: Object.entries(provider.models || {}).map(([id, model]: [string, any]) => ({
        id, name: model.name || id, context: model.limit?.context || null, output: model.limit?.output || null,
        inputPrice: model.cost?.input ?? null, outputPrice: model.cost?.output ?? null,
        free: (provider.id === "opencode" || provider.id === "opencode-go") ? model.cost?.input === 0 : model.cost?.input === 0 && model.cost?.output === 0,
        modalities: model.modalities || null,
      })),
    })).filter((provider: any) => provider.models.length > 0);
  } catch (error) {
    executorError = error instanceof Error ? error.message : "Motor de execução indisponível";
  }

  let router: any = { configured: false, connected: false, models: [] };
  if (getNineRouterConfig().configured) {
    try {
      const routed = await fetchNineRouterModels();
      router = { configured: true, connected: true, models: routed.models, defaultModel: getNineRouterConfig().defaultCombo || null };
      if (routed.models.length) providers.unshift({
        id: "9router", name: "9Router · Rotação automática", connected: true, authMethods: [], models: routed.models,
      });
    } catch (error) {
      router = { configured: true, connected: false, models: [], error: error instanceof Error ? error.message : "Falha ao consultar 9Router." };
    }
  }
  return NextResponse.json({ providers, connected, source: "Motor de execução + 9Router", router, executorError });
}

export async function GET() {
  return readCatalog();
}

export async function POST(_req: NextRequest) { return readCatalog(); }
