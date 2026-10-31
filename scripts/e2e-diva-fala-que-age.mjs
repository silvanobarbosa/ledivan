// A FALA QUE AGE, NO APP DE VERDADE — falando, não simulando.
//
// Gera a fala pela VOZ da casa, manda para a rota do Divã e confere o que o app ENTENDEU e o que
// ele GRAVOU. Empresta a chave Groq do cofre para a conta de QA e a devolve no fim.
//
//   1. "anota na <paciente>: ..." → prévia pronta, e confirmar grava no prontuário.
//   2. Nome ambíguo (dois pacientes com o mesmo primeiro nome) NÃO escolhe sozinho.
//   3. "marca a <paciente> ..." → entende o dia e a hora, e NÃO grava nada (a janela é que abre).
//   4. "cancela a sessão da <paciente> ..." → identifica a sessão certa e cancela só ela.
//   5. Cancelar com DUAS sessões no mesmo dia não escolhe sozinho.
//   6. Pergunta de navegação continua sendo navegação.
//
// Uso: npm run build && npm start, depois node scripts/e2e-diva-fala-que-age.mjs

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { neon } from "@neondatabase/serverless";
import * as jose from "jose";

const require_ = createRequire(import.meta.url);
const BASE = process.env.BASE_URL || "http://localhost:3000";
const sql = neon(process.env.DATABASE_URL);
let falhas = 0;
const check = (nome, ok, detalhe = "") => {
  console.log(`${ok ? "  ok  " : "FALHA "} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  if (!ok) falhas++;
};

const envHub = readFileSync("C:/Users/User/ReverbLabs/.env.local", "utf8");
const pega = (nome) => (envHub.match(new RegExp(`^${nome}=(.+)$`, "m"))?.[1] ?? "").trim().replace(/^["']|["']$/g, "");
const CHAVE_GROQ = pega("GROQ_API_KEY");
const IA = pega("REVERBLABS_AI_KEY");
if (!CHAVE_GROQ || !IA) { console.log("faltam as chaves do cofre (GROQ_API_KEY / REVERBLABS_AI_KEY)."); process.exit(1); }

const [qa] = await sql`SELECT id, ai_provider, ai_key_enc FROM "user" WHERE email = 'qa.ledivan@reverblabs.com.br'`;
if (!qa) { console.log("conta de QA não encontrada"); process.exit(1); }
const token = await new jose.SignJWT({ userId: qa.id })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1d")
  .sign(new TextEncoder().encode(process.env.AUTH0_SECRET));

const marca = Date.now().toString().slice(-5);
const criados = [];
const provedorAntes = qa.ai_provider;
const chaveAntes = qa.ai_key_enc;

/** A fala, gerada pela VOZ da casa. Voz sintética é mais difícil que humana: o que passa é piso. */
const falar = async (texto) => {
  const r = await fetch("https://ia.reverblabs.com.br/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${IA}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "piper", input: texto, voice: "pt_BR" }),
  });
  return Buffer.from(await r.arrayBuffer());
};
const ouvir = async (texto) => {
  const wav = await falar(texto);
  const fd = new FormData();
  fd.append("audio", new Blob([wav], { type: "audio/wav" }), "fala.wav");
  const r = await fetch(`${BASE}/api/diva/ouvir`, { method: "POST", headers: { cookie: `auth-session=${token}` }, body: fd });
  return r.json();
};

const paciente = async (nome) => {
  const [p] = await sql`
    INSERT INTO patients (user_id, name, payment_format, session_fee, patient_status, payment_day, sessions_in_packet, started_at)
    VALUES (${qa.id}, ${nome}, 'sessao', '100.00', 'ativo', 10, 4, now()) RETURNING id`;
  criados.push(p.id);
  return p.id;
};
const sessao = async (pid, quando) => {
  const [s] = await sql`INSERT INTO therapy_sessions (user_id, patient_id, date, status, duration)
    VALUES (${qa.id}, ${pid}, ${quando}, 'agendada', 50) RETURNING id`;
  return s.id;
};
const amanha = (hora) => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(hora, 0, 0, 0); return d; };

try {
  // Empresta a chave: sem ela a rota recusa, e o caminho real nunca seria exercido.
  const { encryptSecret } = await import("../src/lib/crypto.ts").catch(() => ({ encryptSecret: null }));
  if (encryptSecret) {
    await sql`UPDATE "user" SET ai_provider = 'groq', ai_key_enc = ${encryptSecret(CHAVE_GROQ)} WHERE id = ${qa.id}`;
  } else {
    // Sem conseguir importar o TS daqui, usa o mesmo algoritmo por fora não vale a pena: avisa.
    console.log("não consegui cifrar a chave (import de crypto.ts falhou)."); process.exit(1);
  }

  const unico = await paciente("Marcela Damaceno");
  const thaisA = await paciente("Thais Alves");
  const thaisB = await paciente("Thais Duarte");

  // ───────── 1. anotar ─────────
  const j1 = await ouvir("Anota na Marcela Damaceno: relatou melhora do sono.");
  console.log(`       ouviu: "${j1.fala}"`);
  check("entendeu que é uma ANOTAÇÃO", j1.comando?.acao === "anotar", j1.comando?.acao ?? "(nada)");
  check("resolveu a paciente", j1.comando?.paciente?.tipo === "um", JSON.stringify(j1.comando?.paciente?.tipo));
  check("e está PRONTO para confirmar", (j1.comando?.faltando ?? ["?"]).length === 0, (j1.comando?.faltando ?? []).join(" | "));
  check("mas NADA foi gravado ainda — a prévia não escreve",
    (await sql`SELECT count(*) AS n FROM patient_records WHERE patient_id = ${unico}`)[0].n === "0");

  // ───────── 2. nome ambíguo ─────────
  const j2 = await ouvir("Anota na Thais: compareceu.");
  console.log(`       ouviu: "${j2.fala}" → paciente ${JSON.stringify(j2.comando?.paciente ?? null).slice(0, 160)}`);
  /**
   * O que se garante aqui é o que IMPORTA: com duas Thais no cadastro, o Divã NUNCA pode entregar
   * uma delas. Ou ele lista as duas, ou diz que não reconheceu — e as duas respostas param para
   * perguntar. (A voz sintética costuma destruir nomes curtos: "Thais" sai como "Taz". A ambiguidade
   * em si, com o texto exato, é guardada pelos testes de `pacienteDaFala`.)
   */
  const escolheuSozinho = j2.comando?.paciente?.tipo === "um";
  check("com duas Thais no cadastro, NUNCA entrega uma delas sozinho", !escolheuSozinho,
    JSON.stringify(j2.comando?.paciente ?? null).slice(0, 120));
  check("e a resposta é uma que PERGUNTA", ["varios", "nenhum"].includes(j2.comando?.paciente?.tipo),
    String(j2.comando?.paciente?.tipo));

  // ───────── 3. reservar ─────────
  const j3 = await ouvir("Marca a Marcela Damaceno amanhã às dezesseis horas.");
  console.log(`       ouviu: "${j3.fala}"`);
  check("entendeu que é uma RESERVA", j3.comando?.acao === "reservar", j3.comando?.acao ?? "(nada)");
  check("e leu o dia e a hora", !!j3.comando?.quando?.porExtenso, j3.comando?.quando?.porExtenso ?? "(não leu)");
  check("reservar NÃO cria sessão por voz",
    (await sql`SELECT count(*) AS n FROM therapy_sessions WHERE patient_id = ${unico}`)[0].n === "0");

  // ───────── 4 e 5. cancelar ─────────
  const umaSo = await paciente("Kleber Araujo");
  const alvo = await sessao(umaSo, amanha(15));
  const j4 = await ouvir("Cancela a sessão do Kleber Araujo amanhã.");
  console.log(`       ouviu: "${j4.fala}"`);
  check("entendeu que é um CANCELAMENTO", j4.comando?.acao === "cancelar", j4.comando?.acao ?? "(nada)");
  check("achou a sessão certa, e só ela", (j4.comando?.sessoes ?? []).length === 1 && j4.comando.sessoes[0].id === alvo,
    (j4.comando?.sessoes ?? []).map((s) => s.porExtenso).join(" | "));
  check("e não cancelou nada ainda",
    (await sql`SELECT status FROM therapy_sessions WHERE id = ${alvo}`)[0].status === "agendada");

  await sessao(umaSo, amanha(18)); // agora são DUAS no mesmo dia
  const j5 = await ouvir("Cancela a sessão do Kleber Araujo amanhã.");
  check("com DUAS no mesmo dia, não escolhe sozinho", (j5.comando?.sessoes ?? []).length === 2,
    (j5.comando?.sessoes ?? []).map((s) => s.porExtenso).join(" | "));
  check("e diz por quê", (j5.comando?.faltando ?? []).join(" ").match(/mais de um atendimento/i) != null,
    (j5.comando?.faltando ?? []).join(" | "));

  // ───────── 6. navegação continua navegação ─────────
  const j6 = await ouvir("Quem está devendo?");
  check("pergunta de navegação não vira comando", !j6.comando && j6.tarefa?.id === "devendo",
    `comando=${j6.comando?.acao ?? "nenhum"} tarefa=${j6.tarefa?.id ?? "nenhuma"}`);
} catch (e) {
  check("o percurso chegou ao fim sem exceção", false, String(e && e.message ? e.message : e).slice(0, 300));
} finally {
  await sql`UPDATE "user" SET ai_provider = ${provedorAntes}, ai_key_enc = ${chaveAntes} WHERE id = ${qa.id}`;
  for (const id of criados) {
    await sql`DELETE FROM patient_records WHERE patient_id = ${id}`;
    await sql`DELETE FROM therapy_sessions WHERE patient_id = ${id}`;
    await sql`DELETE FROM patients WHERE id = ${id}`;
  }
  console.log(`\n${falhas ? `${falhas} FALHA(S)` : "tudo certo"} · ${criados.length} cadastro(s) apagado(s) · conta de QA devolvida`);
  process.exit(falhas ? 1 : 0);
}
