import { comandoDaFala, type AcaoDaFala } from "./falaDoDiva";
import { pacienteDaFala, type PacienteConhecido } from "./pacienteDaFala";
import { diaDaFala, quandoDaFala } from "./quandoDaFala";

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

export function previaDoComando(
  fala: string,
  pacientes: PacienteConhecido[],
  opts: { agora?: Date; sessoesDoPaciente?: (id: string) => SessaoParaCancelar[] } = {},
): PreviaDoComando | null {
  const comando = comandoDaFala(fala);
  if (!comando) return null;
  const agora = opts.agora ?? new Date();

  const paciente = pacienteDaFala(comando.alvo, pacientes);
  const faltando: string[] = [];
  if (paciente.tipo === "nenhum") faltando.push("Não reconheci o paciente.");
  if (paciente.tipo === "varios") faltando.push("Mais de um paciente com esse nome.");

  const previa: PreviaDoComando = { acao: comando.acao, paciente, quando: null, texto: "", faltando };

  if (comando.acao === "anotar") {
    previa.texto = comando.resto;
    if (!comando.resto) faltando.push("Não entendi o que anotar. Diga, por exemplo: “anota na Marcela: dormiu melhor”.");
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
