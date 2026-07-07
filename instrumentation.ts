import { registerOTel } from "@vercel/otel";

/**
 * #4 OpenTelemetry — tracing distribuído (baseline de observabilidade 2026).
 * Next chama register() no boot. Auto-instrumenta requests/rotas.
 * Exporta se OTEL_EXPORTER_OTLP_ENDPOINT estiver setado (ex: Grafana Tempo na VPS
 * ou o coletor do Vercel); sem endpoint, é no-op — não pesa nem quebra nada.
 */
export function register() {
  registerOTel({ serviceName: process.env.APP_NAME || "reverblabs-app" });
}
