/**
 * O CONTRATO de prestação de serviços (doc 9, menu Contratos) — função pura que monta o texto a
 * partir do que o sistema JÁ tem (Ajustes da analista + cadastro do paciente) e deixa o resto como
 * [campo] para a analista preencher na tela antes de imprimir. É "preencher e imprimir", como o
 * recibo: o sistema adianta o que sabe, a pessoa completa o que falta.
 *
 * O modelo é o do documento (psicanálise infantil/adolescente). Nada aqui é conselho jurídico — é a
 * transcrição fiel do texto que a dona entregou, com os espaços preenchidos.
 */

export type DadosDoContrato = {
  // Analista (Ajustes)
  analistaNome: string | null;
  analistaCpf: string | null;
  descricaoAtendimento: string | null; // "atendimentos terapêuticos" etc.
  // Doc 27 — dados do Perfil que preenchem o cabeçalho e o foro (antes eram [placeholders] fixos).
  analistaConselho: string | null; // Nº do Conselho ou Associação
  analistaEndereco: string | null; // endereço do consultório
  analistaPlataforma: string | null; // plataforma do atendimento on-line
  analistaTelefone: string | null;
  analistaEmail: string | null;
  cidade: string | null; // comarca do foro + local da assinatura
  estado: string | null; // UF
  // Paciente (cadastro)
  pacienteNome: string | null;
  pacienteNascimento: Date | null;
  pacienteCpf: string | null;
  pacienteEndereco: string | null; // endereço residencial do paciente (vai no bloco do contratante)
  pacienteTelefone: string | null; // telefone do paciente (fallback do contato)
  // Responsável (cadastro)
  responsavelNome: string | null;
  responsavelCpf: string | null;
  responsavelTelefone: string | null; // telefone do responsável (preferido no contato)
  // E-mails (doc 41): guia-dados. Alimentam a linha E-mail do CONTRATANTE conforme quem é o R1/R2.
  responsavelEmail?: string | null;
  pacienteEmail?: string | null;
  // Honorários
  valorSessao: string | number | null;
  reajusteMeses: number | null;
  // Enquadre (doc 26) — vindo da agenda/cadastro; nulo cai no placeholder [ex: ...].
  duracaoMaxMin: number | null; // maior duração (min) já cadastrada nas sessões
  recorrencia: { freq: string | null; vezesPorSemana: number; repete: boolean } | null; // da última sessão agendada
  horarioFixo: Date | null; // dia/hora do último agendamento (parede)
  // Pagamento (doc 26) — para a cláusula de vencimento.
  formatoPagamento: string | null; // sessao | mensal | quinzenal | primeira_pacote | ultima_pacote | gratuito
  diaPagamento: number | null;
  diaPagamento2: number | null;
  horasAntesPagamento: number | null;
  // Data em que o contrato está sendo visto (doc 28) — preenche a linha da assinatura. O caller passa
  // `new Date()`; fica como parâmetro para a função seguir pura/testável.
  hoje: Date | null;
};

import { descricaoValida, type DescricaoAtendimento } from "./recibo";

/**
 * Marcadores de CAMPO PREENCHIDO PELO SISTEMA (doc 28): tudo que o app preenche sozinho sai entre
 * \u0001…\u0002 para a tela destacar em negrito. Os campos que ainda faltam saem entre [colchetes]
 * (também em negrito, para a analista achar o que completar). São dois caracteres de controle que
 * não existem no texto do contrato — a impressão nunca os mostra; o `ContratoImpresso` os troca por
 * <strong>. Em contexto sem formatação (teste), `textoLimpo` tira os marcadores.
 */
export const AUTO_L = "\u0001";
export const AUTO_R = "\u0002";
const neg = (v: string | number) => `${AUTO_L}${v}${AUTO_R}`;

/** Remove os marcadores de negrito — para comparar/afirmar sobre o texto puro. */
export function textoLimpo(s: string): string {
  return s.split(AUTO_L).join("").split(AUTO_R).join("");
}

// Valor do sistema sai em negrito; o que falta sai como [placeholder].
const ou = (v: string | null | undefined, placeholder: string) => (v && String(v).trim() ? neg(String(v).trim()) : `[${placeholder}]`);

