import { describe, expect, it } from "vitest";
import { COLUNAS_DA_SESSAO, COLUNAS_DA_SESSAO_COM_PACIENTE } from "@/lib/colunasDaSessao";

/**
 * AS COLUNAS QUE O MOTOR LÊ — e por que isto é um teste, e não só uma constante.
 *
 * A lista estava copiada em quatro telas. Quando o doc 54 acrescentou `faltou_conta`, só a guia
 * Geral passou a trazê-la; a agenda, a Fechamento e a lista de pacientes ficaram para trás. O
 * efeito não foi um erro de tela: foi o motor recebendo um dado a menos e respondendo outra coisa,
 * em silêncio. A mesma sessão aparecia como 2/4 na agenda e 1/4 na guia Geral, e na Fechamento
 * mudava o DINHEIRO do mês.
 *
 * Nenhum teste pegou, porque cada tela, sozinha, estava coerente consigo mesma. Quem percebeu foi
 * a terapeuta, com um print.
 *
 * Este teste não conserta a distração — ele a torna barulhenta. Tirar uma coluna daqui quebra
 * aqui, e não três telas adiante.
 */

const EXIGIDAS = [
  "id",
  "date",
  "status",
  "sessionKind",      // devolutiva comum fica fora da sequência
  "abaterDoPacote",   // devolutiva marcada para ocupar posição
  "chargeable",       // devolutiva marcada para não cobrar
  "faltouConta",      // doc 45/54 — a que faltava em três telas
  "cortesia",         // doc 54
  "extra",            // avul/grat: fora da sequência
  "valorExtra",       // o valor da avulsa
  "repoeSessaoId",    // reposição ocupa vaga, não cria
] as const;

describe("colunas que o motor de cobranças precisa", () => {
  for (const coluna of EXIGIDAS) {
    it(`traz \`${coluna}\``, () => {
      expect(Object.keys(COLUNAS_DA_SESSAO)).toContain(coluna);
    });
  }

  it("a versão com paciente é a mesma, mais o dono da linha", () => {
    const chaves = Object.keys(COLUNAS_DA_SESSAO_COM_PACIENTE);
    expect(chaves).toContain("patientId");
    for (const c of Object.keys(COLUNAS_DA_SESSAO)) expect(chaves).toContain(c);
  });

  it("não sobra coluna sem motivo escrito: a lista exigida cobre tudo que existe", () => {
    // Se alguém acrescentar uma coluna sem documentá-la acima, este teste avisa — a lista é a
    // explicação de POR QUE cada dado atravessa até o motor.
    expect(Object.keys(COLUNAS_DA_SESSAO).sort()).toEqual([...EXIGIDAS].sort());
  });
});
