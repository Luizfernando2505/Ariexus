import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ariexus",
  description: "Cole a URL da oferta. Receba a campanha estruturada.",
};

// Layout das rotas do app (área logada, a partir da Fase 1).
// A landing em "/" não passa por aqui: é o HTML aprovado, servido como arquivo estático.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
