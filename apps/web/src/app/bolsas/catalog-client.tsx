"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Category = { id: string; name: string };
type Product = {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  categoryId: string;
  variants: Array<{ id: string; priceCents: number; color: string; size: string }>;
};

function toBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function getStartingPrice(product: Product): number | null {
  if (!product.variants.length) return null;
  return product.variants.reduce((min, current) => (current.priceCents < min ? current.priceCents : min), product.variants[0].priceCents);
}

export function CatalogClient({
  categories,
  products,
}: {
  categories: Category[];
  products: Product[];
}) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();

    return products.filter((p) => {
      const byCategory = categoryFilter === "all" || p.categoryId === categoryFilter;
      if (!byCategory) return false;

      if (!q) return true;
      const text = `${p.name} ${p.description ?? ""}`.toLowerCase();
      return text.includes(q);
    });
  }, [products, search, categoryFilter]);

  const byCategory = useMemo(
    () =>
      categories
        .map((c) => ({
          category: c,
          items: filteredProducts.filter((p) => p.categoryId === c.id),
        }))
        .filter((entry) => entry.items.length > 0),
    [categories, filteredProducts],
  );

  return (
    <>
      <section className="card section-card filter-panel">
        <div className="filter-grid">
          <label className="field">
            Buscar produto
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ex.: classic, gourmet, preta"
            />
          </label>

          <label className="field">
            Categoria
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="filter-select"
            >
              <option value="all">Todas</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="meta" style={{ margin: 0 }}>
          {filteredProducts.length} produto(s) encontrado(s)
        </p>
      </section>

      {byCategory.length === 0 ? (
        <p className="alert alert-warn">Nenhum produto encontrado com os filtros selecionados.</p>
      ) : null}

      {byCategory.map(({ category, items }) => (
        <section key={category.id} className="card section-card">
          <h2 className="section-title">{category.name}</h2>

          <ul className="list-reset product-grid">
            {items.map((p) => (
              <li key={p.id} className="product-item">
                <div className="product-thumb" aria-hidden="true">
                  {p.imageUrl ? <img src={p.imageUrl} alt="" className="product-thumb-img" /> : <span>CF</span>}
                </div>
                <Link href={`/produto/${p.id}`} className="product-link">
                  {p.name}
                </Link>
                {getStartingPrice(p) !== null ? (
                  <div className="product-price">A partir de {toBRL(getStartingPrice(p) ?? 0)}</div>
                ) : null}
                {p.description ? <div className="product-desc">{p.description}</div> : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
