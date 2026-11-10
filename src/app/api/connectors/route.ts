import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unwrap(payload: any) {
  return payload?.data ?? payload;
}

async function connectorFetch(path: string) {
  const baseUrl = process.env.OPENCONNECTOR_BASE_URL?.replace(/\/+$/, "");
  const adminToken = process.env.OPENCONNECTOR_ADMIN_TOKEN;
  if (!baseUrl || !adminToken) {
    throw new Error("OpenConnector ainda não configurado. Defina OPENCONNECTOR_BASE_URL e OPENCONNECTOR_ADMIN_TOKEN no servidor.");
  }
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${adminToken}`, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.message || payload?.error || `OpenConnector respondeu HTTP ${response.status}`;
    throw new Error(String(message));
  }
  return unwrap(payload);
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() || "";
  const service = request.nextUrl.searchParams.get("service")?.trim() || "";
  const baseUrl = process.env.OPENCONNECTOR_BASE_URL?.replace(/\/+$/, "");
  const consoleUrl = process.env.OPENCONNECTOR_CONSOLE_URL || baseUrl || "";

  if (!baseUrl || !process.env.OPENCONNECTOR_ADMIN_TOKEN) {
    return NextResponse.json({
      configured: false,
      connected: false,
      consoleUrl,
      providers: [],
      actions: [],
      error: "Configure OPENCONNECTOR_BASE_URL e OPENCONNECTOR_ADMIN_TOKEN no ambiente do servidor.",
    }, { status: 200 });
  }

  try {
    if (service) {
      const safeService = service.replace(/[^a-zA-Z0-9_.-]/g, "");
      if (!safeService) return NextResponse.json({ error: "Identificador de aplicativo inválido." }, { status: 400 });
      const [providerResult, actionResult] = await Promise.all([
        connectorFetch(`/api/providers/${encodeURIComponent(safeService)}`),
        connectorFetch(`/api/actions?service=${encodeURIComponent(safeService)}`),
      ]);
      const provider = (providerResult as any)?.provider || providerResult;
      const actions = Array.isArray((actionResult as any)?.actions)
        ? (actionResult as any).actions
        : Array.isArray(actionResult) ? actionResult : [];
      return NextResponse.json({ configured: true, connected: true, consoleUrl, provider, actions });
    }

    const providerResult = await connectorFetch("/api/providers");
    let actionResult: any = { actions: [] };
    if (query) {
      try {
        actionResult = await connectorFetch(`/api/actions/search?q=${encodeURIComponent(query)}`);
      } catch {
        // A catalog search should not hide the provider catalog if this runtime version
        // does not expose the optional action-search endpoint.
        actionResult = { actions: [] };
      }
    }
    const providersRaw = (providerResult as any)?.providers ?? providerResult;
    const providers = Array.isArray(providersRaw)
      ? providersRaw
      : providersRaw && typeof providersRaw === "object"
        ? Object.entries(providersRaw).map(([id, value]: [string, any]) => ({ id, ...value }))
        : [];
    const actionsRaw = (actionResult as any)?.actions ?? actionResult;
    const actions = Array.isArray(actionsRaw) ? actionsRaw : [];
    return NextResponse.json({ configured: true, connected: true, consoleUrl, providers, actions, totalProviders: providers.length });
  } catch (error) {
    return NextResponse.json({
      configured: true,
      connected: false,
      consoleUrl,
      providers: [],
      actions: [],
      error: error instanceof Error ? error.message : "Não foi possível consultar o OpenConnector.",
    }, { status: 502 });
  }
}
