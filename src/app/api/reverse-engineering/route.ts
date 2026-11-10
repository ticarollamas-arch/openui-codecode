import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";

export const runtime = "nodejs";
export const maxDuration = 60;

// Sensitive file patterns to strictly sanitize
const SENSITIVE_PATTERNS = [
  /^\.env/i,
  /\.pem$/i,
  /\.key$/i,
  /id_rsa/i,
  /\.token/i,
  /credentials\.json/i,
  /\.npmrc/i,
  /\.pypirc/i,
  /node_modules\//i,
  /\.git\//i,
  /\.DS_Store/i,
];

function isSafeFile(name: string): boolean {
  return !SENSITIVE_PATTERNS.some((pattern) => pattern.test(name));
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("archive");

    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".zip")) {
      return NextResponse.json(
        { error: "Por favor, envie um arquivo .zip válido." },
        { status: 400 }
      );
    }

    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Arquivo ZIP excede o limite máximo permitido de 50 MB para análise." },
        { status: 413 }
      );
    }

    const zip = await JSZip.loadAsync(await file.arrayBuffer());

    let packageJsonContent: Record<string, any> | null = null;
    let indexHtmlSnippet = "";
    let readmeSnippet = "";
    const structureTree: string[] = [];
    const componentsList: string[] = [];
    const routesList: string[] = [];
    let detectedFramework = "Vanilla / Não identificado";

    const entries = Object.entries(zip.files);
    for (const [rawName, item] of entries) {
      const name = rawName.replace(/\\/g, "/");

      if (item.dir || !isSafeFile(name)) continue;

      structureTree.push(name);

      // Detect components
      if (/components?\/.*\.(tsx|jsx|vue|svelte)$/i.test(name)) {
        componentsList.push(name.split("/").pop() || name);
      }

      // Detect pages / routes
      if (/(pages|routes|app)\/.*\.(tsx|jsx|ts|js)$/i.test(name)) {
        routesList.push(name);
      }

      // Read package.json
      if (name.endsWith("package.json") && !packageJsonContent) {
        try {
          const text = await item.async("text");
          packageJsonContent = JSON.parse(text);
        } catch {
          // ignore
        }
      }

      // Read index.html
      if (name.endsWith("index.html") && !indexHtmlSnippet) {
        try {
          const html = await item.async("text");
          indexHtmlSnippet = html.slice(0, 1500);
        } catch {
          // ignore
        }
      }

      // Read README
      if (/README\.md$/i.test(name) && !readmeSnippet) {
        try {
          const md = await item.async("text");
          readmeSnippet = md.slice(0, 1500);
        } catch {
          // ignore
        }
      }
    }

    if (structureTree.length === 0) {
      return NextResponse.json(
        { error: "O arquivo ZIP está vazio ou não contém arquivos de código válidos." },
        { status: 400 }
      );
    }

    // Detect Framework
    if (packageJsonContent) {
      const deps = {
        ...packageJsonContent.dependencies,
        ...packageJsonContent.devDependencies,
      };
      if (deps["next"]) detectedFramework = "Next.js (App / Pages Router)";
      else if (deps["@remix-run/react"]) detectedFramework = "Remix";
      else if (deps["vite"] && deps["react"]) detectedFramework = "React + Vite SPA";
      else if (deps["vue"]) detectedFramework = "Vue.js";
      else if (deps["@angular/core"]) detectedFramework = "Angular";
      else if (deps["express"]) detectedFramework = "Node.js + Express";
      else if (deps["react"]) detectedFramework = "React (CRA/Gatsby/Custom)";
    }

    // Build the Clean-Room Reverse Engineering Prompt
    const cleanRoomPrompt = `### PROMPT DE ENGENHARIA REVERSA ÉTICA (CLEAN-ROOM REWRITE)

Você é um Arquiteto de Software Especialista em Engenharia Reversa e Engenharia Limpa ("Clean-Room").
Sua missão é projetar e recriar uma aplicação com as mesmas funcionalidades, layout estrutural e regras de negócio da aplicação analisada abaixo, mas reescrevendo 100% do código do zero, em conformidade com as melhores práticas de código limpo.

---
#### DIRETRIZES DA ENGENHARIA LIMPA (CLEAN-ROOM):
1. **Despersonalização & Propriedade Intelectual**:
   - Remova e substitua marcas registradas, logotipos e referências proprietárias do aplicativo original por uma marca neutra ou sob medida.
   - Elimine qualquer segredo, chave ou credencial vazada no código original.
2. **Reimplementação Funcional**:
   - Não copie código literal; reprojete a lógica com base na especificação arquitetural deduzida.
   - Utilize a stack mais moderna e performática: TypeScript estrito, componentes modulares, layout responsivo e acessível.
3. **Escalabilidade & Qualidade**:
   - Garanta separação de conceitos (Clean Architecture / Domain-Driven Design simplificado).
   - Otimize o gerenciamento de estado e consultas de dados.

---
#### METADADOS DO PROJETO ANALISADO:
- **Framework Detectado**: ${detectedFramework}
- **Dependências Principais**: ${
      packageJsonContent?.dependencies
        ? Object.keys(packageJsonContent.dependencies).join(", ")
        : "N/A"
    }
- **Scripts do Projeto**: ${
      packageJsonContent?.scripts
        ? Object.entries(packageJsonContent.scripts)
            .map(([k, v]) => `${k}: ${v}`)
            .join(" | ")
        : "N/A"
    }
- **Total de Arquivos Analisados**: ${structureTree.length} arquivos seguros.
- **Componentes Identificados**: ${
      componentsList.slice(0, 15).join(", ") || "Componentes estruturais na raiz"
    }${componentsList.length > 15 ? ` (+${componentsList.length - 15} outros)` : ""}
- **Rotas Identificadas**: ${
      routesList.slice(0, 12).join(", ") || "Rotas dinâmicas padrão"
    }

---
#### ESTRUTURA DO DIRETÓRIO ORIGEM (MAPA DE ARQUITETURA):
\`\`\`
${structureTree.slice(0, 60).join("\n")}
${structureTree.length > 60 ? `... (+ ${structureTree.length - 60} arquivos)` : ""}
\`\`\`

---
#### TAREFA:
Gere a especificação técnica completa e implemente os arquivos fundamentais para recriar esta solução do zero no formato Clean-Room. Forneça o código funcional dos componentes centrais e explique as escolhas de arquitetura.`;

    return NextResponse.json({
      ok: true,
      fileName: file.name,
      fileSize: file.size,
      totalFiles: structureTree.length,
      detectedFramework,
      dependencies: packageJsonContent?.dependencies || {},
      devDependencies: packageJsonContent?.devDependencies || {},
      componentsCount: componentsList.length,
      routesCount: routesList.length,
      cleanRoomPrompt,
      structureTree: structureTree.slice(0, 100),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Falha ao processar arquivo ZIP para engenharia reversa.",
      },
      { status: 500 }
    );
  }
}
