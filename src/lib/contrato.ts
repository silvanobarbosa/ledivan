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
  // Responsável (cadastro)
  responsavelNome: string | null;
  responsavelCpf: string | null;
  // Honorários
  valorSessao: string | number | null;
  reajusteMeses: number | null;
};

const ou = (v: string | null | undefined, placeholder: string) => (v && String(v).trim() ? String(v).trim() : `[${placeholder}]`);

function idadeEm(nasc: Date | null): string {
  if (!nasc) return "[idade]";
  const hoje = new Date();
  let anos = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) anos--;
  return String(anos);
}

const dataBR = (d: Date | null) => (d ? d.toLocaleDateString("pt-BR") : "[DD/MM/AAAA]");

function reaisBR(v: string | number | null): string {
  if (v == null || v === "") return "[Valor]";
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return "[Valor]";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function montarContrato(d: DadosDoContrato): string {
  const reajusteMes = d.reajusteMeses && d.reajusteMeses > 0 ? `a cada ${d.reajusteMeses} ${d.reajusteMeses === 1 ? "mês" : "meses"}` : "[periodicidade]";

  return `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE PSICANÁLISE
(Atendimento Infantil / Adolescente & Enquadre Clínico)

1. DAS PARTES

CONTRATADA (ANALISTA):
Nome: ${ou(d.analistaNome, "Seu Nome Completo")}
Registro Profissional / Qualificação: [Nº do Conselho ou Associação] / CPF: ${ou(d.analistaCpf, "CPF")}
Endereço do Consultório / Plataforma: [Endereço do Consultório ou Atendimento Online]
Telefone / E-mail: [Seu Contato Profissional]

CONTRATANTE(S) (RESPONSÁVEIS LEGAIS):
Nome do Responsável 1: ${ou(d.responsavelNome, "Nome Completo do Responsável")} — CPF: ${ou(d.responsavelCpf, "CPF")}
Nome do Responsável 2: [Nome Completo do Responsável] — CPF: [CPF]
Endereço: [Endereço Residencial Completo]
Telefone / E-mail de Contato: [Telefone de Contato]

PACIENTE (BENEFICIÁRIO):
Nome da Criança / Adolescente: ${ou(d.pacienteNome, "Nome do Paciente")}
Data de Nascimento: ${dataBR(d.pacienteNascimento)} — Idade: ${idadeEm(d.pacienteNascimento)} anos

2. DO OBJETO DO CONTRATO
2.1. O presente instrumento tem por objeto a prestação de serviços de Atendimento e Análise Psicanalítica voltados ao desenvolvimento psíquico, escuta e elaboração do sofrimento do PACIENTE acima identificado.
2.2. Por se tratar de um processo psicanalítico, a prestação de serviços é de meio, e não de fim, dependendo do engajamento do paciente e da sustentação do enquadre pelos seus responsáveis.

3. DO ENQUADRE CLÍNICO (SETTING ANALÍTICO) E HORÁRIOS
3.1. Frequência e Duração: As sessões terão a duração de [ex: 45 a 50 minutos], ocorrendo com a frequência de [ex: 1 ou 2] vez(es) por semana.
3.2. Horário Fixo: Fica reservado ao paciente o seguinte horário semanal fixo: [ex: Toda terça-feira, às 15h00].
3.3. Pontualidade: O horário reservado pertence exclusivamente ao paciente. Atrasos por parte do paciente/responsáveis não implicarão na prorrogação do tempo da sessão.

4. DOS HONORÁRIOS, FORMA DE PAGAMENTO E REAJUSTE
4.1. Valor por Sessão / Mensalidade: O valor acordado por cada sessão é de R$ ${reaisBR(d.valorSessao)}, totalizando o valor mensal variável conforme o número de semanas/sessões do mês.
4.2. Vencimento e Forma de Pagamento: O pagamento deverá ser efetuado até o dia [ex: 5º dia útil / ao final de cada sessão], via [PIX / Transferência / Cartão] na chave: [Sua Chave PIX].
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
${ou(d.responsavelNome, "NOME DO RESPONSÁVEL 1")} — Contratante / Responsável Legal


_______________________________________
[NOME DO RESPONSÁVEL 2 (OPCIONAL)] — Contratante / Responsável Legal`;
}
