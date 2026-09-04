import { db } from "@/db";
import { sql } from "drizzle-orm";

// Rate limit por janela fixa, persistido no banco (funciona em serverless).
// Retorna true se permitido; false se estourou o limite na janela.
//
// `failClosed`: o que fazer quando o BANCO falha. Endpoints comuns (insights, scan) preferem
// fail-open — não bloquear o usuário por soluço de infra. Mas endpoints de AUTENTICAÇÃO (login,
// código de 6 dígitos do paciente) devem passar `failClosed: true`: aí o rate-limit é a ÚNICA
// barreira contra força bruta, e "abrir na falha" entrega justamente a janela que o atacante quer.
export async function rateLimit(
  userId: string,
  route: string,
  limit: number,
  windowSec: number,
  opts: { failClosed?: boolean } = {},
): Promise<boolean> {
  const key = `${userId}:${route}`;
  const now = new Date();
  const cutoff = new Date(now.getTime() - windowSec * 1000);
  try {
    // Incremento ATÔMICO: um único UPSERT decide reset-de-janela vs +1, evitando a corrida do
    // read-then-write (dois requests concorrentes que liam o mesmo count e ambos passavam).
    const rows = await db.execute(sql`
      INSERT INTO rate_limits (key, count, window_start)
      VALUES (${key}, 1, ${now})
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN rate_limits.window_start < ${cutoff} THEN 1 ELSE rate_limits.count + 1 END,
        window_start = CASE WHEN rate_limits.window_start < ${cutoff} THEN ${now} ELSE rate_limits.window_start END
      RETURNING count
    `);
    const r = (rows as unknown as { rows?: Array<{ count: number }> }).rows ?? (rows as unknown as Array<{ count: number }>);
    const count = Number(r?.[0]?.count ?? 1);
    return count <= limit;
  } catch {
    return !opts.failClosed; // comum: fail-open; auth: fail-closed
  }
}
