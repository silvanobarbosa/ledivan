/**
 * "EM ABERTO" DO PAINEL: a marca do cadastro contra o motor (doc 76) — SOMENTE LEITURA.
 *
 * O painel contava `patients.payment_status`. O dono pediu o recorte do mês vigente, que só o
 * motor sabe fazer. Este script põe os dois lado a lado, por conta, para mostrar o tamanho da
 * divergência — e é por isso que o painel passou a ler o motor.
 */
import { readFileSync } from "node:fs";

for (const linha of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = linha.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}

const { db } = await import("../src/db/index.ts");
const { patients } = await import("../src/db/schema.ts");
const { situacoesDaLista } = await import("../src/lib/situacoesLista.ts");
const { eq } = await import("drizzle-orm");
const { neon } = await import("@neondatabase/serverless");

const sql = neon(process.env.DATABASE_URL);
const contas = await sql`select id, name from "user" order by name`;

for (const dono of contas) {
  const lista = await db.select().from(patients).where(eq(patients.userId, dono.id));
  if (!lista.length) continue;
  const ativos = lista.filter((p) => p.patientStatus !== "prospect");

  const marca = {
    atrasado: ativos.filter((p) => p.paymentStatus === "overdue").length,
    em_aberto: ativos.filter((p) => p.paymentStatus === "pending").length,
    em_dia: ativos.filter((p) => p.paymentStatus === "paid").length,
  };

  const sit = await situacoesDaLista(dono.id, ativos.map((p) => ({
    id: p.id, paymentFormat: p.paymentFormat, pacoteTipo: p.pacoteTipo, sessionFee: p.sessionFee,
    paymentDay: p.paymentDay, paymentDay2: p.paymentDay2, timesPerPeriod: p.timesPerPeriod,
    horasAntesPagamento: p.horasAntesPagamento, sessionsInPacket: p.sessionsInPacket,
  })));
  const motor = { atrasado: 0, em_aberto: 0, em_dia: 0 };
  for (const p of ativos) motor[sit.get(p.id)?.situacao ?? "em_dia"]++;

  console.log(`=== ${dono.name} — ${ativos.length} cadastros ===`);
  console.log(`  marca do cadastro : atraso ${marca.atrasado} · aberto ${marca.em_aberto} · em dia ${marca.em_dia}`);
  console.log(`  motor (mês vigente): atraso ${motor.atrasado} · aberto ${motor.em_aberto} · em dia ${motor.em_dia}\n`);
}
process.exit(0);
