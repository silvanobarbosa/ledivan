import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PWARegistration } from "@/components/PWARegistration";
import { SupportWidget } from "@/components/SupportWidget";
import { Telemetry } from "@/components/Telemetry";

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
    <html lang="pt-BR">
      <head>
        {/* `rel="crossOrigin"` não existe: o valor certo é rel="preconnect" com o ATRIBUTO
            crossOrigin. Do jeito anterior o preconnect para fonts.gstatic.com (de onde vêm os
            arquivos .woff2) simplesmente não acontecia, e o navegador só abria a conexão ao
            encontrar o @font-face — atrasando a primeira renderização do texto. */}
        <link href="https://fonts.googleapis.com" rel="preconnect" />
        <link href="https://fonts.gstatic.com" rel="preconnect" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body>
        <PWARegistration />
        {children}
        <SupportWidget />
      <Telemetry /></body>
    </html>
  );
}
