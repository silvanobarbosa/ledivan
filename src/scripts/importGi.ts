// Importa Gi/*.csv para a conta giselesantosbarbosa@gmail.com.
// Idempotente: zera o domínio da Gisele e recria a partir dos CSVs.
// Rodar: npm run import:gi
import fs from "node:fs";
import path from "node:path";
import { db } from "../db";
import { users, patients, therapySessions, sessionPayments, patientRecords, transactions, financialAccounts, categories } from "../db/schema";
import { eq } from "drizzle-orm";
import { wipeUserData } from "./seedCore";

const EMAIL = "giselesantosbarbosa@gmail.com";
const DIR = path.resolve(process.cwd(), "Gi");
const uid = () => crypto.randomUUID();

// CSV ; com aspas e BOM
function parseCsv(file: string): Record<string, string>[] {
  const raw = fs.readFileSync(file, "utf8").replace(/^﻿/, "");
  const rows: string[][] = [];
  let cur: string[] = [], field = "", q = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (q) {
      if (c === '"' && raw[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ";") { cur.push(field); field = ""; }
    else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
    else if (c === "\r") { /* skip */ }
    else field += c;
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur); }
  const header = rows.shift()!.map((h) => h.trim());
  return rows.filter((r) => r.some((c) => c.trim() !== "")).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}

