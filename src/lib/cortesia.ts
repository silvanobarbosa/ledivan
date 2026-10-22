/**
 * QUANDO A CORTESIA É OFERECIDA (doc 54, item 03).
 *
 * "Este atendimento será uma cortesia" aparece no editar agendamento, acima da data e hora, em
 * **financeiro Mensal ou Quinzenal com modalidade Pacote completo**. É um recorte estreito, e de
 * propósito: a cortesia existe para abrir uma vaga dentro de uma sequência numerada — a sessão
 * deixa de ocupar posição e a seguinte assume o número dela.
 *
 * Fora do pacote a pergunta não teria o que responder. Quem paga a cada sessão já decide sessão a
 * sessão (a pergunta dele é outra, a do Faltou); quem é gratuito não paga nada para ser dispensado
 * de pagar; e o fracionado não tem sequência fechada em que abrir vaga — o mês é a unidade dele.
 *
 * Devolutiva fica de fora porque ela já tem a escolha dela ("abater do pacote?"), e as duas juntas
 * na mesma tela seriam duas perguntas disputando a mesma decisão.
 *
 * Função pura.
 */

/** `pacoteTipo` vazio é o pacote COMPLETO — é o padrão do cadastro, como no motor de cobranças. */
const completo = (pacoteTipo?: string | null) => String(pacoteTipo ?? "").trim().toLowerCase() !== "fragmentado";

const FORMATOS = new Set(["mensal", "quinzenal"]);

export function podeSerCortesia(o: {
  /** O formato VIGENTE NA DATA da sessão, não o do cadastro de hoje. */
  formato?: string | null;
  pacoteTipo?: string | null;
  sessionKind?: string | null;
  /** `avul`/`grat` = sessão extra, que já acontece FORA da sequência. */
  extra?: string | null;
}): boolean {
  /**
   * Sessão EXTRA já está fora da sequência (doc 54 + achado do SuperQA de 22/10).
   *
   * A cortesia serve para abrir uma vaga DENTRO da numeração. Numa extra não há vaga a abrir: a
   * avulsa continua sendo cobrada pelo caminho das extras e a gratuita já não cobra nada. O
   * checkbox aparecia nas duas e não fazia efeito nenhum — oferecer uma escolha que não muda nada
   * é pior do que não oferecer, porque quem marcou acha que resolveu.
   */
  if (o.extra === "avul" || o.extra === "grat") return false;
  if (o.sessionKind === "devolutiva") return false;
  if (!FORMATOS.has(String(o.formato ?? "").trim().toLowerCase())) return false;
  return completo(o.pacoteTipo);
}
