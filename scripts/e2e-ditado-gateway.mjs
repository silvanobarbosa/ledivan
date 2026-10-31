// O DITADO PELO GATEWAY DA CASA, NO APP DE VERDADE.
//
// O que o teste puro não prova: que a rota `/api/transcribe` fala com o ouvido da casa, que o
// áudio vira evolução no prontuário, e que os NOMES PRÓPRIOS saem certos — que é o que mais
// errava e o que mais importa num prontuário.
//
// A fala é gerada pela VOZ da casa (Piper) e devolvida ao OUVIDO (Whisper). Voz sintética é mais
// difícil de transcrever que voz humana, então o que passar aqui é PISO, não teto.
//
// Uso: npm run build && npm start, depois node scripts/e2e-ditado-gateway.mjs
//
// Precisa de REVERBLABS_AI_BASE_URL e REVERBLABS_AI_KEY no .env.local (as mesmas da Vercel).

import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { neon } from "@neondatabase/serverless";
import * as jose from "jose";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const IA = process.env.REVERBLABS_AI_BASE_URL;
const IA_KEY = process.env.REVERBLABS_AI_KEY;
const sql = neon(process.env.DATABASE_URL);
let falhas = 0;
const check = (nome, ok, detalhe = "") => {
  console.log(`${ok ? "  ok  " : "FALHA "} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  if (!ok) falhas++;
};
if (!IA || !IA_KEY) { console.log("gateway não configurado no .env.local — nada a provar."); process.exit(1); }

const [qa] = await sql`SELECT id FROM "user" WHERE email = 'qa.ledivan@reverblabs.com.br'`;
if (!qa) { console.log("conta de QA não encontrada"); process.exit(1); }
const token = await new jose.SignJWT({ userId: qa.id })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1d")
  .sign(new TextEncoder().encode(process.env.AUTH0_SECRET));

let prefsAntes;
const marca = Date.now().toString().slice(-6);
const NOME = `Thais Duarte QA ${marca}`;
const criados = [];
const FALA = "A paciente Thais Duarte relatou melhora do sono e reducao da ansiedade. "
  + "Trabalhamos reestruturacao cognitiva e combinamos registro diario ate o proximo encontro.";

try {
  // A transcrição precisa estar habilitada nas preferências — é um gate do produto, não do teste.
  // Elas moram num JSON na coluna `preferences`, não numa coluna própria.
  const [u] = await sql`SELECT preferences FROM "user" WHERE id = ${qa.id}`;
  prefsAntes = u?.preferences ?? null;
  const prefs = { ...(prefsAntes ? JSON.parse(prefsAntes) : {}), transcriptionEnabled: true };
  await sql`UPDATE "user" SET preferences = ${JSON.stringify(prefs)} WHERE id = ${qa.id}`;

  const [p] = await sql`
    INSERT INTO patients (user_id, name, payment_format, session_fee, patient_status, payment_day, sessions_in_packet, started_at)
    VALUES (${qa.id}, ${NOME}, 'sessao', '100.00', 'ativo', 10, 4, now())
    RETURNING id`;
  criados.push(p.id);

  // A VOZ da casa gera a fala.
  const t0 = Date.now();
  const voz = await fetch(`${IA}/audio/speech`, {
    method: "POST",
    headers: { Authorization: `Bearer ${IA_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "piper", input: FALA, voice: "pt_BR" }),
  });
  const wav = Buffer.from(await voz.arrayBuffer());
  check("a voz da casa gerou o áudio", voz.status === 200 && wav.length > 10000, `${(wav.length / 1024).toFixed(0)} KB em ${Date.now() - t0} ms`);

  // E o APP transcreve — pela rota dele, com a sessão dela.
  const fd = new FormData();
  fd.append("audio", new Blob([wav], { type: "audio/wav" }), "sessao.wav");
  fd.append("patientId", p.id);
  fd.append("consent", "true");
  const t1 = Date.now();
  const res = await fetch(`${BASE}/api/transcribe`, {
    method: "POST",
    headers: { cookie: `auth-session=${token}` },
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  const ms = Date.now() - t1;
  check("o app transcreveu pelo gateway", res.status === 200 && data.ok === true, `${res.status} em ${(ms / 1000).toFixed(1)}s ${data.error ?? ""}`);

  if (data.ok) {
    console.log(`\n       evolução gerada:\n       ${String(data.content).slice(0, 400).replace(/\n/g, "\n       ")}\n`);
    // O NOME PRÓPRIO é o controle: sem a dica, "Thais Duarte" virava "tais do arte".
    check("o nome próprio da paciente saiu certo", /Thais\s+Duarte/i.test(String(data.content)), "procurei 'Thais Duarte' no texto");

    const [rec] = await sql`
      SELECT type, title, content FROM patient_records
      WHERE patient_id = ${p.id} ORDER BY created_at DESC LIMIT 1`;
    check("a evolução foi gravada no prontuário", rec?.type === "evolucao", `${rec?.type ?? "nada"} · ${rec?.title ?? ""}`);
    check("e o que foi gravado é o que a tela recebeu", rec?.content === data.content);
  }

  // O teto do arquivo é conferido ANTES de subir: 26 MB tem de ser recusado na hora.
  const fdG = new FormData();
  fdG.append("audio", new Blob([Buffer.alloc(26 * 1024 * 1024)], { type: "audio/wav" }), "grande.wav");
  fdG.append("patientId", p.id);
  fdG.append("consent", "true");
  const tG = Date.now();
  const grande = await fetch(`${BASE}/api/transcribe`, { method: "POST", headers: { cookie: `auth-session=${token}` }, body: fdG });
  const jG = await grande.json().catch(() => ({}));
  check("áudio grande demais é recusado rápido, sem subir a nenhum motor",
    grande.status === 400 && /25 MB/.test(jG.error ?? "") && Date.now() - tG < 20000,
    `${grande.status} em ${((Date.now() - tG) / 1000).toFixed(1)}s`);

  // Sem consentimento não transcreve — o gate clínico continua de pé depois da troca de motor.
  const fdS = new FormData();
  fdS.append("audio", new Blob([wav], { type: "audio/wav" }), "sessao.wav");
  fdS.append("patientId", p.id);
  const semConsent = await fetch(`${BASE}/api/transcribe`, { method: "POST", headers: { cookie: `auth-session=${token}` }, body: fdS });
  check("sem consentimento, recusa", semConsent.status === 400);

  // E sem sessão, ninguém transcreve nada.
  const fdA = new FormData();
  fdA.append("audio", new Blob([wav], { type: "audio/wav" }), "sessao.wav");
  fdA.append("patientId", p.id);
  fdA.append("consent", "true");
  const anon = await fetch(`${BASE}/api/transcribe`, { method: "POST", body: fdA });
  check("sem sessão, 401", anon.status === 401, String(anon.status));
} catch (e) {
  check("o percurso chegou ao fim sem exceção", false, String(e && e.message ? e.message : e).slice(0, 300));
} finally {
  for (const id of criados) {
    await sql`DELETE FROM patient_records WHERE patient_id = ${id}`;
    await sql`DELETE FROM therapy_sessions WHERE patient_id = ${id}`;
    await sql`DELETE FROM patients WHERE id = ${id}`;
  }
  // Devolve as preferências da conta de QA como estavam.
  if (prefsAntes !== undefined) {
    try { await sql`UPDATE "user" SET preferences = ${prefsAntes} WHERE id = ${qa.id}`; } catch { /* já reportado acima */ }
  }
  console.log(`\n${falhas ? `${falhas} FALHA(S)` : "tudo certo"} · ${criados.length} cadastro(s) de teste apagado(s)`);
  process.exit(falhas ? 1 : 0);
}
