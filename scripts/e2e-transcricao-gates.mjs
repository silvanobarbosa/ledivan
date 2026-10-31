// OS FREIOS DA TRANSCRIÇÃO, NO APP DE VERDADE.
//
// A transcrição é BYOK: o áudio vai para o provedor da própria terapeuta, com a chave dela. Esta
// verificação NÃO transcreve nada — sem uma chave de provedor de verdade não há o que provar, e
// fingir que há seria pior. O que ela guarda são os FREIOS, que valem com ou sem chave:
//
//   1. Sem sessão, 401 — e não o 500 que o redirect para o login causava.
//   2. Sem consentimento do paciente, recusa.
//   3. Sem chave cadastrada, recusa explicada (e nenhuma infraestrutura nossa é usada no lugar).
//   4. Áudio acima de 25 MB é recusado na hora, sem subir a lugar nenhum e sem truncar o corpo.
//
// Uso: npm run build && npm start, depois node scripts/e2e-transcricao-gates.mjs

import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { neon } from "@neondatabase/serverless";
import * as jose from "jose";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const sql = neon(process.env.DATABASE_URL);
let falhas = 0;
const check = (nome, ok, detalhe = "") => {
  console.log(`${ok ? "  ok  " : "FALHA "} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  if (!ok) falhas++;
};

const [qa] = await sql`SELECT id, ai_key_enc FROM "user" WHERE email = 'qa.ledivan@reverblabs.com.br'`;
if (!qa) { console.log("conta de QA não encontrada"); process.exit(1); }
const token = await new jose.SignJWT({ userId: qa.id })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1d")
  .sign(new TextEncoder().encode(process.env.AUTH0_SECRET));

const marca = Date.now().toString().slice(-6);
const criados = [];
let prefsAntes;
const audio = (bytes) => new Blob([Buffer.alloc(bytes)], { type: "audio/wav" });
const enviar = (campos, comSessao = true) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.append(k, v);
  return fetch(`${BASE}/api/transcribe`, { method: "POST", body: fd, ...(comSessao ? { headers: { cookie: `auth-session=${token}` } } : {}) });
};

try {
  const [u] = await sql`SELECT preferences FROM "user" WHERE id = ${qa.id}`;
  prefsAntes = u?.preferences ?? null;
  const base = prefsAntes ? JSON.parse(prefsAntes) : {};
  await sql`UPDATE "user" SET preferences = ${JSON.stringify({ ...base, transcriptionEnabled: true })} WHERE id = ${qa.id}`;

  const [p] = await sql`
    INSERT INTO patients (user_id, name, payment_format, session_fee, patient_status, payment_day, sessions_in_packet, started_at)
    VALUES (${qa.id}, ${`QA transcricao ${marca}`}, 'sessao', '100.00', 'ativo', 10, 4, now())
    RETURNING id`;
  criados.push(p.id);

  const anon = await enviar({ audio: audio(5000), patientId: p.id, consent: "true" }, false);
  check("sem sessão, 401", anon.status === 401, String(anon.status));

  const semConsent = await enviar({ audio: audio(5000), patientId: p.id });
  check("sem consentimento do paciente, recusa", semConsent.status === 400, String(semConsent.status));

  /**
   * A conta de QA não tem chave de provedor. É o controle da decisão do dono (31/10): BYOK é o
   * ÚNICO caminho, então sem chave o app recusa — nunca cai em infraestrutura nossa.
   */
  if (qa.ai_key_enc) {
    console.log("       (conta de QA tem chave cadastrada; pulando o controle de 'sem chave')");
  } else {
    const semChave = await enviar({ audio: audio(5000), patientId: p.id, consent: "true" });
    const j = await semChave.json().catch(() => ({}));
    check("sem chave cadastrada, recusa explicada", semChave.status === 400 && /Cadastre sua chave/.test(j.error ?? ""), `${semChave.status} ${j.error ?? ""}`);
  }

  /**
   * O teto tem de ser conferido ANTES de ler o corpo: a plataforma TRUNCA o que passa dele, e aí
   * o `formData()` estoura num 500 cru depois do upload inteiro.
   */
  const t0 = Date.now();
  const grande = await enviar({ audio: audio(26 * 1024 * 1024), patientId: p.id, consent: "true" });
  const jg = await grande.json().catch(() => ({}));
  check("áudio acima de 25 MB é recusado na hora", grande.status === 400 && /25 MB/.test(jg.error ?? "") && Date.now() - t0 < 20000,
    `${grande.status} em ${((Date.now() - t0) / 1000).toFixed(1)}s`);
} catch (e) {
  check("o percurso chegou ao fim sem exceção", false, String(e && e.message ? e.message : e).slice(0, 300));
} finally {
  for (const id of criados) {
    await sql`DELETE FROM patient_records WHERE patient_id = ${id}`;
    await sql`DELETE FROM patients WHERE id = ${id}`;
  }
  if (prefsAntes !== undefined) {
    try { await sql`UPDATE "user" SET preferences = ${prefsAntes} WHERE id = ${qa.id}`; } catch { /* já reportado */ }
  }
  console.log(`\n${falhas ? `${falhas} FALHA(S)` : "tudo certo"} · ${criados.length} cadastro(s) de teste apagado(s)`);
  process.exit(falhas ? 1 : 0);
}
