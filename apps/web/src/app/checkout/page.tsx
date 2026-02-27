"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CartItem, readCart, writeCartWithOptions } from "@/lib/cart";

type PaymentMethod = "pix" | "dinheiro" | "cartao";

type CheckoutForm = {
  name: string;
  phone: string;
  address: string;
  paymentMethod: PaymentMethod;
  notes: string;
};

const CHECKOUT_FORM_STORAGE_KEY = "cf_boutique_checkout_form_v1";

function toBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function sanitizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

function formatPhoneMask(raw: string): string {
  const digits = sanitizePhone(raw).slice(0, 11);

  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function paymentMethodLabel(method: PaymentMethod): string {
  if (method === "pix") return "PIX";
  if (method === "dinheiro") return "Dinheiro";
  return "Cartao";
}

function isHttpImageUrl(value?: string): boolean {
  if (!value) return false;
  return value.startsWith("http://") || value.startsWith("https://");
}

function buildMessage(form: CheckoutForm, items: CartItem[], totalCents: number, orderId?: string): string {
  const lines: string[] = [];

  lines.push("Ola! Quero finalizar este pedido:");
  if (orderId) {
    lines.push(`Pedido: ${orderId}`);
  }
  lines.push("");
  lines.push("Cliente:");
  lines.push(`Nome: ${form.name}`);
  lines.push(`Telefone: ${form.phone}`);
  lines.push(`Endereco: ${form.address}`);
  lines.push(`Pagamento: ${paymentMethodLabel(form.paymentMethod)}`);
  if (form.notes.trim()) {
    lines.push(`Observacoes: ${form.notes.trim()}`);
  }

  lines.push("");
  lines.push("Itens:");
  items.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.productName} | ${item.color} - ${item.size} | Qtd: ${item.quantity} | Subtotal: ${toBRL(
        item.priceCents * item.quantity,
      )}`,
    );
    if (item.sku) {
      lines.push(`   SKU: ${item.sku}`);
    }
    if (isHttpImageUrl(item.imageUrl)) {
      lines.push(`   Foto: ${item.imageUrl}`);
    }
  });

  lines.push("");
  lines.push(`Total: ${toBRL(totalCents)}`);

  return lines.join("\n");
}

function readStoredForm(): CheckoutForm | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(CHECKOUT_FORM_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    const paymentMethod = parsed?.paymentMethod;

    return {
      name: String(parsed?.name ?? ""),
      phone: formatPhoneMask(String(parsed?.phone ?? "")),
      address: String(parsed?.address ?? ""),
      paymentMethod:
        paymentMethod === "pix" || paymentMethod === "dinheiro" || paymentMethod === "cartao"
          ? paymentMethod
          : "pix",
      notes: String(parsed?.notes ?? ""),
    };
  } catch {
    return null;
  }
}

function validateForm(form: CheckoutForm): string {
  if (form.name.trim().length < 3) return "Informe um nome valido.";
  if (sanitizePhone(form.phone).length < 10) return "Informe um telefone valido com DDD.";
  if (form.address.trim().length < 10) return "Informe um endereco mais completo.";
  return "";
}

export default function CheckoutPage() {
  const api = process.env.NEXT_PUBLIC_API_URL;
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState<CheckoutForm>({
    name: "",
    phone: "",
    address: "",
    paymentMethod: "pix",
    notes: "",
  });
  const [error, setError] = useState("");

  const totalCents = useMemo(
    () => items.reduce((acc, item) => acc + item.priceCents * item.quantity, 0),
    [items],
  );

  const formError = useMemo(() => validateForm(form), [form]);
  const canSubmit = items.length > 0 && !formError;

  useEffect(() => {
    setItems(readCart());

    const stored = readStoredForm();
    if (stored) {
      setForm(stored);
    }

    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    window.localStorage.setItem(CHECKOUT_FORM_STORAGE_KEY, JSON.stringify(form));
  }, [form, loaded]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (items.length === 0) {
      setError("Seu carrinho esta vazio.");
      return;
    }

    if (formError) {
      setError(formError);
      return;
    }

    const configuredNumber = sanitizePhone(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "");

    if (!configuredNumber) {
      setError("Defina NEXT_PUBLIC_WHATSAPP_NUMBER em apps/web/.env.local para finalizar no WhatsApp.");
      return;
    }

    if (!api) {
      setError("API nao configurada.");
      return;
    }

    try {
      const orderRes = await fetch(`${api}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: form.name,
          customerPhone: form.phone,
          customerAddress: form.address,
          paymentMethod: paymentMethodLabel(form.paymentMethod),
          notes: form.notes,
          totalCents,
          items,
        }),
      });

      if (!orderRes.ok) {
        const bodyText = await orderRes.text();
        throw new Error(bodyText || `Falha ao criar pedido (${orderRes.status})`);
      }

      const order = (await orderRes.json()) as { id?: string };
      const message = buildMessage(form, items, totalCents, order.id);
      const url = `https://wa.me/${configuredNumber}?text=${encodeURIComponent(message)}`;

      writeCartWithOptions([], { notify: true });
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao criar pedido.");
    }
  }

  return (
    <main className="page-shell">
      <div className="nav-row">
        <Link href="/carrinho" className="nav-pill">
          Voltar para carrinho
        </Link>
        <Link href="/bolsas" className="nav-pill">
          Continuar comprando
        </Link>
      </div>

      <h1 className="hero-title">Checkout</h1>
      <p className="hero-subtitle">Preencha seus dados para concluir pelo WhatsApp.</p>

      {!loaded ? <p className="meta">Carregando checkout...</p> : null}

      {loaded && items.length === 0 ? <p className="alert alert-warn">Seu carrinho esta vazio.</p> : null}

      {items.length > 0 ? (
        <section className="form-grid" style={{ marginTop: 16 }}>
          <div className="card section-card">
            <h2 className="section-title">Resumo do pedido</h2>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {items.map((item) => (
                <li key={item.variantId} style={{ marginTop: 8 }}>
                  {item.productName} | {item.color} - {item.size} | Qtd: {item.quantity} |{" "}
                  {toBRL(item.priceCents * item.quantity)}
                </li>
              ))}
            </ul>
            <p className="total">Total: {toBRL(totalCents)}</p>
          </div>

          <form onSubmit={onSubmit} className="card section-card form-grid">
            <h2 className="section-title">Seus dados</h2>

            <label className="field">
              Nome
              <input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Seu nome"
              />
            </label>

            <label className="field">
              Telefone
              <input
                value={form.phone}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    phone: formatPhoneMask(event.target.value),
                  }))
                }
                placeholder="(11) 94477-1562"
              />
            </label>

            <label className="field">
              Endereco
              <input
                value={form.address}
                onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
                placeholder="Rua, numero, bairro, cidade"
              />
            </label>

            <fieldset className="radio-group">
              <legend>Pagamento</legend>
              <div className="row" style={{ marginTop: 6 }}>
                <label>
                  <input
                    type="radio"
                    name="payment-method"
                    checked={form.paymentMethod === "pix"}
                    onChange={() => setForm((prev) => ({ ...prev, paymentMethod: "pix" }))}
                  />{" "}
                  PIX
                </label>
                <label>
                  <input
                    type="radio"
                    name="payment-method"
                    checked={form.paymentMethod === "dinheiro"}
                    onChange={() => setForm((prev) => ({ ...prev, paymentMethod: "dinheiro" }))}
                  />{" "}
                  Dinheiro
                </label>
                <label>
                  <input
                    type="radio"
                    name="payment-method"
                    checked={form.paymentMethod === "cartao"}
                    onChange={() => setForm((prev) => ({ ...prev, paymentMethod: "cartao" }))}
                  />{" "}
                  Cartao
                </label>
              </div>
            </fieldset>

            <label className="field">
              Observacoes
              <textarea
                value={form.notes}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder="Referencia, horario de entrega, etc."
                rows={4}
              />
            </label>

            {error ? <p className="alert alert-error">{error}</p> : null}
            {!error && formError ? <p className="alert alert-warn">{formError}</p> : null}

            <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
              Finalizar pedido no WhatsApp
            </button>
          </form>
        </section>
      ) : null}
    </main>
  );
}
