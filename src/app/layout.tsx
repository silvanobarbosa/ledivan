import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PWARegistration } from "@/components/PWARegistration";

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
        <link href="https://fonts.googleapis.com" rel="preconnect" />
        <link href="https://fonts.gstatic.com" rel="crossOrigin" />
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body>
        <PWARegistration />
        {children}
      </body>
    </html>
  );
}
