import { describe, it, expect } from "vitest";
import { previaDoComando } from "@/lib/previaDoComando";

const PACIENTES = [
  { id: "1", nome: "Thais Alves" },
  { id: "2", nome: "Thais Duarte" },
  { id: "5", nome: "Marcela Damaceno" },
];
const AGORA = new Date(2026, 10, 4, 11, 0, 0); // quarta, 04/11/2026

const SESSOES: Record<string, { id: string; quando: Date }[]> = {
  "5": [
    { id: "s1", quando: new Date(2026, 10, 5, 16, 0) },
    { id: "s2", quando: new Date(2026, 10, 5, 18, 0) },
    { id: "s3", quando: new Date(2026, 10, 12, 16, 0) },
  ],
};
const sessoesDoPaciente = (id: string) => SESSOES[id] ?? [];
const previa = (fala: string) => previaDoComando(fala, PACIENTES, { agora: AGORA, sessoesDoPaciente });

describe("a prévia do comando — nada acontece sem ela ver", () => {
  it("anotar com tudo entendido fica PRONTO para confirmar", () => {
    const p = previa("anota na Marcela: relatou melhora do sono")!;
    expect(p.acao).toBe("anotar");
    expect(p.paciente.tipo).toBe("um");
    expect(p.texto).toBe("relatou melhora do sono");
    expect(p.faltando).toEqual([]);
  });

  it("anotar sem conteúdo NÃO fica pronto", () => {
    const p = previa("anota na Marcela")!;
    expect(p.faltando.length).toBeGreaterThan(0);
    expect(p.faltando.join(" ")).toMatch(/o que anotar/i);
  });

  it("nome ambíguo trava e devolve os candidatos", () => {
    const p = previa("anota na Thais: ok")!;
    expect(p.paciente.tipo).toBe("varios");
    expect(p.faltando.join(" ")).toMatch(/mais de um paciente/i);
    if (p.paciente.tipo === "varios") expect(p.paciente.candidatos.length).toBe(2);
  });

  it("paciente que não existe trava", () => {
    const p = previa("anota na Joaquina: ok")!;
    expect(p.paciente.tipo).toBe("nenhum");
    expect(p.faltando.length).toBeGreaterThan(0);
  });

  it("reservar entende o quando e devolve por extenso", () => {
    const p = previa("marca a Marcela quinta às 16h")!;
    expect(p.acao).toBe("reservar");
    expect(p.quando?.porExtenso).toBe("quinta-feira, 05/11, às 16h");
    expect(p.faltando).toEqual([]);
  });

  it("reservar sem hora NÃO fica pronto — horário presumido é sessão na hora errada", () => {
    const p = previa("marca a Marcela quinta")!;
    expect(p.quando).toBeNull();
    expect(p.faltando.join(" ")).toMatch(/dia e a hora/i);
  });

  it("cancelar: um atendimento no dia resolve", () => {
    const p = previa("cancela a sessão da Marcela dia 12")!;
    expect(p.acao).toBe("cancelar");
    expect(p.sessoes?.length).toBe(1);
    expect(p.sessoes?.[0].porExtenso).toContain("12/11");
    expect(p.faltando).toEqual([]);
  });

  it("cancelar: DOIS atendimentos no mesmo dia travam e aparecem os dois", () => {
    const p = previa("cancela a sessão da Marcela amanhã")!;
    expect(p.sessoes?.length).toBe(2);
    expect(p.faltando.join(" ")).toMatch(/mais de um atendimento/i);
  });

  it("cancelar num dia sem atendimento trava, em vez de pegar outro", () => {
    const p = previa("cancela a sessão da Marcela dia 20")!;
    expect(p.sessoes).toEqual([]);
    expect(p.faltando.join(" ")).toMatch(/não achei/i);
  });

  it("cancelar sem dizer o dia oferece o PRÓXIMO, e só ele", () => {
    const p = previa("cancela a sessão da Marcela")!;
    expect(p.sessoes?.length).toBe(1);
    expect(p.sessoes?.[0].porExtenso).toContain("05/11");
  });

  it("pergunta de navegação não vira prévia de comando", () => {
    expect(previa("quem está devendo?")).toBeNull();
  });
});

/**
 * A DATA DO PAGAMENTO DITADO.
 *
 * Relato de 02/11: "registrar um pagamento de 400 reais feito pela Talita, em 31/10". O "em
 * 31/10" era descartado e o lançamento nasceria com a data de hoje — data de dinheiro decide o
 * mês, o caixa e o recibo. Ver [[licao-uma-coluna-duas-perguntas]].
 */
describe("o pagamento ditado carrega a data que ela disse", () => {
  const comCobranca = (fala: string) =>
    previaDoComando(fala, PACIENTES, {
      agora: AGORA,
      sessoesDoPaciente,
      cobrancasDoPaciente: () => [
        { chave: "pacote:inicio:1", vencimento: new Date(2026, 10, 1), falta: 400, ano: 2026 },
      ],
    });

  it("“em 31/10” vira a data do lançamento, não a de hoje", () => {
    const p = comCobranca("registrar um pagamento de 400 reais feito pela Marcela, em 31/10")!;
    expect(p.acao).toBe("pagar");
    expect(p.valor).toBe(400);
    const d = new Date(p.quando!.iso);
    expect([d.getDate(), d.getMonth() + 1]).toEqual([31, 10]);
    expect(p.quando!.porExtenso).toBe("31/10");
    expect(p.faltando).toEqual([]);
  });

  it("“ontem” e “hoje” também valem — é como ela fala", () => {
    const hoje = comCobranca("a Marcela pagou 400 reais hoje")!;
    expect(new Date(hoje.quando!.iso).getDate()).toBe(4);
  });

  it("sem data dita, fica null — e o servidor usa hoje, como o formulário", () => {
    const p = comCobranca("lança o pagamento da Marcela, 400 reais")!;
    expect(p.quando).toBeNull();
    expect(p.valor).toBe(400);
  });

  it("a data não engole o valor: 400 continua 400 com “31/10” na frase", () => {
    const p = comCobranca("lança o pagamento de 400 reais da Marcela em 31/10")!;
    expect(p.valor).toBe(400);
    expect(p.cobranca?.chave).toBe("pacote:inicio:1");
  });

  /**
   * GAP CONHECIDO, deixado à mostra de propósito.
   *
   * "pagamento de 400 reais da Marcela", sem verbo, NÃO vira comando — o catálogo pede um verbo
   * ("lança", "registra", "recebi", "pagou"). Não foi alargado junto com o conserto da data
   * porque "pagamento" sozinho é também como se pede a TELA de pagamentos, e um substantivo
   * virando verbo faria "quero ver os pagamentos" lançar dinheiro. Fica registrado aqui para a
   * próxima sessão saber que é escolha, não esquecimento.
   */
  it("sem verbo não vira comando — e isso é escolha, não falha", () => {
    expect(comCobranca("pagamento de 400 reais da Marcela em 31/10")).toBeNull();
  });
});
