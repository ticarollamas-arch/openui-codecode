/**
 * Groq Multi-Model Fallback Service
 * Compatible with OpenAI SDK format at https://api.groq.com/openai/v1
 */

export interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GroqModelConfig {
  id: string;
  name: string;
  tier: "flagship" | "fast" | "reasoning" | "efficient";
  contextWindow: number;
}

// Modelos de produção atuais. A lista real é consultada na API /models da Groq;
// estes IDs servem apenas como fallback caso a listagem esteja indisponível.
export const GROQ_MODELS: GroqModelConfig[] = [
  { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B", tier: "flagship", contextWindow: 131072 },
  { id: "openai/gpt-oss-20b", name: "GPT-OSS 20B", tier: "fast", contextWindow: 131072 },
  { id: "qwen/qwen3.8-27b", name: "Qwen 3.8 27B", tier: "reasoning", contextWindow: 131072 },
  { id: "minimaxai/minimax-m2.7", name: "MiniMax M2.7", tier: "reasoning", contextWindow: 196608 },
];

export interface GroqExecutionResult {
  text: string;
  modelUsed: string;
  rateLimitedModels: string[];
  totalAttempts: number;
  tokensUsed?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

export async function callGroqWithFallback(options: {
  messages: GroqMessage[];
  preferredModel?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: "json_object" };
}): Promise<GroqExecutionResult> {
  const apiKey = options.apiKey || process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Chave da API Groq não informada. Configure GROQ_API_KEY no painel 'Minhas APIs' ou no ambiente."
    );
  }

  // Build the prioritized model list starting with the preferred model
  const preferred = options.preferredModel || "openai/gpt-oss-120b";
  let liveModels: string[] = [];
  try {
    const catalog = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey.trim()}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (catalog.ok) {
      const payload = await catalog.json();
      liveModels = (payload.data || []).map((item: any) => item.id).filter((id: unknown): id is string => typeof id === "string");
    }
  } catch { /* usa os modelos de produção conhecidos como contingência */ }
  const knownModels = GROQ_MODELS.map((item) => item.id);
  // Prefer the live catalog: stale hard-coded IDs must never block newly released models.
  const candidates = liveModels.length
    ? liveModels.filter((id) => !/(whisper|embedding|guard|tts|speech|transcrib)/i.test(id)).slice(0, 12)
    : knownModels;
  const priorityList = [preferred, ...candidates.filter((id) => id !== preferred)]
    .filter((id, index, all) => all.indexOf(id) === index)
    .filter((id) => !/(whisper|embedding|guard|tts|speech|transcrib)/i.test(id));

  const rateLimitedModels: string[] = [];
  let lastError: Error | null = null;
  let attempt = 0;

  for (const model of priorityList) {
    attempt++;
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          "Content-Type": "application/json",
          "User-Agent": "OpenCode-WebUI/2.0",
        },
        body: JSON.stringify({
          model,
          messages: options.messages,
          temperature: options.temperature ?? 0.3,
          max_tokens: options.maxTokens ?? 4096,
          ...(options.responseFormat ? { response_format: options.responseFormat } : {}),
        }),
      });

      // Handle Rate Limit (HTTP 429) or Service Unavailable (HTTP 503)
      if (response.status === 429 || response.status === 503) {
        const errorText = await response.text();
        console.warn(`[Groq Fallback] Modelo ${model} atingiu Rate Limit (${response.status}):`, errorText);
        rateLimitedModels.push(model);
        // Exponential short jitter backoff before testing next model
        await new Promise((r) => setTimeout(r, 200 * attempt));
        continue;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.error?.message || `Groq API erro ${response.status}: ${response.statusText}`;
        // Modelo removido/incompatível: registra e tenta o próximo modelo ativo.
        if (response.status === 400 || response.status === 404 || response.status === 422) {
          lastError = new Error(message);
          rateLimitedModels.push(`${model} (indisponível)`);
          continue;
        }
        throw new Error(message);
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || "";

      return {
        text,
        modelUsed: model,
        rateLimitedModels,
        totalAttempts: attempt,
        tokensUsed: data.usage
          ? {
              prompt: data.usage.prompt_tokens,
              completion: data.usage.completion_tokens,
              total: data.usage.total_tokens,
            }
          : undefined,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // If error is authentication/bad-request, fail immediately without exhausting fallback
      if (
        lastError.message.includes("401") ||
        lastError.message.includes("Invalid API Key") ||
        lastError.message.includes("unauthorized") ||
        lastError.message.includes("API key") ||
        lastError.message.includes("Invalid API Key")
      ) {
        throw lastError;
      }
      console.warn(`[Groq Error] Falha no modelo ${model}: ${lastError.message}`);
    }
  }

  throw new Error(
    `Nenhum modelo ativo da Groq conseguiu responder. Último erro: ${lastError?.message || "Rate limit esgotado"}. Modelos testados: ${priorityList.join(", ")}`
  );
}
