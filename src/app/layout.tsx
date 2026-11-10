import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { 
  title: "Web UI CodeCode · OpenCode Workspace", 
  description: "Web UI CodeCode - Interface visual para o ecossistema OpenCode com suporte a chaves próprias de API e GitHub." 
};
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