const money = (s?: string) => {
  const v = (s || "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(v);
  // descarta lixo da origem (ex.: timestamps na coluna de valor) — cabe em numeric(10,2)
  if (isNaN(n) || n < 0 || n >= 1_000_000) return null;
  return n.toFixed(2);
};
const dt = (s?: string) => { if (!s) return null; const d = new Date(s.replace(" ", "T")); return isNaN(d.getTime()) ? null : d; };
const intOf = (s?: string) => { const n = parseInt(s || ""); return isNaN(n) ? null : n; };
const tags = (s?: string) => (s || "").split(/[|,]/).map((t) => t.trim()).filter(Boolean).join(", ") || null;

const METHOD: Record<string, string> = { pix: "pix", cartao: "card", "cartão": "card", credito: "card", "crédito": "card", debito: "card", dinheiro: "cash", transferencia: "transfer", "transferência": "transfer", transfer: "transfer", deposito: "transfer" };
const SESS_ST = new Set(["agendada", "realizada", "cancelada", "nao_realizada", "realocada"]);
function sessStatus(s?: string) { const x = (s || "").toLowerCase().replace(/\s+/g, "_").replace("ã", "a").replace("não", "nao"); return SESS_ST.has(x) ? x : (x.startsWith("nao") ? "nao_realizada" : x === "" ? "agendada" : SESS_ST.has(x) ? x : "agendada"); }

async function ensureCategory(name: string) {
  const e = await db.query.categories.findFirst({ where: eq(categories.name, name) });
  if (e) return e.id;
  const [c] = await db.insert(categories).values({ name, type: "income", icon: "HeartHandshake", color: "#8b5cf6" }).returning();
  return c.id;
}
async function chunk(table: any, rows: any[], size = 200) { for (let i = 0; i < rows.length; i += size) if (rows.length) await db.insert(table).values(rows.slice(i, i + size)); }

async function main() {
  const u = await db.query.users.findFirst({ where: eq(users.email, EMAIL) });
  if (!u) { console.error(`Usuário ${EMAIL} não existe.`); process.exit(1); }
  const userId = u.id;
  console.log("Zerando domínio da Gisele…");
  await wipeUserData(userId);

  const [contaPJ] = await db.insert(financialAccounts).values({ userId, name: "Conta PJ", type: "checking", balance: "0", color: "#2b1830" }).returning();
  const catSessoes = await ensureCategory("Sessões");

  const pRows = parseCsv(path.join(DIR, "importacao-ledivan.csv"));
  const sRows = parseCsv(path.join(DIR, "importacao-sessoes.csv"));
  const yRows = parseCsv(path.join(DIR, "importacao-pagamentos.csv"));

  // pacientes
  const byEmail = new Map<string, string>();
  const patientRows = pRows.map((r) => {
    const id = uid();
    if (r.email) byEmail.set(r.email.toLowerCase(), id);
    const fmt = (r.formato_pagamento || "avulso").toLowerCase();
    const note = [r.queixa, r.observacoes].filter(Boolean).join(" — ") || null;
    return {
      id, userId, name: r.nome || "(sem nome)", email: r.email || null, phone: r.telefone || null,
      birthDate: dt(r.data_nascimento), patientStatus: (r.status || "ativo").toLowerCase(),
      sessionFee: money(r.valor_sessao) ?? "0", frequency: r.recorrencia || null,
      paymentFormat: ["avulso", "mensal", "quinzenal", "pacote"].includes(fmt) ? fmt : "avulso",
      contractType: fmt === "pacote" ? "pacote" : "avulso",
      sessionsInPacket: fmt === "pacote" ? intOf(r.tamanho_pacote) : null,
      paymentDay: intOf(r.dia_pagamento),
      attendanceMode: (r.modalidade || "online").toLowerCase(),
      attendanceLocation: r.endereco_atendimento || null,
      tags: tags(r.etiquetas), notes: note,
      emergencyName: r.emergencia_nome || null, emergencyPhone: r.emergencia_telefone || null, emergencyRelationship: r.emergencia_parentesco || null,
      startedAt: dt(r.data_inicio), moodToken: uid().replace(/-/g, ""),
    };
  });
  await chunk(patients, patientRows);

  // sessões + evoluções
  const sessionRows: any[] = [], recordRows: any[] = [];
  let sSkip = 0;
  for (const r of sRows) {
    const pid = byEmail.get((r.paciente_email || "").toLowerCase());
    if (!pid) { sSkip++; continue; }
    const date = dt(r.data_hora); if (!date) { sSkip++; continue; }
    const st = sessStatus(r.status);
    const online = (r.modalidade || "").toLowerCase() === "online";
    const sid = uid();
    sessionRows.push({
      id: sid, userId, patientId: pid, date, duration: intOf(r.duracao_min) ?? 50,
      fee: money(r.valor) ?? "0", status: st,
      chargeable: (r.cobrar || "").toLowerCase() === "sim" && st !== "nao_realizada",
      isOnline: online, location: online ? null : (r.local || null),
      notes: r.evolucao || null,
    });
    if (r.evolucao) recordRows.push({ id: uid(), userId, patientId: pid, sessionId: sid, type: "evolucao", title: null, content: r.evolucao, createdAt: date });
  }
  await chunk(therapySessions, sessionRows);
  await chunk(patientRecords, recordRows);

  // pagamentos (+ receita p/ os pagos)
  const payRows: any[] = [], txRows: any[] = [];
  let ySkip = 0;
  for (const r of yRows) {
    const pid = byEmail.get((r.paciente_email || "").toLowerCase());
    if (!pid) { ySkip++; continue; }
    const amount = money(r.valor); if (!amount) { ySkip++; continue; }
    const status = (r.status || "pago").toLowerCase() === "pendente" ? "pending" : "paid";
    const method = METHOD[(r.metodo || "pix").toLowerCase()] || "pix";
    const date = dt(r.data) || dt(r.data_hora) || new Date();
    let txId: string | null = null;
    if (status === "paid") {
      txId = uid();
      txRows.push({ id: txId, userId, accountId: contaPJ.id, amount, type: "income", categoryId: catSessoes, description: `Pagamento — ${r.paciente_nome || ""}`.trim(), date, source: "session_payment", method: method === "card" ? "credito" : method === "transfer" ? "transferencia" : method === "cash" ? "dinheiro" : "pix" });
    }
    payRows.push({ userId, patientId: pid, amount, date, method, status, linkedTransactionId: txId });
  }
  await chunk(transactions, txRows);
  await chunk(sessionPayments, payRows);

  console.log(`✅ Gisele importada: ${patientRows.length} pacientes, ${sessionRows.length} sessões (skip ${sSkip}), ${payRows.length} pagamentos (skip ${ySkip}), ${recordRows.length} evoluções.`);
  process.exit(0);
}
main().catch((e) => { console.error("❌", e); process.exit(1); });
