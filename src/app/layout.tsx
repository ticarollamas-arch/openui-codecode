import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { 
  title: "OpenUI Code Code · Interface gráfica do OpenCode", 
  description: "OpenUI Code Code — interface gráfica para o OpenCode, com chat, modelos de IA, provedores e integração com GitHub." 
};
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
