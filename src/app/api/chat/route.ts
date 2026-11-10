import { NextRequest, NextResponse } from "next/server";
import { createOpencodeClient } from "@opencode-ai/sdk";
import { callGroqWithFallback, GROQ_MODELS } from "@/lib/groq";
import { getNineRouterConfig, nineRouterHeaders } from "@/lib/ninerouter";

export const runtime = "nodejs";
export const maxDuration = 60;

function getClient() {
  const url = process.env.EXECUTOR_SERVER_URL || "http://127.0.0.1:4096";
  const password = process.env.EXECUTOR_SERVER_PASSWORD;
  return createOpencodeClient({
    baseUrl: url,
    throwOnError: true,
    headers: password
      ? { Authorization: `Basic ${Buffer.from(`opencode:${password}`).toString("base64")}` }
      : undefined,
  });
}

const GROQ_MODEL_IDS = new Set(GROQ_MODELS.map((m) => m.id));

export async function POST(req: NextRequest) {
  try {
    if (process.env.APP_ACCESS_TOKEN && req.headers.get("x-app-token") !== process.env.APP_ACCESS_TOKEN) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const {
      sessionId,
      clientChatId,
      message,
      model,
    } = await req.json();

    if (typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });
    }

    const selectedModel = model || "groq/openai/gpt-oss-120b";
    const groqKey = process.env.GROQ_API_KEY;
    const [selectedProvider, selectedModelId] = selectedModel.includes("/")
      ? [selectedModel.split("/")[0], selectedModel.slice(selectedModel.indexOf("/") + 1)]
      : ["", selectedModel];
    const isGroqModel = selectedProvider === "groq" || GROQ_MODEL_IDS.has(selectedModelId) || selectedModelId.startsWith("groq-");

    if (selectedProvider === "9router") {
      const { baseUrl, apiKey } = getNineRouterConfig();
      if (!getNineRouterConfig().configured) {
        return NextResponse.json({ error: "9Router não está configurado neste servidor." }, { status: 503 });
      }
      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { ...nineRouterHeaders(apiKey), "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModelId || "auto",
          messages: [
            { role: "system", content: "Você é o motor de desenvolvimento do OpenUI Code Code. Entregue soluções técnicas corretas, econômicas em tokens, preserve o contexto e não invente resultados de execução." },
            { role: "user", content: message },
          ],
          stream: false,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(55000),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = payload?.error?.message || payload?.error || payload?.message || `9Router respondeu HTTP ${response.status}`;
        return NextResponse.json({ error: `Falha no 9Router: ${String(detail)}` }, { status: response.status >= 400 && response.status < 600 ? response.status : 502 });
      }
      const answer = payload?.choices?.[0]?.message?.content;
      const responseText = typeof answer === "string" ? answer : Array.isArray(answer) ? answer.map((part: any) => part?.text || "").join("\n") : "";
      if (!responseText.trim()) return NextResponse.json({ error: "9Router respondeu sem conteúdo. Confira os provedores e modelos ativos no painel do roteador." }, { status: 502 });
      return NextResponse.json({
        sessionId: sessionId || crypto.randomUUID(), clientChatId, message: responseText,
        modelUsed: payload?.model || selectedModelId || "auto", usage: payload?.usage || null, router: "9Router",
      });
    }

    if (isGroqModel && groqKey) {
      // Execute via Groq multi-model fallback cascade
      const cleanModelName = selectedModelId.replace(/^groq-/, "");
      const result = await callGroqWithFallback({
        messages: [
          {
            role: "system",
            content:
              "Você é o motor inteligente do plataforma de desenvolvimento. Auxilie o usuário no desenvolvimento de software de alta qualidade, arquitetura limpa, engenharia reversa ética e resolução de problemas técnicos com precisão.",
          },
          {
            role: "user",
            content: message,
          },
        ],
        preferredModel: cleanModelName,
        apiKey: groqKey,
      });

      let responseText = result.text;
      if (result.rateLimitedModels.length > 0) {
        responseText += `\n\n> ⚡ *[Groq Fallback Automático]*: Limite de taxa atingido em (${result.rateLimitedModels.join(", ")}). Resposta gerada via **${result.modelUsed}**.`;
      }

      return NextResponse.json({
        sessionId: sessionId || crypto.randomUUID(),
        clientChatId,
        message: responseText,
        modelUsed: result.modelUsed,
        rateLimitedModels: result.rateLimitedModels,
        tokensUsed: result.tokensUsed,
      });
    }

    // Otherwise, dispatch to SDK do motor de execução
    try {
      const api = getClient();
      let id = typeof sessionId === "string" && sessionId.length ? sessionId : "";
      if (!id) {
        const created: any = await api.session.create({ body: { title: message.slice(0, 72) } });
        id = created?.data?.id || crypto.randomUUID();
      }

      const body: any = { parts: [{ type: "text", text: message }] };
      if (typeof model === "string" && model.trim()) {
        const separator = model.indexOf("/");
        body.model = separator > 0
          ? { providerID: model.slice(0, separator), modelID: model.slice(separator + 1) }
          : { providerID: process.env.EXECUTOR_PROVIDER_ID || "openai", modelID: model };
      }

      const result: any = await api.session.prompt({ path: { id }, body });
      const parts = result?.data?.parts || [];
      const text = parts
        .filter((p: any) => p.type === "text")
        .map((p: any) => p.text)
        .join("\n")
        .trim();

      return NextResponse.json({
        sessionId: id,
        clientChatId,
        message: text || "Tarefa recebida pelo motor de execução.",
        parts,
      });
    } catch (opencodeErr) {
      // If motor de execução is not connected, but Groq key is present, fallback to Groq!
      if (groqKey) {
        const result = await callGroqWithFallback({
          messages: [
            {
              role: "system",
              content:
                "Você é o assistente de desenvolvimento da plataforma. O executor local está em espera, respondendo em modo autônomo de alta velocidade.",
            },
            { role: "user", content: message },
          ],
          preferredModel: "openai/gpt-oss-120b",
          apiKey: groqKey,
        });
        return NextResponse.json({
          sessionId: sessionId || crypto.randomUUID(),
          clientChatId,
          message: `${result.text}\n\n> ℹ️ *[Executado via Groq ${result.modelUsed} - Executor local em espera]*`,
        });
      }
      throw opencodeErr;
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno ao enviar instrução." },
      { status: 502 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (process.env.APP_ACCESS_TOKEN && req.headers.get("x-app-token") !== process.env.APP_ACCESS_TOKEN) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const { sessionId } = await req.json();
    if (typeof sessionId !== "string" || !sessionId) {
      throw new Error("Sessão não informada");
    }
    await getClient().session.abort({ path: { id: sessionId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível abortar." },
      { status: 502 }
    );
  }
}
