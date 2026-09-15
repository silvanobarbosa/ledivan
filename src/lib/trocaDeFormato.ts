/**
 * O QUE GRAVAR QUANDO O FORMATO DE PAGAMENTO MUDA NO CADASTRO.
 *
 * O formulário manda o formato novo e, quando ele mudou, a data a partir da qual vale (regra do
 * dono, 15/09/2026). Esta função decide as linhas de `patient_payment_format_history` — e só isso.
 *
 * Três cuidados:
 *
 * 1. **Não mudou, não grava.** Salvar o cadastro por outro motivo (telefone, escola) não pode abrir
 *    período novo: um período novo reinicia a sequência do pacote.
 * 2. **Tipo de pacote só conta onde existe pacote.** "A cada sessão" com `pacote_tipo = completo`
 *    esquecido no banco não é troca nenhuma.
 * 3. **Paciente sem histórico ganha o formato ANTIGO primeiro.** Sem isso, a única linha seria a
 *    nova — e, como o primeiro período vale para trás, o formato novo tomaria a história inteira,
 *    que é exatamente o defeito que a vigência veio corrigir.
 *
 * Função pura.
 */

import { usaPacote } from "./reajuste";

export type FormatoComPacote = { formato: string | null | undefined; pacoteTipo?: string | null };

export type LinhaDeVigencia = { formato: string; pacoteTipo: string | null; dataEfetiva: Date };

const normaliza = (f: FormatoComPacote) => ({
  formato: f.formato || "sessao",
  pacoteTipo: usaPacote(f.formato) ? (f.pacoteTipo === "fragmentado" ? "fragmentado" : "completo") : null,
});

/** `AAAA-MM-DD` do `<input type="date">` → meia-noite daquele dia. Qualquer outra coisa → null. */
export function diaDoFormulario(valor: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((valor ?? "").trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 ? d : null; // 31/02 não vira 03/03
}

export function formatoMudou(anterior: FormatoComPacote, novo: FormatoComPacote): boolean {
  const a = normaliza(anterior);
  const b = normaliza(novo);
  return a.formato !== b.formato || a.pacoteTipo !== b.pacoteTipo;
}

export function vigenciasAGravar(opts: {
  anterior: FormatoComPacote;
  novo: FormatoComPacote;
  /** O "vale a partir de" do formulário. Vazio = hoje. */
  desde: string | null | undefined;
  hoje: Date;
  /** O paciente já tem alguma linha de vigência? */
  jaTemHistorico: boolean;
  /** Início do tratamento (ou criação do cadastro): de onde vale o formato antigo. */
  inicioDoPaciente: Date | null | undefined;
}): LinhaDeVigencia[] {
  if (!formatoMudou(opts.anterior, opts.novo)) return [];

  const hojeDia = new Date(opts.hoje.getFullYear(), opts.hoje.getMonth(), opts.hoje.getDate());
  const aPartirDe = diaDoFormulario(opts.desde) ?? hojeDia;
  const linhas: LinhaDeVigencia[] = [];

  if (!opts.jaTemHistorico) {
    const antigo = normaliza(opts.anterior);
    const i = opts.inicioDoPaciente;
    const desdeAntigo = i ? new Date(i.getFullYear(), i.getMonth(), i.getDate()) : aPartirDe;
    // Formato antigo começando DEPOIS da troca não faz sentido: cola na véspera dela.
    linhas.push({ ...antigo, dataEfetiva: desdeAntigo.getTime() < aPartirDe.getTime() ? desdeAntigo : new Date(aPartirDe.getTime() - 86_400_000) });
  }

  linhas.push({ ...normaliza(opts.novo), dataEfetiva: aPartirDe });
  return linhas;
}

/**
 * De quando vale o PREÇO novo.
 *
 * Defeito achado no percurso real (15/09/2026), não em teste unitário: o paciente saía de gratuito
 * para "a cada sessão" valendo a partir de 01/09, mas o preço novo nascia com a data de HOJE (15/09).
 * As sessões de 01 e 08/09 já eram do formato pago e ainda do preço antigo — R$ 0 —, e a Fechamento
 * mostrava o paciente "quitado" devendo R$ 400.
 *
 * Então: data explícita do preço, se o formulário mandar; senão, se o formato também mudou, a data
 * da troca; senão, hoje.
 */
export function dataDoPreco(opts: {
  dataEfetiva: string | null | undefined;
  formatoMudou: boolean;
  formatoDesde: string | null | undefined;
  hoje: Date;
}): Date {
  const explicita = opts.dataEfetiva ? new Date(opts.dataEfetiva) : null;
  if (explicita && !Number.isNaN(explicita.getTime())) return explicita;
  if (opts.formatoMudou) {
    const d = diaDoFormulario(opts.formatoDesde);
    if (d) return d;
  }
  return opts.hoje;
}
