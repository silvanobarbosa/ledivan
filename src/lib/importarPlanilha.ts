/**
 * A PLANILHA PADRÃO DE IMPORTAÇÃO — o que ela tem, e o que vale em cada coluna.
 *
 * Quem chega de outro sistema chega com uma lista: os pacientes, a agenda e o que já foi pago.
 * Digitar tudo de novo é o que faz uma terapeuta desistir na primeira semana. Este arquivo é o
 * contrato dessa planilha, e ele é um só: o MODELO que o app oferece para baixar e o LEITOR que
 * confere o que voltou saem daqui. Dois lugares diferentes divergiriam, e o sintoma seria a
 * planilha que o próprio app entregou vindo recusada.
 *
 * Nada aqui escreve: este módulo lê, normaliza e ACUSA. A gravação é de quem chama, e só depois
 * de a terapeuta confirmar o que viu.
 *
 * Funções puras.
 */

export type Aba = "Pacientes" | "Agenda" | "Pagamentos";

export type Coluna = {
  /** O cabeçalho que vai na planilha — é por ele que a coluna é encontrada na volta. */
  chave: string;
  /** O que a terapeuta lê na linha de ajuda da planilha. */
  ajuda: string;
  obrigatoria?: boolean;
  /** Quando a coluna só aceita um conjunto fechado, ele vai escrito na ajuda e é conferido aqui. */
  opcoes?: readonly string[];
};

export const FORMATOS = ["a cada sessão", "mensal", "quinzenal", "1ª do pacote", "última do pacote", "gratuito"] as const;
export const PACOTES = ["completo", "fragmentado"] as const;
export const STATUS = ["agendada", "realizada", "não realizada", "cancelada", "profissional desmarcou", "atestado"] as const;
export const MODALIDADES = ["presencial", "online"] as const;
export const FORMAS = ["pix", "dinheiro", "débito", "crédito", "transferência"] as const;

/** O formato como a terapeuta escreve → o valor que o banco guarda. */
const FORMATO_NO_BANCO: Record<string, string> = {
  "a cada sessão": "sessao", mensal: "mensal", quinzenal: "quinzenal",
  "1ª do pacote": "primeira_pacote", "última do pacote": "ultima_pacote", gratuito: "gratuito",
};
const STATUS_NO_BANCO: Record<string, string> = {
  agendada: "agendada", realizada: "realizada", "não realizada": "nao_realizada",
  cancelada: "cancelada", "profissional desmarcou": "prof_desmarcou", atestado: "atestado",
};
const FORMA_NO_BANCO: Record<string, string> = {
  pix: "pix", dinheiro: "cash", "débito": "debito", "crédito": "credito", "transferência": "transfer",
};

export const COLUNAS: Record<Aba, readonly Coluna[]> = {
  Pacientes: [
    { chave: "nome", ajuda: "Nome completo", obrigatoria: true },
    { chave: "nascimento", ajuda: "dd/mm/aaaa" },
    { chave: "cpf", ajuda: "Só números ou com pontuação" },
    { chave: "telefone", ajuda: "Com DDD" },
    { chave: "email", ajuda: "E-mail do paciente" },
    { chave: "responsavel", ajuda: "Nome de quem responde pelo paciente" },
    { chave: "responsavel_telefone", ajuda: "Com DDD" },
    { chave: "formato_pagamento", ajuda: "Como ele paga", obrigatoria: true, opcoes: FORMATOS },
    { chave: "pacote_tipo", ajuda: "Só nos formatos de pacote", opcoes: PACOTES },
    { chave: "valor_sessao", ajuda: "Ex.: 150,00" },
    { chave: "sessoes_no_pacote", ajuda: "Quantas sessões fecham o pacote" },
    { chave: "dia_vencimento", ajuda: "Dia do mês, de 1 a 31" },
    { chave: "inicio", ajuda: "Início do tratamento, dd/mm/aaaa" },
  ],
  Agenda: [
    { chave: "paciente", ajuda: "Nome igual ao da aba Pacientes", obrigatoria: true },
    { chave: "data", ajuda: "dd/mm/aaaa", obrigatoria: true },
    { chave: "hora", ajuda: "hh:mm", obrigatoria: true },
    { chave: "duracao", ajuda: "Em minutos (vazio = 50)" },
    { chave: "status", ajuda: "O que aconteceu", opcoes: STATUS },
    { chave: "modalidade", ajuda: "Presencial ou online", opcoes: MODALIDADES },
  ],
  Pagamentos: [
    { chave: "paciente", ajuda: "Nome igual ao da aba Pacientes", obrigatoria: true },
    { chave: "data", ajuda: "dd/mm/aaaa", obrigatoria: true },
    { chave: "valor", ajuda: "Ex.: 600,00", obrigatoria: true },
    { chave: "forma", ajuda: "Como entrou", opcoes: FORMAS },
    { chave: "pago_por", ajuda: "Quem pagou (vazio = o próprio paciente)" },
  ],
};

