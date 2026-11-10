import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { createOpencodeClient } from "@opencode-ai/sdk";
import { callGroqWithFallback } from "@/lib/groq";
import { getNineRouterConfig, nineRouterHeaders } from "@/lib/ninerouter";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_ARCHIVE_BYTES = 3 * 1024 * 1024;
const MAX_CONTEXT_CHARS = 105_000;
const MAX_FILES = 180;
const MAX_OUTPUT_FILES = 220;
const MAX_OUTPUT_BYTES = 18 * 1024 * 1024;
const EXCLUDED = /(^|\/)(\.git|node_modules|\.next|dist|build|coverage)(\/|$)|(^|\/)(\.env(?:\..*)?|.*\.(?:pem|key)|id_rsa|credentials\.json|\.npmrc|\.pypirc)$/i;
const TEXT_EXT = /\.(?:txt|md|mdx|json|js|jsx|ts|tsx|css|scss|html|xml|yml|yaml|toml|py|go|rs|java|kt|sql|sh|bash|env\.example|gitignore|dockerignore|conf|ini|svg)$/i;

function safePath(input: string) {
  const path = input.replace(/\\/g, "/").replace(/^\.\//, "");
  if (!path || path.startsWith("/") || path.split("/").some((part) => !part || part === ".." || part === ".")) return null;
  const isExampleEnv = /(^|\/)\.env\.example$/i.test(path);
  if (!isExampleEnv && EXCLUDED.test(path)) return null;
  return path;
}

function extractJson(text: string): any {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(trimmed); } catch { /* tenta extrair objeto */ }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
  throw new Error("A IA não retornou o manifesto de arquivos em JSON válido. Peça novamente para gerar o ZIP.");
}

async function readArchive(file: File | null, base64: string) {
  let bytes: Uint8Array | null = null;
  if (file) {
    if (!file.name.toLowerCase().endsWith(".zip")) throw new Error("Para atualizar um projeto existente, anexe o projeto em formato ZIP.");
    if (file.size > MAX_ARCHIVE_BYTES) throw new Error("O ZIP excede o limite de 3 MB da função serverless da Vercel. Para projetos maiores, use o executor em VPS/armazenamento de arquivos.");
    bytes = new Uint8Array(await file.arrayBuffer());
  } else if (base64) {
    const clean = base64.replace(/^data:.*?;base64,/, "");
    if (clean.length > MAX_ARCHIVE_BYTES * 1.5) throw new Error("O projeto anterior excede o limite de processamento.");
    bytes = new Uint8Array(Buffer.from(clean, "base64"));
  }
  if (!bytes) return { files: [] as { path: string; content: string }[], tree: "(projeto novo)", projectName: "openui-project", originalZip: null as JSZip | null, hasArchive: false };

  const zip = await JSZip.loadAsync(bytes, { checkCRC32: false });
  const files: { path: string; content: string }[] = [];
  const tree: string[] = [];
  let totalChars = 0;
  for (const [rawName, item] of Object.entries(zip.files) as [string, JSZip.JSZipObject][]) {
    if (item.dir) continue;
    const path = safePath(rawName);
    if (!path) continue;
    tree.push(path);
    const uncompressedSize = (item as any)._data?.uncompressedSize || 0;
    if (!TEXT_EXT.test(path) || files.length >= MAX_FILES || totalChars >= MAX_CONTEXT_CHARS || uncompressedSize > 180_000) continue;
    const bytes = await item.async("uint8array");
    if (bytes.byteLength > 180_000) continue;
    const content = Buffer.from(bytes).toString("utf8");
    if (content.includes("\u0000")) continue;
    const clipped = content.slice(0, Math.max(0, MAX_CONTEXT_CHARS - totalChars));
    files.push({ path, content: clipped });
    totalChars += clipped.length;
  }
  if (!tree.length) throw new Error("O ZIP está vazio ou contém somente arquivos excluídos por segurança.");
  const first = tree[0].split("/")[0];
  const projectName = first && tree.every((path) => path.startsWith(`${first}/`)) ? first : "openui-project";
  return { files, tree: tree.slice(0, 400).join("\n"), projectName, originalZip: zip, hasArchive: true };
}

