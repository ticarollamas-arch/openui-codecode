import { NextRequest, NextResponse } from "next/server";
import { createOpencodeClient } from "@opencode-ai/sdk";
import { callGroqWithFallback, GROQ_MODELS } from "@/lib/groq";

export const runtime = "nodejs";
export const maxDuration = 60;

function getClient(userUrl?: string, userPassword?: string) {
  const url = userUrl || process.env.OPENCODE_SERVER_URL || "http://127.0.0.1:4096";
  const password = userPassword || process.env.OPENCODE_SERVER_PASSWORD;
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
      customServerUrl,
      customServerPassword,
      userApiKeys,
    } = await req.json();

    if (typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });
    }

    const selectedModel = model || "llama-3.3-70b-versatile";
    const groqKey = userApiKeys?.groq || process.env.GROQ_API_KEY;
    const [selectedProvider, selectedModelId] = selectedModel.includes("/")
      ? [selectedModel.split("/")[0], selectedModel.slice(selectedModel.indexOf("/") + 1)]
      : ["", selectedModel];
    const isGroqModel = selectedProvider === "groq" || GROQ_MODEL_IDS.has(selectedModelId) || selectedModelId.startsWith("groq-");

    if (isGroqModel && groqKey) {
      // Execute via Groq multi-model fallback cascade
      const cleanModelName = selectedModelId.replace(/^groq-/, "");
      const result = await callGroqWithFallback({
        messages: [
          {
            role: "system",
            content:
              "Você é o motor inteligente do OpenCode WebUI. Auxilie o usuário no desenvolvimento de software de alta qualidade, arquitetura limpa, engenharia reversa ética e resolução de problemas técnicos com precisão.",
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

    // Otherwise, dispatch to OpenCode Executor SDK
    try {
      const api = getClient(customServerUrl, customServerPassword);
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
          : { providerID: process.env.OPENCODE_PROVIDER_ID || "openai", modelID: model };
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
        message: text || "Tarefa recebida pelo OpenCode.",
        parts,
      });
    } catch (opencodeErr) {
      // If OpenCode executor is not connected, but Groq key is present, fallback to Groq!
      if (groqKey) {
        const result = await callGroqWithFallback({
          messages: [
            {
              role: "system",
              content:
                "Você é o assistente de desenvolvimento OpenCode. O executor local está em espera, respondendo em modo autônomo de alta velocidade.",
            },
            { role: "user", content: message },
          ],
          preferredModel: "llama-3.3-70b-versatile",
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
    const { sessionId, customServerUrl, customServerPassword } = await req.json();
    if (typeof sessionId !== "string" || !sessionId) {
      throw new Error("Sessão não informada");
    }
    await getClient(customServerUrl, customServerPassword).session.abort({ path: { id: sessionId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível abortar." },
      { status: 502 }
    );
  }
}
