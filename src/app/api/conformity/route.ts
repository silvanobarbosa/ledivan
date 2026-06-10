export const dynamic = "force-dynamic";

// Telemetria read-only de conformidade para o ReverbLabs.
export async function GET() {
  const findings: { rule: string; severity: string }[] = [];
  return Response.json(
    { service: "ledivan", time: new Date().toISOString(), conformant: findings.length === 0, findings },
    { headers: { "Cache-Control": "no-store" } },
  );
}
