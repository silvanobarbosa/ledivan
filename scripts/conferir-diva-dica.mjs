/**
 * A dica do Divã cabe no teto do provedor? SÓ LEITURA do banco; uma chamada curta por terapeuta.
 *
 * Existe porque o sintoma era mudo: a tela dizia "Não consegui ouvir agora" e o 400 do provedor
 * ("prompt length must be 896 characters or fewer") só aparecia no log do servidor. Rodando isto,
 * o estouro aparece ANTES de a terapeuta perder o comando de voz.
 */
import { config } from "dotenv";
config({ path: "C:/Users/User/Ledivan Plus/.env.local", quiet: true });
import { neon } from "@neondatabase/serverless";
const { decryptSecret } = await import("../src/lib/crypto.ts");
const { TAREFAS } = await import("../src/lib/diva.ts");
const { dicaQueCabe, TETO_DA_DICA } = await import("../src/lib/transcricao.ts");

const sql = neon(process.env.DATABASE_URL);
const BASE_VERBOS = `Verbos: anotar, anota, marcar, marca, agendar, cancelar, cancela, desmarcar. Comandos: ${TAREFAS.map((t) => t.rotulo).join("; ")}.`;

const terapeutas = await sql`SELECT id, email, ai_provider, ai_key_enc FROM "user" WHERE ai_key_enc IS NOT NULL`;
let falhas = 0;
for (const t of terapeutas) {
  const ps = await sql`SELECT name FROM patients WHERE user_id = ${t.id} AND patient_status <> 'inativo'`;
  const nomes = ps.map((p) => p.name);
  const antiga = `${BASE_VERBOS} Pacientes: ${nomes.slice(0, 80).join(", ")}.`;
  const nova = dicaQueCabe(BASE_VERBOS, nomes);
  const cabem = (nova.match(/Pacientes: (.*)\.$/)?.[1] ?? "").split(", ").filter(Boolean).length;
  console.log(`${t.email} · ${t.ai_provider} · ${nomes.length} pacientes`);
  console.log(`   dica ANTIGA: ${antiga.length} chars ${antiga.length > TETO_DA_DICA ? "← ESTOURAVA" : "(cabia)"}`);
  console.log(`   dica NOVA:   ${nova.length} chars · ${cabem} de ${nomes.length} nomes`);
  if (nova.length > TETO_DA_DICA) { console.log("   FALHA: a dica nova passou do teto"); falhas++; continue; }

  // A prova de verdade: o provedor aceita? Áudio mínimo, uma chamada.
  const taxa = 8000, n = taxa;
  const dados = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) dados.writeInt16LE(Math.round(3000 * Math.sin((2 * Math.PI * 440 * i) / taxa)), i * 2);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + dados.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(taxa, 24); h.writeUInt32LE(taxa * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(dados.length, 40);
  const fd = new FormData();
  fd.append("file", new Blob([Buffer.concat([h, dados])], { type: "audio/wav" }), "fala.webm");
  fd.append("model", t.ai_provider === "groq" ? "whisper-large-v3" : "whisper-1");
  fd.append("language", "pt");
  fd.append("prompt", nova);
  const url = t.ai_provider === "groq"
    ? "https://api.groq.com/openai/v1/audio/transcriptions"
    : "https://api.openai.com/v1/audio/transcriptions";
  const r = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${decryptSecret(t.ai_key_enc)}` }, body: fd });
  const corpo = r.ok ? "" : (await r.text()).replace(/\s+/g, " ").slice(0, 160);
  console.log(`   provedor com a dica nova: HTTP ${r.status} ${r.ok ? "(aceito)" : "→ " + corpo}`);
  if (!r.ok) falhas++;
}
console.log(`\n${falhas ? `${falhas} FALHA(S)` : "todas as dicas cabem e o provedor aceita"}`);
process.exit(falhas ? 1 : 0);
