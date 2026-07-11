"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { initTelemetry } from "@/lib/telemetry-client";

/**
 * Camada garantidora — provider de telemetria first-party (beacon → hub).
 * Dispara pageview na navegação SPA e expõe a API global `window.__tel` pra ações/features/audit.
 * app = NEXT_PUBLIC_TELEMETRY_APP (deve casar com projects.name). No-op sem app.
 */
let tel: ReturnType<typeof initTelemetry> | null = null;

export function Telemetry() {
  const app = process.env.NEXT_PUBLIC_TELEMETRY_APP;
  const pathname = usePathname();
  useEffect(() => {
    if (!app || tel) return;
    tel = initTelemetry(app);
    (window as unknown as { __tel: typeof tel }).__tel = tel;
  }, [app]);
  useEffect(() => { if (tel && pathname) tel.pageview(pathname); }, [pathname]);
  return null;
}