/** Texto fixo da cláusula/assinatura conforme a formação escolhida nos Ajustes (doc 28). */
const PELA_MODALIDADE: Record<DescricaoAtendimento, { titulo: string; objeto: string; processo: string; reserva: string; assinatura: string }> = {
  terapia: {
    titulo: "TERAPIA",
    objeto: "a prestação de serviços de Atendimento terapêutico voltados ao PACIENTE acima identificado",
    processo: "terapêutico",
    reserva: "Na terapia",
    assinatura: "Terapeuta",
  },
  psicanalise: {
    titulo: "PSICANÁLISE",
    objeto: "a prestação de serviços de Atendimento e Análise Psicanalítica voltados ao desenvolvimento psíquico, escuta e elaboração do sofrimento do PACIENTE acima identificado",
    processo: "psicanalítico",
    reserva: "Na psicanálise",
    assinatura: "Psicanalista",
  },
  psicologia: {
    titulo: "PSICOLOGIA",
    objeto: "a prestação de serviços de Atendimento Psicológico voltados ao desenvolvimento psíquico, escuta e elaboração do sofrimento do PACIENTE acima identificado",
    processo: "psicológico",
    reserva: "Na psicologia",
    assinatura: "Psicólogo(a)",
  },
};

const MESES_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
/** "11 de outubro de 2026" — a data em que o contrato está sendo visto (doc 28). */
function dataPorExtenso(d: Date | null): string {
  if (!d || Number.isNaN(d.getTime())) return "[Dia] de [Mês] de [Ano]";
  return `${d.getDate()} de ${MESES_PT[d.getMonth()]} de ${d.getFullYear()}`;
}

function idadeNum(nasc: Date | null): number | null {
  if (!nasc) return null;
  const hoje = new Date();
  let anos = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) anos--;
  return anos;
}

const dataBR = (d: Date | null) => (d ? d.toLocaleDateString("pt-BR") : "[DD/MM/AAAA]");

