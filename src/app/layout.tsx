import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Open UI Code Code — Agentes, Cloud e Desenvolvimento",
  description: "Central de trabalho com agentes de IA, modelos, ferramentas de desenvolvimento, integrações e infraestrutura cloud.",
  applicationName: "Open UI Code Code",
  keywords: [
    "Open UI Code Code",
    "agentes de IA",
    "ferramentas de desenvolvimento",
    "cloud",
    "automação de desenvolvimento",
    "integrações de IA",
    "economia de tokens",
    "workspace de programação"
  ],
  openGraph: {
    title: "Open UI Code Code",
    description: "Agentes, cloud e ferramentas de desenvolvimento em um só espaço.",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
