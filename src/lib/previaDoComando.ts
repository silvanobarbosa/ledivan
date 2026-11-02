import { comandoDaFala, type AcaoDaFala } from "./falaDoDiva";
import { pacienteDaFala, type PacienteConhecido } from "./pacienteDaFala";
import { diaDaFala, quandoDaFala } from "./quandoDaFala";
import { valorDaFala } from "./valorDaFala";

/**
 * A PRÉVIA: o que o Divã entendeu, antes de qualquer escrita.
 *
 * Esta função não grava nada e não decide por ninguém. Ela junta as três leituras — verbo,
 * paciente, quando — e devolve o que está ENTENDIDO e o que está FALTANDO. A tela mostra isso e
 * espera o toque; só então uma ação acontece.
 *
 * `faltando` é a parte mais importante do retorno. Um assistente que preenche as lacunas sozinho
 * acerta na maioria das vezes, e é na minoria que ele anota na paciente errada ou desmarca quem
 * não devia. Faltou, pergunta.
 *
 * Função pura: recebe a lista de pacientes e as sessões de quem chamou.
 */

export type SessaoParaCancelar = { id: string; quando: Date; rotulo?: string | null };

/** Uma cobrança em aberto do paciente, do mesmo motor que desenha a guia Geral. */
export type CobrancaParaPagar = { chave: string; vencimento: Date | null; falta: number; ano: number };

export type PreviaDoComando = {
  acao: AcaoDaFala;
  /** Resolvido, ou a lista para ela escolher, ou nada. */
  paciente:
    | { tipo: "um"; paciente: PacienteConhecido }
    | { tipo: "varios"; candidatos: PacienteConhecido[] }
    | { tipo: "nenhum" };
  /** Para reservar: data e hora. */
  quando: { iso: string; porExtenso: string } | null;
  /** Para anotar: o conteúdo. */
  texto: string;
  /** Para pagar: quanto ela disse, em reais. */
  valor: number | null;
  /** Para pagar: a forma, quando dita. `null` = a tela usa o padrão dela. */
  forma: string | null;
  /** Para pagar: a cobrança mais antiga em aberto — a que o lançamento vai abrir. */
  cobranca?: { chave: string; porExtenso: string; falta: number; ano: number } | null;
  /** Para cancelar: as sessões candidatas. Uma só = pronto; várias = ela escolhe. */
  sessoes?: { id: string; porExtenso: string }[];
  /** O que impede de executar. Vazio = pronto para ela confirmar. */
  faltando: string[];
};

const DIAS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const dois = (n: number) => String(n).padStart(2, "0");

export function sessaoPorExtenso(d: Date): string {
  return `${DIAS[d.getDay()]}, ${dois(d.getDate())}/${dois(d.getMonth() + 1)}, às ${dois(d.getHours())}h${d.getMinutes() ? dois(d.getMinutes()) : ""}`;
}

const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** A cobrança do jeito que ela reconhece: quando vence e quanto falta. */
export function cobrancaPorExtenso(c: CobrancaParaPagar): string {
  const quando = c.vencimento ? `vence em ${dois(c.vencimento.getDate())}/${dois(c.vencimento.getMonth() + 1)}` : "sem vencimento";
  return `${quando} · faltam ${reais(c.falta)}`;
}

