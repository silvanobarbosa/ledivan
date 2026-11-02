import { describe, it, expect } from "vitest";
import { previaDoComando } from "@/lib/previaDoComando";
import { tarefaDaFala, TAREFAS } from "@/lib/diva";

/**
 * COMO ELA FALA DE DINHEIRO.
 *
 * Relato de 02/11, na segunda tentativa: "ele recebeu, transcreveu, e foi pra carteira, mas não
 * lançou". Com a voz já gravando, ir para uma TELA só podia significar uma coisa — a fala não
 * virou comando e caiu no catálogo de navegação.
 *
 * Rodando 20 falas naturais contra o vocabulário, **8 não viravam comando**, e 5 delas iam parar
 * na Carteira, que é uma tela de leitura: o pedido completo de dinheiro morria num lugar onde não
 * se lança nada.
 *
 * Nenhuma das 8 era exquisita. Faltava a conjugação curta, o substantivo, o verbo sem a palavra
 * "pagamento" e a forma de pagamento usada como verbo. **Quem fala não repete o nome do menu** —
 * e cada buraco destes custa um lançamento que não entra.
 */

const PACIENTES = [
  { id: "1", nome: "Talita Cruz Dick" },
  { id: "2", nome: "Marcela Damaceno" },
];
const AGORA = new Date(2026, 10, 2, 18, 0, 0);
const COBRANCAS = () => [
  { chave: "pacote:inicio:1", vencimento: new Date(2026, 10, 1), falta: 400, ano: 2026 },
];

const previa = (fala: string) =>
  previaDoComando(fala, PACIENTES, {
    agora: AGORA,
    sessoesDoPaciente: () => [],
    cobrancasDoPaciente: COBRANCAS,
  });

/** Virou um pedido PRONTO de dinheiro: paciente resolvido, valor entendido, nada faltando. */
const lanca = (fala: string) => {
  const p = previa(fala);
  return p?.acao === "pagar" && p.paciente.tipo === "um" && p.faltando.length === 0 ? p : null;
};

describe("as falas que a terapeuta usa para dizer que recebeu", () => {
  const FALAS = [
    "registrar um pagamento de 400 reais feito pela Talita em 31/10",
    "lançar um pagamento de 400 reais da Talita",
    "quero lançar um pagamento para a Talita de 400 reais",
    // Os oito buracos medidos em 02/11 — cada linha aqui é um lançamento que não entrava.
    "fazer o lançamento de 400 reais da Talita",
    "faz o lançamento do pagamento da Talita de 400 reais",
    "lançamento de 400 reais da Talita",
    "registra o pagamento da Talita de 400 reais",
    "lança 400 reais da Talita",
    "lançar 400 reais para a Talita",
    "pix de 400 reais da Talita",
    "entrou 400 reais da Talita",
    "baixa de 400 reais no pagamento da Talita",
    // E os jeitos em que o nome vem na frente do verbo.
    "a Talita pagou 400 reais",
    "a Talita me pagou 400 reais",
    "a Talita fez um pix de 400 reais",
    "a Talita transferiu 400 reais",
    "a Talita depositou 400 reais",
    "recebi 400 reais da Talita",
    "dar baixa de 400 reais da Talita",
  ];

  for (const fala of FALAS) {
    it(`“${fala}” vira lançamento`, () => {
      const p = lanca(fala);
      expect(p, "caiu na navegação em vez de virar comando").not.toBeNull();
      expect(p!.valor).toBe(400);
      expect(p!.cobranca?.chave).toBe("pacote:inicio:1");
    });
  }
});

describe("o que NÃO pode virar pagamento", () => {
  it("anotação continua anotação — “registrar na” e “registra o pagamento da” começam igual", () => {
    expect(previa("registrar na Marcela que faltou")?.acao).toBe("anotar");
    expect(previa("anota na Marcela: dormiu melhor")?.acao).toBe("anotar");
  });

  it("agendar e cancelar não viram dinheiro", () => {
    expect(previa("marca a Marcela quinta às 16h")?.acao).toBe("reservar");
    expect(previa("cancelar a sessão da Marcela")?.acao).toBe("cancelar");
  });

  it("“mandou” não é pagamento: a Marcela mandou mensagem", () => {
    // O verbo de dinheiro chegando é lista curta de propósito. "mandou" sozinho significa
    // qualquer coisa, e um falso positivo aqui lança dinheiro que ninguém recebeu.
    expect(previa("a Marcela mandou mensagem")).toBeNull();
  });

  it("perguntas sobre dinheiro continuam NAVEGANDO, não lançando", () => {
    expect(previa("ver quem está devendo")).toBeNull();
    expect(tarefaDaFala("ver quem está devendo")?.id).toBe("devendo");
    expect(previa("quanto entrou esse mês")).toBeNull();
    expect(tarefaDaFala("quanto entrou esse mês")?.id).toBe("carteira");
  });
});

describe("a tarefa de navegação leva aonde SE LANÇA", () => {
  /**
   * `/dashboard/pagamentos` é a tela **Carteira**: recebimentos por mês, nada de lançar. O rótulo
   * prometia um verbo e entregava leitura — a terapeuta chegava lá e não conseguia fazer o que
   * tinha pedido. O lançamento manual mora na ficha do paciente, guia Geral.
   */
  const lancar = TAREFAS.find((t) => t.id === "lancar-pagamento")!;

  it("não aponta mais para a Carteira", () => {
    expect(lancar.rota).not.toBe("/dashboard/pagamentos");
  });

  it("aponta para onde se escolhe o paciente, e diz o caminho", () => {
    expect(lancar.rota).toBe("/dashboard/patients");
    expect(lancar.dica).toMatch(/ficha/i);
    expect(lancar.dica).toMatch(/Geral/);
  });

  it("e continua avisando que só LEVA — não grava", () => {
    expect(lancar.soLeva).toBe(true);
  });
});