export const ABAS: readonly Aba[] = ["Pacientes", "Agenda", "Pagamentos"];

/** Teto por aba. Planilha maior que isto não é migração, é outra coisa — e merece uma conversa. */
export const TETO_DE_LINHAS = 2000;

// ───────────────────────── normalização ─────────────────────────

const texto = (v: unknown): string => String(v ?? "").trim();

/** Compara nome e opção ignorando caixa, acento e espaço sobrando. */
export function igual(a: unknown, b: unknown): boolean {
  const limpa = (v: unknown) => texto(v).toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, " ");
  return !!limpa(a) && limpa(a) === limpa(b);
}

/**
 * A DATA, nas três formas em que ela chega.
 *
 * `dd/mm/aaaa` é o que a terapeuta digita. ISO é o que sai de exportação de sistema. E NÚMERO é o
 * que o Excel guarda quando a célula está formatada como data — quem lê a planilha recebe 45678,
 * não "15/01/2025", e é esse o caso que passa despercebido até alguém importar um ano errado.
 */
export function comoData(v: unknown): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : new Date(v.getFullYear(), v.getMonth(), v.getDate());
  const t = texto(v);
  if (!t) return null;

  const br = t.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (br) {
    const [, d, m, a] = br;
    const ano = a.length === 2 ? 2000 + Number(a) : Number(a);
    const data = new Date(ano, Number(m) - 1, Number(d));
    return data.getMonth() === Number(m) - 1 && data.getDate() === Number(d) ? data : null;
  }

  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const data = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(data.getTime()) ? null : data;
  }

  // Serial do Excel: dias desde 30/12/1899. Fora de uma faixa plausível, é outra coisa.
  const n = Number(t.replace(",", "."));
  if (Number.isFinite(n) && n > 20000 && n < 80000) {
    const base = Date.UTC(1899, 11, 30) + Math.floor(n) * 86400000;
    const d = new Date(base);
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  return null;
}

/** `hh:mm` (aceita `h:mm`, `hh.mm` e a fração de dia que o Excel usa para hora). */
export function comoHora(v: unknown): { h: number; m: number } | null {
  const t = texto(v);
  if (!t) return null;
  const hm = t.match(/^(\d{1,2})[:h.](\d{2})/i);
  if (hm) {
    const h = Number(hm[1]), m = Number(hm[2]);
    return h >= 0 && h < 24 && m >= 0 && m < 60 ? { h, m } : null;
  }
  const fr = Number(t.replace(",", "."));
  if (Number.isFinite(fr) && fr >= 0 && fr < 1) {
    const min = Math.round(fr * 24 * 60);
    return { h: Math.floor(min / 60), m: min % 60 };
  }
  return null;
}

