export const dynamic = "force-dynamic";

// Telemetria read-only para o ReverbLabs (control-plane).
export async function GET() {
  return Response.json(
    { service: "ledivan", status: "up", time: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
