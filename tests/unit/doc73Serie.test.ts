import { describe, it, expect } from "vitest";
import { perguntaDaAbrangencia, abrangenciaValida, marcasDaSessao } from "@/lib/abrangenciaDaSerie";

/**
 * Doc 73, itens 7 e 8 — "todas as sessões desta sequência ou apenas esta?".
 *
 * Até aqui a série INTEIRA herdava a escolha sem ninguém perguntar: quem combinava uma cortesia
 * dentro de um ritmo semanal saía com o ritmo inteiro de graça. A pergunta só existe quando há
 * série E quando a escolha muda o que a sessão é.
 */

const marca = { extra: "grat", valorExtra: null, cortesia: false };

describe("doc 73 — quando perguntar, e com que palavras", () => {
  it("fora da sequência + não cobrada: pergunta pelas GRATUITAS", () => {
    const q = perguntaDaAbrangencia({ recorrente: true, escolha: "fora", cobrada: "nao" });
    expect(q?.titulo).toBe("Deseja tornar gratuitas todas as sessões desta sequência ou apenas esta sessão?");
  });

  it("fora da sequência + cobrada: pergunta pelas AVULSAS", () => {
    const q = perguntaDaAbrangencia({ recorrente: true, escolha: "fora", cobrada: "sim" });
    expect(q?.titulo).toBe("Deseja que todas as sessões desta sequência sejam agendadas como avulsas ou apenas esta sessão?");
  });

  it("cortesia: pergunta pela CORTESIA", () => {
    const q = perguntaDaAbrangencia({ recorrente: true, escolha: "cortesia" });
    expect(q?.titulo).toBe("Deseja tornar todas as sessões desta sequência cortesia ou apenas esta sessão?");
  });

  it("agendamento ÚNICO nunca pergunta — não há 'todas'", () => {
    expect(perguntaDaAbrangencia({ recorrente: false, escolha: "cortesia" })).toBeNull();
    expect(perguntaDaAbrangencia({ recorrente: false, escolha: "fora", cobrada: "nao" })).toBeNull();
  });

  it("série que entra na sequência normal não tem o que perguntar", () => {
    expect(perguntaDaAbrangencia({ recorrente: true, escolha: "normal" })).toBeNull();
    expect(perguntaDaAbrangencia({ recorrente: true, escolha: null })).toBeNull();
  });

  it("fora da sequência sem resposta de cobrança ainda não pergunta", () => {
    // O quadro pede "Esta sessão será cobrada?" primeiro; sem ela, não há pergunta a fazer.
    expect(perguntaDaAbrangencia({ recorrente: true, escolha: "fora" })).toBeNull();
    expect(perguntaDaAbrangencia({ recorrente: true, escolha: "fora", cobrada: "" })).toBeNull();
  });
});

describe("doc 73 — o que cada sessão da série recebe", () => {
  it("'todas' repete a marca em todas — o comportamento de sempre", () => {
    for (const indice of [0, 1, 7]) {
      expect(marcasDaSessao({ indice, abrangencia: "todas", escolhido: marca })).toEqual(marca);
    }
  });

  it("'apenas esta' marca a PRIMEIRA e devolve as outras ao ritmo normal", () => {
    expect(marcasDaSessao({ indice: 0, abrangencia: "apenas_esta", escolhido: marca })).toEqual(marca);
    // Sem `extra` elas voltam a ocupar posição na sequência do pacote — "o restante deve ser
    // agendada iniciando/seguindo a sequência".
    expect(marcasDaSessao({ indice: 1, abrangencia: "apenas_esta", escolhido: marca }))
      .toEqual({ extra: null, valorExtra: null, cortesia: false });
  });

  it("a avulsa com valor: só a primeira carrega o valor", () => {
    const avulsa = { extra: "avul", valorExtra: "120.00", cortesia: false };
    expect(marcasDaSessao({ indice: 0, abrangencia: "apenas_esta", escolhido: avulsa })).toEqual(avulsa);
    expect(marcasDaSessao({ indice: 3, abrangencia: "apenas_esta", escolhido: avulsa }).valorExtra).toBeNull();
  });

  it("a cortesia: a primeira é cortesia, as outras voltam a ser cobradas", () => {
    const cortesia = { extra: null, valorExtra: null, cortesia: true };
    expect(marcasDaSessao({ indice: 0, abrangencia: "apenas_esta", escolhido: cortesia }).cortesia).toBe(true);
    expect(marcasDaSessao({ indice: 1, abrangencia: "apenas_esta", escolhido: cortesia }).cortesia).toBe(false);
  });

  it("campo ausente ou estranho é 'todas' — o que o app sempre fez", () => {
    expect(abrangenciaValida(undefined)).toBe("todas");
    expect(abrangenciaValida(null)).toBe("todas");
    expect(abrangenciaValida("qualquer coisa")).toBe("todas");
    expect(abrangenciaValida("apenas_esta")).toBe("apenas_esta");
  });
});
