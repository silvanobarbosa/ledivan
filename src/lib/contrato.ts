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
};

const ou = (v: string | null | undefined, placeholder: string) => (v && String(v).trim() ? String(v).trim() : `[${placeholder}]`);

function idadeNum(nasc: Date | null): number | null {
  if (!nasc) return null;
  const hoje = new Date();
  let anos = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) anos--;
  return anos;
}

function idadeEm(nasc: Date | null): string {
  const n = idadeNum(nasc);
  return n == null ? "[idade]" : String(n);
}

const dataBR = (d: Date | null) => (d ? d.toLocaleDateString("pt-BR") : "[DD/MM/AAAA]");

function reaisBR(v: string | number | null): string {
  if (v == null || v === "") return "[Valor]";
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return "[Valor]";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Frase de frequência da cláusula 3.1 (doc 26), vinda da recorrência da última sessão agendada. */
function frequenciaDoContrato(r: DadosDoContrato["recorrencia"]): string {
  if (!r) return "ocorrendo com a frequência de [ex: 1 ou 2] vez(es) por semana"; // sem agendamento: placeholder
  if (!r.repete) return "ocorre com a frequência Semanal"; // "não repetir"
  if (r.freq === "mensal") return "ocorre com a frequência Mensal";
  if (r.freq === "quinzenal") return "ocorre com a frequência Quinzenal";
  return `ocorre com a frequência Semanal (${r.vezesPorSemana >= 2 ? "2x" : "1x"} por semana)`;
}

const DIAS_SEMANA_CONTRATO = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

/** "Toda terça-feira, às 15h00" a partir do último agendamento (doc 26). */
function horarioFixoDoContrato(dt: Date | null): string {
  if (!dt || Number.isNaN(dt.getTime())) return "[ex: Toda terça-feira, às 15h00]";
  const dia = DIAS_SEMANA_CONTRATO[dt.getDay()];
  const hh = String(dt.getHours()).padStart(2, "0");
  const mm = String(dt.getMinutes()).padStart(2, "0");
  return `Toda ${dia}, às ${hh}h${mm}`;
}

/** Texto do vencimento da cláusula 4.2 conforme o formato de pagamento (doc 26). */
function vencimentoDoContrato(d: DadosDoContrato): string {
  const dia = (v: number | null) => (v != null ? String(v) : "[x]");
  switch (d.formatoPagamento) {
    case "mensal":
      return `O pagamento deverá ser efetuado até o dia ${dia(d.diaPagamento)} do mês vigente`;
    case "primeira_pacote":
      return "O pagamento deverá ser efetuado até a data da primeira sessão do pacote do mês vigente";
    case "ultima_pacote":
      return "O pagamento deverá ser efetuado até a data da última sessão do pacote do mês vigente";
    case "quinzenal":
      return `O pagamento deverá ser efetuado nos dias ${dia(d.diaPagamento)} e ${dia(d.diaPagamento2)} do mês vigente`;
    case "sessao":
      return `O pagamento deverá ser efetuado até ${d.horasAntesPagamento != null ? d.horasAntesPagamento : "[x]"} horas antes do atendimento`;
    default:
      return "O pagamento deverá ser efetuado até o dia [ex: 5º dia útil / ao final de cada sessão]";
  }
}

export function montarContrato(d: DadosDoContrato): string {
  const reajusteMes = d.reajusteMeses && d.reajusteMeses > 0 ? `a cada ${d.reajusteMeses} ${d.reajusteMeses === 1 ? "mês" : "meses"}` : "[periodicidade]";
  // Enquadre dinâmico (doc 26).
  const duracaoTxt = d.duracaoMaxMin && d.duracaoMaxMin > 0 ? `até ${d.duracaoMaxMin} minutos` : "até [ex: 45 a 50 minutos]";
  const frequenciaTxt = frequenciaDoContrato(d.recorrencia);
  const horarioFixoTxt = horarioFixoDoContrato(d.horarioFixo);
  // Gratuito: a cláusula 4.2 inteira vira "Isento"; senão, o vencimento conforme o formato.
  const linha42 = d.formatoPagamento === "gratuito"
    ? "4.2. Vencimento e Forma de Pagamento: Isento"
    : `4.2. Vencimento e Forma de Pagamento: ${vencimentoDoContrato(d)}, via [PIX / Transferência / Cartão] na chave: [Sua Chave PIX].`;

  /**
   * Preenchimento automático dos responsáveis por IDADE (doc 23):
   * - Maior de idade (≥ 18): o próprio paciente é o Responsável 1. Se há responsável no cadastro, ele
   *   vai para o Responsável 1 e o paciente desce para o Responsável 2. Sem responsável, o 2 fica vazio.
   * - Menor de 18 (ou idade desconhecida): o responsável do cadastro preenche o Responsável 1.
   * Usa só o que já está no cadastro, sem duplicar nem alterar.
   */
  const idade = idadeNum(d.pacienteNascimento);
  const temResponsavel = !!(d.responsavelNome && d.responsavelNome.trim());
  let r1Nome: string | null, r1Cpf: string | null, r2Nome: string | null, r2Cpf: string | null;
  if (idade != null && idade >= 18) {
    if (temResponsavel) {
      r1Nome = d.responsavelNome; r1Cpf = d.responsavelCpf;
      r2Nome = d.pacienteNome; r2Cpf = d.pacienteCpf;
    } else {
      r1Nome = d.pacienteNome; r1Cpf = d.pacienteCpf;
      r2Nome = null; r2Cpf = null;
    }
  } else {
    r1Nome = d.responsavelNome; r1Cpf = d.responsavelCpf;
    r2Nome = null; r2Cpf = null;
  }

  return `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE PSICANÁLISE

1. DAS PARTES

CONTRATADA (ANALISTA):
Nome: ${ou(d.analistaNome, "Seu Nome Completo")}
Registro Profissional / Qualificação: [Nº do Conselho ou Associação] / CPF: ${ou(d.analistaCpf, "CPF")}
Endereço do Consultório / Plataforma: [Endereço do Consultório ou Atendimento Online]
Telefone / E-mail: [Seu Contato Profissional]

CONTRATANTE(S) (RESPONSÁVEIS LEGAIS):
Nome do Responsável 1: ${ou(r1Nome, "Nome Completo do Responsável")} — CPF: ${ou(r1Cpf, "CPF")}${r2Nome && r2Nome.trim() ? `
Nome do Responsável 2: ${ou(r2Nome, "Nome Completo do Responsável")} — CPF: ${ou(r2Cpf, "CPF")}` : ""}
Endereço: ${ou(d.pacienteEndereco, "Endereço Residencial Completo")}
Telefone / E-mail de Contato: ${ou(d.responsavelTelefone?.trim() ? d.responsavelTelefone : d.pacienteTelefone, "Telefone de Contato")}

PACIENTE (BENEFICIÁRIO):
Nome: ${ou(d.pacienteNome, "Nome do Paciente")}
Data de Nascimento: ${dataBR(d.pacienteNascimento)} — Idade: ${idadeEm(d.pacienteNascimento)} anos

2. DO OBJETO DO CONTRATO
2.1. O presente instrumento tem por objeto a prestação de serviços de Atendimento e Análise Psicanalítica voltados ao desenvolvimento psíquico, escuta e elaboração do sofrimento do PACIENTE acima identificado.
2.2. Por se tratar de um processo psicanalítico, a prestação de serviços é de meio, e não de fim, dependendo do engajamento do paciente e da sustentação do enquadre pelos seus responsáveis.

3. DO ENQUADRE CLÍNICO (SETTING ANALÍTICO) E HORÁRIOS
3.1. Frequência e Duração: As sessões terão a duração de ${duracaoTxt}, ${frequenciaTxt}.
3.2. Horário Fixo: Fica reservado ao paciente o seguinte horário semanal fixo: ${horarioFixoTxt}.
3.3. Pontualidade: O horário reservado pertence exclusivamente ao paciente. Atrasos por parte do paciente/responsáveis não implicarão na prorrogação do tempo da sessão.

4. DOS HONORÁRIOS, FORMA DE PAGAMENTO E REAJUSTE
4.1. Valor por Sessão / Mensalidade: O valor acordado por cada sessão é de R$ ${reaisBR(d.valorSessao)}, totalizando o valor mensal variável conforme o número de semanas/sessões do mês.
${linha42}
4.3. Reajuste: O valor dos honorários poderá ser reajustado ${reajusteMes}, mediante prévio aviso de 30 (trinta) dias aos responsáveis.

5. DA POLÍTICA DE FALTAS, DESMARCAÇÕES E REAGENDAMENTOS
5.1. Reserva do Horário: Na psicanálise, o pagamento remunera a reserva exclusiva do tempo e do espaço clínico colocados à disposição do paciente.
5.2. Faltas do Paciente: As sessões desmarcadas pelos responsáveis ou pelo paciente serão cobradas normalmente, independentemente do motivo (saúde, viagens, imprevistos ou compromissos escolares).
5.3. Reagendamento: Havendo disponibilidade de agenda por parte da ANALISTA, poderá ser oferecido um horário alternativo na mesma semana, sem que isso constitua obrigação contratual.
5.4. Faltas da Analista: Caso a ANALISTA precise desmarcar por motivo de força maior, a sessão não será cobrada ou será obrigatoriamente reposta em horário mutuamente combinado.
5.5. Recessos e Feriados: Não haverá cobrança de sessões que coincidirem com recessos previstos e comunicados previamente (ex: Férias de Julho/Dezembro) ou feriados em que o consultório não funcione.

6. DO SIGILO PROFISSIONAL E SESSÕES DE ORIENTAÇÃO DE PAIS
6.1. Sigilo em Relação à Criança/Adolescente: O espaço de escuta é protegido pelo sigilo ético e analítico. O conteúdo direto das falas, brincadeiras e produções lúdicas da criança não será repassado de forma direta ou detalhada aos pais.
6.2. Orientações aos Responsáveis: Serão realizadas sessões periódicas de Orientação aos Responsáveis (frequência a combinar), focadas no manejo da rotina, direção do tratamento e percepção do desenvolvimento, preservando a intimidade da escuta da criança.
6.3. Quebra de Sigilo: O sigilo só será mitigado diante de situações de risco iminente à integridade física ou à vida do paciente ou de terceiros, conforme o Código de Ética e a legislação vigente.

7. ATENDIMENTOS ONLINE (SE APLICÁVEL)
7.1. Privacidade do Ambiente: Para sessões online, os RESPONSÁVEIS comprometem-se a garantir ambiente privado, silencioso, sem interrupções e com conexão estável durante a sessão.
7.2. Gravação Proibida: É expressamente proibida a gravação (áudio ou vídeo) das sessões por qualquer das partes sem autorização prévia e formal por escrito.

8. DO ENCERRAMENTO E ALTA ANALÍTICA
8.1. Processo de Encerramento: O desligamento exige um período de elaboração. Caso se decida interromper o tratamento, concorda-se com a realização de no mínimo [ex: 2 a 4] sessões de encerramento para o manejo da separação e fechamento do vínculo.

9. DO FORO
Para dirimir dúvidas oriundas deste contrato, as partes elegem o Foro da Comarca de [Sua Cidade / Estado], com renúncia a qualquer outro.

Por estarem assim justos e contratados, assinam o presente instrumento em 2 (duas) vias de igual teor e forma.

[Cidade - UF], [Dia] de [Mês] de [Ano].


_______________________________________
${ou(d.analistaNome, "NOME DA ANALISTA")} — Analista / Prestadora de Serviços


_______________________________________
${ou(r1Nome, "NOME DO RESPONSÁVEL 1")} — Contratante / Responsável Legal


_______________________________________
${ou(r2Nome, "NOME DO RESPONSÁVEL 2 (OPCIONAL)")} — Contratante / Responsável Legal`;
}
