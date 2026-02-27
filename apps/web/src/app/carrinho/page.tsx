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
                <div>
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
