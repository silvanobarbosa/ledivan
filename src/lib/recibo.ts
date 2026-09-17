/**
 * O TEXTO DO RECIBO — o documento que a terapeuta entrega ao paciente.
 *
 * Tudo aqui é função pura, e existe separado da tela por dois motivos: é texto que sai do
 * consultório com o nome e o CPF de duas pessoas, e é a única parte do fluxo de pagamento que dá
 * para provar sem banco.
 *
 * A palavra que descreve o atendimento muda conforme a formação da terapeuta, e isso não é
 * enfeite: "atendimentos psicológicos" num recibo de quem não é psicóloga é declaração errada num
 * documento fiscal. Por isso a escolha mora nos Ajustes dela, e não numa suposição do app.
 */

export type DescricaoAtendimento = "terapia" | "psicanalise" | "psicologia";

/** O que cada formação escreve no recibo. O padrão é o texto que o documento do dono trouxe. */
const COMO_SE_ESCREVE: Record<DescricaoAtendimento, string> = {
  terapia: "atendimentos terapêuticos",
  psicanalise: "atendimentos psicanalíticos",
  psicologia: "atendimentos psicológicos",
};

export const DESCRICOES: { valor: DescricaoAtendimento; rotulo: string }[] = [
  { valor: "terapia", rotulo: "Terapia" },
  { valor: "psicanalise", rotulo: "Psicanálise" },
  { valor: "psicologia", rotulo: "Psicologia" },
];

export function descricaoValida(v: string | null | undefined): DescricaoAtendimento {
  return v === "psicanalise" || v === "psicologia" ? v : "terapia";
}

export type DadosDoRecibo = {
  responsavel: string;
  responsavelCpf?: string | null;
  paciente: string;
  /** As datas das sessões que ESTE pagamento cobre, na ordem em que aconteceram. */
  datas: Date[];
  valorTotal: number;
  dataPagamento: Date;
  terapeuta: string;
  terapeutaCpf?: string | null;
  descricao: DescricaoAtendimento;
};

const dois = (n: number) => String(n).padStart(2, "0");

/** `14/09/2026` — sem passar por `toLocaleDateString`, que já fez data andar um dia neste app. */
export function dataBR(d: Date): string {
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** `R$ 520,00` */
export function valorBR(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const UNIDADES = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez",
  "onze", "doze", "treze", "catorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos",
  "setecentos", "oitocentos", "novecentos"];

/**
 * O valor por extenso, como manda o recibo: "quinhentos e vinte reais".
 *
 * Vai até 999.999,99 — acima disso um recibo de consultório vira outra conversa, e escrever o que
 * não se vai usar é código que envelhece sem ninguém olhar.
 */
export function porExtenso(valor: number): string {
  const centavos = Math.round((valor - Math.floor(valor)) * 100);
  const inteiro = Math.floor(valor);

  const ate999 = (n: number): string => {
    if (n === 0) return "";
    if (n === 100) return "cem";
    const c = Math.floor(n / 100);
    const resto = n % 100;
    const partes: string[] = [];
    if (c) partes.push(CENTENAS[c]);
    if (resto) {
      if (resto < 20) partes.push(UNIDADES[resto]);
      else {
        const d = Math.floor(resto / 10);
        const u = resto % 10;
        partes.push(u ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d]);
      }
    }
    return partes.join(" e ");
  };

  const escreveInteiro = (n: number): string => {
    if (n === 0) return "zero";
    const milhares = Math.floor(n / 1000);
    const resto = n % 1000;
    if (!milhares) return ate999(resto);
    const inicio = milhares === 1 ? "mil" : `${ate999(milhares)} mil`;
    if (!resto) return inicio;
    // "mil e duzentos", mas "mil duzentos e cinquenta" — a conjunção só entra quando o resto é
    // redondo ou menor que cem, que é como se fala.
    return `${inicio}${resto < 100 || resto % 100 === 0 ? " e " : " "}${ate999(resto)}`;
  };

  const reais = `${escreveInteiro(inteiro)} ${inteiro === 1 ? "real" : "reais"}`;
  if (!centavos) return reais;
  const cent = `${escreveInteiro(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`;
  return `${reais} e ${cent}`;
}

/**
 * Só os dígitos de um CPF, ou `null` quando não sobrou nada.
 *
 * O banco guarda sem pontuação: cada pessoa digita de um jeito, e o recibo não pode herdar isso.
 * Guardar limpo e formatar na saída mantém uma forma só no papel.
 */
export function apenasCpf(v: string | null | undefined): string | null {
  return String(v ?? "").replace(/\D/g, "").slice(0, 11) || null;
}

/** CPF no formato do papel. Número incompleto sai como veio — não se inventa dígito num recibo. */
export function cpfBR(v: string | null | undefined): string {
  const d = apenasCpf(v);
  if (!d) return "";
  if (d.length !== 11) return d;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/**
 * O recibo inteiro, pronto para a tela e para o papel.
 *
 * O CPF do responsável só aparece quando informado — o documento do dono diz "CPF, se informado", e
 * escrever "CPF: —" num recibo é pior do que não escrever nada.
 */
export function montarRecibo(d: DadosDoRecibo): string {
  const cpfResp = cpfBR(d.responsavelCpf) ? `, CPF ${cpfBR(d.responsavelCpf)}` : "";
  const datas = d.datas.map((x) => `- ${dataBR(x)}`).join("\n");
  const cpfTerapeuta = cpfBR(d.terapeutaCpf) ? `\nCPF: ${cpfBR(d.terapeutaCpf)}` : "";

  return [
    "RECIBO DE PAGAMENTO",
    "",
    `Recebi de ${d.responsavel}${cpfResp}, o valor de ${valorBR(d.valorTotal)} (${porExtenso(d.valorTotal)}), ` +
      `referente aos ${COMO_SE_ESCREVE[d.descricao]} realizados para ${d.paciente}, nas seguintes datas:`,
    "",
    datas,
    "",
    `Data do pagamento: ${dataBR(d.dataPagamento)}.`,
    "",
    `Terapeuta: ${d.terapeuta}${cpfTerapeuta}`,
  ].join("\n");
}
