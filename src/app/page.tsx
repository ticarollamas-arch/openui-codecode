"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  Paperclip,
  Plus,
  Settings2,
  MessageSquare,
  Code2,
  FolderOpen,
  X,
  Square,
  Check,
  AlertCircle,
  Menu,
  Copy,
  Github,
  Puzzle,
  UploadCloud,
  RefreshCw,
  Trash2,
  ExternalLink,
  Key,
  Eye,
  EyeOff,
  LogOut,
  CheckCircle2,
  Sparkles,
  Zap,
  ShieldCheck,
  Layers,
  FileCode,
  Sliders,
  ChevronRight,
  Terminal,
  Instagram,
  Search,
  Cpu,
  PlugZap,
  Database,
  CircleDollarSign,
} from "lucide-react";

type Chat = { id: string; title: string; updatedAt: number };
type Msg = { id: string; role: "user" | "assistant"; text: string; time: number; status?: string; artifact?: { id: string; fileName: string; fileCount: number } };
type PendingTask = { chatId: string; text: string; files: File[] };
type Skill = { id: string; name: string; description: string; category?: string; tags?: string[]; version?: string };
type GitHubUser = {
  login: string;
  name: string;
  avatar_url: string;
  html_url: string;
  public_repos?: number;
};

type ProviderModel = { id: string; name: string; context: number | null; output: number | null; inputPrice: number | null; outputPrice: number | null; free: boolean; modalities?: any };
type ProviderInfo = { id: string; name: string; connected: boolean; authMethods?: { type: string; label?: string }[]; models: ProviderModel[] };

type ReverseEngResult = {
  fileName: string;
  fileSize: number;
  totalFiles: number;
  detectedFramework: string;
  dependencies: Record<string, string>;
  componentsCount: number;
  routesCount: number;
  structureTree: string[];
};

const STORE = "opencode-workspace-v4";

// Modelos Groq de produção; o fallback consulta a lista ativa da própria Groq.
const MODELS = [
  { id: "groq/openai/gpt-oss-120b", label: "GPT-OSS 120B (Groq · Raciocínio e código)", group: "Groq" },
  { id: "groq/openai/gpt-oss-20b", label: "GPT-OSS 20B (Groq · Rápido)", group: "Groq" },
  { id: "groq/qwen/qwen3.8-27b", label: "Qwen 3.8 27B (Groq · Raciocínio)", group: "Groq" },
  { id: "groq/minimaxai/minimax-m2.7", label: "MiniMax M2.7 (Groq)", group: "Groq" },
];

const SKILL_CATEGORIES = [
  "Todas",
  "Engenharia Reversa",
  "IA & Modelos Groq",
  "Frontend & UI",
  "Backend & APIs",
  "Segurança & Auth",
  "Bancos de Dados",
  "DevOps & CI/CD",
  "Arquitetura & Clean Code",
];

