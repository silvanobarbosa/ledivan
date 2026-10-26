import { describe, expect, it } from "vitest";
import { tipoDaFalta, tipoDaFaltaPeloRotulo, perguntaDaFalta, type TipoDaFalta } from "@/lib/perguntaFalta";

describe("tipoDaFalta — classifica o agendamento pelo formato do cadastro", () => {
  it("qualquer formato de pacote vira 'pacote', seja mensal ou quinzenal", () => {
    // O que importa para a pergunta é existir uma SEQUÊNCIA a abater — não o ritmo dela.
    for (const f of ["mensal", "mensal_completo", "mensal_fracionado", "quinzenal",
                     "quinzenal_completo", "quinzenal_fracionado", "pacote"]) {
      expect(tipoDaFalta(f)).toBe<TipoDaFalta>("pacote");
    }
  });

  it("gratuito é reconhecido", () => {
    expect(tipoDaFalta("gratuito")).toBe("gratuito");
    expect(tipoDaFalta("Gratuito")).toBe("gratuito");
  });

  it("sessão avulsa — inclusive a grafia 'sessao' que o cadastro usa", () => {
    expect(tipoDaFalta("sessao")).toBe("avulso");
    expect(tipoDaFalta("avulso")).toBe("avulso");
  });

  it("formato ausente cai em avulso, que é o default do cadastro", () => {
    expect(tipoDaFalta(null)).toBe("avulso");
    expect(tipoDaFalta(undefined)).toBe("avulso");
    expect(tipoDaFalta("")).toBe("avulso");
    expect(tipoDaFalta("   ")).toBe("avulso");
  });

  it("formato desconhecido não quebra a tela — cai em avulso", () => {
    expect(tipoDaFalta("formato-que-ninguem-criou")).toBe("avulso");
  });
});

describe("perguntaDaFalta — cada tipo tem a SUA pergunta", () => {
  it("as três perguntas são diferentes entre si", () => {
    // Se duas coincidissem, o usuário voltaria a ter que adivinhar a consequência.
    const titulos = (["gratuito", "avulso", "pacote"] as const).map((t) => perguntaDaFalta(t).titulo);
    expect(new Set(titulos).size).toBe(3);
  });

  it("gratuito pergunta se deseja COBRAR (doc 57)", () => {
    const p = perguntaDaFalta("gratuito");
    expect(p.titulo).toBe("Deseja cobrar esta sessão?");
    expect(p.explicaSim).toContain("Avulso");
    expect(p.explicaNao).toContain("gratuita");
  });

  it("avulso pergunta se CONTINUA cobrando (doc 57)", () => {
    // "Continuar" e não "Cobrar": a sessão já é cobrada, e o verbo precisa dizer isso — senão
    // "Não" parece não fazer nada.
    const p = perguntaDaFalta("avulso");
    expect(p.titulo).toBe("Continuar cobrando esta sessão?");
    expect(p.explicaNao).toContain("convertida para gratuita");
  });

  it("pacote pergunta sobre abater, e as explicações falam de NUMERAÇÃO (doc 55)", () => {
    // O texto antigo dizia "abater" e "contagem" — palavras do sistema. O dono trocou pelo que ela
    // vê na célula e na tabela: a numeração das sessões.
    const p = perguntaDaFalta("pacote");
    expect(p.titulo).toContain("Abater");
    expect(p.explicaSim).toContain("avançando a numeração");
    expect(p.explicaNao).toContain("sem consumir uma sessão do pacote");
  });

  it("toda pergunta explica o Sim E o Não — nenhuma deixa metade no escuro", () => {
    for (const t of ["gratuito", "avulso", "pacote"] as const) {
      const p = perguntaDaFalta(t);
      expect(p.titulo.length).toBeGreaterThan(10);
      expect(p.explicaSim.length).toBeGreaterThan(20);
      expect(p.explicaNao.length).toBeGreaterThan(20);
    }
  });
});

/**
 * Doc 57: a janela é a do que a sessão É AGORA, não a do formato do cadastro.
 *
 * A diferença aparece em quem já converteu uma vez: um paciente gratuito cuja sessão virou AVUL ao
 * responder "Sim" precisa, na segunda vez, da pergunta do AVUL. Pelo formato do cadastro ele seria
 * sempre gratuito, e a janela ofereceria converter o que já está convertido.
 */
describe("tipoDaFaltaPeloRotulo — a pergunta concorda com a célula da agenda", () => {
  it("GRAT abre a janela do gratuito, mesmo num paciente avulso", () => {
    expect(tipoDaFaltaPeloRotulo("GRAT", "sessao")).toBe<TipoDaFalta>("gratuito");
  });

  it("AVUL abre a do avulso, mesmo num paciente GRATUITO que já converteu", () => {
    expect(tipoDaFaltaPeloRotulo("AVUL", "gratuito")).toBe<TipoDaFalta>("avulso");
  });

  it("posição no pacote abre a do pacote", () => {
    for (const r of ["1/4", "3/8", "10/12"]) expect(tipoDaFaltaPeloRotulo(r, "gratuito")).toBe<TipoDaFalta>("pacote");
  });

  it("devolutiva que ocupa posição também é do pacote", () => {
    expect(tipoDaFaltaPeloRotulo("DEVOL 2/4", "mensal")).toBe<TipoDaFalta>("pacote");
  });

  it("sem rótulo, vale o cadastro — é o comportamento de antes", () => {
    expect(tipoDaFaltaPeloRotulo("", "mensal")).toBe<TipoDaFalta>("pacote");
    expect(tipoDaFaltaPeloRotulo(null, "gratuito")).toBe<TipoDaFalta>("gratuito");
    expect(tipoDaFaltaPeloRotulo(undefined, null)).toBe<TipoDaFalta>("avulso");
  });

  it("rótulo desconhecido não é chutado: cai no cadastro", () => {
    expect(tipoDaFaltaPeloRotulo("DEVOL", "mensal")).toBe<TipoDaFalta>("pacote");
    expect(tipoDaFaltaPeloRotulo("XYZ", "gratuito")).toBe<TipoDaFalta>("gratuito");
  });
});
