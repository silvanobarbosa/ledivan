/**
 * DITADO POR CAMPO — a fala da terapeuta virando texto de prontuário (doc 76).
 *
 * Ela segura o microfone do campo, fala, solta. O que ela disse vira um texto redigido em
 * linguagem profissional, no campo CERTO — e nunca no campo ao lado.
 *
 * Três decisões que moram aqui porque são regra, não tela:
 *
 * 1. **Cada campo tem seu prompt.** Um título é uma linha; um registro de sessão é um parágrafo
 *    de evolução; uma resposta de anamnese é o relato organizado de um item específico. O mesmo
 *    prompt para os três produzia título com três frases e evolução com uma só.
 * 2. **O modelo organiza, não interpreta.** Ele não pode acrescentar hipótese diagnóstica,
 *    conduta ou qualquer fato que não tenha sido dito. Prontuário é documento legal: inventar uma
 *    frase plausível ali é pior do que não escrever nada, porque ninguém revisa o que parece
 *    certo. A instrução é explícita e repetida nos três.
 * 3. **O texto ditado chega como BLOCO DATADO.** O doc 76 pede, nos itens 7 e 8, que uma gravação
 *    nova não apague a anterior e que cada uma guarde data e hora. Acrescentar um bloco com
 *    carimbo resolve isso sem inventar uma tabela de histórico — e deixa a terapeuta continuar
 *    editando o campo inteiro à mão, como sempre fez.
 *
 * Funções puras. Quem fala com o provedor é a rota.
 */

export type CampoDoDitado = "titulo" | "registro" | "anamnese";

const COMUM = [
  "Você organiza a fala de um(a) psicólogo(a) em texto de prontuário, em português do Brasil.",
  "NUNCA acrescente informação que não foi dita: nada de hipótese diagnóstica, conduta, data,",
  "nome ou sintoma que não esteja na fala. Se a fala estiver confusa ou incompleta, escreva só o",
  "que dá para afirmar. Não comente, não explique, não use aspas: responda apenas com o texto",
  "final, pronto para entrar no prontuário.",
].join(" ");

/** A instrução do modelo para cada campo. */
export function promptDoCampo(campo: CampoDoDitado, rotulo?: string): string {
  if (campo === "titulo") {
    return `${COMUM} Produza um TÍTULO curto para este registro: uma linha, no máximo 8 palavras, sem ponto final.`;
  }
  if (campo === "anamnese") {
    const qual = rotulo?.trim() ? ` do item "${rotulo.trim()}"` : "";
    return `${COMUM} Organize a fala como a resposta${qual} de uma anamnese: texto corrido, impessoal, técnico e sóbrio. Mantenha a ordem em que os fatos foram ditos.`;
  }
  return `${COMUM} Organize a fala como a EVOLUÇÃO de uma sessão de psicoterapia: texto corrido em parágrafos, impessoal e técnico, preservando o sentido do relato. Refira-se ao paciente como "o paciente" ou "a paciente" se o gênero estiver claro na fala; caso contrário, use "o(a) paciente".`;
}

/** Quanto texto o modelo pode devolver em cada campo. Título curto é título curto. */
export function tetoDoCampo(campo: CampoDoDitado): number {
  return campo === "titulo" ? 120 : 4000;
}

/**
 * Limpa o que o modelo costuma devolver por hábito: aspas em volta, rótulo na frente
 * ("Título:", "Evolução:"), e quebras sobrando. Em título, também o ponto final.
 */
export function textoLimpo(bruto: string, campo: CampoDoDitado): string {
  let t = (bruto ?? "").trim();
  t = t.replace(/^(t[íi]tulo|evolu[çc][ãa]o|resposta|texto)\s*:\s*/i, "");
  t = t.replace(/^["'“”]+|["'“”]+$/g, "").trim();
  t = t.replace(/\n{3,}/g, "\n\n");
  if (campo === "titulo") t = t.split("\n")[0].replace(/[.;]+$/, "").trim();
  return t.slice(0, tetoDoCampo(campo));
}

const DOIS = (n: number) => String(n).padStart(2, "0");

/** O carimbo de um bloco ditado: `[12/11/2026 14:35]`. */
export function carimbo(quando: Date): string {
  return `[${DOIS(quando.getDate())}/${DOIS(quando.getMonth() + 1)}/${quando.getFullYear()} ${DOIS(quando.getHours())}:${DOIS(quando.getMinutes())}]`;
}

/**
 * ACRESCENTA o texto ditado ao que já existe, com data e hora — nunca substitui.
 *
 * Campo vazio recebe o bloco sozinho. Campo com conteúdo recebe o bloco DEPOIS, separado por uma
 * linha em branco, porque o doc pede histórico cronológico e cronológico é de cima para baixo no
 * que já está escrito à mão.
 */
export function acrescentaDitado(atual: string | null | undefined, novo: string, quando: Date): string {
  const texto = (novo ?? "").trim();
  if (!texto) return (atual ?? "").trim();
  const bloco = `${carimbo(quando)} ${texto}`;
  const antes = (atual ?? "").trim();
  return antes ? `${antes}\n\n${bloco}` : bloco;
}
