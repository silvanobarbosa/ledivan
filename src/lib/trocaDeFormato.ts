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
  const hojeDia = new Date(opts.hoje.getFullYear(), opts.hoje.getMonth(), opts.hoje.getDate());
  const aPartirDe = diaDoFormulario(opts.desde) ?? hojeDia;
  const diaDoInicio = () => {
    const i = opts.inicioDoPaciente;
    return i ? new Date(i.getFullYear(), i.getMonth(), i.getDate()) : aPartirDe;
  };

  /**
   * PRIMEIRO cadastro financeiro (doc 18): não existe modalidade anterior REAL. "Não definido"
   * (null/"") é o estado de quem salvou só os Dados — NÃO é "Avulso". Aqui o sistema gravava uma
   * linha-base fictícia de Avulso antes da escolhida, e o histórico mostrava "Avulso → Gratuito"
   * de uma troca que nunca aconteceu. Correto: gravar SÓ a modalidade escolhida, como ENTRADA.
   */
  const temPriorReal = !!(opts.anterior.formato && String(opts.anterior.formato).trim());
  const novoReal = !!(opts.novo.formato && String(opts.novo.formato).trim());
  if (!opts.jaTemHistorico && !temPriorReal) {
    if (!novoReal) return []; // nada de financeiro definido ainda → nada a gravar
    // A escolhida vale desde o início do paciente (cobre a história inteira). Uma linha só, sem
    // "anterior → nova". Vale inclusive quando a escolhida é Avulso.
    return [{ ...normaliza(opts.novo), dataEfetiva: diaDoInicio() }];
  }

  if (!formatoMudou(opts.anterior, opts.novo)) return [];

  const linhas: LinhaDeVigencia[] = [];
  if (!opts.jaTemHistorico) {
    // Tem modalidade anterior REAL mas nenhuma linha ainda (legado): grava o antigo como base.
    const antigo = normaliza(opts.anterior);
    const desdeAntigo = diaDoInicio();
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
  // A data escolhida é AAAA-MM-DD do <input type="date"> — tem de ser lida como meia-noite LOCAL
  // (via diaDoFormulario), não `new Date(string)`, que o JS trata como UTC e em fuso negativo joga
  // para o dia anterior ao salvar/exibir (doc 25, pág 2). Ver [[licao-meia-noite-vira-dia-anterior]].
  const explicita = diaDoFormulario(opts.dataEfetiva);
  if (explicita) return explicita;
  // Doc 22: "Vale a partir de" (formatoDesde) manda sempre que preenchido — não só quando o formato
  // muda. O campo passou a aparecer para QUALQUER alteração financeira (doc 21), e a data escolhida
  // tem de ser a data efetiva do preço, inclusive no histórico. `formatoMudou` já não decide isto.
  const d = diaDoFormulario(opts.formatoDesde);
  if (d) return d;
  return opts.hoje;
}
