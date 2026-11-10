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

// Ordered list of Groq models for cascading fallback
export const GROQ_MODELS: GroqModelConfig[] = [
  {
    id: "llama-3.3-70b-versatile",
    name: "Llama 3.3 70B Versatile (Alta Inteligência)",
    tier: "flagship",
    contextWindow: 128000,
  },
  {
    id: "llama-3.1-8b-instant",
    name: "Llama 3.1 8B Instant (Ultra-Rápido)",
    tier: "fast",
    contextWindow: 128000,
  },
  {
    id: "qwen-qwq-32b",
    name: "Qwen QwQ 32B (Raciocínio & Código)",
    tier: "reasoning",
    contextWindow: 32768,
  },
  {
    id: "mixtral-8x7b-32768",
    name: "Mixtral 8x7B (Contexto Balanceado)",
    tier: "efficient",
    contextWindow: 32768,
  },
  {
    id: "gemma2-9b-it",
    name: "Gemma 2 9B IT (Google / Rápido)",
    tier: "fast",
    contextWindow: 8192,
  },
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
}): Promise<GroqExecutionResult> {
  const apiKey = options.apiKey || process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Chave da API Groq não informada. Configure GROQ_API_KEY no painel 'Minhas APIs' ou no ambiente."
    );
  }

  // Build the prioritized model list starting with the preferred model
  const preferred = options.preferredModel || "llama-3.3-70b-versatile";
  const priorityList = [
    preferred,
    ...GROQ_MODELS.map((m) => m.id).filter((id) => id !== preferred),
  ];

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
        throw new Error(
          errorData.error?.message || `Groq API erro ${response.status}: ${response.statusText}`
        );
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
        lastError.message.includes("unauthorized")
      ) {
        throw lastError;
      }
      console.warn(`[Groq Error] Falha no modelo ${model}: ${lastError.message}`);
    }
  }

  throw new Error(
    `Todos os modelos da Groq atingiram limites ou falharam. Último erro: ${lastError?.message || "Rate limit esgotado"}. Modelos testados: ${priorityList.join(", ")}`
  );
}
