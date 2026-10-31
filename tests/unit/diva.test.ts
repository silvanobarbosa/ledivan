import { describe, it, expect } from "vitest";
import { abreSozinho, avisosDoDiva, DISPENSAS_ATE_CALAR, normalizar, TAREFAS, tarefaDaFala } from "@/lib/diva";

describe("o Divã — o catálogo", () => {
  it("toda tarefa aponta para uma rota do app e tem o que reconhecer na fala", () => {
    for (const t of TAREFAS) {
      expect(t.rota.startsWith("/dashboard")).toBe(true);
      expect(t.ditos.length).toBeGreaterThan(0);
      expect(t.rotulo.trim().length).toBeGreaterThan(0);
    }
  });

  it("os identificadores não se repetem", () => {
    expect(new Set(TAREFAS.map((t) => t.id)).size).toBe(TAREFAS.length);
  });
});

describe("o Divã — o que ele entende da fala", () => {
  it("entende a terapeuta falando como ela fala", () => {
    const casos: [string, string][] = [
      ["O que eu tenho hoje?", "agenda-hoje"],
      ["quem eu atendo hoje", "agenda-hoje"],
      ["quero marcar um atendimento", "marcar"],
      ["preciso agendar a Marcela", "marcar"],
      ["quem está devendo?", "devendo"],
      ["quem tá devendo pra mim", "devendo"],
      ["lançar pagamento da Thais", "lancar-pagamento"],
      ["cadastrar paciente novo", "novo-paciente"],
      ["bloquear horário na sexta", "bloquear"],
      ["emitir recibo", "recibo"],
      ["escrever evolução", "evolucao"],
      ["quanto recebi este mês", "carteira"],
      ["me ensina a usar", "ajuda"],
    ];
    for (const [fala, id] of casos) {
      expect(tarefaDaFala(fala)?.id, fala).toBe(id);
    }
  });

  it("o dito MAIS LONGO vence — senão a palavra solta rouba a frase", () => {
    // "pagamento" sozinho é "lançar pagamento"; a frase inteira é outra coisa.
    expect(tarefaDaFala("marcar atendimento")?.id).toBe("marcar");
    expect(tarefaDaFala("lançar pagamento")?.id).toBe("lancar-pagamento");
  });

  it("acento, caixa e pontuação não atrapalham", () => {
    expect(normalizar("Quem está DEVENDO?!")).toBe("quem esta devendo");
    expect(tarefaDaFala("QUEM ESTÁ DEVENDO?")?.id).toBe("devendo");
  });

  it("não entendeu = null, e nunca um chute", () => {
    for (const fala of ["", "   ", "banana com farinha", "qual o sentido da vida"]) {
      expect(tarefaDaFala(fala)).toBeNull();
    }
  });

  it("não oferece conduta clínica: nada no catálogo responde 'o que faço com esse paciente'", () => {
    expect(tarefaDaFala("o que eu faço com essa paciente")).toBeNull();
    expect(tarefaDaFala("qual o diagnóstico dela")).toBeNull();
    expect(tarefaDaFala("devo medicar")).toBeNull();
  });
});

describe("o Divã — o que te espera", () => {
  const zerado = { sessoesHoje: 0, cobrancasEmAtraso: 0, valorEmAtraso: 0, semProximoAgendamento: 0, reajustesAVencer: 0 };

  it("dia limpo não vira lista de zeros", () => {
    expect(avisosDoDiva(zerado)).toEqual([]);
  });

  it("conta o que existe, no singular e no plural", () => {
    const um = avisosDoDiva({ ...zerado, sessoesHoje: 1 });
    expect(um[0].texto).toBe("1 atendimento hoje");
    const varios = avisosDoDiva({ ...zerado, sessoesHoje: 4 });
    expect(varios[0].texto).toBe("4 atendimentos hoje");
  });

  it("o atraso vem com o valor, porque é o número que decide a ação", () => {
    const [aviso] = avisosDoDiva({ ...zerado, cobrancasEmAtraso: 2, valorEmAtraso: 740 });
    expect(aviso.texto).toContain("2 cobranças em atraso");
    expect(aviso.texto).toContain("740");
    expect(aviso.rota).toBe("/dashboard/fechamento");
  });

  it("cada aviso leva a uma tela", () => {
    const avisos = avisosDoDiva({ sessoesHoje: 3, cobrancasEmAtraso: 1, valorEmAtraso: 100, semProximoAgendamento: 2, reajustesAVencer: 1 });
    expect(avisos.length).toBe(4);
    for (const a of avisos) expect(a.rota.startsWith("/dashboard")).toBe(true);
  });
});

describe("o Divã — a pergunta da abertura é dispensável", () => {
  it("abre sozinho enquanto ela não o dispensar três vezes seguidas", () => {
    expect(abreSozinho(0)).toBe(true);
    expect(abreSozinho(DISPENSAS_ATE_CALAR - 1)).toBe(true);
  });

  it("na terceira dispensa seguida, cala — e fica só no ícone", () => {
    expect(abreSozinho(DISPENSAS_ATE_CALAR)).toBe(false);
    expect(abreSozinho(10)).toBe(false);
  });
});
