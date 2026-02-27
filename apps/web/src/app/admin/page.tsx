"use client";

import { useEffect, useMemo, useState } from "react";

type Category = { id: string; name: string };
type Variant = {
  id: string;
  sku: string;
  color: string;
  size: string;
  priceCents: number;
  active: boolean;
  inventory?: { onHand: number; reserved: number } | null;
};

type Product = {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  categoryId: string;
  active: boolean;
  category?: Category;
  variants: Variant[];
};

type NewProductForm = {
  name: string;
  description: string;
  imageUrl: string;
  categoryId: string;
  priceCents: string;
  color: string;
  size: string;
  stock: string;
};

type AdminOrderItem = {
  id: string;
  productName: string;
  sku?: string | null;
  imageUrl?: string | null;
  color: string;
  size: string;
  quantity: number;
  priceCents: number;
};

type AdminOrder = {
  id: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  paymentMethod: string;
  notes?: string | null;
  totalCents: number;
  paymentStatus: "pending" | "paid";
  deliveryStatus: "pending" | "delivered";
  stockDeducted: boolean;
  createdAt: string;
  items: AdminOrderItem[];
};

type AdminDashboard = {
  ordersCount: number;
  paidOrdersCount: number;
  totalSalesCents: number;
  paidSalesCents: number;
};

const ADMIN_KEY_STORAGE = "cf_admin_key";

function toBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatCurrencyInputFromCents(cents: number): string {
  const safe = Number.isFinite(cents) ? Math.max(0, cents) : 0;
  return (safe / 100).toFixed(2).replace(".", ",");
}

function parseCurrencyInputToCents(raw: string): number {
  const text = raw.trim();
  if (!text) return 0;

  if (text.includes(",") || text.includes(".")) {
    const normalized = text.replace(/\./g, "").replace(",", ".");
    const value = Number(normalized);
    if (!Number.isFinite(value) || value < 0) return 0;
    return Math.round(value * 100);
  }

  const value = Number(text);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value * 100);
}

function normalizeProduct(input: Product): Product {
  return {
    ...input,
    variants: (input.variants ?? []).map((v) => ({
      ...v,
      priceCents: Number.isFinite(v.priceCents) ? Math.max(0, Math.floor(v.priceCents)) : 0,
      inventory: v.inventory
        ? {
            onHand: Number.isFinite(v.inventory.onHand) ? Math.max(0, Math.floor(v.inventory.onHand)) : 0,
            reserved: Number.isFinite(v.inventory.reserved) ? Math.max(0, Math.floor(v.inventory.reserved)) : 0,
          }
        : { onHand: 0, reserved: 0 },
    })),
  };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Falha ao ler arquivo de imagem."));
    reader.readAsDataURL(file);
  });
}

