/**
 * O aviso de pagamento da sessão — e o que acontece quando o pagamento não vem.
 *
 * Regra do dono, dita por ele em uma frase: é UMA mensagem para o paciente, e nada mais. Não
 * existe ação automática. Se o pagamento não vier, a sessão fica marcada como PAGAMENTO ATRASADO
 * e quem decide é o profissional: atende assim mesmo, ou cancela a sessão. O sistema não cancela,
 * não bloqueia e não manda segunda cobrança.
 *
 * Vale só para quem paga "a cada sessão" e tem o "pagar até" preenchido — em horas antes do
 * atendimento.
 *
 * Tudo aqui é função pura: decide, não grava e não envia.
 */

/** Até quando o pagamento pode ser feito. `null` quando o combinado não tem prazo. */
export function prazoDoPagamento(dataSessao: Date | string, horasAntes: number | null | undefined): Date | null {
  if (!horasAntes || horasAntes <= 0) return null;
  const d = dataSessao instanceof Date ? dataSessao : new Date(dataSessao);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() - horasAntes * 60 * 60 * 1000);
}

/**
 * Manda o aviso agora?
 *
 * Sim quando o prazo já está à vista e a mensagem ainda não foi enviada. O `intervaloMin` é o
 * espaço entre duas rodadas do cron (um dia, por padrão): se a próxima rodada só acontecer depois
 * do prazo, o aviso sai agora — senão o paciente receberia o lembrete quando já não desse tempo.
 */
export function deveAvisar(opts: {
  agora: Date;
  dataSessao: Date | string;
  horasAntes: number | null | undefined;
  jaAvisado: boolean;
  pago: boolean;
  intervaloMin?: number;
}): boolean {
  if (opts.jaAvisado || opts.pago) return false;
  const prazo = prazoDoPagamento(opts.dataSessao, opts.horasAntes);
  if (!prazo) return false;

  const sessao = opts.dataSessao instanceof Date ? opts.dataSessao : new Date(opts.dataSessao);
  if (sessao.getTime() <= opts.agora.getTime()) return false; // sessão já passou: não se cobra antes do que já foi

  const minutosAteOPrazo = (prazo.getTime() - opts.agora.getTime()) / 60000;
  const intervalo = opts.intervaloMin ?? 1440;
  return minutosAteOPrazo <= intervalo;
}

/**
 * A sessão está com pagamento atrasado?
 *
 * Atrasado é só isto: o prazo passou e o pagamento não entrou. Serve para a agenda avisar o
 * profissional — não muda o status da sessão nem impede nada.
 */
export function pagamentoAtrasado(opts: {
  agora: Date;
  dataSessao: Date | string;
  horasAntes: number | null | undefined;
  pago: boolean;
  status?: string;
}): boolean {
  if (opts.pago) return false;
  if (opts.status && ["cancelada", "realocada", "falta"].includes(opts.status)) return false;
  const prazo = prazoDoPagamento(opts.dataSessao, opts.horasAntes);
  if (!prazo) return false;
  return opts.agora.getTime() > prazo.getTime();
}

const dia = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const hora = (d: Date) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/**
 * A mensagem. Uma só, e sem ameaça: o combinado é lembrar, não pressionar.
 *
 * Não promete cancelamento nem fala em consequência, porque não existe nenhuma automática — se
 * o profissional decidir não atender, ele cancela a sessão e o paciente é avisado por ali.
 */
export function avisoPagamentoTexto(
  nomePaciente: string,
  valor: number,
  dataSessao: Date | string,
  prazo: Date,
  terapeuta: string,
): string {
  const primeiro = (nomePaciente || "").split(" ")[0] || "Olá";
  const d = dataSessao instanceof Date ? dataSessao : new Date(dataSessao);
  const quanto = valor > 0 ? ` de R$ ${valor.toFixed(2).replace(".", ",")}` : "";
  return (
    `Olá, ${primeiro}! 🌿 Sua sessão é dia ${dia(d)} às ${hora(d)}. ` +
    `O pagamento${quanto} pode ser feito até ${dia(prazo)} às ${hora(prazo)}. ` +
    `Qualquer dúvida, é só me chamar. — ${(terapeuta || "").split(" ")[0] || "Seu terapeuta"}`
  );
}