export function previaDoComando(
  fala: string,
  pacientes: PacienteConhecido[],
  opts: {
    agora?: Date;
    sessoesDoPaciente?: (id: string) => SessaoParaCancelar[];
    cobrancasDoPaciente?: (id: string) => CobrancaParaPagar[];
  } = {},
): PreviaDoComando | null {
  const comando = comandoDaFala(fala);
  if (!comando) return null;
  const agora = opts.agora ?? new Date();

  /**
   * No pedido de PAGAMENTO, o dinheiro sai da frase ANTES de procurar o paciente.
   *
   * "lança 300 no pix da Talita" tem três coisas na mesma frase. Resolver o nome com "300" e
   * "pix" ainda dentro dele é dar ao `pacienteDaFala` palavras que não são nome nenhum.
   */
  const dinheiro = comando.acao === "pagar" ? valorDaFala(comando.resto) : null;
  const alvo = dinheiro ? dinheiro.resto : comando.alvo;

  const paciente = pacienteDaFala(alvo, pacientes);
  const faltando: string[] = [];
  if (paciente.tipo === "nenhum") faltando.push("Não reconheci o paciente.");
  if (paciente.tipo === "varios") faltando.push("Mais de um paciente com esse nome.");

  const previa: PreviaDoComando = {
    acao: comando.acao, paciente, quando: null, texto: "",
    valor: dinheiro?.valor ?? null, forma: dinheiro?.forma ?? null, faltando,
  };

  if (comando.acao === "anotar") {
    previa.texto = comando.resto;
    if (!comando.resto) faltando.push("Não entendi o que anotar. Diga, por exemplo: “anota na Marcela: dormiu melhor”.");
    return previa;
  }

  /**
   * PAGAR: o valor e a COBRANÇA que ele vai quitar, mostrados antes de a tela abrir.
   *
   * A cobrança escolhida é a **mais antiga em aberto** — a mesma ordem em que o motor encaixa
   * pagamento sem chave. Não é um chute escondido: ela aparece na prévia por extenso ("vence em
   * 10/10 · faltam R$ 300,00"), e o lançamento que abre é o daquela linha, que ela pode fechar e
   * escolher outra. Aqui nada é gravado.
   */
  if (comando.acao === "pagar") {
    if (previa.valor == null) {
      faltando.push("Não entendi o valor. Diga, por exemplo: “lança o pagamento da Marcela, 300 reais”.");
    }
    if (paciente.tipo === "um" && opts.cobrancasDoPaciente) {
      const abertas = opts.cobrancasDoPaciente(paciente.paciente.id)
        .filter((c) => c.falta > 0.005)
        .sort((a, b) => (a.vencimento?.getTime() ?? 0) - (b.vencimento?.getTime() ?? 0));
      const alvoDaCobranca = abertas[0];
      previa.cobranca = alvoDaCobranca
        ? {
            chave: alvoDaCobranca.chave,
            porExtenso: cobrancaPorExtenso(alvoDaCobranca),
            falta: alvoDaCobranca.falta,
            ano: alvoDaCobranca.ano,
          }
        : null;
      if (!alvoDaCobranca) faltando.push("Esse paciente não tem cobrança em aberto.");
    }
    return previa;
  }

  if (comando.acao === "reservar") {
    const q = quandoDaFala(comando.resto, agora);
    previa.quando = q ? { iso: q.quando.toISOString(), porExtenso: q.porExtenso } : null;
    if (!q) faltando.push("Não entendi o dia e a hora. Diga, por exemplo: “quinta às 16h”.");
    return previa;
  }

  // CANCELAR: o dia basta; a hora é opcional. Quem fecha a escolha são as sessões reais daquele dia.
  if (paciente.tipo === "um" && opts.sessoesDoPaciente) {
    const dia = diaDaFala(comando.resto, agora);
    const todas = opts.sessoesDoPaciente(paciente.paciente.id);
    const doDia = dia
      ? todas.filter((s) => s.quando.getFullYear() === dia.getFullYear() && s.quando.getMonth() === dia.getMonth() && s.quando.getDate() === dia.getDate())
      : todas.filter((s) => s.quando.getTime() >= agora.getTime());

    const candidatas = (dia ? doDia : doDia.slice(0, 1)).map((s) => ({ id: s.id, porExtenso: sessaoPorExtenso(s.quando) }));
    previa.sessoes = candidatas;
    if (!candidatas.length) faltando.push(dia ? "Não achei atendimento desse paciente nesse dia." : "Não achei um próximo atendimento desse paciente.");
    else if (candidatas.length > 1) faltando.push("Mais de um atendimento nesse dia.");
  }
  return previa;
}
