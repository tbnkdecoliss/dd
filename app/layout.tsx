import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Zeta Manifold Lab",
  description: "A high-performance sandbox for exploring a zeta-inspired periodicity manifold."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
