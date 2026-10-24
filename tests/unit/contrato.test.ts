import { describe, it, expect } from "vitest";
import { montarContrato, montarContratoSupervisao, textoLimpo } from "@/lib/contrato";

// Helper: o texto SEM os marcadores de negrito (\u0001…\u0002), para asserção sobre o conteúdo.
const c = (x: Parameters<typeof montarContrato>[0]) => textoLimpo(montarContrato(x));

describe("montarContrato", () => {
  // Paciente criança (nascido 2015 → < 18): regra de menor, responsável do cadastro no Responsável 1.
  // descricaoAtendimento guarda a FORMAÇÃO ("terapia"|"psicanalise"|"psicologia"), não a frase.
  const base = { analistaNome: "Gisele Barbosa", analistaCpf: "123.456.789-00", descricaoAtendimento: "psicanalise", analistaConselho: null, analistaEndereco: null, analistaPlataforma: null, analistaTelefone: null, analistaEmail: null, cidade: null, estado: null, pacienteNome: "João Silva", pacienteNascimento: new Date(2015, 5, 10), pacienteCpf: "111.222.333-44", responsavelNome: "Maria Silva", responsavelCpf: "987.654.321-00", valorSessao: 120, reajusteMeses: 6, pacienteEndereco: "Rua das Flores, 100 — Centro", responsavelTelefone: "(11) 99999-0000", pacienteTelefone: "(11) 88888-0000", duracaoMaxMin: 50, recorrencia: { freq: "semanal", vezesPorSemana: 1, repete: true }, horarioFixo: new Date(2026, 9, 6, 15, 0), formatoPagamento: "mensal", diaPagamento: 5, diaPagamento2: null, horasAntesPagamento: null, hoje: new Date(2026, 9, 11) };

  it("preenche nome, CPF, valor e reajuste do que existe", () => {
    const t = c(base);
    expect(t).toContain("Nome: Gisele Barbosa");
    expect(t).toContain("João Silva");
    expect(t).toContain("Maria Silva");
    expect(t).toContain("R$ 120,00");
    expect(t).toContain("a cada 6 meses");
  });
  // Doc 41: campo da guia dados vazio SAI do contrato; a CONTRATADA (Perfil) mantém o placeholder.
  it("doc 41: campo vazio da guia dados some; CONTRATADA mantém [placeholder]", () => {
    const t = c({ ...base, analistaCpf: null });
    expect(t).toContain("CPF: [CPF]"); // CONTRATADA, do Perfil → placeholder fica
    const semResp = c({ ...base, responsavelNome: null, responsavelCpf: null });
    expect(semResp).not.toContain("Nome do Responsável:");
    expect(semResp).not.toContain("[Nome Completo do Responsável]");
  });
  it("doc 41: e-mail do contratante aparece quando cadastrado e some quando vazio", () => {
    expect(c({ ...base, responsavelEmail: "mae@exemplo.com" })).toContain("E-mail: mae@exemplo.com");
    expect(c({ ...base })).not.toContain("E-mail: [E-mail de Contato]");
  });
  it("doc 41: sem periodicidade de reajuste, a cláusula 4.3 sai do contrato", () => {
    const sem = c({ ...base, reajusteMeses: null });
    expect(sem).not.toContain("4.3. Reajuste:");
    const com = c({ ...base, reajusteMeses: 6 });
    expect(com).toContain("4.3. Reajuste: O valor dos honorários poderá ser reajustado a cada 6 meses");
  });
  it("doc 41: novo texto da cláusula 5.2 (Faltas do Paciente)", () => {
    const t = c(base);
    expect(t).toContain("5.2. Faltas do Paciente: As sessões em que o paciente não comparecer e não realizar o cancelamento prévio do agendamento serão cobradas normalmente, independentemente do motivo da ausência (saúde, viagens, imprevistos ou compromissos escolares). A cobrança será desconsiderada mediante apresentação de atestado médico.");
  });
  it("doc 41: terapia troca 'analítico' por 'terapêutico' (6.1 e seção 8)", () => {
    const t = c({ ...base, descricaoAtendimento: "terapia" });
    expect(t).toContain("sigilo ético e terapêutico");
    expect(t).toContain("8. DO ENCERRAMENTO E ALTA TERAPÊUTICA");
    expect(t).not.toContain("sigilo ético e analítico");
    const psi = c({ ...base, descricaoAtendimento: "psicanalise" });
    expect(psi).toContain("sigilo ético e analítico");
    expect(psi).toContain("8. DO ENCERRAMENTO E ALTA ANALÍTICA");
  });
  it("calcula idade da data de nascimento", () => {
    const t = c({ ...base, pacienteNascimento: new Date(2010, 0, 1) });
    expect(t).toMatch(/Idade: 1[0-9] anos/);
  });

  // Doc 28 — título, objeto (2.1/2.2), reserva (5.1) e assinatura pela FORMAÇÃO.
  it("título, objeto, processo, reserva e assinatura — PSICANÁLISE", () => {
    const t = c({ ...base, descricaoAtendimento: "psicanalise" });
    expect(t.startsWith("CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE PSICANÁLISE\n")).toBe(true);
    expect(t).toContain("Atendimento e Análise Psicanalítica voltados ao desenvolvimento psíquico");
    expect(t).toContain("Por se tratar de um processo psicanalítico");
    expect(t).toContain("5.1. Reserva do Horário: Na psicanálise,");
    expect(t).toContain("— Psicanalista");
  });
  it("título/objeto/reserva/assinatura — TERAPIA", () => {
    const t = c({ ...base, descricaoAtendimento: "terapia" });
    expect(t.startsWith("CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE TERAPIA\n")).toBe(true);
    expect(t).toContain("a prestação de serviços de Atendimento terapêutico voltados ao PACIENTE acima identificado.");
    expect(t).toContain("Por se tratar de um processo terapêutico");
    expect(t).toContain("5.1. Reserva do Horário: Na terapia,");
    expect(t).toContain("— Terapeuta");
  });
  it("título/objeto/reserva/assinatura — PSICOLOGIA", () => {
    const t = c({ ...base, descricaoAtendimento: "psicologia" });
    expect(t.startsWith("CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE PSICOLOGIA\n")).toBe(true);
    expect(t).toContain("a prestação de serviços de Atendimento Psicológico voltados ao desenvolvimento psíquico");
    expect(t).toContain("Por se tratar de um processo psicológico");
    expect(t).toContain("5.1. Reserva do Horário: Na psicologia,");
    expect(t).toContain("— Psicólogo(a)");
  });

  // Doc 28 — rótulos de seção sem os textos entre parênteses; 3. sem "(SETTING ANALÍTICO)".
  it("rótulos das partes sem (Analista)/(Responsáveis Legais)/(Beneficiário)", () => {
    const t = c(base);
    expect(t).toContain("CONTRATADA:\n");
    expect(t).not.toContain("CONTRATADA (ANALISTA)");
    expect(t).toContain("CONTRATANTE(S):\n");
    expect(t).not.toContain("RESPONSÁVEIS LEGAIS");
    expect(t).toContain("PACIENTE:\nNome: João Silva");
    expect(t).not.toContain("BENEFICIÁRIO");
    expect(t).toContain("3. DO ENQUADRE CLÍNICO E HORÁRIOS");
    expect(t).not.toContain("SETTING ANALÍTICO");
  });
  it("5.3/5.4 falam em PROFISSIONAL, não ANALISTA", () => {
    const t = c(base);
    expect(t).toContain("por parte do PROFISSIONAL");
    expect(t).toContain("5.4. Faltas do Profissional: Caso o PROFISSIONAL precise desmarcar");
    expect(t).not.toContain("por parte da ANALISTA");
  });

  // Doc 23/25 — responsáveis por idade; a linha do Responsável 2 só quando há R2.
  it("menor de 18: responsável do cadastro vira Responsável (sem número); R2 não aparece", () => {
    const t = c(base); // João, 2015
    expect(t).toContain("Nome do Responsável: Maria Silva");
    expect(t).toContain("CPF: 987.654.321-00");
    expect(t).not.toContain("Nome do Responsável 2");
  });
  it("maior de 18 SEM responsável: o próprio paciente é o Responsável; R2 não aparece", () => {
    const t = c({ ...base, pacienteNascimento: new Date(1990, 0, 1), responsavelNome: null, responsavelCpf: null });
    expect(t).toContain("Nome do Responsável: João Silva");
    expect(t).not.toContain("Nome do Responsável 2");
  });
  it("maior de 18 COM responsável: responsável no 1, paciente no 2", () => {
    const t = c({ ...base, pacienteNascimento: new Date(1990, 0, 1) });
    expect(t).toContain("Nome do Responsável: Maria Silva");
    expect(t).toContain("Nome do Responsável 2: João Silva");
  });

  // Doc 25/28 — endereço e telefone do CONTRATANTE preenchidos do cadastro, em linhas próprias.
  it("endereço do contratante é o endereço do paciente", () => {
    expect(c(base)).toContain("Endereço: Rua das Flores, 100 — Centro");
  });
  it("telefone do contratante é o do responsável", () => {
    expect(c(base)).toContain("Telefone: (11) 99999-0000");
  });
  it("sem telefone do responsável, usa o do paciente", () => {
    expect(c({ ...base, responsavelTelefone: null })).toContain("Telefone: (11) 88888-0000");
  });

  // Doc 26 — enquadre dinâmico.
  it("3.1 duração usa 'até X minutos' do maior tempo cadastrado", () => {
    expect(c({ ...base, duracaoMaxMin: 60 })).toContain("terão a duração de até 60 minutos");
  });
  it("3.1 frequência: semanal 1x / 2x / mensal / quinzenal / não repetir", () => {
    expect(c({ ...base, recorrencia: { freq: "semanal", vezesPorSemana: 1, repete: true } })).toContain("ocorre com a frequência Semanal (1x por semana)");
    expect(c({ ...base, recorrencia: { freq: "semanal", vezesPorSemana: 2, repete: true } })).toContain("ocorre com a frequência Semanal (2x por semana)");
    expect(c({ ...base, recorrencia: { freq: "mensal", vezesPorSemana: 1, repete: true } })).toContain("ocorre com a frequência Mensal");
    expect(c({ ...base, recorrencia: { freq: "quinzenal", vezesPorSemana: 1, repete: true } })).toContain("ocorre com a frequência Quinzenal");
  });
  // Doc 42: a cláusula 3.2 "Horário Fixo" saiu; 3.3 Pontualidade virou 3.2.
  it("doc 42: não há mais cláusula de Horário Fixo; Pontualidade é a 3.2", () => {
    const t = c(base);
    expect(t).not.toContain("Horário Fixo");
    expect(t).not.toContain("Toda terça-feira, às 15h00");
    expect(t).toContain("3.2. Pontualidade:");
    expect(t).not.toContain("3.3. Pontualidade:");
  });

  // Doc 28 — vencimento (4.2) por formato.
  it("4.2 mensal: até o dia X do mês vigente", () => {
    expect(c({ ...base, formatoPagamento: "mensal", diaPagamento: 10 })).toContain("efetuado até o dia 10 do mês vigente");
  });
  it("4.2 quinzenal: nos dias X e X", () => {
    expect(c({ ...base, formatoPagamento: "quinzenal", diaPagamento: 10, diaPagamento2: 20 })).toContain("nos dias 10 e 20 do mês vigente");
  });
  it("4.2 primeira/última sessão do pacote (sem 'do mês vigente')", () => {
    expect(c({ ...base, formatoPagamento: "primeira_pacote" })).toContain("efetuado até a primeira sessão de cada pacote.");
    expect(c({ ...base, formatoPagamento: "ultima_pacote" })).toContain("efetuado até a última sessão de cada pacote.");
  });
  it("4.2 avulso: X horas antes da sessão", () => {
    expect(c({ ...base, formatoPagamento: "sessao", horasAntesPagamento: 24 })).toContain("efetuado até 24 horas antes da sessão.");
  });
  it("4.2 gratuito: sem cobrança enquanto a gratuidade vigorar (doc 55)", () => {
    const t = c({ ...base, formatoPagamento: "gratuito" });
    expect(t).toContain("4.2. Vencimento e Forma de Pagamento: Enquanto vigente a condição de gratuidade, não haverá cobrança pelas sessões realizadas, nem data de vencimento ou obrigação de pagamento referente a esses atendimentos.");
    expect(t).not.toContain("[Sua Chave PIX]");
  });

  /**
   * Doc 55: no gratuito a 4.3 deixa de ser Reajuste e passa a ser a cobrança por falta.
   *
   * Reajuste não faz sentido onde o valor é zero — a cláusula ficava prometendo que R$ 0,00
   * subiria a cada seis meses. E sem a cláusula nova o contrato não dá base para cobrar a falta
   * sem aviso, que é o caso em que a terapeuta perde a hora e o dinheiro.
   */
  it("4.3 gratuito: cobrança por falta no lugar do reajuste", () => {
    const t = c({ ...base, formatoPagamento: "gratuito", reajusteMeses: 6 });
    expect(t).toContain("4.3. Cobrança em Caso de Falta:");
    expect(t).toContain("I – Falta sem aviso prévio;");
    expect(t).toContain("fora do prazo mínimo de 24 horas de antecedência da sessão");
    expect(t).toContain("Não haverá cobrança quando o cancelamento ocorrer dentro do prazo estabelecido");
    expect(t).not.toContain("4.3. Reajuste:");
  });

  it("4.3 fora do gratuito continua sendo o reajuste", () => {
    const t = c({ ...base, formatoPagamento: "mensal", reajusteMeses: 6 });
    expect(t).toContain("4.3. Reajuste:");
    expect(t).not.toContain("4.3. Cobrança em Caso de Falta:");
  });
  it("nenhum formato mostra mais a linha de PIX", () => {
    expect(c({ ...base, formatoPagamento: "mensal", diaPagamento: 5 })).not.toContain("via [PIX");
  });

  // Doc 27 — cabeçalho da analista em linhas próprias; doc 28 confirma.
  it("preenche conselho, endereço, plataforma, telefone e e-mail da analista em linhas", () => {
    const t = c({ ...base, analistaConselho: "CRP 06/12345", analistaEndereco: "Av. Central, 10", analistaPlataforma: "Google Meet", analistaTelefone: "(11) 97777-0000", analistaEmail: "gi@exemplo.com" });
    expect(t).toContain("Registro Profissional: CRP 06/12345");
    expect(t).toContain("Endereço: Av. Central, 10");
    expect(t).toContain("Plataforma utilizada para atendimentos online: Google Meet");
    expect(t).toContain("Telefone: (11) 97777-0000");
    expect(t).toContain("E-mail: gi@exemplo.com");
  });
  it("sem dados da analista, mantém os placeholders do cabeçalho", () => {
    const t = c(base);
    expect(t).toContain("Registro Profissional: [Nº do Conselho ou Associação]");
    expect(t).toContain("Endereço: [Endereço]");
    expect(t).toContain("Plataforma utilizada para atendimentos online: [Plataforma utilizada para atendimentos online]");
  });

  // Doc 27/28 — foro + data da assinatura (data = hoje).
  it("foro e local usam cidade/estado; data da assinatura é a de hoje por extenso", () => {
    const t = c({ ...base, cidade: "Campinas", estado: "SP" });
    expect(t).toContain("Foro da Comarca de Campinas / SP");
    expect(t).toContain("Campinas - SP, 11 de outubro de 2026.");
  });
  it("sem cidade, mantém o placeholder do local; data continua a de hoje", () => {
    const t = c(base);
    expect(t).toContain("Foro da Comarca de [Sua Cidade / Estado]");
    expect(t).toContain("[Cidade - UF], 11 de outubro de 2026.");
  });

  // Doc 28 — campos preenchidos pelo sistema saem com marcador de negrito.
  it("os valores preenchidos pelo sistema vêm marcados para negrito", () => {
    const bruto = montarContrato({ ...base, cidade: "Campinas", estado: "SP" });
    expect(bruto).toContain("\u0001Gisele Barbosa\u0002");
    expect(bruto).toContain("\u0001R$ 120,00\u0002");
    expect(bruto).toContain("\u000111 de outubro de 2026\u0002");
  });

  // Doc 29 — sequência (3.1) em negrito. (Doc 42: horário fixo saiu.)
  it("3.1 sequência sai em negrito", () => {
    const bruto = montarContrato(base);
    expect(bruto).toContain("\u0001Semanal (1x por semana)\u0002");
  });
  it("gratuito: 4.1 'R$ 0,00' e 4.2 isenção em negrito (sem 'totalizando')", () => {
    const bruto = montarContrato({ ...base, formatoPagamento: "gratuito" });
    expect(bruto).toContain("\u0001O valor acordado por cada sessão é de R$ 0,00,\u0002 sendo o atendimento concedido gratuitamente por tempo indeterminado.");
    expect(textoLimpo(bruto)).not.toContain("totalizando o valor mensal");
    expect(bruto).toContain("\u0001não haverá cobrança pelas sessões realizadas, nem data de vencimento ou obrigação de pagamento referente a esses atendimentos.\u0002");
    // Doc 55: os negritos da 4.3 nova também são os que o dono marcou.
    expect(bruto).toContain("\u0001A gratuidade não isenta o(a) contratante da possibilidade de cobrança em caso de ausência à sessão previamente agendada\u0002");
    expect(bruto).toContain("\u0001fora do prazo mínimo de 24 horas de antecedência da sessão\u0002");
  });
  it("4.2 primeira/última sessão do pacote: a condição em negrito", () => {
    expect(montarContrato({ ...base, formatoPagamento: "primeira_pacote" })).toContain("\u0001a primeira sessão de cada pacote\u0002");
    expect(montarContrato({ ...base, formatoPagamento: "ultima_pacote" })).toContain("\u0001a última sessão de cada pacote\u0002");
  });

  // Doc 42 — contrato de SUPERVISÃO CLÍNICA (cadastro supervisionado).
  describe("montarContratoSupervisao", () => {
    const s = (x: Parameters<typeof montarContratoSupervisao>[0]) => textoLimpo(montarContratoSupervisao(x));
    it("título, partes e cláusulas próprias da supervisão", () => {
      const t = s(base);
      expect(t.startsWith("CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE SUPERVISÃO CLÍNICA\n")).toBe(true);
      expect(t).toContain("SUPERVISIONANDO(A):\nNome: João Silva");
      expect(t).toContain("Nome do Responsável: Maria Silva");
      expect(t).toContain("CPF: 987.654.321-00"); // doc 44: CPF do responsável no CONTRATANTE
      expect(t).toContain("5.2. Faltas do SUPERVISIONANDO: As sessões em que o SUPERVISIONANDO não comparecer");
      expect(t).toContain("3.2. Pontualidade:");
    });
    it("não tem Horário Fixo nem cláusula de reajuste", () => {
      const t = s(base);
      expect(t).not.toContain("Horário Fixo");
      expect(t).not.toContain("4.3. Reajuste");
    });
    it("papel da assinatura vem da formação (Ajustes)", () => {
      expect(s({ ...base, descricaoAtendimento: "terapia" })).toContain("— Terapeuta");
      expect(s({ ...base, descricaoAtendimento: "psicanalise" })).toContain("— Psicanalista");
      expect(s({ ...base, descricaoAtendimento: "psicologia" })).toContain("— Psicólogo(a)");
    });
    it("campo vazio da guia dados sai do contrato (responsável)", () => {
      expect(s({ ...base, responsavelNome: null })).not.toContain("Nome do Responsável:");
    });
    it("valor e enquadre preenchidos do cadastro", () => {
      const t = s({ ...base, duracaoMaxMin: 50, valorSessao: 200 });
      expect(t).toContain("duração de até 50 minutos");
      expect(t).toContain("R$ 200,00");
    });
  });
});