function reaisBR(v: string | number | null): string {
  if (v == null || v === "") return "[Valor]";
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return "[Valor]";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Frase de frequência da cláusula 3.1 (doc 26). A SEQUÊNCIA (Semanal 1x/2x, Mensal, Quinzenal) é
 * campo preenchido pelo sistema → sai em negrito (doc 29).
 */
function frequenciaDoContrato(r: DadosDoContrato["recorrencia"]): string {
  if (!r) return "ocorrendo com a frequência de [ex: 1 ou 2] vez(es) por semana"; // sem agendamento: placeholder
  if (!r.repete) return `ocorre com a frequência ${neg("Semanal")}`; // "não repetir"
  if (r.freq === "mensal") return `ocorre com a frequência ${neg("Mensal")}`;
  if (r.freq === "quinzenal") return `ocorre com a frequência ${neg("Quinzenal")}`;
  return `ocorre com a frequência ${neg(`Semanal (${r.vezesPorSemana >= 2 ? "2x" : "1x"} por semana)`)}`;
}

/** Texto do vencimento da cláusula 4.2 conforme o formato de pagamento (doc 26/28). */
function vencimentoDoContrato(d: DadosDoContrato): string {
  const dia = (v: number | null) => (v != null ? neg(v) : "[x]");
  switch (d.formatoPagamento) {
    case "mensal":
      return `O pagamento deverá ser efetuado até o dia ${dia(d.diaPagamento)} do mês vigente`;
    case "primeira_pacote":
      // Doc 29: a condição ("a primeira sessão de cada pacote") é campo do sistema → negrito.
      return `O pagamento deverá ser efetuado até ${neg("a primeira sessão de cada pacote")}`;
    case "ultima_pacote":
      return `O pagamento deverá ser efetuado até ${neg("a última sessão de cada pacote")}`;
    case "quinzenal":
      return `O pagamento deverá ser efetuado nos dias ${dia(d.diaPagamento)} e ${dia(d.diaPagamento2)} do mês vigente`;
    case "sessao":
      return `O pagamento deverá ser efetuado até ${d.horasAntesPagamento != null ? neg(d.horasAntesPagamento) : "[x]"} horas antes da sessão`;
    default:
      return "O pagamento deverá ser efetuado até o dia [ex: 5º dia útil / ao final de cada sessão]";
  }
}

export function montarContrato(d: DadosDoContrato): string {
  // Formação escolhida nos Ajustes decide título, objeto (2.1/2.2), reserva (5.1) e rótulo da
  // assinatura (doc 28).
  const m = PELA_MODALIDADE[descricaoValida(d.descricaoAtendimento)];
  // Doc 41: quando a formação é TERAPIA, "analítico/analítica" vira "terapêutico/terapêutica"
  // (sigilo da 6.1 e título da seção 8). Nas demais formações o termo analítico é mantido.
  const ehTerapia = descricaoValida(d.descricaoAtendimento) === "terapia";
  const sigiloAdj = ehTerapia ? "terapêutico" : "analítico";
  const altaTermo = ehTerapia ? "TERAPÊUTICA" : "ANALÍTICA";

  // Doc 41: sem "próximo reajuste em" (periodicidade não definida), a cláusula 4.3 inteira sai do
  // contrato; volta a aparecer assim que a periodicidade é preenchida.
  const temReajuste = !!(d.reajusteMeses && d.reajusteMeses > 0);
  const linha43 = temReajuste
    ? `\n4.3. Reajuste: O valor dos honorários poderá ser reajustado ${neg(`a cada ${d.reajusteMeses} ${d.reajusteMeses === 1 ? "mês" : "meses"}`)}, mediante prévio aviso de 30 (trinta) dias aos responsáveis.`
    : "";
  // Enquadre dinâmico (doc 26).
  const duracaoTxt = d.duracaoMaxMin && d.duracaoMaxMin > 0 ? `até ${neg(`${d.duracaoMaxMin} minutos`)}` : "até [ex: 45 a 50 minutos]";
  const frequenciaTxt = frequenciaDoContrato(d.recorrencia);
  // Gratuito (doc 28): a cláusula 4.2 inteira é a isenção por tempo indeterminado; senão, o
  // vencimento conforme o formato. Doc 29: no gratuito, a isenção toda sai em negrito.
  const linha42 = d.formatoPagamento === "gratuito"
    ? `4.2. Vencimento e Forma de Pagamento: ${neg("Isento de qualquer tipo de pagamento por tempo indeterminado. Não há data de vencimento nem obrigação de pagamento enquanto essa condição estiver vigente.")}`
    : `4.2. Vencimento e Forma de Pagamento: ${vencimentoDoContrato(d)}.`;
  // 4.1 (doc 29): no gratuito, "O valor acordado por cada sessão é de R$ 0,00." em negrito, sem a
  // cauda "totalizando…". Senão, o valor da sessão + a cauda, como no doc 28.

  // Doc 27/28 — cabeçalho (cada item em sua linha) e foro preenchidos do Perfil.
  const enderecoProf = ou(d.analistaEndereco, "Endereço");
  const plataformaProf = ou(d.analistaPlataforma, "Plataforma utilizada para atendimentos online");
  const telefoneProf = ou(d.analistaTelefone, "Telefone");
  const emailProf = ou(d.analistaEmail, "E-mail");
  const limpo = (v: string | null) => (v && v.trim() ? v.trim() : null);
  const cidade = limpo(d.cidade);
  const estado = limpo(d.estado);
  const foroCidadeUf = cidade ? `${neg(`${cidade}${estado ? ` / ${estado}` : ""}`)}` : "[Sua Cidade / Estado]";
  const localAssinatura = cidade ? `${neg(`${cidade}${estado ? ` - ${estado}` : ""}`)}` : "[Cidade - UF]";
  const dataAssinatura = d.hoje && !Number.isNaN(d.hoje.getTime()) ? neg(dataPorExtenso(d.hoje)) : dataPorExtenso(null);

  // Valor por sessão, data de nascimento e idade em negrito quando preenchidos.
  const valorRaw = reaisBR(d.valorSessao);
  const valorSessaoTxt = valorRaw.startsWith("[") ? valorRaw : neg(`R$ ${valorRaw}`);
  const nascimentoTxt = d.pacienteNascimento ? neg(dataBR(d.pacienteNascimento)) : "[DD/MM/AAAA]";
  const idadeNumero = idadeNum(d.pacienteNascimento);
  const idadeTxt = idadeNumero != null ? neg(String(idadeNumero)) : "[idade]";

  /**
   * Preenchimento automático dos responsáveis por IDADE (doc 23):
   * - Maior de idade (≥ 18): o próprio paciente é o Responsável 1. Se há responsável no cadastro, ele
   *   vai para o Responsável 1 e o paciente desce para o Responsável 2. Sem responsável, o 2 fica vazio.
   * - Menor de 18 (ou idade desconhecida): o responsável do cadastro preenche o Responsável 1.
   * Usa só o que já está no cadastro, sem duplicar nem alterar.
   */
  const idade = idadeNum(d.pacienteNascimento);
  const temResponsavel = !!(d.responsavelNome && d.responsavelNome.trim());
  let r1Nome: string | null, r1Cpf: string | null, r1Email: string | null;
  let r2Nome: string | null, r2Cpf: string | null, r2Email: string | null;
  if (idade != null && idade >= 18) {
    if (temResponsavel) {
      r1Nome = d.responsavelNome; r1Cpf = d.responsavelCpf; r1Email = d.responsavelEmail ?? null;
      r2Nome = d.pacienteNome; r2Cpf = d.pacienteCpf; r2Email = d.pacienteEmail ?? null;
    } else {
      r1Nome = d.pacienteNome; r1Cpf = d.pacienteCpf; r1Email = d.pacienteEmail ?? null;
      r2Nome = null; r2Cpf = null; r2Email = null;
    }
  } else {
    r1Nome = d.responsavelNome; r1Cpf = d.responsavelCpf; r1Email = d.responsavelEmail ?? null;
    r2Nome = null; r2Cpf = null; r2Email = null;
  }

  // Doc 41: campo da guia dados vazio → a LINHA sai do contrato; volta quando a informação é
  // cadastrada. Vale só para a identificação do CONTRATANTE e do PACIENTE (dados do cadastro). O
  // cabeçalho da CONTRATADA (Perfil) e o enquadre (agenda) seguem com [placeholder].
  const Lopt = (label: string, raw: string | number | null | undefined) =>
    raw != null && String(raw).trim() !== "" ? `${label}: ${neg(String(raw).trim())}\n` : "";
  const telefoneR1 = d.responsavelTelefone?.trim() ? d.responsavelTelefone : d.pacienteTelefone;
  const blocoResponsavel = (nome: string | null, cpf: string | null, tel: string | null, email: string | null, rotuloNome: string) =>
    Lopt(rotuloNome, nome) + Lopt("CPF", cpf) + Lopt("Endereço", d.pacienteEndereco) + Lopt("Telefone", tel) + Lopt("E-mail", email);
  const contratanteBloco = blocoResponsavel(r1Nome, r1Cpf, telefoneR1, r1Email, "Nome do Responsável").trimEnd();
  const contratante2Bloco = r2Nome && r2Nome.trim()
    ? blocoResponsavel(r2Nome, r2Cpf, d.pacienteTelefone, r2Email, "Nome do Responsável 2").trimEnd()
    : "";
  // PACIENTE: idade/nascimento só quando há data de nascimento.
  const pacienteBloco = (
    Lopt("Nome", d.pacienteNome) +
    (d.pacienteNascimento ? `Data de Nascimento: ${nascimentoTxt}\n` : "") +
    (idadeNumero != null ? `Idade: ${idadeTxt} anos\n` : "")
  ).trimEnd();

  return `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE ${m.titulo}

1. DAS PARTES

CONTRATADA:
Nome: ${ou(d.analistaNome, "Seu Nome Completo")}
Registro Profissional: ${ou(d.analistaConselho, "Nº do Conselho ou Associação")}
CPF: ${ou(d.analistaCpf, "CPF")}
Endereço: ${enderecoProf}
Plataforma utilizada para atendimentos online: ${plataformaProf}
Telefone: ${telefoneProf}
E-mail: ${emailProf}

CONTRATANTE(S):
${contratanteBloco}${contratante2Bloco ? `

${contratante2Bloco}` : ""}

PACIENTE:
${pacienteBloco}

2. DO OBJETO DO CONTRATO
2.1. O presente instrumento tem por objeto ${m.objeto}.
2.2. Por se tratar de um processo ${m.processo}, a prestação de serviços é de meio, e não de fim, dependendo do engajamento do paciente e da sustentação do enquadre pelos seus responsáveis.

3. DO ENQUADRE CLÍNICO E HORÁRIOS
3.1. Frequência e Duração: As sessões terão a duração de ${duracaoTxt}, ${frequenciaTxt}.
3.2. Pontualidade: O horário reservado pertence exclusivamente ao paciente. Atrasos por parte do paciente/responsáveis não implicarão na prorrogação do tempo da sessão.

4. DOS HONORÁRIOS, FORMA DE PAGAMENTO E REAJUSTE
${d.formatoPagamento === "gratuito"
  ? `4.1. Valor por Sessão / Mensalidade: ${neg("O valor acordado por cada sessão é de R$ 0,00.")}`
  : `4.1. Valor por Sessão / Mensalidade: O valor acordado por cada sessão é de ${valorSessaoTxt}, totalizando o valor mensal variável conforme o número de semanas/sessões do mês.`}
${linha42}${linha43}

5. DA POLÍTICA DE FALTAS, DESMARCAÇÕES E REAGENDAMENTOS
5.1. Reserva do Horário: ${m.reserva}, o pagamento remunera a reserva exclusiva do tempo e do espaço clínico colocados à disposição do paciente.
5.2. Faltas do Paciente: As sessões em que o paciente não comparecer e não realizar o cancelamento prévio do agendamento serão cobradas normalmente, independentemente do motivo da ausência (saúde, viagens, imprevistos ou compromissos escolares). A cobrança será desconsiderada mediante apresentação de atestado médico.
5.3. Reagendamento: Havendo disponibilidade de agenda por parte do PROFISSIONAL, poderá ser oferecido um horário alternativo na mesma semana, sem que isso constitua obrigação contratual.
5.4. Faltas do Profissional: Caso o PROFISSIONAL precise desmarcar por motivo de força maior, a sessão não será cobrada ou será obrigatoriamente reposta em horário mutuamente combinado.
5.5. Recessos e Feriados: Não haverá cobrança de sessões que coincidirem com recessos previstos e comunicados previamente (ex: Férias de Julho/Dezembro) ou feriados em que o consultório não funcione.

6. DO SIGILO PROFISSIONAL E SESSÕES DE ORIENTAÇÃO DE PAIS
6.1. Sigilo em Relação à Criança/Adolescente: O espaço de escuta é protegido pelo sigilo ético e ${sigiloAdj}. O conteúdo direto das falas, brincadeiras e produções lúdicas da criança não será repassado de forma direta ou detalhada aos pais.
6.2. Orientações aos Responsáveis: Serão realizadas sessões periódicas de Orientação aos Responsáveis (frequência a combinar), focadas no manejo da rotina, direção do tratamento e percepção do desenvolvimento, preservando a intimidade da escuta da criança.
6.3. Quebra de Sigilo: O sigilo só será mitigado diante de situações de risco iminente à integridade física ou à vida do paciente ou de terceiros, conforme o Código de Ética e a legislação vigente.

7. ATENDIMENTOS ONLINE (SE APLICÁVEL)
7.1. Privacidade do Ambiente: Para sessões online, os RESPONSÁVEIS comprometem-se a garantir ambiente privado, silencioso, sem interrupções e com conexão estável durante a sessão.
7.2. Gravação Proibida: É expressamente proibida a gravação (áudio ou vídeo) das sessões por qualquer das partes sem autorização prévia e formal por escrito.

8. DO ENCERRAMENTO E ALTA ${altaTermo}
8.1. Processo de Encerramento: O desligamento exige um período de elaboração. Caso se decida interromper o tratamento, concorda-se com a realização de no mínimo [ex: 2 a 4] sessões de encerramento para o manejo da separação e fechamento do vínculo.

9. DO FORO
Para dirimir dúvidas oriundas deste contrato, as partes elegem o Foro da Comarca de ${foroCidadeUf}, com renúncia a qualquer outro.

Por estarem assim justos e contratados, assinam o presente instrumento em 2 (duas) vias de igual teor e forma.

${localAssinatura}, ${dataAssinatura}.


_______________________________________
${ou(d.analistaNome, "NOME DA ANALISTA")} — ${m.assinatura}


_______________________________________
${ou(r1Nome, "NOME DO RESPONSÁVEL 1")} — Contratante / Responsável Legal${r2Nome && r2Nome.trim() ? `


_______________________________________
${ou(r2Nome, "NOME DO RESPONSÁVEL 2")} — Contratante / Responsável Legal` : ""}`;
}
