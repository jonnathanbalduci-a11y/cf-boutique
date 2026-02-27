import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { CartBadge } from "@/components/cart-badge";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CF Boutique",
  description: "Catalogo e checkout da CF Boutique",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <header className="app-header">
          <Link href="/bolsas" className="brand">
            CF Boutique
          </Link>
          <div className="header-actions">
            <Link href="/checkout" className="header-link">
              Checkout
            </Link>
            <Link href="/admin" className="header-link">
              Admin
            </Link>
            <CartBadge />
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