export default function Home() {
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<"chat" | "reverse" | "skills" | "apresentacao">("chat");
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Chats
  const [chats, setChats] = useState<Chat[]>([]);
  const [active, setActive] = useState("");
  const [messages, setMessages] = useState<Record<string, Msg[]>>({});
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);
  const [model, setModel] = useState("groq/openai/gpt-oss-120b");
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState("Pronto para trabalhar");
  const [serverReady, setServerReady] = useState<boolean | null>(null);
  const [sessionMap, setSessionMap] = useState<Record<string, string>>({});

  // 20k Skills state with Progressive Disclosure
  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillsTotal, setSkillsTotal] = useState(0);
  const [skillQuery, setSkillQuery] = useState("");
  const [skillCategory, setSkillCategory] = useState("Todas");
  const [skillsPage, setSkillsPage] = useState(1);
  const [selectedSkillDetail, setSelectedSkillDetail] = useState<any>(null);
  const [loadingSkillDetail, setLoadingSkillDetail] = useState(false);

  // Reverse Engineering & ZIP State
  const [zip, setZip] = useState<File | null>(null);
  const [zipValidation, setZipValidation] = useState<{ valid: boolean; message: string; filesCount?: number } | null>(null);
  const [reverseBusy, setReverseBusy] = useState(false);
  const [reverseResult, setReverseResult] = useState<ReverseEngResult | null>(null);

  // GitHub Publish State
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [githubBusy, setGithubBusy] = useState(false);
  const [publishNotice, setPublishNotice] = useState("");

  // GitHub Auth
  const [githubAuthModal, setGithubAuthModal] = useState(false);
  const [githubUser, setGithubUser] = useState<GitHubUser | null>(null);
  const [verifyingToken, setVerifyingToken] = useState(false);
  const [authFeedback, setAuthFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Settings
  const [settings, setSettings] = useState(false);
  const [providerCatalog, setProviderCatalog] = useState<ProviderInfo[]>([]);
  const [providerSearch, setProviderSearch] = useState("");
  const [providerLoading, setProviderLoading] = useState(false);
  const [providerError, setProviderError] = useState("");
  const [activeProvider, setActiveProvider] = useState("");
  const [providerFeedback, setProviderFeedback] = useState("");
  const [routerStatus, setRouterStatus] = useState<"not-configured" | "offline" | "ready">("not-configured");
  const [routerBusy, setRouterBusy] = useState(false);
  const [routerFeedback, setRouterFeedback] = useState("");
  const [routerDefaultModel, setRouterDefaultModel] = useState("");

  const endRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const taskQueueRef = useRef<PendingTask[]>([]);
  const workspaceByChatRef = useRef<Record<string, { base64: string; fileName: string }>>({});
  const artifactByIdRef = useRef<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  const current = messages[active] || [];

  const loadProviderCatalog = async () => {
    setProviderLoading(true);
    setProviderError("");
    try {
      const response = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.hint || "Não foi possível carregar os modelos.");
      setProviderCatalog(data.providers || []);
      setRouterStatus(data.router?.connected ? "ready" : data.router?.configured ? "offline" : "not-configured");
      setRouterDefaultModel(data.router?.defaultModel || "");
      if (data.router?.error) setRouterFeedback(data.router.error);
      setActiveProvider((current) => current || data.providers?.find((p: ProviderInfo) => p.connected)?.id || data.providers?.[0]?.id || "");
    } catch (error) {
      setProviderError(error instanceof Error ? error.message : "Falha ao consultar o catálogo de modelos.");
    } finally {
      setProviderLoading(false);
    }
  };

  const startNineRouter = async () => {
    setRouterBusy(true);
    setRouterFeedback("");
    try {
      const response = await fetch("/api/9router/start", { method: "POST", cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Não foi possível conectar ao 9Router.");
      setRouterStatus("ready");
      setRouterDefaultModel(data.defaultModel);
      setModel(`9router/${data.defaultModel}`);
      setRouterFeedback(`Ativo · ${data.modelCount} modelos sincronizados · combo ${data.defaultModel} selecionado.`);
      await loadProviderCatalog();
    } catch (error) {
      setRouterStatus("offline");
      setRouterFeedback(error instanceof Error ? error.message : "Falha ao iniciar 9Router.");
    } finally {
      setRouterBusy(false);
    }
  };

  const syncNineRouter = async () => {
    setRouterBusy(true);
    setRouterFeedback("");
    try {
      const response = await fetch("/api/9router/models", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.connected) throw new Error(data.error || data.message || "9Router não está disponível.");
      setRouterStatus("ready");
      setRouterFeedback(`${data.models.length} modelos sincronizados com o 9Router.`);
      await loadProviderCatalog();
    } catch (error) {
      setRouterStatus("offline");
      setRouterFeedback(error instanceof Error ? error.message : "Falha ao sincronizar catálogo.");
    } finally {
      setRouterBusy(false);
    }
  };

  const visibleProviders = providerCatalog.filter((provider) => {
    const query = providerSearch.trim().toLowerCase();
    return !query || provider.name.toLowerCase().includes(query) || provider.id.toLowerCase().includes(query) || provider.models.some((item) => item.name.toLowerCase().includes(query) || item.id.toLowerCase().includes(query));
  });
  const selectedProviderInfo = providerCatalog.find((provider) => provider.id === activeProvider);
  const visibleModels = (selectedProviderInfo?.models || []).filter((item) => {
    const query = providerSearch.trim().toLowerCase();
    return !query || item.name.toLowerCase().includes(query) || item.id.toLowerCase().includes(query);
  });

  useEffect(() => {
    if (hydrated) void loadProviderCatalog();
  }, [hydrated]);

  // Hydration
  useEffect(() => {
    try {
      const s = localStorage.getItem(STORE);
      if (s) {
        const d = JSON.parse(s);
        setChats(d.chats || []);
        setMessages(d.messages || {});
        setActive(d.active || d.chats?.[0]?.id || "");
        const oldModel = d.model || "";
        const retiredGroqModels = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "qwen-qwq-32b", "mixtral-8x7b-32768", "gemma2-9b-it"];
        setModel(retiredGroqModels.includes(oldModel) ? "groq/openai/gpt-oss-120b" : (oldModel || "groq/openai/gpt-oss-120b"));
        setSessionMap(d.sessionMap || {});
        if (d.tab) setTab(d.tab);
      }
      try {
        const cachedWorkspaceRaw = sessionStorage.getItem("openui-code-code-workspace");
        if (cachedWorkspaceRaw) {
          const cachedWorkspace = JSON.parse(cachedWorkspaceRaw);
          if (cachedWorkspace?.chatId && cachedWorkspace?.base64 && cachedWorkspace?.fileName) {
            workspaceByChatRef.current[cachedWorkspace.chatId] = { base64: cachedWorkspace.base64, fileName: cachedWorkspace.fileName };
            if (cachedWorkspace.artifactId) artifactByIdRef.current[cachedWorkspace.artifactId] = cachedWorkspace.base64;
            const binary = atob(cachedWorkspace.base64);
            const bytes = new Uint8Array(binary.length);
            for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
            setZip(new File([bytes.buffer as ArrayBuffer], cachedWorkspace.fileName, { type: "application/zip" }));
            setZipValidation({ valid: true, message: `Projeto recuperado da sessão: ${cachedWorkspace.fileName}.` });
          }
        }
      } catch { /* cache opcional; não bloqueia a hidratação da interface */ }
      localStorage.removeItem("opencode-github-token");
      localStorage.removeItem("opencode-github-user");
      // Credenciais de provedores são administradas exclusivamente no servidor.
      localStorage.removeItem("opencode-user-api-keys");
    } catch {
      // Ignore
    } finally {
      setHydrated(true);
    }
  }, []);

  // Save State
  useEffect(() => {
    if (hydrated) {
      localStorage.setItem(
        STORE,
        JSON.stringify({ chats, messages, active, model, sessionMap, tab })
      );
    }
  }, [chats, messages, active, model, sessionMap, tab, hydrated]);

  useEffect(() => {
    if (!active && chats.length) setActive(chats[0].id);
  }, [active, chats]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [current.length, busy]);

  // Load health & initial skills
  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setServerReady(!!d.ok))
      .catch(() => setServerReady(false));
    loadSkills(1, skillQuery, skillCategory);
  }, []);

  // Load Skills with Progressive Disclosure
  async function loadSkills(page = 1, query = skillQuery, category = skillCategory) {
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "24",
      });
      if (query.trim()) params.set("q", query.trim());
      if (category && category !== "Todas") params.set("category", category);

      const r = await fetch(`/api/skills?${params.toString()}`);
      const d = await r.json();
      setSkills(d.skills || []);
      setSkillsTotal(d.total || 0);
      setSkillsPage(d.page || 1);
    } catch {
      setSkills([]);
    }
  }

  // Progressive Disclosure: Load Level 2 Detail on demand
  async function inspectSkillDetail(skillId: string) {
    setLoadingSkillDetail(true);
    try {
      const res = await fetch(`/api/skills?detail=${encodeURIComponent(skillId)}`);
      const data = await res.json();
      if (data.skill) {
        setSelectedSkillDetail(data.skill);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSkillDetail(false);
    }
  }

  function injectSkillIntoChat(promptSnippet: string) {
    setInput((prev) => (prev ? `${prev}\n\n${promptSnippet}` : promptSnippet));
    setTab("chat");
    setDrawerOpen(false);
    setSelectedSkillDetail(null);
  }

  function newChat() {
    const id = crypto.randomUUID();
    setChats((v) => [{ id, title: "Nova conversa", updatedAt: Date.now() }, ...v]);
    setMessages((v) => ({ ...v, [id]: [] }));
    setActive(id);
    setInput("");
    setFiles([]);
    setTab("chat");
    setDrawerOpen(false);
  }

  function deleteChat(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setChats((v) => v.filter((c) => c.id !== id));
    setMessages((v) => {
      const copy = { ...v };
      delete copy[id];
      return copy;
    });
    if (active === id) {
      const remaining = chats.filter((c) => c.id !== id);
      setActive(remaining[0]?.id || "");
    }
  }

  function addMessage(id: string, m: Msg) {
    setMessages((v) => ({ ...v, [id]: [...(v[id] || []), m] }));
  }

  // Handle ZIP file selection & instant validation (Fixes UI bug where button stays disabled)
  async function handleZipSelection(selectedFile: File | null) {
    if (!selectedFile) {
      setZip(null);
      setZipValidation(null);
      return;
    }

    if (!selectedFile.name.toLowerCase().endsWith(".zip")) {
      setZip(null);
      setZipValidation({
        valid: false,
        message: "O arquivo selecionado não possui extensão .zip válida.",
      });
      return;
    }

    if (selectedFile.size > 3 * 1024 * 1024) {
      setZip(null);
      setZipValidation({
        valid: false,
        message: "O arquivo excede o limite de 3 MB desta implantação Vercel.",
      });
      return;
    }

    setZip(selectedFile);
    setZipValidation({
      valid: true,
      message: `Arquivo válido: ${selectedFile.name} (${(selectedFile.size / 1024 / 1024).toFixed(2)} MB)`,
    });
  }

  // Execute Clean-Room Reverse Engineering
  async function runReverseEngineering() {
    if (!zip) return;
    setReverseBusy(true);
    setReverseResult(null);
    try {
      const fd = new FormData();
      fd.append("archive", zip);
      const res = await fetch("/api/reverse-engineering", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha na análise de engenharia reversa.");
      setReverseResult(data);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro na engenharia reversa.");
    } finally {
      setReverseBusy(false);
    }
  }

  // Send reverse engineering prompt to the configured execution engine / Groq
  function sendReversePromptToChat() {
    if (!reverseResult || !zip) return;
    const text = "Faça uma recriação Clean-Room do ZIP anexado. Preserve a estrutura técnica e os arquivos necessários, atualize o README, implemente o projeto funcional com identidade visual original e entregue um novo ZIP completo. Trabalhe somente com conteúdo que tenho autorização para modificar.";
    let id = active;
    if (!id) {
      id = crypto.randomUUID();
      setChats((v) => [{ id, title: "Recriação do projeto", updatedAt: Date.now() }, ...v]);
      setMessages((v) => ({ ...v, [id]: [] }));
      setActive(id);
    }
    const task: PendingTask = { chatId: id, text, files: [zip] };
    addUserTaskMessage(task);
    setInput("");
    setFiles([]);
    setTab("chat");
    if (busyRef.current) {
      taskQueueRef.current.push(task);
      setQueuedCount(taskQueueRef.current.length);
    } else {
      void drainTaskQueue(task);
    }
  }

  function addUserTaskMessage(task: PendingTask) {
    const names = task.files.map((f) => f.name);
    const userText = task.text + (names.length ? `\n\nAnexos selecionados: ${names.join(", ")}` : "");
    addMessage(task.chatId, { id: crypto.randomUUID(), role: "user", text: userText, time: Date.now() });
    setChats((v) => v.map((c) => c.id === task.chatId
      ? { ...c, title: task.text.slice(0, 42) || names[0] || "Nova tarefa", updatedAt: Date.now() }
      : c));
  }

  function downloadWorkspaceZip(artifactId: string, fileName: string) {
    const base64 = artifactByIdRef.current[artifactId];
    if (!base64) {
      window.alert("Este arquivo não está mais disponível nesta sessão. Anexe novamente o ZIP anterior para continuar.");
      return;
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function executeTask(task: PendingTask) {
    const zipAttachment = task.files.find((f) => f.name.toLowerCase().endsWith(".zip"));
    const previousWorkspace = workspaceByChatRef.current[task.chatId];
    const projectIntent = /\b(crie|criar|desenvolva|desenvolver|construa|construir|implemente|implementar|atualize|atualizar|modifique|modificar|corrija|corrigir|refatore|refatorar|adicione|adicionar|remova|remover|gere|gerar|exporte|empacote|projeto|aplicativo|aplicação|site|sistema|pasta|arquivos|código|codigo|zip|engenharia reversa)\b/i.test(task.text);
    const workspaceMode = Boolean(zipAttachment || previousWorkspace || projectIntent);

    try {
      if (workspaceMode) {
        setStatus(previousWorkspace || zipAttachment ? "Lendo estrutura e preparando alterações..." : "Construindo projeto e preparando arquivos...");
        const form = new FormData();
        form.append("prompt", task.text || "Analise e organize o projeto anexado.");
        form.append("model", model);
        if (zipAttachment) form.append("archive", zipAttachment);
        else if (previousWorkspace) form.append("archiveBase64", previousWorkspace.base64);

        const response = await fetch("/api/workspace", { method: "POST", body: form });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Não foi possível gerar o projeto.");
        workspaceByChatRef.current[task.chatId] = { base64: data.zipBase64, fileName: data.fileName };
        const artifactId = crypto.randomUUID();
        artifactByIdRef.current[artifactId] = data.zipBase64;
        try {
          sessionStorage.setItem("openui-code-code-workspace", JSON.stringify({ chatId: task.chatId, base64: data.zipBase64, fileName: data.fileName, artifactId }));
        } catch { /* o ZIP continua disponível em memória nesta sessão */ }
        const zipBinary = atob(data.zipBase64);
        const zipBytes = new Uint8Array(zipBinary.length);
        for (let index = 0; index < zipBinary.length; index++) zipBytes[index] = zipBinary.charCodeAt(index);
        const generatedZip = new File([zipBytes.buffer as ArrayBuffer], data.fileName, { type: "application/zip" });
        setZip(generatedZip);
        setZipValidation({ valid: true, message: `Projeto gerado: ${data.fileName} (${data.fileCount} arquivos). Pronto para publicação no GitHub.` });
        const checks = Array.isArray(data.checks) && data.checks.length
          ? `\n\nVerificações: ${data.checks.join(" · ")}`
          : "";
        addMessage(task.chatId, {
          id: crypto.randomUUID(),
          role: "assistant",
          text: `${data.summary || "Projeto empacotado."}\n\n${data.fileCount} arquivos incluídos no ZIP.${checks}\n\nO ZIP está pronto para baixar e também foi disponibilizado para a ferramenta de publicação no GitHub. Para solicitar novas alterações, continue nesta conversa.`,
          time: Date.now(),
          artifact: { id: artifactId, fileName: data.fileName, fileCount: data.fileCount },
        });
        setStatus("ZIP pronto para entrega");
      } else {
        const names = task.files.map((f) => f.name);
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sessionMap[task.chatId] || "",
            clientChatId: task.chatId,
            message: task.text || `Analise os arquivos anexados: ${names.join(", ")}`,
            model,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Falha na execução");
        if (data.sessionId) setSessionMap((v) => ({ ...v, [task.chatId]: data.sessionId }));
        addMessage(task.chatId, { id: crypto.randomUUID(), role: "assistant", text: data.message || "Instrução concluída.", time: Date.now() });
        setStatus("Concluído");
      }
    } catch (error) {
      addMessage(task.chatId, {
        id: crypto.randomUUID(),
        role: "assistant",
        text: `Não foi possível concluir a tarefa: ${error instanceof Error ? error.message : "Erro desconhecido"}`,
        time: Date.now(),
        status: "error",
      });
      setStatus("Falha na execução");
    }
  }

  async function drainTaskQueue(firstTask: PendingTask) {
    if (busyRef.current) {
      taskQueueRef.current.push(firstTask);
      setQueuedCount(taskQueueRef.current.length);
      return;
    }
    busyRef.current = true;
    setBusy(true);
    let task: PendingTask | undefined = firstTask;
    try {
      while (task) {
        await executeTask(task);
        task = taskQueueRef.current.shift();
        setQueuedCount(taskQueueRef.current.length);
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
      setQueuedCount(0);
      setStatus("Pronto para trabalhar");
    }
  }

  // Novas mensagens entram na fila; nunca interrompem o trabalho em andamento.
  function send() {
    const text = input.trim();
    if (!text && !files.length) return;
    let id = active;
    if (!id) {
      id = crypto.randomUUID();
      setChats((v) => [{ id, title: text.slice(0, 42) || "Nova conversa", updatedAt: Date.now() }, ...v]);
      setMessages((v) => ({ ...v, [id]: [] }));
      setActive(id);
    }
    const task: PendingTask = { chatId: id, text, files: [...files] };
    addUserTaskMessage(task);
    setInput("");
    setFiles([]);
    if (busyRef.current) {
      taskQueueRef.current.push(task);
      setQueuedCount(taskQueueRef.current.length);
      setStatus("Sua próxima instrução foi adicionada à fila.");
      return;
    }
    void drainTaskQueue(task);
  }

  // GitHub Auth
  async function connectManagedGitHub() {
    setVerifyingToken(true);
    setAuthFeedback(null);
    try {
      const res = await fetch("/api/github/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "A integração GitHub ainda não foi habilitada pela administração.");
      setGithubUser(data.user);
      setAuthFeedback({ type: "success", text: `Integração da plataforma ativa como @${data.user.login}.` });
      setTimeout(() => setGithubAuthModal(false), 1500);
    } catch (err) {
      setAuthFeedback({ type: "error", text: err instanceof Error ? err.message : "Não foi possível verificar a integração." });
    } finally {
      setVerifyingToken(false);
    }
  }

  function disconnectGitHub() {
    setGithubUser(null);
    setAuthFeedback(null);
  }

  // Publish to GitHub via Git Trees API
  async function publishZip() {
    if (!zip || !repo.trim()) {
      setPublishNotice("Selecione um arquivo ZIP e informe o repositório no formato owner/nome.");
      return;
    }
    setGithubBusy(true);
    setPublishNotice("Descompactando e criando árvore no GitHub...");
    try {
      const fd = new FormData();
      fd.append("archive", zip);
      fd.append("repository", repo.trim());
      fd.append("branch", branch.trim());
      const r = await fetch("/api/github/publish", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Falha ao publicar");
      setPublishNotice(d.message || "Publicação concluída com sucesso via Git Trees API.");
    } catch (e) {
      setPublishNotice(e instanceof Error ? e.message : "Erro ao publicar no GitHub.");
    } finally {
      setGithubBusy(false);
    }
  }

  const sorted = useMemo(() => [...chats].sort((a, b) => b.updatedAt - a.updatedAt), [chats]);

  return (
    <main className="shell">
      {/* ============================================================
          TOPBAR (CLEAN, MINIMAL & STRICTLY RESPONSIVE)
          - Desktop: nome da plataforma, abas e ações principais.
          - Mobile (<=768px): menu compacto e nome da plataforma.
          ============================================================ */}
      <header className="topbar">
        <div className="topbar-left">
          {/* Hamburger button (always available, crucial on mobile) */}
          <button
            className="hamburger-btn"
            onClick={() => setDrawerOpen(true)}
            title="Abrir menu de navegação e ferramentas"
          >
            <Menu size={18} />
          </button>

          {/* Clean Title / Logo */}
          <div className="brand-wrapper" onClick={() => setTab("chat")}>
            <div className="brandmark-dark">
              <Code2 size={18} />
            </div>
            <div className="brand-title">
              <span>OpenUI Code Code</span>
            </div>
          </div>

          {/* Desktop Navigation Tabs (Hidden on Mobile) */}
          <nav className="topbar-tabs">
            <button
              className={tab === "chat" ? "active" : ""}
              onClick={() => setTab("chat")}
            >
              <MessageSquare size={14} />
              Chat
            </button>
            <button
              className={tab === "reverse" ? "active" : ""}
              onClick={() => setTab("reverse")}
            >
              <Zap size={14} />
              Engenharia Reversa & Git
            </button>
            <button
              className={tab === "skills" ? "active" : ""}
              onClick={() => setTab("skills")}
            >
              <Puzzle size={14} />
              20k Skills
            </button>
            <button
              className={tab === "apresentacao" ? "active" : ""}
              onClick={() => setTab("apresentacao")}
            >
              <Sparkles size={14} />
              Apresentação
            </button>
          </nav>
        </div>

        {/* Desktop Only Actions (Hidden on Mobile) */}
        <div className="topbar-desktop-actions">
          {/* GitHub connection */}
          <button
            className={`header-btn ${githubUser ? "connected" : ""}`}
            onClick={() => setGithubAuthModal(true)}
            title={
              githubUser
                ? `Conectado como @${githubUser.login}`
                : "Autenticar no GitHub com Token"
            }
          >
            {githubUser?.avatar_url ? (
              <img
                src={githubUser.avatar_url}
                alt={githubUser.login}
                style={{ width: 16, height: 16, borderRadius: "50%" }}
              />
            ) : (
              <Github size={13} />
            )}
            <span>{githubUser ? `@${githubUser.login}` : "GitHub"}</span>
          </button>

          {/* Settings */}
          <button
            className="iconbtn"
            onClick={() => { setSettings(true); if (!providerCatalog.length) void loadProviderCatalog(); }}
            title="Configurações gerais"
          >
            <Settings2 size={15} />
          </button>
        </div>
      </header>

      {/* ============================================================
          DRAWER / HAMBURGER SLIDEOUT MENU (MOBILE + DESKTOP)
          ============================================================ */}
      {drawerOpen && (
        <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <div className="brand-wrapper" onClick={() => { setTab("chat"); setDrawerOpen(false); }}>
                <div className="brandmark-dark">
                  <Code2 size={18} />
                </div>
                <div className="brand-title">
                  <span>OpenUI Code Code</span>
                </div>
              </div>
              <button className="iconbtn" onClick={() => setDrawerOpen(false)}>
                <X size={16} />
              </button>
            </div>

            {/* New Chat Button */}
            <button className="drawer-newchat" onClick={newChat}>
              <Plus size={16} />
              <span>Novo Chat</span>
            </button>

            {/* Navigation Section (Crucial for Mobile!) */}
            <div className="drawer-nav">
              <div className="drawer-section-label">Navegação Principal</div>
              <button
                className={`drawer-item ${tab === "chat" ? "active" : ""}`}
                onClick={() => {
                  setTab("chat");
                  setDrawerOpen(false);
                }}
              >
                <MessageSquare size={15} />
                <span>Chat de desenvolvimento</span>
                {chats.length > 0 && <span className="badge">{chats.length}</span>}
              </button>

              <button
                className={`drawer-item ${tab === "reverse" ? "active" : ""}`}
                onClick={() => {
                  setTab("reverse");
                  setDrawerOpen(false);
                }}
              >
                <Zap size={15} />
                <span>Engenharia Reversa & Git</span>
              </button>

              <button
                className={`drawer-item ${tab === "skills" ? "active" : ""}`}
                onClick={() => {
                  setTab("skills");
                  setDrawerOpen(false);
                }}
              >
                <Puzzle size={15} />
                <span>Biblioteca de 20k Skills</span>
                <span className="badge">20k</span>
              </button>

              <button
                className={`drawer-item ${tab === "apresentacao" ? "active" : ""}`}
                onClick={() => {
                  setTab("apresentacao");
                  setDrawerOpen(false);
                }}
              >
                <Sparkles size={15} />
                <span>Apresentação CodeCode</span>
              </button>
            </div>

            {/* Saved Chats List */}
            <div className="drawer-section-label">Conversas Salvas</div>
            <div className="drawer-chat-list">
              {sorted.map((c) => (
                <div
                  key={c.id}
                  className={`drawer-chat-item ${active === c.id && tab === "chat" ? "selected" : ""}`}
                  onClick={() => {
                    setActive(c.id);
                    setTab("chat");
                    setDrawerOpen(false);
                  }}
                >
                  <MessageSquare size={13} style={{ flexShrink: 0 }} />
                  <span>{c.title}</span>
                  <button
                    className="chat-del-btn"
                    onClick={(e) => deleteChat(c.id, e)}
                    title="Excluir conversa"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {sorted.length === 0 && (
                <div style={{ padding: "8px 10px", color: "var(--text-dim)", fontSize: "11.5px" }}>
                  Nenhuma conversa salva ainda.
                </div>
              )}
            </div>

            {/* Drawer Bottom Actions (Accessible on Mobile) */}
            <div className="drawer-bottom">
              <button
                className="drawer-item"
                onClick={() => {
                  setGithubAuthModal(true);
                  setDrawerOpen(false);
                }}
              >
                <Github size={15} />
                <span>{githubUser ? `@${githubUser.login}` : "Conectar GitHub"}</span>
              </button>

              <button
                className="drawer-item"
                onClick={() => {
                  setSettings(true);
                  if (!providerCatalog.length) void loadProviderCatalog();
                  setDrawerOpen(false);
                }}
              >
                <Settings2 size={15} />
                <span>Configurações do Modelo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MAIN VIEW AREA
          ============================================================ */}
      <section className="main-view">
        {/* ============================================================
            TAB 1: CHAT COM MODELOS E MOTOR DE EXECUÇÃO
            ============================================================ */}
        {tab === "chat" && (
          <>
            <div className="chat-container">
              {current.length === 0 ? (
                <div className="chat-welcome">
                  <div className="chat-welcome-icon">
                    <Code2 size={28} />
                  </div>
                  <h1>O que vamos construir hoje?</h1>
                  <p>
                    Modelos de IA conectados ao motor de execução da plataforma. Escolha um modelo e envie suas instruções.
                  </p>
                  <div className="chat-suggestions">
                    <button
                      onClick={() =>
                        setInput(
                          "Analise o projeto e implemente uma arquitetura limpa com testes e tratamento de exceções."
                        )
                      }
                    >
                      <Code2 size={15} /> Arquitetura Limpa
                    </button>
                    <button
                      onClick={() =>
                        setInput("Crie um componente full-stack moderno com fallback automático de API.")
                      }
                    >
                      <FolderOpen size={15} /> Componente Full-Stack
                    </button>
                    <button
                      onClick={() =>
                        setInput("Encontre potenciais vazamentos de memória ou limites de rate limit e corrija.")
                      }
                    >
                      <Check size={15} /> Otimizar Rate Limits
                    </button>
                  </div>
                </div>
              ) : (
                <div className="messages-list">
                  {current.map((m) => (
                    <article key={m.id} className={`chat-msg ${m.role}`}>
                      <div className="chat-avatar">
                        {m.role === "user" ? "VC" : <Code2 size={16} />}
                      </div>
                      <div className="chat-msg-body">
                        <div className="chat-msg-role">
                          {m.role === "user" ? "VOCÊ" : "OPENUI CODE CODE"}
                        </div>
                        <div className="chat-msg-text">{m.text}</div>
                        <button
                          className="toolbtn-copy"
                          onClick={() => navigator.clipboard.writeText(m.text)}
                          title="Copiar mensagem"
                        >
                          <Copy size={12} /> Copiar
                        </button>
                        {m.artifact && (
                          <button
                            className="btn-opencode-primary"
                            style={{ marginTop: "10px", width: "max-content" }}
                            onClick={() => downloadWorkspaceZip(m.artifact!.id, m.artifact!.fileName)}
                          >
                            <FolderOpen size={15} /> Baixar {m.artifact.fileName} · {m.artifact.fileCount} arquivos
                          </button>
                        )}
                        {m.status === "error" && (
                          <div className="dark-notice-box warning" style={{ marginTop: "8px", padding: "8px 12px" }}>
                            <AlertCircle size={14} />
                            <span>Erro de execução ou conexão.</span>
                          </div>
                        )}
                      </div>
                    </article>
                  ))}

                  {busy && (
                    <div className="chat-working">
                      <div className="chat-avatar">
                        <Code2 size={16} />
                      </div>
                      <div>
                        <div className="chat-msg-role">OPENUI CODE CODE · EXECUTANDO</div>
                        <div className="chat-typing">
                          <i />
                          <i />
                          <i />
                          <span>{status}{queuedCount > 0 ? ` · ${queuedCount} na fila` : ""}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={endRef} />
                </div>
              )}
            </div>

            {/* Dark Composer */}
            <div className="dark-composer-wrap">
              <div className="dark-composer">
                {files.length > 0 && (
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", paddingBottom: "8px" }}>
                    {files.map((f, i) => (
                      <span
                        key={i}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          background: "var(--panel-elevated)",
                          borderRadius: "6px",
                          padding: "4px 8px",
                          fontSize: "11px",
                          color: "var(--text-secondary)",
                        }}
                      >
                        <Paperclip size={11} />
                        {f.name}
                        <button
                          onClick={() => setFiles((v) => v.filter((_, n) => n !== i))}
                          style={{ border: 0, background: "none", color: "var(--text-dim)", padding: 0 }}
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder={busy ? "A execução continua. Envie outra instrução para adicioná-la à fila..." : "Descreva o que deseja criar ou alterar no projeto..."}
                  rows={2}
                />

                <div className="composer-bottom">
                  <div className="composer-tools-left">
                    <button
                      className="iconbtn"
                      onClick={() => fileRef.current?.click()}
                      title="Anexar arquivo"
                      style={{ width: "30px", height: "30px" }}
                    >
                      <Plus size={15} />
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      multiple
                      hidden
                      onChange={(e) => {
                        if (e.target.files) setFiles((v) => [...v, ...Array.from(e.target.files!)]);
                      }}
                    />

                    {/* Model Selector with provider options */}
                    <select
                      className="dark-model-select"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                    >
                      <optgroup label="9Router · Combo de fallback">
                        <option value={routerDefaultModel ? `9router/${routerDefaultModel}` : "9router/auto"} disabled={!routerDefaultModel}>
                          {routerDefaultModel ? `Combo · ${routerDefaultModel}` : "Configure o combo padrão no servidor"}
                        </option>
                      </optgroup>
                      <optgroup label="Modelos Gratuitos Groq (Alta Velocidade)">
                        {MODELS.filter((m) => m.group === "Groq").map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label}
                          </option>
                        ))}
                      </optgroup>
                      {providerCatalog.map((provider) => (
                        <optgroup key={provider.id} label={`${provider.name}${provider.connected ? " · conectado" : " · não conectado"}`}>
                          {provider.models.map((item) => (
                            <option key={`${provider.id}/${item.id}`} value={`${provider.id}/${item.id}`}>
                              {item.name}{item.free ? " · grátis*" : ""}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  <button
                    className="dark-send-btn"
                    disabled={!input.trim() && !files.length}
                    onClick={send}
                    title={busy ? "Adicionar à fila sem interromper a execução" : "Enviar mensagem"}
                  >
                    <ArrowUp size={17} />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ============================================================
            TAB 2: ENGENHARIA REVERSA ÉTICA DE ZIP & ENVIO AO GITHUB
            (Bug visual corrigido e validação completa)
            ============================================================ */}
        {tab === "reverse" && (
          <div className="dark-tool-page">
            <div>
              <h1 style={{ fontSize: "22px", color: "#ffffff", display: "flex", alignItems: "center", gap: "10px", margin: "0 0 6px" }}>
                <Zap size={22} style={{ color: "var(--accent-text)" }} /> Engenharia Reversa Ética & Git Trees
              </h1>
              <p style={{ color: "var(--text-muted)", margin: 0, fontSize: "13.5px" }}>
                Análise despersonalizada (Clean-Room) de arquivos ZIP e envio automatizado para o GitHub
                através da Git Trees API com o conector GitHub.
              </p>
            </div>

            {/* ZIP File Attachment with Instant Validation */}
            <div className="dark-tool-card">
              <h3>
                <FileCode size={16} /> Arquivo ZIP do Projeto
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <input
                  ref={zipInputRef}
                  type="file"
                  accept=".zip,application/zip"
                  onChange={(e) => handleZipSelection(e.target.files?.[0] || null)}
                  style={{ display: "none" }}
                />

                <div
                  onClick={() => zipInputRef.current?.click()}
                  style={{
                    border: "2px dashed var(--line-strong)",
                    borderRadius: "12px",
                    padding: "24px 20px",
                    textAlign: "center",
                    cursor: "pointer",
                    background: "var(--bg-subtle)",
                    transition: "all 0.15s ease",
                  }}
                >
                  <UploadCloud size={32} style={{ margin: "0 auto 10px", color: "var(--accent-text)" }} />
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "#ffffff", marginBottom: "4px" }}>
                    {zip ? zip.name : "Clique para selecionar ou arraste o arquivo .zip"}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-dim)" }}>
                    {zip ? `${(zip.size / 1024 / 1024).toFixed(2)} MB` : "ZIP de até 3 MB nesta versão Vercel"}
                  </div>
                </div>

                {zipValidation && (
                  <div className={`dark-notice-box ${zipValidation.valid ? "info" : "warning"}`}>
                    {zipValidation.valid ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    <span>{zipValidation.message}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons for the ZIP */}
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "6px" }}>
                <button
                  className="btn-opencode-primary"
                  onClick={runReverseEngineering}
                  disabled={!zip || !zipValidation?.valid || reverseBusy}
                >
                  <Sparkles size={15} />
                  {reverseBusy ? "Analisando Clean-Room..." : "Executar Engenharia Reversa Ética"}
                </button>
              </div>
            </div>

            {/* Clean-Room Blueprint Output */}
            {reverseResult && (
              <div className="dark-tool-card" style={{ borderColor: "rgba(249, 115, 22, 0.4)" }}>
                <h3>
                  <Terminal size={16} /> Resultado da Engenharia Reversa (Clean-Room)
                </h3>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
                  <div className="dark-notice-box neutral">
                    <div>
                      <div style={{ fontSize: "11px", color: "var(--text-dim)" }}>Framework Detectado</div>
                      <b style={{ color: "#ffffff" }}>{reverseResult.detectedFramework}</b>
                    </div>
                  </div>
                  <div className="dark-notice-box neutral">
                    <div>
                      <div style={{ fontSize: "11px", color: "var(--text-dim)" }}>Arquivos Analisados</div>
                      <b style={{ color: "#ffffff" }}>{reverseResult.totalFiles} arquivos seguros</b>
                    </div>
                  </div>
                  <div className="dark-notice-box neutral">
                    <div>
                      <div style={{ fontSize: "11px", color: "var(--text-dim)" }}>Componentes</div>
                      <b style={{ color: "#ffffff" }}>{reverseResult.componentsCount} identificados</b>
                    </div>
                  </div>
                </div>

                <div className="dark-notice-box neutral">
                  <ShieldCheck size={16} />
                  <span>A análise técnica está pronta. O ZIP original será enviado diretamente ao agente de projetos; a conversa mostrará apenas o resumo e o link para baixar a nova versão, sem despejar código ou prompts extensos.</span>
                </div>

                <button
                  className="btn-opencode-primary"
                  onClick={sendReversePromptToChat}
                  style={{ width: "max-content" }}
                >
                  <FolderOpen size={15} />
                  Recriar projeto e entregar ZIP
                </button>
              </div>
            )}

            {/* GitHub Trees API Automated Publisher */}
            <div className="dark-tool-card">
              <h3>
                <Github size={16} /> Publicação Automatizada via Git Trees API
              </h3>
              <p style={{ fontSize: "12.5px", color: "var(--text-muted)", margin: 0 }}>
                O GitHub não descompacta ZIPs na API de release. Esta ferramenta descompacta os arquivos em
                memória, cria blobs individuais e comita a árvore completa no seu repositório.
              </p>

              <div className="dark-field-grid">
                <label className="dark-field">
                  <span>Repositório de Destino (owner/nome)</span>
                  <input
                    value={repo}
                    onChange={(e) => setRepo(e.target.value)}
                    placeholder={githubUser ? `${githubUser.login}/meu-projeto-limpo` : "usuario/projeto"}
                  />
                  <span className="hint">Se não existir, será criado automaticamente.</span>
                </label>
                <label className="dark-field">
                  <span>Branch de Destino</span>
                  <input
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="main"
                  />
                </label>
              </div>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                <button
                  className="btn-opencode-primary"
                  onClick={publishZip}
                  disabled={githubBusy || !zip || !repo.trim()}
                >
                  <UploadCloud size={15} />
                  {githubBusy ? "Publicando via Git Trees API..." : "Descompactar e Publicar no GitHub"}
                </button>

                {githubUser && (
                  <button
                    className="header-btn"
                    onClick={() => setRepo(`${githubUser.login}/`)}
                  >
                    Usar @{githubUser.login}/
                  </button>
                )}
              </div>

              {publishNotice && (
                <div
                  className={`dark-notice-box ${
                    publishNotice.includes("Sucesso") || publishNotice.includes("sucesso")
                      ? "info"
                      : "neutral"
                  }`}
                >
                  {publishNotice}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================
            TAB 3: BIBLIOTECA DE 20 MIL SKILLS (PROGRESSIVE DISCLOSURE)
            ============================================================ */}
        {tab === "skills" && (
          <div className="dark-tool-page">
            <div>
              <h1 style={{ fontSize: "22px", color: "#ffffff", display: "flex", alignItems: "center", gap: "10px", margin: "0 0 6px" }}>
                <Puzzle size={22} style={{ color: "var(--accent-text)" }} /> Biblioteca de 20.000 Skills
              </h1>
              <p style={{ color: "var(--text-muted)", margin: 0, fontSize: "13.5px" }}>
                Arquitetura de <b>Divulgação Progressiva</b>: os metadados leves são pesquisados instantaneamente,
                e o corpo integral (markdown + scripts) só é injetado no prompt quando a skill é acionada.
              </p>
            </div>

            {/* Filter & Search Bar */}
            <div className="dark-tool-card">
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <input
                  value={skillQuery}
                  onChange={(e) => {
                    setSkillQuery(e.target.value);
                    loadSkills(1, e.target.value, skillCategory);
                  }}
                  placeholder="Pesquisar entre as 20.000 habilidades (ex: reverse, groq, postgres, clean-room)..."
                  style={{ flex: 1, minWidth: "240px" }}
                />

                <select
                  value={skillCategory}
                  onChange={(e) => {
                    setSkillCategory(e.target.value);
                    loadSkills(1, skillQuery, e.target.value);
                  }}
                  style={{ width: "auto" }}
                >
                  {SKILL_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <button
                  className="header-btn"
                  onClick={() => loadSkills(1, skillQuery, skillCategory)}
                >
                  <RefreshCw size={13} /> Atualizar
                </button>
              </div>

              <div style={{ fontSize: "12px", color: "var(--text-dim)" }}>
                Mostrando página {skillsPage} de {Math.ceil(skillsTotal / 24)} ({skillsTotal.toLocaleString("pt-BR")} habilidades indexadas)
              </div>
            </div>

            {/* Skills Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "12px" }}>
              {skills.map((s) => (
                <div
                  key={s.id}
                  className="dark-tool-card"
                  style={{ padding: "16px", cursor: "pointer" }}
                  onClick={() => inspectSkillDetail(s.id)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                    <b style={{ color: "#ffffff", fontSize: "13.5px" }}>{s.name}</b>
                    <span className="dark-tag">{s.category || "Skill"}</span>
                  </div>
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "4px 0 8px", lineHeight: "1.4" }}>
                    {s.description}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
                    <span style={{ fontSize: "10.5px", color: "var(--text-dim)", fontFamily: "monospace" }}>
                      v{s.version || "1.0.0"}
                    </span>
                    <span style={{ fontSize: "11px", color: "var(--accent-text)", display: "flex", alignItems: "center", gap: "3px" }}>
                      Ver detalhes <ChevronRight size={12} />
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "10px" }}>
              <button
                className="header-btn"
                disabled={skillsPage <= 1}
                onClick={() => loadSkills(skillsPage - 1, skillQuery, skillCategory)}
              >
                Anterior
              </button>
              <button
                className="header-btn"
                disabled={skillsPage >= Math.ceil(skillsTotal / 24)}
                onClick={() => loadSkills(skillsPage + 1, skillQuery, skillCategory)}
              >
                Próxima
              </button>
            </div>
          </div>
        )}

        {/* ============================================================
            TAB 4: PÁGINA DE APRESENTAÇÃO (OpenUI Code Code)
            ============================================================ */}
        {tab === "apresentacao" && (
          <div className="presentation-container">
            <div className="presentation-hero">
              <div className="presentation-badge">
                <i />
                AGENTES · CLOUD · DESENVOLVIMENTO
              </div>

              <h1 className="presentation-title">OpenUI Code Code</h1>

              <p className="presentation-subtitle">
                Um espaço de trabalho para quem quer usar agentes de IA, ferramentas de desenvolvimento e serviços cloud sem se perder em configurações. Reúna modelos, projetos, skills e fluxos de trabalho em uma experiência integrada.
              </p>

              <div className="presentation-actions">
                <button
                  className="btn-opencode-primary"
                  onClick={() => setTab("chat")}
                >
                  <MessageSquare size={16} />
                  Abrir Chat do CodeCode
                </button>

                <button className="btn-opencode-secondary" onClick={() => setSettings(true)}>
                  <Puzzle size={15} /> Explorar integrações
                </button>
              </div>

              <div className="presentation-socials">
                <a href="https://github.com/ticarollamas-arch" target="_blank" rel="noreferrer" className="social-link">
                  <Github size={17} /> <span>GitHub · @ticarollamas-arch</span> <ExternalLink size={12} />
                </a>
                <a href="https://www.instagram.com/anacarolinelamas/" target="_blank" rel="noreferrer" className="social-link instagram-link">
                  <Instagram size={17} /> <span>Instagram · @anacarolinelamas</span> <ExternalLink size={12} />
                </a>
              </div>
            </div>

            <section className="brand-showcase" aria-label="Ecossistema de inteligência artificial, cloud e desenvolvimento">
              <div className="section-eyebrow">ECOSSISTEMA CONECTADO</div>
              <h2>As ferramentas que você já conhece. Em um só espaço.</h2>
              <p>Modelos de IA, plataformas de desenvolvimento e infraestrutura cloud para organizar seu fluxo de trabalho. As marcas são de seus respectivos proprietários; não indicam parceria ou endosso.</p>

              <div className="brand-group">
                <h3>Inteligência artificial</h3>
                <div className="brand-logo-grid">
                  {[
                    ["Grok", "grok", "FFFFFF", "G"],
                    ["OpenAI", "openai", "FFFFFF", "◎"],
                    ["Gemini", "googlegemini", "8E75B2", "G"],
                    ["Claude", "anthropic", "D97757", "C"],
                    ["Groq", "groq", "F55036", "G"],
                    ["Mistral", "mistralai", "F7D046", "M"]
                  ].map(([name, slug, color, fallback]) => (
                    <div className="brand-logo-card" key={name} title={name}>
                      <span className="brand-logo-fallback">{fallback}</span>
                      <img
                        src={`https://cdn.simpleicons.org/${slug}/${color}`}
                        alt={`${name} logo`}
                        loading="lazy"
                        onError={(event) => { event.currentTarget.style.display = "none"; }}
                      />
                      <span>{name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="brand-group">
                <h3>Cloud, infraestrutura e desenvolvimento</h3>
                <div className="brand-logo-grid">
                  {[
                    ["GitHub", "github", "FFFFFF", "GH"],
                    ["AWS", "amazonaws", "FF9900", "AWS"],
                    ["Google Cloud", "googlecloud", "4285F4", "GCP"],
                    ["Docker", "docker", "2496ED", "D"],
                    ["Linux", "linux", "FCC624", "L"],
                    ["Python", "python", "3776AB", "Py"],
                    ["Node.js", "nodedotjs", "5FA04E", "N"],
                    ["React", "react", "61DAFB", "R"],
                    ["Vercel", "vercel", "FFFFFF", "▲"]
                  ].map(([name, slug, color, fallback]) => (
                    <div className="brand-logo-card" key={name} title={name}>
                      <span className="brand-logo-fallback">{fallback}</span>
                      <img
                        src={`https://cdn.simpleicons.org/${slug}/${color}`}
                        alt={`${name} logo`}
                        loading="lazy"
                        onError={(event) => { event.currentTarget.style.display = "none"; }}
                      />
                      <span>{name}</span>
                    </div>
                  ))}
                </div>
              </div>
              <small className="brand-assets-note">Ícones vetoriais transparentes do projeto Simple Icons. As marcas e logotipos pertencem aos seus respectivos titulares.</small>
            </section>

            <section className="tech-showcase" aria-label="Tecnologias utilizadas">
              <div className="section-eyebrow">TECNOLOGIAS E ECOSSISTEMA</div>
              <h2>Ferramentas para construir, integrar e evoluir</h2>
              <p>Um espaço de trabalho conectado às tecnologias modernas de desenvolvimento, infraestrutura e inteligência artificial.</p>
              <div className="tech-grid">
                {[
                  ["Docker", "🐳", "docker"], ["Node.js", "JS", "node"], ["Java", "☕", "java"],
                  ["AWS", "aws", "aws"], ["GitHub", "⌘", "github"], ["Python", "Py", "python"],
                  ["React", "⚛", "react"], ["Next.js", "N", "next"], ["Linux", "🐧", "linux"],
                  ["TypeScript", "TS", "typescript"], ["PostgreSQL", "◉", "postgres"], ["Vercel", "▲", "vercel"]
                ].map(([name, mark, tone], index) => (
                  <div className={`tech-tile tech-${tone}`} key={name} style={{ animationDelay: `${index * 55}ms` }}>
                    <span className="tech-mark">{mark}</span><span>{name}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="token-savings-section">
              <div className="section-eyebrow">EFICIÊNCIA DE CONTEXTO</div>
              <h2>Economia inteligente de tokens</h2>
              <p>Conheça ferramentas open source que ajudam a reduzir contexto redundante, compactar saídas e aproveitar melhor a janela de cada modelo. Os resultados variam conforme o projeto e a tarefa.</p>
              <a className="token-repo-card" href="https://github.com/rtk-ai/rtk" target="_blank" rel="noreferrer">
                <span className="token-repo-icon"><Zap size={21}/></span>
                <span><b>RTK · Rust Token Killer</b><small>Filtra e compacta saídas de comandos de desenvolvimento antes que cheguem ao contexto da IA; o projeto oferece integração com diferentes fluxos de desenvolvimento.</small><em>github.com/rtk-ai/rtk</em></span>
                <ExternalLink size={15}/>
              </a>
              <p className="token-repo-note">Ferramenta independente de código aberto. A disponibilidade e os ganhos dependem da configuração e do tipo de tarefa.</p>
            </section>

            {/* Feature Cards */}
            <div className="features-grid">
              <div className="feature-card">
                <div className="feature-icon-wrap">
                  <Zap size={18} />
                </div>
                <h4>Modelos Groq & Fallback</h4>
                <p>
                  Integração ultra-rápida com Llama 3.3 70B, QwQ e Mixtral com transição automática transparente
                  ao atingir limites de rate limit (RPM/RPD).
                </p>
              </div>

              <div className="feature-card">
                <div className="feature-icon-wrap">
                  <ShieldCheck size={18} />
                </div>
                <h4>Engenharia Reversa Clean-Room</h4>
                <p>
                  Extração segura de ZIPs e geração de especificações funcionais despersonalizadas, livres de marcas
                  proprietárias e prontas para recriação.
                </p>
              </div>

              <div className="feature-card">
                <div className="feature-icon-wrap">
                  <UploadCloud size={18} />
                </div>
                <h4>Git Trees API Automatizada</h4>
                <p>
                  Descompactação direta no servidor e commit estruturado na árvore Git sem exigir clone local ou
                  tentar enviar ZIP bruto.
                </p>
              </div>

              <div className="feature-card">
                <div className="feature-icon-wrap">
                  <Layers size={18} />
                </div>
                <h4>20.000 Skills Progressivas</h4>
                <p>
                  Arquitetura de divulgação progressiva que preserva a janela de contexto de tokens, carregando
                  instruções completas somente sob demanda.
                </p>
              </div>
            </div>

            <section className="about-details">
              <div className="about-detail-card">
                <h3>Uma interface visual para trabalhar com código</h3>
                <p>O objetivo é aproximar ferramentas poderosas de desenvolvimento de quem prefere uma experiência visual, organizada e acessível pelo navegador — sem depender de executar cada tarefa manualmente no terminal.</p>
              </div>
              <div className="about-detail-card">
                <h3>Conteúdo, demonstrações e aprendizado</h3>
                <p>Também estou preparando demonstrações em vídeo com explicações em áudio, apresentando repositórios, ferramentas e fluxos de trabalho de forma prática. Novidades e materiais serão compartilhados por aqui e nas redes sociais.</p>
              </div>
              <div className="about-detail-card">
                <h3>Desenvolvimento responsável</h3>
                <p>Os recursos de análise e engenharia reversa devem ser utilizados em projetos próprios ou com autorização. A proposta é facilitar o entendimento técnico, a organização do código e a criação de soluções.</p>
              </div>
            </section>
          </div>
        )}
      </section>

      {/* ============================================================
          MODAL: GITHUB CONNECTOR
          ============================================================ */}
      {githubAuthModal && (
        <div className="dark-modal-backdrop" onClick={() => setGithubAuthModal(false)}>
          <div className="dark-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dark-modal-head">
              <div>
                <h2><Github size={18} /> Integração GitHub</h2>
                <p>Conexão centralizada, sem pedir token ou chave pessoal ao usuário.</p>
              </div>
              <button className="iconbtn" onClick={() => setGithubAuthModal(false)}><X size={16} /></button>
            </div>
            {githubUser && <div className="dark-modal-section"><b>Conector ativo: @{githubUser.login}</b><p>Esta é a conta configurada pela administração da plataforma.</p><button className="header-btn" onClick={disconnectGitHub}>Limpar estado local</button></div>}
            <div className="dark-modal-section">
              <b>Conector gerenciado pela plataforma</b>
              <p>Quando o administrador configurar a integração segura no servidor, você poderá publicar projetos sem criar ou colar tokens pessoais.</p>
              <small>Se a integração ainda não estiver configurada, a publicação permanecerá indisponível. Não solicitaremos sua chave pessoal.</small>
            </div>
            {authFeedback && <div className={`dark-notice-box ${authFeedback.type === "success" ? "info" : "warning"}`}><span>{authFeedback.text}</span></div>}
            <div className="dark-modal-foot">
              <button className="header-btn" onClick={() => setGithubAuthModal(false)}>Fechar</button>
              <button className="btn-opencode-primary" onClick={connectManagedGitHub} disabled={verifyingToken}>
                <Github size={14} /> {verifyingToken ? "Verificando..." : "Verificar conector"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL 3: SKILL LEVEL 2 DETAIL (PROGRESSIVE DISCLOSURE)
          ============================================================ */}
      {selectedSkillDetail && (
        <div className="dark-modal-backdrop" onClick={() => setSelectedSkillDetail(null)}>
          <div className="dark-modal" style={{ maxWidth: "680px" }} onClick={(e) => e.stopPropagation()}>
            <div className="dark-modal-head">
              <div>
                <h2>
                  <Puzzle size={18} style={{ color: "var(--accent-text)" }} /> {selectedSkillDetail.name}
                </h2>
                <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "4px" }}>
                  <span className="dark-tag">{selectedSkillDetail.category}</span>
                  <span style={{ fontSize: "11px", color: "var(--text-dim)", fontFamily: "monospace" }}>
                    ID: {selectedSkillDetail.id}
                  </span>
                </div>
              </div>
              <button className="iconbtn" onClick={() => setSelectedSkillDetail(null)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
                Corpo Completo da Habilidade (SKILL.md - Injetado sob demanda):
              </div>
              <pre
                style={{
                  background: "var(--bg-subtle)",
                  border: "1px solid var(--line)",
                  borderRadius: "10px",
                  padding: "12px",
                  fontSize: "12px",
                  lineHeight: "1.5",
                  maxHeight: "260px",
                  overflowY: "auto",
                  color: "#e2e8f0",
                }}
              >
                {selectedSkillDetail.fullMarkdown}
              </pre>
            </div>

            <div className="dark-modal-foot">
              <button className="header-btn" onClick={() => setSelectedSkillDetail(null)}>
                Fechar
              </button>
              <button
                className="btn-opencode-primary"
                onClick={() => injectSkillIntoChat(selectedSkillDetail.promptSnippet)}
              >
                <Terminal size={14} /> Injetar no Prompt do Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL 4: CONFIGURAÇÕES
          ============================================================ */}
      {settings && (
        <div className="dark-modal-backdrop" onClick={() => setSettings(false)}>
          <div className="dark-modal model-settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dark-modal-head">
              <div>
                <h2><Settings2 size={18} /> Central de modelos e roteamento</h2>
                <p>Pesquise os modelos habilitados pela plataforma e escolha o modelo de trabalho.</p>
              </div>
              <button className="iconbtn" onClick={() => setSettings(false)}><X size={16} /></button>
            </div>

            <div className="model-console">
              <div className="model-console-bar">
                <span className="console-dot" /><span className="console-dot" /><span className="console-dot" />
                <span className="console-path">Modelos / provedores / roteamento</span>
                <span className="console-live">CATÁLOGO</span>
              </div>
              <label className="model-search-box">
                <Search size={17} />
                <input value={providerSearch} onChange={(e) => setProviderSearch(e.target.value)} placeholder="> buscar modelos ou provedores..." />
                <kbd>⌕</kbd>
              </label>
              <div className="model-console-actions">
                <button className="header-btn" onClick={loadProviderCatalog} disabled={providerLoading || routerBusy}>
                  <RefreshCw size={14} className={providerLoading ? "spin" : ""} /> {providerLoading ? "Buscando..." : "Carregar modelos"}
                </button>
                <button className="header-btn" onClick={syncNineRouter} disabled={routerBusy}>
                  <RefreshCw size={14} className={routerBusy ? "spin" : ""} /> Sincronizar 9Router
                </button>
                <button className="btn-opencode-primary" onClick={startNineRouter} disabled={routerBusy}>
                  <Zap size={14} /> {routerBusy ? "Conectando..." : routerDefaultModel && model === `9router/${routerDefaultModel}` && routerStatus === "ready" ? "9Router ativo" : "Start 9Router"}
                </button>
                <span><Database size={13} /> Motor de execução + 9Router</span>
              </div>
              <div className="dark-notice-box neutral" style={{ marginTop: 10 }}>
                <Zap size={15} style={{ flexShrink: 0 }} />
                <div><b>9Router:</b> {routerStatus === "ready" ? "Conectado. O combo selecionado executa fallback ou rotação conforme a estratégia configurada no 9Router." : routerStatus === "offline" ? "Configurado, mas indisponível. Confira a conexão do serviço no VPS." : "Aguardando configuração do serviço no servidor."} <small>As credenciais dos provedores ficam no 9Router do servidor; o usuário final não precisa cadastrar sua própria API. O Start conecta ao serviço já instalado; não instala nem inicia o processo do 9Router.</small></div>
              </div>
              {routerFeedback && <p className="provider-feedback">{routerFeedback}</p>}
            </div>

            {providerError && <div className="dark-notice-box neutral" style={{ marginTop: 12 }}><AlertCircle size={16} /> <div>{providerError}<br /><small>Verifique se o motor de execução está ativo e se o servidor foi configurado pela administração.</small></div></div>}

            <div className="provider-manager-grid">
              <section className="provider-list-panel">
                <div className="provider-panel-title"><b><PlugZap size={15} /> Provedores</b><span>{visibleProviders.length} disponíveis</span></div>
                {providerLoading && <p className="provider-empty">Consultando o catálogo de modelos...</p>}
                {!providerLoading && visibleProviders.map((provider) => (
                  <button key={provider.id} className={`provider-row ${activeProvider === provider.id ? "active" : ""}`} onClick={() => { setActiveProvider(provider.id); setProviderFeedback(""); }}>
                    <span className="provider-avatar">{provider.name.slice(0, 1).toUpperCase()}</span>
                    <span className="provider-row-copy"><b>{provider.name}</b><small>{provider.models.length} modelos · {provider.id}</small></span>
                    <span className={`provider-state ${provider.connected ? "connected" : ""}`}>{provider.connected ? "Conectado" : "Disponível"}</span>
                  </button>
                ))}
                {!providerLoading && !visibleProviders.length && !providerError && <p className="provider-empty">Nenhum provedor encontrado. Use Buscar modelos para atualizar.</p>}
              </section>

              <section className="provider-detail-panel">
                <div className="provider-panel-title"><b><Cpu size={15} /> Modelos disponíveis</b><span>{visibleModels.length} modelos</span></div>
                {selectedProviderInfo ? <>
                  <div className="provider-detail-heading"><div><h3>{selectedProviderInfo.name}</h3><p>{selectedProviderInfo.connected ? "Conexão administrada pela plataforma." : "A disponibilidade depende da configuração da plataforma."}</p></div><span className={`provider-state ${selectedProviderInfo.connected ? "connected" : ""}`}>{selectedProviderInfo.connected ? "Conectado" : "Não conectado"}</span></div>
                  {!selectedProviderInfo.connected && <div className="provider-connect-box"><b>Conexão administrada pela plataforma</b><small>Você não precisa inserir API key. Este provedor só ficará disponível quando a administração habilitar uma conexão segura ou um fluxo oficial de autorização.</small></div>}
                  {providerFeedback && <p className="provider-feedback">{providerFeedback}</p>}
                  <div className="provider-model-list">{visibleModels.slice(0, 120).map((item) => (
                    <div className={`provider-model-row ${model === `${selectedProviderInfo.id}/${item.id}` ? "selected" : ""}`} key={item.id}>
                      <div className="provider-model-info"><b>{item.name}</b><small>{item.id}{item.context ? ` · ${(item.context / 1000).toFixed(0)}k contexto` : ""}</small></div>
                      <div className="provider-model-meta">{item.free ? <span className="model-free"><CircleDollarSign size={12}/> Gratuito*</span> : <span className="model-paid">Pago / conforme provedor</span>}<button className="model-select-btn" onClick={() => { setModel(`${selectedProviderInfo.id}/${item.id}`); setSettings(false); }}>{model === `${selectedProviderInfo.id}/${item.id}` ? "Selecionado" : "Usar modelo"}</button></div>
                    </div>
                  ))}</div>
                  {visibleModels.length > 120 && <p className="provider-empty">Exibindo os primeiros 120 resultados. Refine a busca para localizar outros modelos.</p>}
                </> : <div className="provider-empty">Selecione um provedor para ver os modelos disponíveis.</div>}
              </section>
            </div>

            <div className="dark-notice-box neutral" style={{ marginTop: 14 }}>
              <ShieldCheck size={16} style={{ flexShrink: 0, color: "var(--accent-text)" }} />
              <div><b>Roteamento compartilhado:</b> quando 9Router estiver ativo, os usuários utilizam as contas e provedores configurados pela administração, sem inserir API própria. O roteador faz fallback/rotação conforme as cotas disponíveis; não cria tokens ilimitados. O uso continua sujeito aos termos, limites e disponibilidade de cada provedor.</div>
            </div>
            <div className="dark-modal-foot">
              <button className="header-btn" onClick={() => { setSettings(false); setProviderSearch(""); }}>Fechar</button>
              <button className="btn-opencode-primary" onClick={loadProviderCatalog}><RefreshCw size={14} /> Atualizar catálogo</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
