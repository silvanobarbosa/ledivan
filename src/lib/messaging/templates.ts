// Templates das mensagens ao paciente, por evento. Corpo em texto (WhatsApp/Telegram);
// o adapter de e-mail embrulha em HTML. Sem dependência de servidor (puro).
export type MsgEvent =
  | "session_reminder"
  | "session_confirmed"
  | "session_canceled"
  | "payment_received"
  | "reactivation"
  | "custom";

export type TemplateVars = {
  patientName: string;
  therapistName?: string;
  when?: string;          // data/hora já formatada
  isOnline?: boolean;
  meetingLink?: string;
  amount?: string;        // "R$ 150,00"
  text?: string;          // corpo livre p/ event "custom"
};

export function renderTemplate(event: MsgEvent, v: TemplateVars): { subject: string; body: string } {
  const nome = v.patientName;
  const ass = v.therapistName ? `\n\n${v.therapistName}` : "";
  switch (event) {
    case "session_reminder": {
      let body = `Olá, ${nome}! 🌿\nLembrete da sua sessão: *${v.when}*.`;
      if (v.isOnline && v.meetingLink) body += `\n\nAtendimento online — entre por aqui no horário:\n${v.meetingLink}`;
      body += `\n\nAté lá!${ass}`;
      return { subject: "Lembrete da sua sessão", body };
    }
    case "session_confirmed":
      return { subject: "Sessão confirmada", body: `Olá, ${nome}! ✅\nSua sessão *${v.when}* está confirmada.${v.isOnline && v.meetingLink ? `\n\nLink: ${v.meetingLink}` : ""}${ass}` };
    case "session_canceled":
      return { subject: "Sessão cancelada", body: `Olá, ${nome}.\nSua sessão de *${v.when}* foi cancelada. Qualquer coisa, é só falar comigo pra reagendarmos.${ass}` };
    case "payment_received":
      return { subject: "Pagamento recebido", body: `Olá, ${nome}! 🌿\nRecebi seu pagamento${v.amount ? ` de *${v.amount}*` : ""}. Obrigado!${ass}` };
    case "reactivation":
      return { subject: "Que tal retomarmos?", body: `Olá, ${nome}! 🌿\nFaz um tempinho desde a nossa última sessão. Se quiser retomar, estou por aqui — é só me chamar.${ass}` };
    case "custom":
    default:
      return { subject: "Mensagem", body: `${v.text ?? ""}${ass}` };
  }
}
