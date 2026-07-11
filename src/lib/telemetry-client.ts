/**
 * Camada garantidora — TELEMETRY CLIENT (self-contained, embutir na frota).
 * ⑤ trilha de auditoria por usuário · ⑥ UX: pageview, ação, feature (usada/não usada),
 * web-vitals (LCP/CLS/INP/FCP/TTFB), erro. Batch → sendBeacon (sem preflight) pro hub.
 *
 * PRIVACIDADE: user_ref é HASHEADO no browser (SHA-256) antes de sair — nunca PII crua.
 * Uso:
 *   import { initTelemetry } from "@/lib/telemetry-client";
 *   const tel = initTelemetry("meu-app");            // pega app da frota
 *   await tel.identify(user.email);                   // vira hash, não o e-mail
 *   tel.track("exportou_relatorio", { formato: "pdf" });
 *   tel.feature("dashboard.filtro-avancado");         // marca recurso usado
 *   tel.audit("excluiu_cliente", { id: 123 });        // trilha 90d
 */
type Ev = { type: string; name?: string; value?: number; meta?: Record<string, unknown>; at?: string };
type Opts = { ingestUrl?: string; token?: string; flushMs?: number; maxBatch?: number; auto?: boolean };

const DEFAULT_INGEST = "https://reverblabs.com.br/api/telemetry/ingest";

function rid(): string { const a = new Uint8Array(12); (globalThis.crypto || ({} as Crypto)).getRandomValues?.(a); return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join(""); }
async function sha256(s: string): Promise<string> {
  try { const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32); }
  catch { return "h_" + Math.abs([...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)).toString(16); }
}

export function initTelemetry(app: string, opts: Opts = {}) {
  const noop = { track() {}, feature() {}, audit() {}, async identify() {}, pageview() {}, flush() {} };
  if (typeof window === "undefined") return noop; // SSR-safe

  const ingestUrl = opts.ingestUrl || DEFAULT_INGEST;
  const flushMs = opts.flushMs ?? 8000;
  const maxBatch = opts.maxBatch ?? 25;
  const sessionId = rid();
  let userRef: string | null = null;
  let queue: Ev[] = [];

  const push = (e: Ev) => { queue.push({ ...e, at: new Date().toISOString() }); if (queue.length >= maxBatch) flush(); };
  function flush() {
    if (!queue.length) return;
    const batch = queue; queue = [];
    const payload = JSON.stringify({ app, token: opts.token, sessionId, userRef, events: batch });
    try {
      const blob = new Blob([payload], { type: "text/plain" }); // text/plain evita preflight CORS
      if (navigator.sendBeacon && navigator.sendBeacon(ingestUrl, blob)) return;
    } catch {}
    fetch(ingestUrl, { method: "POST", body: payload, headers: { "Content-Type": "text/plain" }, keepalive: true }).catch(() => {});
  }

  // ⑥ web-vitals via PerformanceObserver (sem lib externa)
  const vital = (name: string, value: number, meta?: Record<string, unknown>) => push({ type: "vital", name, value: Math.round(value), meta });
  try {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (nav) vital("TTFB", nav.responseStart);
    new PerformanceObserver((l) => { const e = l.getEntries().pop() as any; if (e) vital("LCP", e.startTime); }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries() as any[]) if (e.name === "first-contentful-paint") vital("FCP", e.startTime); }).observe({ type: "paint", buffered: true });
    let cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries() as any[]) if (!e.hadRecentInput) cls += e.value; }).observe({ type: "layout-shift", buffered: true });
    let inp = 0; new PerformanceObserver((l) => { for (const e of l.getEntries() as any[]) inp = Math.max(inp, e.duration); }).observe({ type: "event", buffered: true, durationThreshold: 40 } as any);
    addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") { if (cls) vital("CLS", cls * 1000); if (inp) vital("INP", inp); flush(); } });
  } catch {}

  // erros
  if (opts.auto !== false) {
    addEventListener("error", (e) => push({ type: "error", name: (e.message || "error").slice(0, 120), meta: { src: (e.filename || "").slice(0, 120), line: e.lineno } }));
    addEventListener("unhandledrejection", (e: any) => push({ type: "error", name: String(e.reason?.message || e.reason || "rejection").slice(0, 120) }));
  }
  addEventListener("pagehide", flush);
  const timer = setInterval(flush, flushMs);
  if ((globalThis as any).__telClear) clearInterval((globalThis as any).__telClear);
  (globalThis as any).__telClear = timer;

  const api = {
    track: (name: string, meta?: Record<string, unknown>) => push({ type: "action", name, meta }),
    feature: (name: string, meta?: Record<string, unknown>) => push({ type: "feature", name, meta }),
    audit: (action: string, meta?: Record<string, unknown>) => push({ type: "audit", name: action, meta }),
    async identify(rawId: string) { userRef = rawId ? await sha256(String(rawId)) : null; },
    pageview: (path?: string) => push({ type: "pageview", name: (path || location.pathname).slice(0, 120), meta: { ref: document.referrer.slice(0, 120) } }),
    flush,
  };
  api.pageview(); // pageview inicial
  return api;
}
