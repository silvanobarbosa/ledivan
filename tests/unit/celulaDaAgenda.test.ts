import { describe, expect, it } from "vitest";
import {
  codigoDaSessao,
  conteudoDaCelula,
  entraNaSequencia,
  identificacao,
  letraDaRepeticao,
  posicaoEmTexto,
} from "@/lib/celulaDaAgenda";

/** As cinco regras que elas escreveram para o que a célula mostra, uma a uma. */

describe("a identificação do paciente", () => {
  it("usa o campo próprio quando ele está preenchido", () => {
    expect(identificacao({ agendaId: "P-014", registro: 7, nome: "Ana Lima" })).toBe("P-014");
  });

  it("cai no número de registro quando o campo está vazio", () => {
    // O campo é OPCIONAL no cadastro e costuma estar vazio. Sem reserva a célula ficaria muda.
    expect(identificacao({ agendaId: "", registro: 7, nome: "Ana Lima" })).toBe("0007");
    expect(identificacao({ agendaId: null, registro: 132, nome: "Ana Lima" })).toBe("0132");
  });

  it("cai no primeiro nome quando não há nem campo nem registro", () => {
    expect(identificacao({ nome: "Ana Lima" })).toBe("Ana");
  });

  it("sem nada, mostra um travessão em vez de ficar em branco", () => {
    expect(identificacao({})).toBe("—");
  });

  it("espaço em volta não conta como preenchido", () => {
    expect(identificacao({ agendaId: "   ", registro: 3 })).toBe("0003");
  });
});

describe("a letra da repetição", () => {
  it("mensal é (M) e quinzenal é (Q), como elas pediram", () => {
    expect(letraDaRepeticao("mensal")).toBe("M");
    expect(letraDaRepeticao("quinzenal")).toBe("Q");
  });

  it("semanal ganhou (S): sem marca ele seria o único recorrente indistinguível de um pontual", () => {
    expect(letraDaRepeticao("semanal")).toBe("S");
  });

  it("sem repetição, não há letra", () => {
    expect(letraDaRepeticao(null)).toBeNull();
    expect(letraDaRepeticao("pontual")).toBeNull();
  });
});

describe("o código da sessão", () => {
  const pos = { index: 2, total: 4 };

  it("devolutiva escreve DEVOL", () => {
    expect(codigoDaSessao({ tipo: "devolutiva", formato: "mensal", posicao: pos })).toBe("DEVOL");
  });

  it("devolutiva que abate do pacote escreve DEVOL e a posição", () => {
    expect(codigoDaSessao({ tipo: "devolutiva", abateDoPacote: true, formato: "mensal", posicao: pos })).toBe("DEVOL 2/4");
  });

  it("devolutiva manda no rótulo mesmo quando o paciente fecha por pacote", () => {
    // É um tipo de encontro, não um formato de cobrança: o que precisa saltar é que não é consulta.
    expect(codigoDaSessao({ tipo: "devolutiva", formato: "ultima_pacote", posicao: pos })).toBe("DEVOL");
  });

  it("quem é atendido de graça escreve GRAT", () => {
    expect(codigoDaSessao({ tipo: "consulta", formato: "gratuito" })).toBe("GRAT");
  });

  it("quem paga a cada sessão escreve AVUL", () => {
    expect(codigoDaSessao({ tipo: "consulta", formato: "sessao" })).toBe("AVUL");
  });

  it("quem fecha por pacote escreve a posição", () => {
    for (const formato of ["mensal", "quinzenal", "primeira_pacote", "ultima_pacote"]) {
      expect(codigoDaSessao({ tipo: "consulta", formato, posicao: pos }), formato).toBe("2/4");
    }
  });

  it("pacote sem posição calculada não inventa número", () => {
    expect(codigoDaSessao({ tipo: "consulta", formato: "mensal", posicao: null })).toBe("");
  });

  it("gratuito ganha GRAT mesmo tendo posição — não se cobra de quem não paga", () => {
    expect(codigoDaSessao({ tipo: "consulta", formato: "gratuito", posicao: pos })).toBe("GRAT");
  });
});

