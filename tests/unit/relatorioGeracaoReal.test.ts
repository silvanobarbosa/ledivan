import { describe, it, expect } from "vitest";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

const w = (s: string) => process.stdout.write(s + "\n");

/**
 * TESTE REAL DE GERAÇÃO (doc 9, item 5).
 *
 * Fala com o gateway da casa de verdade, com o MESMO prompt que o app usa, a partir de um
 * prontuário sintético — material inventado de propósito: validar a qualidade do texto não é
 * motivo para mandar o prontuário de ninguém para um teste.
 *
 * Só roda em máquina que tenha `REVERBLABS_AI_*` no `.env.local`. Sem a chave ele se omite, em
 * vez de reprovar a CI por uma coisa que a CI não pode fazer.
 *
 * O que ele pegou e as regras puras não pegariam: `###` de Markdown num campo de texto puro, e o
 * modelo completando "em março" para "março de 2026" — a data que ninguém registrou.
 */
const temGateway = !!(process.env.REVERBLABS_AI_KEY && (process.env.REVERBLABS_AI_BASE_URL || process.env.REVERBLABS_AI_URL));

describe.skipIf(!temGateway)("geração do relatório (fala com o gateway de verdade)", () => {
  it("o gateway devolve um relatório utilizável", async () => {
    const { promptDoRelatorio, textoDoRelatorio } = await import("@/lib/relatorioAcompanhamento");
    const bruto = process.env.REVERBLABS_AI_BASE_URL || process.env.REVERBLABS_AI_URL || "";
    // O hub guarda a raiz; o app guarda a base OpenAI. Aqui vale a base OpenAI.
    const base = /\/v1$/.test(bruto.replace(/\/+$/, "")) ? bruto.replace(/\/+$/, "") : bruto.replace(/\/+$/, "") + "/v1";
    const key = process.env.REVERBLABS_AI_KEY;

    const prompt = promptDoRelatorio({
      paciente: "Marina Teixeira",
      anamnese: [
        { titulo: "Identificação (profissão, estado civil, com quem mora)", texto: "34 anos, arquiteta, casada, mora com o marido." },
        { titulo: "Medicações em uso", texto: "Sertralina 50mg pela manhã, prescrita pela psiquiatra em março." },
        { titulo: "Queixa principal", texto: "Crises de ansiedade antes de reuniões e dificuldade para dormir." },
        { titulo: "Objetivos do tratamento", texto: "Reduzir as crises e voltar a dormir a noite inteira." },
        { titulo: "Histórico familiar", texto: "Mãe com quadro de ansiedade tratado. Relação próxima com a irmã." },
        { titulo: "Lutos vividos", texto: "Perda do pai em 2023, com quem trabalhava." },
      ],
      registros: [
        { titulo: "Sessão inicial", data: "2026-08-12", texto: "Chegou relatando insônia há quatro meses e taquicardia antes de apresentar projetos. Chorou ao falar do pai." },
        { titulo: null, data: "2026-09-02", texto: "Trouxe o registro de respiração que combinamos. Usou em duas reuniões e conseguiu terminar a apresentação." },
        { titulo: null, data: "2026-10-07", texto: "Dormiu a noite inteira em cinco das últimas sete noites. Reduziu a cafeína por conta própria." },
        { titulo: null, data: "2026-10-28", texto: "Falou da irmã como apoio. Ainda evita entrar no escritório que era do pai." },
      ],
      atividades: [
        { titulo: "Respiração diafragmática", texto: "Treinada em sessão e usada antes de reuniões." },
        { titulo: "Registro de pensamentos disfuncionais", texto: "Preenchido em casa durante três semanas." },
      ],
    });
    expect(prompt).toBeTruthy();

    const r = await fetch(`${String(base).replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.REVERBLABS_AI_MODEL || "rl-heavy",
        temperature: 0.4,
        messages: [
          { role: "system", content: prompt!.sistema },
          { role: "user", content: prompt!.usuario },
        ],
      }),
    });
    w(`HTTP ${r.status}`);
    const j = (await r.json()) as { choices?: { message?: { content?: string } }[]; error?: unknown };
    if (!r.ok) w(JSON.stringify(j).slice(0, 600));
    expect(r.ok, "gateway respondeu").toBe(true);

    const texto = textoDoRelatorio(j.choices?.[0]?.message?.content ?? "");
    w("\n--------- RELATÓRIO GERADO ---------\n" + texto + "\n------------------------------------");
    expect(texto.length).toBeGreaterThan(400);
    // Nada de Markdown: o campo do documento é texto puro.
    expect(texto).not.toMatch(/\*\*/);
    expect(texto, "sem cabecalho markdown").not.toMatch(/^#{1,6} /m);
    expect(texto, "nao inventou o ano de marco").not.toMatch(/mar.o de 20\d\d/i);
  }, 180000);
});
