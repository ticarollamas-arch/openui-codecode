const DEFAULT_BASE_URL = "http://127.0.0.1:20128";

export function getNineRouterConfig() {
  const baseUrl = (process.env.NINEROUTER_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const apiKey = process.env.NINEROUTER_API_KEY || "";
  const defaultCombo = process.env.NINEROUTER_DEFAULT_COMBO || "";
  return { baseUrl, apiKey, defaultCombo, configured: Boolean(process.env.NINEROUTER_BASE_URL) };
}

export function nineRouterHeaders(apiKey: string) {
  return {
    Accept: "application/json",
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
  };
}

export async function fetchNineRouterModels() {
  const { baseUrl, apiKey } = getNineRouterConfig();
  const response = await fetch(`${baseUrl}/v1/models`, {
    headers: nineRouterHeaders(apiKey),
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || payload?.error || payload?.message || `9Router respondeu HTTP ${response.status}`;
    throw new Error(String(message));
  }
  const rawModels = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.models) ? payload.models : [];
  const models = rawModels
    .filter((item: any) => item && typeof item.id === "string" && item.id.trim())
    .map((item: any) => ({
      id: item.id,
      name: item.name || item.id,
      context: item.context_length || item.context_window || null,
      output: item.max_output_tokens || null,
      inputPrice: null,
      outputPrice: null,
      free: /free|opencode|iflow|kiro/i.test(`${item.id} ${item.name || ""}`),
      modalities: item.modalities || null,
    }));
  return { baseUrl, models };
}

export async function checkNineRouterHealth() {
  const { baseUrl, apiKey } = getNineRouterConfig();
  const response = await fetch(`${baseUrl}/health`, {
    headers: nineRouterHeaders(apiKey),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`9Router indisponível (HTTP ${response.status}).`);
  return response.json().catch(() => ({ status: "ok" }));
}
