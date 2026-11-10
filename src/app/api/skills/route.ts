import { NextRequest, NextResponse } from "next/server";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { searchSkillsCatalog, getSkillDetail } from "@/lib/skills-catalog";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const detailId = searchParams.get("detail");
  const query = searchParams.get("q") || "";
  const category = searchParams.get("category") || "";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "24", 10);

  // Progressive Disclosure: Level 2 on-demand detail injection
  if (detailId) {
    const detail = getSkillDetail(detailId);
    if (!detail) {
      return NextResponse.json({ error: "Skill não encontrada no catálogo." }, { status: 404 });
    }
    return NextResponse.json({ skill: detail });
  }

  // Level 1: Fast metadata search across the 20,000 skills registry
  const result = searchSkillsCatalog({
    query,
    category,
    page,
    limit,
  });

  // Also read any local physical SKILL.md files if available
  const localSkills: any[] = [];
  const roots = [process.env.OPENCODE_SKILLS_DIR, path.join(process.cwd(), ".agents", "skills")].filter(
    Boolean
  ) as string[];

  for (const root of roots) {
    try {
      const entries = await readdir(root, { withFileTypes: true });
      for (const e of entries) {
        if (!e.isDirectory()) continue;
        const file = path.join(root, e.name, "SKILL.md");
        try {
          const raw = await readFile(file, "utf8");
          const desc =
            raw.match(/^description:\s*(.+)$/m)?.[1] ||
            raw.split("\n").find((x) => x.trim() && !x.startsWith("#")) ||
            "Skill local do OpenCode";
          localSkills.push({
            id: `local-${e.name}`,
            name: e.name,
            category: "Skills Locais",
            description: desc.replace(/^['"]|['"]$/g, ""),
            tags: ["local", "opencode"],
            version: "local",
          });
        } catch {}
      }
    } catch {}
  }

  return NextResponse.json({
    skills: [...localSkills, ...result.skills],
    total: result.total + localSkills.length,
    page: result.page,
    totalPages: result.totalPages,
    progressiveDisclosureMode: "metadata-only (carregamento progressivo sob demanda)",
  });
}
