import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    await req.json().catch(() => ({}));
    const token = process.env.GITHUB_TOKEN;

    if (!token || typeof token !== "string" || !token.trim()) {
      return NextResponse.json(
        { ok: false, error: "A integração GitHub ainda não foi habilitada pela administração." },
        { status: 400 }
      );
    }

    const cleanToken = token.trim();

    const res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${cleanToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "Open-UI-Code-Code",
      },
    });

    if (!res.ok) {
      if (res.status === 401) {
        return NextResponse.json(
          { ok: false, error: "A credencial GitHub administrada pela plataforma é inválida ou expirou." },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { ok: false, error: `GitHub API respondeu com status ${res.status}.` },
        { status: res.status }
      );
    }

    const user = await res.json();
    return NextResponse.json({
      ok: true,
      user: {
        login: user.login,
        name: user.name || user.login,
        avatar_url: user.avatar_url,
        html_url: user.html_url,
        public_repos: user.public_repos,
        total_private_repos: user.total_private_repos,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Erro ao validar token." },
      { status: 500 }
    );
  }
}
