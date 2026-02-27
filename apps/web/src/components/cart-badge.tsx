"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { readCart } from "@/lib/cart";

function getCartCount(): number {
  return readCart().reduce((acc, item) => acc + item.quantity, 0);
}

export function CartBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    function syncCount() {
      setCount(getCartCount());
    }

    function onStorage(event: StorageEvent) {
      if (event.key && event.key !== "cf_boutique_cart_v1") return;
      syncCount();
    }

    syncCount();
    window.addEventListener("cf_cart_updated", syncCount);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("cf_cart_updated", syncCount);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const label = useMemo(() => `Carrinho (${count})`, [count]);

  return (
    <Link href="/carrinho" aria-label={label} title={label} className="badge-link">
      <span>Carrinho</span>
      <span className="badge-dot" aria-live="polite">
        {count}
      </span>
    </Link>
  );
}
