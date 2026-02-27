import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ padding: 24, maxWidth: 920, margin: "0 auto" }}>
      <h1>Pagina nao encontrada</h1>
      <p style={{ marginTop: 8, opacity: 0.8 }}>O conteudo que voce tentou abrir nao existe.</p>
      <p style={{ marginTop: 16 }}>
        <Link href="/bolsas">Voltar para o catalogo</Link>
      </p>
    </main>
  );
}

