"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CartItem, readCart, writeCartWithOptions } from "@/lib/cart";

function toBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export default function CarrinhoPage() {
  const api = process.env.NEXT_PUBLIC_API_URL;
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setItems(readCart());
    setLoaded(true);
  }, []);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key && event.key !== "cf_boutique_cart_v1") return;
      setItems(readCart());
    }

    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    writeCartWithOptions(items, { notify: true });
  }, [items, loaded]);

  useEffect(() => {
    if (!api || !loaded || items.length === 0) return;

    const missingImageItems = items.filter((item) => !item.imageUrl);
    if (missingImageItems.length === 0) return;

    let cancelled = false;

    async function hydrateMissingImages() {
      const uniqueProductIds = Array.from(new Set(missingImageItems.map((item) => item.productId)));

      const imageEntries = await Promise.all(
        uniqueProductIds.map(async (productId) => {
          try {
            const res = await fetch(`${api}/catalog/products/${productId}`, { cache: "no-store" });
            if (!res.ok) return null;

            const product = (await res.json()) as { imageUrl?: string };
            if (!product.imageUrl) return null;
            return [productId, product.imageUrl] as const;
          } catch {
            return null;
          }
        }),
      );

      if (cancelled) return;

      const imageByProductId = new Map(
        imageEntries.filter((entry): entry is readonly [string, string] => entry !== null),
      );

      if (imageByProductId.size === 0) return;

      let changed = false;
      const nextItems = items.map((item) => {
        if (item.imageUrl) return item;
        const imageUrl = imageByProductId.get(item.productId);
        if (!imageUrl) return item;
        changed = true;
        return { ...item, imageUrl };
      });

      if (!changed) return;
      setItems(nextItems);
      writeCartWithOptions(nextItems, { notify: true });
    }

    void hydrateMissingImages();

    return () => {
      cancelled = true;
    };
  }, [api, items, loaded]);

  const totalCents = useMemo(
    () => items.reduce((acc, item) => acc + item.priceCents * item.quantity, 0),
    [items],
  );

  function changeQuantity(variantId: string, delta: number) {
    setItems((prev) =>
      prev
        .map((item) =>
          item.variantId === variantId
            ? {
                ...item,
                quantity: Math.max(0, item.quantity + delta),
              }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  function removeItem(variantId: string) {
    setItems((prev) => prev.filter((item) => item.variantId !== variantId));
  }

  function clearCart() {
    setItems([]);
  }

  return (
    <main className="page-shell">
      <div className="nav-row">
        <Link href="/bolsas" className="nav-pill">
          Continuar comprando
        </Link>
      </div>

      <h1 className="hero-title">Carrinho</h1>
      <p className="hero-subtitle">Revise seus itens antes de concluir o pedido.</p>

      {!loaded ? <p className="meta">Carregando carrinho...</p> : null}

      {loaded && items.length === 0 ? <p className="alert alert-warn">Seu carrinho esta vazio.</p> : null}

      {items.length > 0 ? (
        <>
          <ul className="list-reset cart-list">
            {items.map((item) => (
              <li key={item.variantId} className="card cart-item">
                <div className="row" style={{ alignItems: "center", gap: 10 }}>
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.productName}
                      style={{
                        width: 56,
                        height: 56,
                        objectFit: "cover",
                        borderRadius: 8,
                        border: "1px solid #d9cab7",
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 8,
                        border: "1px solid #d9cab7",
                        background: "#f6efe6",
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <strong>{item.productName}</strong>
                </div>
                <div className="meta">
                  {item.color} - {item.size}
                </div>
                <div>Valor unitario: {toBRL(item.priceCents)}</div>
                <div>Subtotal: {toBRL(item.priceCents * item.quantity)}</div>

                <div className="row">
                  <button
                    type="button"
                    onClick={() => changeQuantity(item.variantId, -1)}
                    className="qty-btn"
                    aria-label={`Diminuir quantidade de ${item.productName}`}
                  >
                    -
                  </button>
                  <span>Qtd: {item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => changeQuantity(item.variantId, 1)}
                    className="qty-btn"
                    aria-label={`Aumentar quantidade de ${item.productName}`}
                  >
                    +
                  </button>
                  <button type="button" onClick={() => removeItem(item.variantId)} className="btn btn-soft">
                    Remover
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <section className="card summary">
            <h2 className="section-title">Resumo</h2>
            <p className="total">Total: {toBRL(totalCents)}</p>
            <div className="row">
              <Link href="/checkout" className="nav-pill">
                Ir para checkout
              </Link>
              <button type="button" onClick={clearCart} className="btn btn-soft">
                Limpar carrinho
              </button>
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
