// Texto da mensagem de cobrança. Puro (sem "use server") — usado pela action e pelo cron.

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function cobrancaTexto(nome: string, valor: number, mesIdx: number, terapeuta: string): string {
  const primeiro = nome.split(" ")[0];
  const mes = MESES[mesIdx] ?? "";
  return `Olá, ${primeiro}! 🌿 Passando para lembrar do pagamento${mes ? ` referente a ${mes}` : ""}` +
    `${valor > 0 ? ` — valor em aberto de R$ ${valor.toFixed(2).replace(".", ",")}` : ""}.` +
    ` Qualquer dúvida, é só me chamar. Obrigado(a)! — ${terapeuta.split(" ")[0]}`;
}
