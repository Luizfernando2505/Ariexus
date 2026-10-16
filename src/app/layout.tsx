import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";

// Mesma fonte da landing, servida pelo próprio app (sem depender do Google em tempo de uso).
const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree" });

export const metadata: Metadata = {
  title: { default: "Ariexus", template: "%s · Ariexus" },
  description: "Cole a URL da oferta. Receba a campanha estruturada.",
};

// Layout das rotas do app. A landing em "/" não passa por aqui: é o HTML aprovado, servido como arquivo estático.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={figtree.variable}>
      <body>{children}</body>
    </html>
  );
}
