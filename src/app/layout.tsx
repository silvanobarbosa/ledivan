import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { PWARegistration } from "@/components/PWARegistration";
import { SupportWidget } from "@/components/SupportWidget";
import { Telemetry } from "@/components/Telemetry";

// As fontes passam a ser BAIXADAS NO BUILD e servidas pelo próprio domínio. Antes eram três
// requisições ao Google em toda página (duas <link> aqui + um @import no globals.css pedindo o
// MESMO arquivo), todas bloqueando a renderização. Autohospedar também tira o IP do usuário do
// caminho do Google — relevante num app de saúde.
//
// Nada de `weight` nestes dois: Fraunces e Inter são fontes VARIÁVEIS, e o next/font recusa a
// combinação de fonte variável com lista de pesos. O eixo `opsz` fica explícito porque o CSS usa
// `font-optical-sizing: auto` nos títulos.
const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-fraunces",
  display: "swap",
});
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Ledivan — Gestão de consultório e finanças",
  description: "Gestão completa do consultório de terapia com módulo financeiro integrado.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Ledivan",
  },
};

export const viewport: Viewport = {
  themeColor: "#2b1830",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // O <head> some inteiro: as duas fontes vêm do next/font e o Material Symbols era carregado
    // em toda página sem nenhum uso — o único lugar que pede aquela família é src/stitch/**, que
    // são mockups HTML estáticos e nunca são renderizados pelo app.
    <html lang="pt-BR" className={`${inter.variable} ${fraunces.variable}`}>
      <body>
        <PWARegistration />
        {children}
        <SupportWidget />
      <Telemetry /></body>
    </html>
  );
}