export default function AdminPage() {
  const api = process.env.NEXT_PUBLIC_API_URL;

  const [adminKeyInput, setAdminKeyInput] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [dashboard, setDashboard] = useState<AdminDashboard>({
    ordersCount: 0,
    paidOrdersCount: 0,
    totalSalesCents: 0,
    paidSalesCents: 0,
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [imagePreview, setImagePreview] = useState<{ src: string; alt: string } | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);

  const [newProduct, setNewProduct] = useState<NewProductForm>({
    name: "",
    description: "",
    imageUrl: "",
    categoryId: "",
    priceCents: "",
    color: "",
    size: "",
    stock: "",
  });

  useEffect(() => {
    const saved = window.localStorage.getItem(ADMIN_KEY_STORAGE) ?? "";
    if (saved) {
      setAdminKey(saved);
      setAdminKeyInput(saved);
    }
  }, []);

  async function adminFetch(path: string, init?: RequestInit, keyOverride?: string) {
    if (!api) throw new Error("Defina NEXT_PUBLIC_API_URL em apps/web/.env.local");
    const key = (keyOverride ?? adminKey).trim();
    if (!key) throw new Error("Informe a chave admin.");

    const res = await fetch(`${api}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": key,
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });

    if (!res.ok) {
      if (res.status === 413) {
        throw new Error("Imagem muito grande. Use uma imagem menor e tente novamente.");
      }
      const text = await res.text();
      throw new Error(text || `Erro ${res.status}`);
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return res.json();
    }
    return null;
  }

  async function loadData(keyOverride?: string) {
    setLoading(true);
    setError("");
    try {
      const [cats, prods, ords, dash] = await Promise.all([
        adminFetch("/admin/categories", undefined, keyOverride),
        adminFetch("/admin/products", undefined, keyOverride),
        adminFetch("/admin/orders", undefined, keyOverride),
        adminFetch("/admin/dashboard", undefined, keyOverride),
      ]);
      setCategories(cats as Category[]);
      setProducts((prods as Product[]).map(normalizeProduct));
      setOrders(ords as AdminOrder[]);
      setDashboard(dash as AdminDashboard);
      setMessage("Dados administrativos carregados.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar painel.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshOrdersAndDashboard(keyOverride?: string) {
    try {
      const [ords, dash] = await Promise.all([
        adminFetch("/admin/orders", undefined, keyOverride),
        adminFetch("/admin/dashboard", undefined, keyOverride),
      ]);
      setOrders(ords as AdminOrder[]);
      setDashboard(dash as AdminDashboard);
    } catch {
      // Silent refresh; keeps current data if a transient request fails.
    }
  }

  useEffect(() => {
    if (!adminKey) return;
    void loadData();
  }, [adminKey]);

  useEffect(() => {
    if (!adminKey || !api) return;

    const refreshNow = () => {
      if (document.visibilityState === "visible") {
        void refreshOrdersAndDashboard();
      }
    };

    const streamUrl = `${api}/admin/orders/events?key=${encodeURIComponent(adminKey)}`;
    const stream = new EventSource(streamUrl);

    stream.onmessage = () => {
      void refreshOrdersAndDashboard();
    };

    // Browser reconnects SSE automatically on network hiccups.
    stream.onerror = () => {
      refreshNow();
    };

    window.addEventListener("focus", refreshNow);
    document.addEventListener("visibilitychange", refreshNow);

    return () => {
      stream.close();
      window.removeEventListener("focus", refreshNow);
      document.removeEventListener("visibilitychange", refreshNow);
    };
  }, [adminKey, api]);

  useEffect(() => {
    if (!imagePreview) return;
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setImagePreview(null);
      }
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [imagePreview]);

  const categoryOptions = useMemo(() => categories, [categories]);

  async function saveAdminKey() {
    const key = adminKeyInput.trim();
    if (!key) {
      setError("Digite a chave admin para entrar.");
      setMessage("");
      return;
    }

    setError("");
    setMessage("Validando acesso...");
    setLoading(true);

    try {
      await adminFetch("/admin/categories", undefined, key);
      window.localStorage.setItem(ADMIN_KEY_STORAGE, key);
      setAdminKey(key);
      await loadData(key);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chave admin invalida.");
      setMessage("");
    } finally {
      setLoading(false);
    }
  }

  function logoutAdmin() {
    window.localStorage.removeItem(ADMIN_KEY_STORAGE);
    setAdminKey("");
    setAdminKeyInput("");
    setProducts([]);
    setCategories([]);
    setOrders([]);
    setDashboard({ ordersCount: 0, paidOrdersCount: 0, totalSalesCents: 0, paidSalesCents: 0 });
    setError("");
    setMessage("");
  }

  async function createProduct() {
    setError("");
    setMessage("");
    try {
      await adminFetch("/admin/products", {
        method: "POST",
        body: JSON.stringify({
          name: newProduct.name,
          description: newProduct.description,
          imageUrl: newProduct.imageUrl,
          categoryId: newProduct.categoryId,
          priceCents: newProduct.priceCents,
          color: newProduct.color || "Unica",
          size: newProduct.size || "Unico",
          stock: Number(newProduct.stock || 0),
        }),
      });

      setMessage("Produto criado com sucesso.");
      setNewProduct({
        name: "",
        description: "",
        imageUrl: "",
        categoryId: "",
        priceCents: "",
        color: "",
        size: "",
        stock: "",
      });
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao criar produto.");
    }
  }

  async function saveProduct(product: Product) {
    setError("");
    setMessage("");
    try {
      await adminFetch(`/admin/products/${product.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: product.name,
          description: product.description ?? "",
          imageUrl: product.imageUrl ?? "",
          categoryId: product.categoryId,
          active: product.active,
        }),
      });
      setMessage(`Produto ${product.name} atualizado.`);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar produto.");
    }
  }

  async function saveVariant(productName: string, variant: Variant) {
    setError("");
    setMessage("");
    try {
      if (!Number.isFinite(variant.priceCents) || variant.priceCents < 0) {
        throw new Error("Valor da variante invalido.");
      }
      await adminFetch(`/admin/variants/${variant.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          color: variant.color,
          size: variant.size,
          priceCents: Math.floor(variant.priceCents),
          active: variant.active,
          stock: Number(variant.inventory?.onHand ?? 0),
        }),
      });
      setMessage(`Variante ${variant.sku} de ${productName} atualizada.`);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar variante.");
    }
  }

  async function onSelectNewProductImage(file: File | null) {
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setNewProduct((prev) => ({ ...prev, imageUrl: dataUrl }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar imagem.");
    }
  }

  async function onSelectProductImage(productId: string, file: File | null) {
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, imageUrl: dataUrl } : p)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar imagem.");
    }
  }

  async function setOrderPaid(orderId: string, paid: boolean) {
    setError("");
    setMessage("");
    try {
      await adminFetch(`/admin/orders/${orderId}/payment`, {
        method: "PATCH",
        body: JSON.stringify({ paid }),
      });
      setMessage(paid ? "Pedido marcado como pago e estoque atualizado." : "Pedido marcado como pendente.");
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao atualizar pagamento.");
    }
  }

  async function setOrderDelivered(orderId: string, delivered: boolean) {
    setError("");
    setMessage("");
    try {
      await adminFetch(`/admin/orders/${orderId}/delivery`, {
        method: "PATCH",
        body: JSON.stringify({ delivered }),
      });
      setMessage(delivered ? "Pedido marcado como entregue." : "Entrega marcada como pendente.");
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao atualizar entrega.");
    }
  }

  return (
    <main className="page-shell">
      <h1 className="hero-title">Painel Admin</h1>
      <p className="hero-subtitle">Gerencie produtos, pedidos, pagamentos e entregas.</p>

      <section className="card section-card form-grid" style={{ marginTop: 16 }}>
        <h2 className="section-title">Acesso administrativo</h2>
        <div className="row">
          <input
            value={adminKeyInput}
            onChange={(event) => setAdminKeyInput(event.target.value)}
            placeholder="Digite ADMIN_KEY"
            style={{ minWidth: 260 }}
          />
          <button type="button" className="btn btn-primary" onClick={saveAdminKey}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
          {adminKey ? (
            <button type="button" className="btn btn-soft" onClick={logoutAdmin}>
              Sair
            </button>
          ) : null}
        </div>
      </section>

      {message ? (
        <p className="alert" style={{ color: "var(--ok)", background: "#eef9f1", borderColor: "#b9e6c7" }}>
          {message}
        </p>
      ) : null}
      {error ? <p className="alert alert-error">{error}</p> : null}

      {adminKey ? (
        <>
          <section className="card section-card" style={{ marginTop: 16 }}>
            <h2 className="section-title">Dashboard</h2>
            <div className="filter-grid" style={{ marginTop: 10 }}>
              <div className="card" style={{ padding: 12 }}>
                <div className="meta">Pedidos totais</div>
                <strong>{dashboard.ordersCount}</strong>
              </div>
              <div className="card" style={{ padding: 12 }}>
                <div className="meta">Pedidos pagos</div>
                <strong>{dashboard.paidOrdersCount}</strong>
              </div>
              <div className="card" style={{ padding: 12 }}>
                <div className="meta">Vendas totais</div>
                <strong>{toBRL(dashboard.totalSalesCents)}</strong>
              </div>
              <div className="card" style={{ padding: 12 }}>
                <div className="meta">Vendas pagas</div>
                <strong>{toBRL(dashboard.paidSalesCents)}</strong>
              </div>
            </div>
          </section>

          <section className="card section-card" style={{ marginTop: 16 }}>
            <h2 className="section-title">Pedidos</h2>
            {orders.length === 0 ? <p className="meta">Nenhum pedido registrado.</p> : null}
            <div className="form-grid" style={{ marginTop: 10 }}>
              {orders.map((order) => (
                <div key={order.id} className="card" style={{ padding: 12 }}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <strong>Pedido {order.id}</strong>
                    <span className="meta">{new Date(order.createdAt).toLocaleString("pt-BR")}</span>
                  </div>
                  <div className="meta" style={{ marginTop: 6 }}>
                    {order.customerName} | {order.customerPhone}
                  </div>
                  <div className="meta">{order.customerAddress}</div>
                  <div style={{ marginTop: 8 }}>
                    Pagamento: <strong>{order.paymentStatus === "paid" ? "Pago" : "Pendente"}</strong> | Entrega: <strong>{order.deliveryStatus === "delivered" ? "Entregue" : "Pendente"}</strong>
                  </div>
                  <div className="meta">Estoque baixado: {order.stockDeducted ? "Sim" : "Nao"}</div>
                  <ul style={{ marginTop: 8, paddingLeft: 0, listStyle: "none" }}>
                    {order.items.map((item) => (
                      <li key={item.id} style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                        {item.imageUrl ? (
                          <button
                            type="button"
                            onClick={() => setImagePreview({ src: item.imageUrl as string, alt: item.productName })}
                            style={{ padding: 0, border: "none", background: "transparent", cursor: "zoom-in" }}
                            title="Abrir imagem maior"
                          >
                            <img
                              src={item.imageUrl}
                              alt={item.productName}
                              style={{
                                width: 48,
                                height: 48,
                                objectFit: "cover",
                                borderRadius: 8,
                                border: "1px solid #d9cab7",
                                flexShrink: 0,
                              }}
                            />
                          </button>
                        ) : (
                          <div
                            style={{
                              width: 48,
                              height: 48,
                              borderRadius: 8,
                              border: "1px solid #d9cab7",
                              background: "#f6efe6",
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <span>
                          {item.productName} ({item.color}/{item.size}) - Qtd {item.quantity} -{" "}
                          {toBRL(item.priceCents * item.quantity)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="total" style={{ margin: "10px 0" }}>
                    Total: {toBRL(order.totalCents)}
                  </p>
                  <div className="row">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => void setOrderPaid(order.id, order.paymentStatus !== "paid")}
                    >
                      {order.paymentStatus === "paid" ? "Marcar como pendente" : "Marcar como pago"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-soft"
                      onClick={() => void setOrderDelivered(order.id, order.deliveryStatus !== "delivered")}
                    >
                      {order.deliveryStatus === "delivered" ? "Marcar entrega pendente" : "Marcar como entregue"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="card section-card form-grid" style={{ marginTop: 16 }}>
            <h2 className="section-title">Nova bolsa</h2>
            <div className="filter-grid">
              <label className="field">
                Nome
                <input value={newProduct.name} onChange={(e) => setNewProduct((p) => ({ ...p, name: e.target.value }))} />
              </label>
              <label className="field">
                Categoria
                <select
                  className="filter-select"
                  value={newProduct.categoryId}
                  onChange={(e) => setNewProduct((p) => ({ ...p, categoryId: e.target.value }))}
                >
                  <option value="">Selecione...</option>
                  {categoryOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Valor (R$)
                <input
                  value={newProduct.priceCents}
                  onChange={(e) => setNewProduct((p) => ({ ...p, priceCents: e.target.value }))}
                  placeholder="Ex.: 199,90"
                />
              </label>
              <label className="field">
                Estoque inicial
                <input
                  value={newProduct.stock}
                  onChange={(e) => setNewProduct((p) => ({ ...p, stock: e.target.value }))}
                  placeholder="Ex.: 10"
                />
              </label>
              <label className="field">
                Cor
                <input value={newProduct.color} onChange={(e) => setNewProduct((p) => ({ ...p, color: e.target.value }))} />
              </label>
              <label className="field">
                Tamanho
                <input value={newProduct.size} onChange={(e) => setNewProduct((p) => ({ ...p, size: e.target.value }))} />
              </label>
            </div>

            <label className="field">
              Foto da bolsa
              <input
                type="file"
                accept="image/*"
                onChange={(e) => void onSelectNewProductImage(e.target.files?.[0] ?? null)}
              />
            </label>
            {newProduct.imageUrl ? (
              <div className="row">
                <img
                  src={newProduct.imageUrl}
                  alt="Preview da nova bolsa"
                  style={{ width: 140, height: 110, objectFit: "cover", borderRadius: 10, border: "1px solid #d9cab7" }}
                />
                <button
                  type="button"
                  className="btn btn-soft"
                  onClick={() => setNewProduct((p) => ({ ...p, imageUrl: "" }))}
                >
                  Remover foto
                </button>
              </div>
            ) : null}

            <label className="field">
              Descricao
              <textarea
                rows={3}
                value={newProduct.description}
                onChange={(e) => setNewProduct((p) => ({ ...p, description: e.target.value }))}
              />
            </label>

            <div>
              <button type="button" className="btn btn-primary" onClick={createProduct}>
                Criar bolsa
              </button>
            </div>
          </section>

          {loading ? <p className="meta">Carregando produtos...</p> : null}

          {products.map((product, index) => (
            <section key={product.id} className="card section-card form-grid" style={{ marginTop: 16 }}>
              <h2 className="section-title">
                Produto {index + 1}: {product.name}
              </h2>

              <div className="filter-grid">
                <label className="field">
                  Nome
                  <input
                    value={product.name}
                    disabled={editingProductId !== product.id}
                    onChange={(e) =>
                      setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, name: e.target.value } : p)))
                    }
                  />
                </label>

                <label className="field">
                  Categoria
                  <select
                    className="filter-select"
                    value={product.categoryId}
                    disabled={editingProductId !== product.id}
                    onChange={(e) =>
                      setProducts((prev) =>
                        prev.map((p) => (p.id === product.id ? { ...p, categoryId: e.target.value } : p)),
                      )
                    }
                  >
                    {categoryOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="field">
                Foto da bolsa
                <input
                  type="file"
                  accept="image/*"
                  disabled={editingProductId !== product.id}
                  onChange={(e) => void onSelectProductImage(product.id, e.target.files?.[0] ?? null)}
                />
              </label>
              {product.imageUrl ? (
                <div className="row">
                  <img
                    src={product.imageUrl}
                    alt={`Preview de ${product.name}`}
                    style={{ width: 140, height: 110, objectFit: "cover", borderRadius: 10, border: "1px solid #d9cab7" }}
                  />
                  <button
                    type="button"
                    className="btn btn-soft"
                    disabled={editingProductId !== product.id}
                    onClick={() =>
                      setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, imageUrl: "" } : p)))
                    }
                  >
                    Remover foto
                  </button>
                </div>
              ) : null}

              <label className="field">
                Descricao
                <textarea
                  rows={3}
                  value={product.description ?? ""}
                  disabled={editingProductId !== product.id}
                  onChange={(e) =>
                    setProducts((prev) =>
                      prev.map((p) => (p.id === product.id ? { ...p, description: e.target.value } : p)),
                    )
                  }
                />
              </label>

              <label className="row">
                <input
                  type="checkbox"
                  checked={product.active}
                  disabled={editingProductId !== product.id}
                  onChange={(e) =>
                    setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, active: e.target.checked } : p)))
                  }
                />
                Produto ativo
              </label>

              <div>
                {editingProductId !== product.id ? (
                  <button type="button" className="btn btn-soft" onClick={() => setEditingProductId(product.id)}>
                    Editar informacoes
                  </button>
                ) : (
                  <div className="row">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={async () => {
                        await saveProduct(product);
                        setEditingProductId(null);
                      }}
                    >
                      Salvar produto
                    </button>
                    <button
                      type="button"
                      className="btn btn-soft"
                      onClick={async () => {
                        await loadData();
                        setEditingProductId(null);
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>

              <div className="form-grid" style={{ marginTop: 10 }}>
                {product.variants.map((variant) => (
                  <div key={variant.id} className="card" style={{ padding: 12 }}>
                    <p style={{ marginTop: 0, fontWeight: 700 }}>Variante: {variant.sku}</p>
                    <div className="filter-grid">
                      <label className="field">
                        Cor
                        <input
                          value={variant.color}
                          disabled={editingVariantId !== variant.id}
                          onChange={(e) =>
                            setProducts((prev) =>
                              prev.map((p) =>
                                p.id !== product.id
                                  ? p
                                  : {
                                      ...p,
                                      variants: p.variants.map((v) =>
                                        v.id === variant.id ? { ...v, color: e.target.value } : v,
                                      ),
                                    },
                              ),
                            )
                          }
                        />
                      </label>

                      <label className="field">
                        Tamanho
                        <input
                          value={variant.size}
                          disabled={editingVariantId !== variant.id}
                          onChange={(e) =>
                            setProducts((prev) =>
                              prev.map((p) =>
                                p.id !== product.id
                                  ? p
                                  : {
                                      ...p,
                                      variants: p.variants.map((v) =>
                                        v.id === variant.id ? { ...v, size: e.target.value } : v,
                                      ),
                                    },
                              ),
                            )
                          }
                        />
                      </label>

                      <label className="field">
                        Valor (R$)
                        <input
                          value={formatCurrencyInputFromCents(variant.priceCents)}
                          disabled={editingVariantId !== variant.id}
                          onChange={(e) =>
                            setProducts((prev) =>
                              prev.map((p) =>
                                p.id !== product.id
                                  ? p
                                  : {
                                      ...p,
                                      variants: p.variants.map((v) =>
                                        v.id === variant.id
                                          ? { ...v, priceCents: parseCurrencyInputToCents(e.target.value) }
                                          : v,
                                      ),
                                    },
                              ),
                            )
                          }
                        />
                      </label>

                      <label className="field">
                        Estoque
                        <input
                          value={String(variant.inventory?.onHand ?? 0)}
                          disabled={editingVariantId !== variant.id}
                          onChange={(e) =>
                            setProducts((prev) =>
                              prev.map((p) =>
                                p.id !== product.id
                                  ? p
                                  : {
                                      ...p,
                                      variants: p.variants.map((v) =>
                                        v.id === variant.id
                                          ? {
                                              ...v,
                                              inventory: {
                                                onHand: Number(e.target.value || 0),
                                                reserved: v.inventory?.reserved ?? 0,
                                              },
                                            }
                                          : v,
                                      ),
                                    },
                              ),
                            )
                          }
                        />
                      </label>
                    </div>

                    <p className="meta">Preco atual: {toBRL(variant.priceCents)}</p>

                    <label className="row">
                      <input
                        type="checkbox"
                        checked={variant.active}
                        disabled={editingVariantId !== variant.id}
                        onChange={(e) =>
                          setProducts((prev) =>
                            prev.map((p) =>
                              p.id !== product.id
                                ? p
                                : {
                                    ...p,
                                    variants: p.variants.map((v) =>
                                      v.id === variant.id ? { ...v, active: e.target.checked } : v,
                                    ),
                                  },
                            ),
                          )
                        }
                      />
                      Variante ativa
                    </label>

                    {editingVariantId !== variant.id ? (
                      <button type="button" className="btn btn-soft" onClick={() => setEditingVariantId(variant.id)}>
                        Editar variante
                      </button>
                    ) : (
                      <div className="row">
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={async () => {
                            await saveVariant(product.name, variant);
                            setEditingVariantId(null);
                          }}
                        >
                          Salvar variante
                        </button>
                        <button
                          type="button"
                          className="btn btn-soft"
                          onClick={async () => {
                            await loadData();
                            setEditingVariantId(null);
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </>
      ) : null}

      {imagePreview ? (
        <div
          onClick={() => setImagePreview(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 12,
              maxWidth: "min(92vw, 720px)",
              width: "100%",
            }}
          >
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
              <strong>{imagePreview.alt}</strong>
              <button type="button" className="btn btn-soft" onClick={() => setImagePreview(null)}>
                Fechar
              </button>
            </div>
            <img
              src={imagePreview.src}
              alt={imagePreview.alt}
              style={{
                width: "100%",
                maxHeight: "75vh",
                objectFit: "contain",
                borderRadius: 10,
                border: "1px solid #d9cab7",
                background: "#f7f2eb",
              }}
            />
          </div>
        </div>
      ) : null}
    </main>
  );
}
