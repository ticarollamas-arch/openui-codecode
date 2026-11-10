import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0b0d11", color: "#f8fafc", fontFamily: "sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <h2 style={{ fontSize: "28px", fontWeight: "700", marginBottom: "8px" }}>Página Não Encontrada</h2>
        <p style={{ color: "#94a3b8", marginBottom: "20px" }}>O recurso solicitado não existe ou foi movido.</p>
        <Link href="/" style={{ background: "#f97316", color: "#0b0d11", padding: "10px 18px", borderRadius: "8px", textDecoration: "none", fontWeight: "600" }}>
          Voltar ao Início
        </Link>
      </div>
    </div>
  );
}
