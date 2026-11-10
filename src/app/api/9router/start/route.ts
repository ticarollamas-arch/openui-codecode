import { NextResponse } from "next/server";
import { checkNineRouterHealth, fetchNineRouterModels, getNineRouterConfig } from "@/lib/ninerouter";

export const runtime = "nodejs";

export async function POST() {
  if (!getNineRouterConfig().configured) {
    return NextResponse.json({ ok: false, error: "9Router ainda não foi configurado no servidor. Defina NINEROUTER_BASE_URL e, se necessário, NINEROUTER_API_KEY." }, { status: 503 });
  }
  try {
    const health = await checkNineRouterHealth();
    const { models } = await fetchNineRouterModels();
    const { defaultCombo } = getNineRouterConfig();
    if (!models.length) throw new Error("9Router respondeu, mas ainda não há modelos configurados. Conecte provedores no painel do 9Router.");
    if (!defaultCombo) throw new Error("Defina NINEROUTER_DEFAULT_COMBO com o nome do combo de fallback criado no painel do 9Router.");
    if (!models.some((item: { id: string }) => item.id === defaultCombo)) throw new Error(`O combo '${defaultCombo}' não apareceu em /v1/models. Confira o nome e salve o combo no painel do 9Router.`);
    return NextResponse.json({ ok: true, status: "running", health, modelCount: models.length, defaultModel: defaultCombo });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Não foi possível iniciar a conexão com 9Router." }, { status: 502 });
  }
}
