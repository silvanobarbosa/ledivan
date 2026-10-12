import { describe, expect, it } from "vitest";
import { resumoDaGeral, type EntradaDaGeral } from "@/lib/guiaGeral";

// Doc 33 (F17): o card da lista mostrava "Atrasado" onde a tela do paciente não via atraso.
// Causa: `situacoesDaLista` montava a conta SEM alguns fatos que `geralDoPaciente` passa — em
// especial `quita` (diferença perdoada) e `vencimentos` (vencimento editado à mão). Estes testes
// travam o motor: com e sem esses fatos a situação de atraso MUDA, então a lista tem de passá-los.
const sessao = (id: string, diasAtras: number) => {
  const d = new Date();
  d.setDate(d.getDate() - diasAtras);
  d.setHours(9, 0, 0, 0);
  return { id, date: d, status: "realizada", sessionKind: "consulta", chargeable: true };
};

const baseSessao = (): EntradaDaGeral => ({
  vigencias: [{ formato: "sessao", pacoteTipo: "completo", desde: new Date(2024, 0, 1) }],
  reserva: { formato: "sessao", pacoteTipo: "completo" },
  precos: [{ valor: 100, desde: new Date(2024, 0, 1) }],
  sessoes: [sessao("s1", 10)], // sessão realizada há 10 dias → vencimento já passou
  valorDaSessao: 100,
  diaPagamento: null,
  hoje: new Date(),
  pagamentos: [],
});

describe("situação de atraso depende de fatos que a lista precisa passar (doc 33 F17)", () => {
  it("diferença perdoada (quita): sem `quita` fica em atraso; com `quita` não", () => {
    const pagamentoParcial = { id: "pg", valor: 50, data: new Date(), status: "paid", cobrancaChave: "sessao:s1" };

    const semQuita = resumoDaGeral({ ...baseSessao(), pagamentos: [{ ...pagamentoParcial }] });
    expect(semQuita.nAtraso).toBe(1); // 50 de 100, sem perdão → atrasada

    const comQuita = resumoDaGeral({ ...baseSessao(), pagamentos: [{ ...pagamentoParcial, quita: true }] });
    expect(comQuita.nAtraso).toBe(0); // diferença perdoada → paga, sem atraso
  });

  it("vencimento editado para o futuro: sem o override fica em atraso; com o override não", () => {
    const futuro = new Date();
    futuro.setDate(futuro.getDate() + 30);

    const semOverride = resumoDaGeral(baseSessao());
    expect(semOverride.nAtraso).toBe(1); // vencimento (data da sessão) já passou → atrasada

    const comOverride = resumoDaGeral({ ...baseSessao(), vencimentos: [{ chave: "sessao:s1", vencimento: futuro }] });
    expect(comOverride.nAtraso).toBe(0); // vencimento empurrado para a frente → ainda não vence
  });
});
