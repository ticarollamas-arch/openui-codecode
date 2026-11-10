import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";

export const runtime = "nodejs";
export const maxDuration = 60;

const api = "https://api.github.com";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const formToken = form.get("token") ? String(form.get("token")).trim() : null;
    const headerToken = req.headers.get("x-github-token")?.trim();
    const token = formToken || headerToken || process.env.GITHUB_TOKEN;

    if (!token) {
      return NextResponse.json(
        { error: "Configure seu Token de Acesso do GitHub para publicar." },
        { status: 401 }
      );
    }

    const archive = form.get("archive");
    const repository = String(form.get("repository") || "").trim();
    const branch = String(form.get("branch") || "main").trim();
    const notifyOpenCode = form.get("notifyOpenCode") === "true";

    if (!(archive instanceof File) || !archive.name.toLowerCase().endsWith(".zip")) {
      return NextResponse.json({ error: "Envie um arquivo ZIP válido." }, { status: 400 });
    }

    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
      return NextResponse.json({ error: "Repositório deve estar no formato owner/nome." }, { status: 400 });
    }

    if (archive.size > 50 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Este endpoint serverless aceita ZIPs de até 50 MB. Para volumes maiores, utilize armazenamento direto." },
        { status: 413 }
      );
    }

    const zip = await JSZip.loadAsync(await archive.arrayBuffer());
    const files: { path: string; content: string }[] = [];
    let total = 0;

    for (const [name, item] of Object.entries(zip.files) as [string, JSZip.JSZipObject][]) {
      if (item.dir) continue;
      const normalized = name.replace(/\\/g, "/");
      // Sanitize unwanted files
      if (
        normalized.startsWith("/") ||
        normalized.split("/").some((p) => p === "..") ||
        normalized.includes(".git/") ||
        normalized.includes("node_modules/") ||
        normalized.endsWith(".DS_Store")
      ) {
        continue;
      }
      const blob = await item.async("uint8array");
      total += blob.byteLength;
      if (blob.byteLength > 90 * 1024 * 1024) {
        throw new Error(`Arquivo ${normalized} excede o limite de 90 MB por arquivo.`);
      }
      files.push({ path: normalized, content: Buffer.from(blob).toString("base64") });
    }

    if (!files.length) {
      return NextResponse.json({ error: "O ZIP não contém arquivos válidos para publicação." }, { status: 400 });
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "OpenCode-Workspace",
    };

    async function gh(url: string, body?: unknown, method?: string) {
      const r = await fetch(url, {
        method: method || (body ? "POST" : "GET"),
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        const error = new Error(d.message || `GitHub API erro ${r.status}`);
        (error as any).status = r.status;
        throw error;
      }
      return d;
    }

    const [owner, repoName] = repository.split("/");
    const base = `${api}/repos/${owner}/${repoName}`;

    // Verify if repo exists, if not, attempt creation
    let repoExists = true;
    try {
      await gh(base);
    } catch (err: any) {
      if (err.status === 404) {
        repoExists = false;
        // Create repo under user account
        try {
          await gh(`${api}/user/repos`, {
            name: repoName,
            description: "Projeto publicado via OpenCode Workspace",
            auto_init: true,
            private: false,
          });
          // Wait 1.5s for GitHub to initialize default branch
          await new Promise((r) => setTimeout(r, 1500));
        } catch (createErr: any) {
          throw new Error(`Não foi possível criar o repositório ${repository}: ${createErr.message}`);
        }
      } else {
        throw err;
      }
    }

    // Get parent commit or initialize
    let parentSha: string | null = null;
    let baseTreeSha: string | undefined = undefined;

    try {
      const ref = await gh(`${base}/git/ref/heads/${encodeURIComponent(branch)}`);
      parentSha = ref.object.sha;
      const parent = await gh(`${base}/git/commits/${parentSha}`);
      baseTreeSha = parent.tree.sha;
    } catch (err: any) {
      // If branch doesn't exist, try getting default branch or create initial commit
      try {
        const repoData = await gh(base);
        const defaultBranch = repoData.default_branch || "main";
        const defaultRef = await gh(`${base}/git/ref/heads/${encodeURIComponent(defaultBranch)}`);
        parentSha = defaultRef.object.sha;
        const parent = await gh(`${base}/git/commits/${parentSha}`);
        baseTreeSha = parent.tree.sha;
      } catch {
        // Repository is empty without initial commit
        parentSha = null;
        baseTreeSha = undefined;
      }
    }

    // Create blobs for each file
    const tree = [];
    for (const f of files) {
      const blob = await gh(`${base}/git/blobs`, { content: f.content, encoding: "base64" });
      tree.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
    }

    // Create Tree
    const newTree = await gh(`${base}/git/trees`, {
      base_tree: baseTreeSha,
      tree,
    });

    // Create Commit
    const commitPayload: any = {
      message: `OpenCode Import: ${files.length} arquivos descompactados e sincronizados`,
      tree: newTree.sha,
    };
    if (parentSha) {
      commitPayload.parents = [parentSha];
    }
    const commit = await gh(`${base}/git/commits`, commitPayload);

    // Update branch ref or create it
    try {
      await gh(`${base}/git/refs/heads/${encodeURIComponent(branch)}`, { sha: commit.sha, force: true }, "PATCH");
    } catch {
      // Create new branch reference
      await gh(`${base}/git/refs`, {
        ref: `refs/heads/${branch}`,
        sha: commit.sha,
      });
    }

    const repoUrl = `https://github.com/${repository}`;
    const branchUrl = `${repoUrl}/tree/${encodeURIComponent(branch)}`;

    // Optional notification to OpenCode executor
    let openCodeStatus = "Não configurado";
    if (notifyOpenCode && process.env.OPENCODE_SERVER_URL) {
      try {
        const { opencode } = await import("@/lib/opencode");
        await opencode.session.create({
          body: {
            title: `Workspace importado: ${repository}`,
          },
        });
        openCodeStatus = "Sessão iniciada no OpenCode";
      } catch {
        openCodeStatus = "Executor ocupado ou indisponível";
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Sucesso! ${files.length} arquivos descompactados e publicados em ${repository} (${branch}).`,
      url: branchUrl,
      repoUrl,
      filesCount: files.length,
      totalBytes: total,
      commitSha: commit.sha,
      openCodeStatus,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha ao descompactar e publicar no GitHub." },
      { status: 502 }
    );
  }
}