export async function POST(req: NextRequest) {
  try {
    if (process.env.APP_ACCESS_TOKEN && req.headers.get("x-app-token") !== process.env.APP_ACCESS_TOKEN) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const form = await req.formData();
    const prompt = String(form.get("prompt") || "").trim();
    const model = String(form.get("model") || "openai/gpt-oss-120b");
    const archive = form.get("archive");
    const archiveFile = archive instanceof File ? archive : null;
    const archiveBase64 = String(form.get("archiveBase64") || "");
    const groqKey = String(form.get("groqApiKey") || process.env.GROQ_API_KEY || "").trim();
    const customServerUrl = String(form.get("customServerUrl") || process.env.OPENCODE_SERVER_URL || "").trim();
    const customServerPassword = String(form.get("customServerPassword") || process.env.OPENCODE_SERVER_PASSWORD || "");
    if (!prompt) return NextResponse.json({ error: "Descreva o que deseja construir ou alterar." }, { status: 400 });

    const source = await readArchive(archiveFile, archiveBase64);
    const preferredModel = model.startsWith("groq/") ? model.slice(5) : "openai/gpt-oss-120b";
    const projectContext = source.files.map((f) => `\n--- FILE: ${f.path} ---\n${f.content}`).join("\n");
    const system = `Você é o agente executor de projetos da OpenUI Code Code. Sua saída será transformada automaticamente em arquivos reais e empacotada em ZIP. NÃO escreva blocos de código na resposta textual. Retorne SOMENTE JSON válido no formato {"summary":"resumo curto em português","files":[{"path":"caminho/arquivo.ext","content":"conteúdo integral do arquivo"}],"checks":["verificações feitas ou não executadas"]}.\n\nREGRAS OBRIGATÓRIAS:\n- Produza arquivos completos, coerentes e executáveis, não exemplos parciais nem pseudocódigo.\n- Preserve a estrutura e os arquivos existentes que não precisem mudar; para cada arquivo alterado, devolva o conteúdo integral. Inclua os arquivos novos.\n- Não apague arquivos sem necessidade. Preserve configurações e dependências existentes, atualizando-as somente quando necessário.\n- Sempre crie ou atualize README.md com instalação, configuração, execução, variáveis de ambiente e funcionalidades.\n- Inclua testes ou verificações automatizáveis quando fizer sentido. Não alegue que executou testes/build que não executou.\n- Não inclua segredos, tokens, chaves privadas, .env real, node_modules, .git, artefatos de build ou arquivos binários no ZIP. Crie .env.example sem valores secretos quando necessário.\n- Caminhos relativos, sem '..', sem caminhos absolutos.\n- Se o pedido envolver engenharia reversa, só trabalhe com software que o usuário possui ou tem autorização para modificar. Reimplemente comportamento e arquitetura de forma independente; não copie código proprietário, marcas, logos, identidade visual distintiva nem remova marcas d'água para ocultar autoria. Use identidade visual nova e ativos substitutos. Preserve somente a estrutura técnica necessária e legalmente autorizada.\n- Se o contexto estiver truncado, priorize os arquivos essenciais e declare limitações em summary/checks.\n- Retorne o conteúdo de cada arquivo como string JSON válida, escapando quebras de linha e aspas. Não use markdown ao redor do JSON.`;

    const user = `PEDIDO DO USUÁRIO:\n${prompt}\n\nMODO: ${source.hasArchive ? "ATUALIZAR PROJETO EXISTENTE" : "CRIAR PROJETO DO ZERO"}\nNOME DA PASTA PRINCIPAL: ${source.projectName}\n\nÁRVORE DO PROJETO ORIGINAL:\n${source.tree}\n\nCONTEÚDO TEXTUAL DISPONÍVEL (arquivos sensíveis e binários foram excluídos):\n${projectContext || "Nenhum arquivo de texto de origem."}\n\nEntregue a versão final completa em JSON, incluindo README.md.`;

    let generatedText = "";
    let modelUsed = preferredModel;
    let tokensUsed: { prompt: number; completion: number; total: number } | undefined;
    const useOpenCode = Boolean(customServerUrl) && !model.startsWith("9router/");
    const useNineRouter = model.startsWith("9router/");
    if (!useOpenCode && !useNineRouter && !model.startsWith("groq/")) {
      throw new Error("Selecione 9Router Auto, conecte um servidor OpenCode ou selecione um modelo Groq.");
    }
    if (useNineRouter) {
      const { baseUrl, apiKey } = getNineRouterConfig();
      if (!getNineRouterConfig().configured) throw new Error("9Router não está configurado no servidor.");
      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { ...nineRouterHeaders(apiKey), "Content-Type": "application/json" },
        body: JSON.stringify({
          model: model.slice("9router/".length) || "auto",
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
          temperature: 0.15,
          max_tokens: 8192,
          response_format: { type: "json_object" },
          stream: false,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(55000),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(`9Router: ${payload?.error?.message || payload?.error || payload?.message || `HTTP ${response.status}`}`);
      const content = payload?.choices?.[0]?.message?.content;
      generatedText = typeof content === "string" ? content : Array.isArray(content) ? content.map((part: any) => part?.text || "").join("\n") : "";
      modelUsed = payload?.model || "9router/auto";
      tokensUsed = payload?.usage ? { prompt: payload.usage.prompt_tokens || 0, completion: payload.usage.completion_tokens || 0, total: payload.usage.total_tokens || 0 } : undefined;
      if (!generatedText.trim()) throw new Error("9Router não retornou o manifesto JSON do projeto.");
    } else if (useOpenCode) {
      const client = createOpencodeClient({
        baseUrl: customServerUrl,
        throwOnError: true,
        headers: customServerPassword
          ? { Authorization: `Basic ${Buffer.from(`opencode:${customServerPassword}`).toString("base64")}` }
          : undefined,
      });
      const created: any = await client.session.create({ body: { title: `OpenUI: ${prompt.slice(0, 64)}` } });
      const sessionId = created?.data?.id;
      if (!sessionId) throw new Error("OpenCode não retornou um identificador de sessão.");
      const separator = model.indexOf("/");
      const requestBody: any = {
        parts: [{ type: "text", text: `${system}\n\n${user}` }],
      };
      if (separator > 0) requestBody.model = { providerID: model.slice(0, separator), modelID: model.slice(separator + 1) };
      const answer: any = await client.session.prompt({ path: { id: sessionId }, body: requestBody });
      generatedText = (answer?.data?.parts || []).filter((part: any) => part.type === "text").map((part: any) => part.text).join("\n");
      modelUsed = model;
      await client.session.delete({ path: { id: sessionId } }).catch(() => undefined);
    } else {
      if (!groqKey) throw new Error("Conecte uma API Groq ou configure o servidor OpenCode nas configurações para gerar projetos ZIP.");
      const result = await callGroqWithFallback({
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        preferredModel,
        apiKey: groqKey,
        temperature: 0.15,
        maxTokens: 8192,
        responseFormat: { type: "json_object" },
      });
      generatedText = result.text;
      modelUsed = result.modelUsed;
      tokensUsed = result.tokensUsed;
    }
    const manifest = extractJson(generatedText);
    if (!Array.isArray(manifest.files) || manifest.files.length === 0) throw new Error("A IA não entregou arquivos para montar o projeto.");

    const output = new JSZip();
    const seen = new Set<string>();
    let totalBytes = 0;
    // Merge the source archive first so untouched assets and files survive revisions.
    if (source.originalZip) {
      for (const [rawPath, item] of Object.entries(source.originalZip.files) as [string, JSZip.JSZipObject][]) {
        if (item.dir) continue;
        const path = safePath(rawPath);
        if (!path || seen.has(path) || seen.size >= MAX_OUTPUT_FILES) continue;
        const uncompressedSize = (item as any)._data?.uncompressedSize || 0;
        if (uncompressedSize > 4 * 1024 * 1024 || totalBytes + uncompressedSize > MAX_OUTPUT_BYTES) continue;
        const bytes = await item.async("uint8array");
        totalBytes += bytes.byteLength;
        output.file(path, bytes);
        seen.add(path);
      }
    }
    for (const entry of manifest.files.slice(0, MAX_OUTPUT_FILES)) {
      if (!entry || typeof entry.path !== "string" || typeof entry.content !== "string") continue;
      const path = safePath(entry.path);
      if (!path) continue;
      if (Buffer.byteLength(entry.content, "utf8") > 1_500_000) continue;
      const contentBytes = Buffer.byteLength(entry.content, "utf8");
      if (totalBytes + contentBytes > MAX_OUTPUT_BYTES) break;
      totalBytes += contentBytes;
      seen.add(path);
      output.file(path, entry.content);
    }
    const hasReadme = [...seen].some((path) => /(^|\/)README\.md$/i.test(path));
    if (!hasReadme) {
      const readmePath = source.projectName === "openui-project" ? "README.md" : `${source.projectName}/README.md`;
      output.file(readmePath, `# ${source.projectName}\n\n${String(manifest.summary || "Projeto gerado com OpenUI Code Code.")}\n\n## Instalação e execução\n\nConsulte os arquivos de configuração do projeto e instale as dependências indicadas.\n\n## Configuração\n\nUse .env.example como referência. Nunca coloque credenciais reais no repositório.\n`);
      seen.add(readmePath);
    }
    if (!seen.size) throw new Error("Nenhum arquivo seguro foi retornado para o ZIP.");
    const zipBytes = await output.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
    if (zipBytes.byteLength > 3 * 1024 * 1024) {
      throw new Error("O ZIP final ultrapassou 3 MB, limite seguro de resposta da Vercel. Para projetos maiores, conecte um armazenamento S3 ou use o executor em VPS.");
    }
    const zipBase64 = zipBytes.toString("base64");

    return NextResponse.json({
      ok: true,
      summary: typeof manifest.summary === "string" ? manifest.summary : "Projeto atualizado e empacotado.",
      checks: ["Estrutura e arquivos empacotados no ZIP.", "Build e testes automatizados não foram executados nesta função serverless."],
      fileCount: seen.size,
      zipBase64,
      fileName: `${source.projectName}-openui.zip`,
      modelUsed,
      tokensUsed,
      mode: source.hasArchive ? "update" : "create",
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao executar e empacotar o projeto." }, { status: 500 });
  }
}
