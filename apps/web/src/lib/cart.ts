export type CartItem = {
  variantId: string;
  productId: string;
  productName: string;
  sku?: string;
  color: string;
  size: string;
  imageUrl?: string;
  priceCents: number;
  quantity: number;
};

export const CART_STORAGE_KEY = "cf_boutique_cart_v1";

export function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(CART_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => ({
        variantId: String(item?.variantId ?? ""),
        productId: String(item?.productId ?? ""),
        productName: String(item?.productName ?? ""),
        sku: item?.sku ? String(item.sku) : undefined,
        color: String(item?.color ?? ""),
        size: String(item?.size ?? ""),
        imageUrl: item?.imageUrl ? String(item.imageUrl) : undefined,
        priceCents: Number(item?.priceCents ?? 0),
        quantity: Number(item?.quantity ?? 0),
      }))
      .filter((item) => item.variantId && item.productId && item.quantity > 0 && item.priceCents >= 0);
  } catch {
    return [];
  }
}

export function writeCart(items: CartItem[]): void {
  writeCartWithOptions(items, { notify: true });
}

export function writeCartWithOptions(
  items: CartItem[],
  options: { notify?: boolean } = {},
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  if (options.notify !== false) {
    window.dispatchEvent(new Event("cf_cart_updated"));
  }
}