/** Dinheiro em pt-BR ou cru. `null` quando não é número. */
export function comoDinheiro(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
  const t = texto(v).replace(/r\$/i, "").trim();
  if (!t) return null;
  // "1.234,56" → "1234.56"; "1234.56" fica como está.
  const normal = /,\d{1,2}$/.test(t) ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  const n = Number(normal);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/** A opção escrita pela terapeuta, devolvida na grafia do catálogo. `null` se não for nenhuma. */
export function comoOpcao(v: unknown, opcoes: readonly string[]): string | null {
  const achada = opcoes.find((o) => igual(o, v));
  return achada ?? null;
}

export const formatoNoBanco = (rotulo: string): string | null => FORMATO_NO_BANCO[rotulo] ?? null;
export const statusNoBanco = (rotulo: string): string | null => STATUS_NO_BANCO[rotulo] ?? null;
export const formaNoBanco = (rotulo: string): string | null => FORMA_NO_BANCO[rotulo] ?? null;

// ───────────────────────── conferência ─────────────────────────

export type Problema = { aba: Aba; linha: number; coluna?: string; texto: string };

export type PacienteLido = {
  linha: number; nome: string; nascimento: Date | null; cpf: string; telefone: string; email: string;
  responsavel: string; responsavelTelefone: string; formato: string; pacoteTipo: string | null;
  valorSessao: number | null; sessoesNoPacote: number | null; diaVencimento: number | null; inicio: Date | null;
};
export type SessaoLida = { linha: number; paciente: string; quando: Date; duracao: number; status: string; online: boolean };
export type PagamentoLido = { linha: number; paciente: string; quando: Date; valor: number; forma: string; pagoPor: string };

export type Leitura = {
  pacientes: PacienteLido[];
  sessoes: SessaoLida[];
  pagamentos: PagamentoLido[];
  problemas: Problema[];
};

type Linha = Record<string, unknown>;

/**
 * A planilha inteira, conferida.
 *
 * `jaCadastrados` são os nomes que já existem na base da terapeuta: um paciente citado na Agenda
 * pode estar lá de antes, e exigir que ele venha também na aba Pacientes obrigaria a reimportar
 * quem já existe — que é como se duplica cadastro.
 *
 * A linha com problema NÃO entra; as outras entram. Recusar a planilha inteira por causa de uma
 * célula é o que faz a pessoa desistir da migração.
 */
export function conferir(
  abas: { Pacientes?: Linha[]; Agenda?: Linha[]; Pagamentos?: Linha[] },
  jaCadastrados: string[] = [],
): Leitura {
  const problemas: Problema[] = [];
  const erro = (aba: Aba, linha: number, texto: string, coluna?: string) => problemas.push({ aba, linha, coluna, texto });

  const acima = (aba: Aba, linhas: Linha[] | undefined): Linha[] => {
    const l = linhas ?? [];
    if (l.length > TETO_DE_LINHAS) {
      erro(aba, 0, `A aba tem ${l.length} linhas; o limite é ${TETO_DE_LINHAS}. Divida a planilha.`);
      return l.slice(0, TETO_DE_LINHAS);
    }
    return l;
  };

  // ── Pacientes ──
  const pacientes: PacienteLido[] = [];
  const vistos = new Set<string>();
  acima("Pacientes", abas.Pacientes).forEach((row, i) => {
    const linha = i + 2; // 1 é o cabeçalho, como a terapeuta vê no Excel
    const nome = texto(row.nome);
    if (!nome) {
      if (Object.values(row).some((v) => texto(v))) erro("Pacientes", linha, "Sem nome — a linha foi ignorada.", "nome");
      return;
    }
    if (vistos.has(nome.toLowerCase())) { erro("Pacientes", linha, `"${nome}" aparece mais de uma vez na planilha.`, "nome"); return; }
    vistos.add(nome.toLowerCase());

    const rotuloFormato = comoOpcao(row.formato_pagamento, FORMATOS);
    if (!rotuloFormato) {
      erro("Pacientes", linha, `Formato de pagamento inválido. Use: ${FORMATOS.join(", ")}.`, "formato_pagamento");
      return;
    }
    const formato = formatoNoBanco(rotuloFormato)!;
    const pacoteTipo = comoOpcao(row.pacote_tipo, PACOTES);
    const valorSessao = comoDinheiro(row.valor_sessao);
    if (texto(row.valor_sessao) && valorSessao == null) erro("Pacientes", linha, "Valor da sessão não é um número.", "valor_sessao");
    if (formato !== "gratuito" && (valorSessao ?? 0) <= 0) {
      erro("Pacientes", linha, "Quem não é gratuito precisa de valor da sessão.", "valor_sessao");
      return;
    }
    const dia = Number(texto(row.dia_vencimento));
    const diaVencimento = Number.isInteger(dia) && dia >= 1 && dia <= 31 ? dia : null;
    if (texto(row.dia_vencimento) && diaVencimento == null) erro("Pacientes", linha, "Dia de vencimento deve ser de 1 a 31.", "dia_vencimento");
    const sess = Number(texto(row.sessoes_no_pacote));
    const sessoesNoPacote = Number.isInteger(sess) && sess > 0 && sess <= 60 ? sess : null;

    pacientes.push({
      linha, nome, nascimento: comoData(row.nascimento), cpf: texto(row.cpf).replace(/\D/g, ""),
      telefone: texto(row.telefone), email: texto(row.email), responsavel: texto(row.responsavel),
      responsavelTelefone: texto(row.responsavel_telefone), formato, pacoteTipo,
      valorSessao, sessoesNoPacote, diaVencimento, inicio: comoData(row.inicio),
    });
  });

  /** Quem o resto da planilha pode citar: os que já existem mais os que estão chegando. */
  const conhecidos = [...jaCadastrados, ...pacientes.map((p) => p.nome)];
  const conhece = (nome: string) => conhecidos.some((c) => igual(c, nome));

  // ── Agenda ──
  const sessoes: SessaoLida[] = [];
  acima("Agenda", abas.Agenda).forEach((row, i) => {
    const linha = i + 2;
    const paciente = texto(row.paciente);
    if (!paciente && !Object.values(row).some((v) => texto(v))) return;
    if (!paciente) { erro("Agenda", linha, "Sem paciente — a linha foi ignorada.", "paciente"); return; }
    if (!conhece(paciente)) { erro("Agenda", linha, `"${paciente}" não está na aba Pacientes nem cadastrado.`, "paciente"); return; }

    const dia = comoData(row.data);
    if (!dia) { erro("Agenda", linha, "Data inválida. Use dd/mm/aaaa.", "data"); return; }
    const hora = comoHora(row.hora);
    if (!hora) { erro("Agenda", linha, "Hora inválida. Use hh:mm.", "hora"); return; }

    const dur = Number(texto(row.duracao));
    const duracao = Number.isInteger(dur) && dur > 0 && dur <= 480 ? dur : 50;
    const rotuloStatus = texto(row.status) ? comoOpcao(row.status, STATUS) : "agendada";
    if (!rotuloStatus) { erro("Agenda", linha, `Status inválido. Use: ${STATUS.join(", ")}.`, "status"); return; }
    const modalidade = texto(row.modalidade) ? comoOpcao(row.modalidade, MODALIDADES) : "presencial";
    if (!modalidade) { erro("Agenda", linha, `Modalidade inválida. Use: ${MODALIDADES.join(", ")}.`, "modalidade"); return; }

    sessoes.push({
      linha, paciente,
      quando: new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), hora.h, hora.m),
      duracao, status: statusNoBanco(rotuloStatus)!, online: modalidade === "online",
    });
  });

  // ── Pagamentos ──
  const pagamentos: PagamentoLido[] = [];
  acima("Pagamentos", abas.Pagamentos).forEach((row, i) => {
    const linha = i + 2;
    const paciente = texto(row.paciente);
    if (!paciente && !Object.values(row).some((v) => texto(v))) return;
    if (!paciente) { erro("Pagamentos", linha, "Sem paciente — a linha foi ignorada.", "paciente"); return; }
    if (!conhece(paciente)) { erro("Pagamentos", linha, `"${paciente}" não está na aba Pacientes nem cadastrado.`, "paciente"); return; }

    const dia = comoData(row.data);
    if (!dia) { erro("Pagamentos", linha, "Data inválida. Use dd/mm/aaaa.", "data"); return; }
    const valor = comoDinheiro(row.valor);
    if (valor == null || valor <= 0) { erro("Pagamentos", linha, "Valor precisa ser maior que zero.", "valor"); return; }
    const rotuloForma = texto(row.forma) ? comoOpcao(row.forma, FORMAS) : "pix";
    if (!rotuloForma) { erro("Pagamentos", linha, `Forma inválida. Use: ${FORMAS.join(", ")}.`, "forma"); return; }

    pagamentos.push({
      linha, paciente, quando: new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), 12, 0),
      valor, forma: formaNoBanco(rotuloForma)!, pagoPor: texto(row.pago_por) || paciente,
    });
  });

  return { pacientes, sessoes, pagamentos, problemas };
}

/** O resumo que a tela mostra antes de a terapeuta confirmar. */
export function resumo(l: Leitura): { pacientes: number; sessoes: number; pagamentos: number; problemas: number; dinheiro: number } {
  return {
    pacientes: l.pacientes.length,
    sessoes: l.sessoes.length,
    pagamentos: l.pagamentos.length,
    problemas: l.problemas.length,
    dinheiro: Math.round(l.pagamentos.reduce((s, p) => s + p.valor, 0) * 100) / 100,
  };
}
