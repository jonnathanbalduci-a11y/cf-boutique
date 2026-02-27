"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main style={{ padding: 24, maxWidth: 920, margin: "0 auto" }}>
      <h1>Ops, ocorreu um erro inesperado.</h1>
      <p style={{ opacity: 0.8, marginTop: 8 }}>Tente novamente. Se persistir, recarregue a pagina.</p>
      <p style={{ marginTop: 10, fontSize: 13, opacity: 0.65 }}>
        Detalhe tecnico: {error.message || "Erro interno"}
      </p>
      <button type="button" onClick={reset} style={{ marginTop: 16, cursor: "pointer" }}>
        Tentar novamente
      </button>
    </main>
  );
}

