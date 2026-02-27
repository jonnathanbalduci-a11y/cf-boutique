"use client";

import { useMemo, useState } from "react";
import { CartItem, readCart, writeCart } from "@/lib/cart";

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
  imageUrl?: string;
  variants: Variant[];
};

function toBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function getAvailableStock(variant: Variant): number {
  return (variant.inventory?.onHand ?? 0) - (variant.inventory?.reserved ?? 0);
}

function addToCart(product: Product, variant: Variant): void {
  const current = readCart();

  const existingIndex = current.findIndex((item) => item.variantId === variant.id);

  if (existingIndex >= 0) {
    const updated = [...current];
    updated[existingIndex] = {
      ...updated[existingIndex],
      quantity: updated[existingIndex].quantity + 1,
    };
    writeCart(updated);
    return;
  }

  const item: CartItem = {
    variantId: variant.id,
    productId: product.id,
    productName: product.name,
    sku: variant.sku,
    color: variant.color,
    size: variant.size,
    imageUrl: product.imageUrl,
    priceCents: variant.priceCents,
    quantity: 1,
  };

  writeCart([...current, item]);
}

export function ProductDetailClient({ product }: { product: Product }) {
  const [selectedVariantId, setSelectedVariantId] = useState<string>(product.variants[0]?.id ?? "");
  const [feedback, setFeedback] = useState<string>("");

  const selectedVariant = useMemo(
    () => product.variants.find((v) => v.id === selectedVariantId) ?? product.variants[0],
    [product.variants, selectedVariantId],
  );

  if (!selectedVariant) {
    return <p className="alert alert-warn">Produto sem variantes disponiveis.</p>;
  }

  const stock = getAvailableStock(selectedVariant);
  const canAdd = stock > 0;

  return (
    <section className="card section-card detail-layout">
      {product.imageUrl ? (
        <img
          src={product.imageUrl}
          alt={product.name}
          style={{ width: "100%", maxHeight: 360, objectFit: "cover", borderRadius: 12 }}
        />
      ) : null}

      <h2 className="section-title">Escolha a variante</h2>

      <div className="choice-grid">
        {product.variants.map((variant) => {
          const variantStock = getAvailableStock(variant);
          const isSelected = variant.id === selectedVariant.id;

          return (
            <button
              key={variant.id}
              type="button"
              onClick={() => setSelectedVariantId(variant.id)}
              className={`choice-card${isSelected ? " active" : ""}`}
            >
              <strong>
                {variant.color} - {variant.size}
              </strong>
              <div>{toBRL(variant.priceCents)}</div>
              <div className="meta">SKU: {variant.sku}</div>
              <div className="meta">Estoque: {variantStock}</div>
            </button>
          );
        })}
      </div>

      <div className="price-row">
        <strong className="price">{toBRL(selectedVariant.priceCents)}</strong>
        <button
          type="button"
          onClick={() => {
            addToCart(product, selectedVariant);
            setFeedback("Item adicionado ao carrinho.");
            setTimeout(() => setFeedback(""), 1800);
          }}
          disabled={!canAdd}
          className="btn btn-primary"
        >
          {canAdd ? "Adicionar ao carrinho" : "Sem estoque"}
        </button>
      </div>

      {feedback ? <p style={{ color: "var(--ok)", margin: 0 }}>{feedback}</p> : null}
    </section>
  );
}
