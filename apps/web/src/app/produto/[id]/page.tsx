import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductDetailClient } from "./product-detail-client";

type Inventory = { onHand: number; reserved: number };
type Variant = {
  id: string;
  sku: string;
  color: string;
  size: string;
  priceCents: number;
  inventory?: Inventory | null;
};

type Product = {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  category?: { id: string; name: string };
  variants: Variant[];
};

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getProduct(apiBase: string, id: string): Promise<Product | null> {
  try {
    const res = await fetch(`${apiBase}/catalog/products/${id}`, { cache: "no-store" });

    if (res.status === 404) return null;
    if (!res.ok) return null;

    return res.json();
  } catch {
    return null;
  }
}

export default async function ProdutoPage({ params }: PageProps) {
  const { id } = await params;
  const api = process.env.NEXT_PUBLIC_API_URL;

  if (!api) {
    throw new Error("Defina NEXT_PUBLIC_API_URL em apps/web/.env.local");
  }

  const product = await getProduct(api, id);

  if (!product) {
    notFound();
  }

  return (
    <main className="page-shell">
      <div className="nav-row">
        <Link href="/bolsas" className="nav-pill">
          Voltar para catalogo
        </Link>
        <Link href="/carrinho" className="nav-pill">
          Ir para carrinho
        </Link>
      </div>

      <h1 className="hero-title">{product.name}</h1>
      {product.category ? <p className="meta">Categoria: {product.category.name}</p> : null}
      {product.description ? <p className="hero-subtitle">{product.description}</p> : null}

      <ProductDetailClient product={product} />
    </main>
  );
}
