import Link from "next/link";
import { CatalogClient } from "./catalog-client";

type Category = { id: string; name: string };
type Product = {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  categoryId: string;
  variants: Array<{ id: string; priceCents: number; color: string; size: string }>;
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Erro ao carregar ${url}: ${res.status}`);
  return res.json();
}

export default async function BolsasPage() {
  const api = process.env.NEXT_PUBLIC_API_URL;

  if (!api) {
    throw new Error("Defina NEXT_PUBLIC_API_URL em apps/web/.env.local");
  }

  let categories: Category[] = [];
  let products: Product[] = [];
  let loadError = "";

  try {
    [categories, products] = await Promise.all([
      getJson<Category[]>(`${api}/catalog/categories`),
      getJson<Product[]>(`${api}/catalog/products`),
    ]);
  } catch {
    loadError = "Nao foi possivel carregar o catalogo agora. Tente novamente em instantes.";
  }

  return (
    <main className="page-shell">
      <div className="nav-row">
        <Link href="/carrinho" className="nav-pill">
          Ver carrinho
        </Link>
      </div>

      <h1 className="hero-title">Colecao CF Boutique</h1>
      <p className="hero-subtitle">Escolha sua bolsa ideal e finalize o pedido pelo WhatsApp.</p>

      {loadError ? <p className="alert alert-error">{loadError}</p> : null}
      {!loadError ? <CatalogClient categories={categories} products={products} /> : null}
    </main>
  );
}