describe("a posição em texto", () => {
  it("escreve X/X", () => {
    expect(posicaoEmTexto({ index: 3, total: 4 })).toBe("3/4");
  });

  it("sem posição, nada", () => {
    expect(posicaoEmTexto(null)).toBeNull();
  });

  it("total zerado não vira 1/0 na tela", () => {
    expect(posicaoEmTexto({ index: 1, total: 0 })).toBeNull();
  });
});

describe("a devolutiva e a sequência", () => {
  it("consulta sempre ocupa posição", () => {
    expect(entraNaSequencia({ sessionKind: "consulta" })).toBe(true);
  });

  it("devolutiva comum acontece FORA do pacote", () => {
    // Contá-la roubaria uma consulta do paciente.
    expect(entraNaSequencia({ sessionKind: "devolutiva" })).toBe(false);
  });

  it("devolutiva marcada para abater ocupa posição, mesmo sem cobrar", () => {
    expect(entraNaSequencia({ sessionKind: "devolutiva", abaterDoPacote: true })).toBe(true);
  });
});

describe("social é categoria, não formato", () => {
  it("social NÃO substitui o código: quem fecha por pacote continua mostrando a posição", () => {
    // Era o que o código fazia antes: social vinha de `paymentFormat === "gratuito"`, então as
    // duas coisas eram a mesma e metade da informação se perdia.
    const c = conteudoDaCelula({
      agendaId: "P-1",
      formato: "mensal",
      tipo: "consulta",
      posicao: { index: 2, total: 4 },
      social: true,
    });
    expect(c.codigo).toBe("2/4");
    expect(c.social).toBe(true);
  });

  it("social e gratuito convivem: o código é GRAT e a marca também aparece", () => {
    const c = conteudoDaCelula({ agendaId: "P-1", formato: "gratuito", tipo: "consulta", social: true });
    expect(c.codigo).toBe("GRAT");
    expect(c.social).toBe(true);
  });

  it("gratuito sem vínculo social não ganha a marca", () => {
    const c = conteudoDaCelula({ agendaId: "P-1", formato: "gratuito", tipo: "consulta" });
    expect(c.codigo).toBe("GRAT");
    expect(c.social).toBe(false);
  });

  it("social pagando a cada sessão continua sendo AVUL", () => {
    const c = conteudoDaCelula({ agendaId: "P-1", formato: "sessao", tipo: "consulta", social: true });
    expect(c.codigo).toBe("AVUL");
    expect(c.social).toBe(true);
  });
});

describe("a célula inteira", () => {
  it("junta identificação, letra, código e câmera", () => {
    const c = conteudoDaCelula({
      agendaId: "P-014",
      formato: "quinzenal",
      tipo: "consulta",
      posicao: { index: 1, total: 4 },
      online: true,
      repeticao: "quinzenal",
    });
    expect(c).toEqual({ identificacao: "P-014", repeticao: "Q", codigo: "1/4", online: true, repeteSemLetra: false, social: false });
  });

  it("repetição sem frequência conhecida não fica muda", () => {
    // A base tem 111 sessões recorrentes com a frequência nula. Sem marca nenhuma elas ficariam
    // idênticas a um agendamento pontual — exatamente o que a cor azul dizia antes de a legenda
    // passar a falar de status.
    const c = conteudoDaCelula({ agendaId: "P-1", recorrente: true, repeticao: null });
    expect(c.repeticao).toBeNull();
    expect(c.repeteSemLetra).toBe(true);
  });

  it("quando a frequência é conhecida, a letra basta e o ícone some", () => {
    const c = conteudoDaCelula({ agendaId: "P-1", recorrente: true, repeticao: "mensal" });
    expect(c.repeticao).toBe("M");
    expect(c.repeteSemLetra).toBe(false);
  });

  it("agendamento pontual não ganha marca nenhuma", () => {
    const c = conteudoDaCelula({ agendaId: "P-1", recorrente: false });
    expect(c.repeticao).toBeNull();
    expect(c.repeteSemLetra).toBe(false);
  });

  it("presencial não acende a câmera", () => {
    expect(conteudoDaCelula({ agendaId: "P-1", online: false }).online).toBe(false);
  });
});
