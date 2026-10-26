import { pgTable, text, numeric, timestamp, uuid, pgEnum, boolean, integer, primaryKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import type { AdapterAccountType } from "next-auth/adapters"

export const transactionTypeEnum = pgEnum("transaction_type", ["income", "expense"]);
// 'session_payment' = receita gerada automaticamente de um pagamento de sessao (Ledivan)
export const transactionSourceEnum = pgEnum("transaction_source", ["manual", "telegram", "scan", "session_payment"]);

// --- Enums do dominio Terapia (Ledivan) ---
/**
 * O que aconteceu com a sessão.
 *
 * Os cinco primeiros são os originais e ficam como estão — renomear valor de enum reescreveria
 * histórico. O que muda é o RÓTULO na tela: `realizada` é "Presente", `nao_realizada` é "Faltou" e
 * `cancelada` é "Desmarcou". `realocada` continua existindo pelo histórico, e a tela mostra ela
 * como Desmarcou, que é como ela já se comporta (fora da contagem e fora da cobrança).
 *
 * Os dois últimos nasceram do lote das beta testers, e existem porque a pergunta mudou: não é mais
 * só "a sessão aconteceu?", e sim "de quem foi a ausência?" — é disso que depende o paciente perder
 * ou não perder a sessão. Faltar por conta própria e faltar com atestado eram a mesma coisa aqui.
 */
export const sessionStatusEnum = pgEnum("session_status", ["realizada", "nao_realizada", "cancelada", "realocada", "agendada", "prof_desmarcou", "atestado"]);
// "card" é legado (não distingue débito/crédito); doc 49 passou a capturar "debito"/"credito" para o
// cálculo da taxa. Pagamentos antigos em "card" ficam sem split de taxa (não dá para saber qual era).
export const paymentMethodEnum = pgEnum("payment_method", ["pix", "card", "cash", "transfer", "debito", "credito", "credito_2x", "credito_3x", "credito_4x", "credito_5x"]);
export const paymentStatusEnum = pgEnum("payment_status", ["paid", "pending", "overdue"]);
export const contractTypeEnum = pgEnum("contract_type", ["pacote", "avulso"]);

// --- Auth.js Tables ---

export const users = pgTable("user", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  photo3x4: text("photo_3x4"), // foto 3x4 do terapeuta (cabeçalho)
  passwordHash: text("password_hash"), // login por senha (conta demo/apoiador)
  telegramId: text("telegram_id").unique(),
  telegramVerificationCode: text("telegram_verification_code"),
  telegramVerificationExpires: timestamp("telegram_verification_expires"),
  whatsappId: text("whatsapp_id").unique(), // últimos 11 dígitos do número, p/ vincular mensagens recebidas
  bookingSlug: text("booking_slug").unique(), // link público de autoagendamento /agendar/<slug>
  // SMTP próprio do profissional (e-mails ao paciente saem do e-mail dele) — por tenant
  smtpHost: text("smtp_host"),
  smtpPort: integer("smtp_port"),
  smtpSecure: boolean("smtp_secure").default(false),
  smtpUser: text("smtp_user"),
  smtpPassEnc: text("smtp_pass_enc"), // senha de app, criptografada
  smtpFromName: text("smtp_from_name"),
  emailConfigured: boolean("email_configured").default(false).notNull(),
  // IA do próprio terapeuta (BYOK) — usada na transcrição/redação da evolução.
  // O app NÃO carrega chave de provedor: o áudio vai para o provedor DELA, com a chave DELA.
  aiProvider: text("ai_provider"), // openai | groq
  aiKeyEnc: text("ai_key_enc"), // chave do provedor, cifrada (AES-256-GCM)
  // WhatsApp do profissional (instância Evolution própria) — por tenant
  whatsappInstance: text("whatsapp_instance"),
  whatsappConnected: boolean("whatsapp_connected").default(false).notNull(),
  // Endereços de atendimento presencial (até 3): JSON [{name, address}]
  attendanceLocations: text("attendance_locations"),
  // Cidades p/ feriados na agenda (até 3): JSON [{ibge, nome, uf}]. Vazio/null = feriados não ativados.
  holidayCities: text("holiday_cities"),

  // Modelo da mensagem de aniversário (painel Aniversariantes). `{nome}` é trocado pelo primeiro
  // nome do paciente na hora de abrir a caixa. Null = usa o texto padrão do app.
  birthdayMessage: text("birthday_message"),
  // O modelo do lembrete de "Lembrar agendamento": o texto é da terapeuta e vale para todos.
  agendamentoMessage: text("agendamento_message"),
  // O modelo da mensagem de COBRANÇA, personalizável por terapeuta. Variáveis: {nome}, {valor},
  // {vencimento}. Null = usa o texto padrão do app.
  cobrancaMessage: text("cobranca_message"),
  // Dados do profissional que entram no RECIBO. O CPF é obrigatório no documento que ela entrega
  // ao paciente, e não existia em lugar nenhum do cadastro.
  therapistCpf: text("therapist_cpf"),
  // Como o atendimento é descrito no recibo: "atendimentos terapêuticos", "psicanalíticos" ou
  // "psicológicos". A escolha é da terapeuta e vale para todos os recibos dela.
  descricaoAtendimento: text("descricao_atendimento"),
  // Telefone profissional (vai no cabeçalho do contrato, linha de contato da analista). Doc 27.
  therapistPhone: text("therapist_phone"),
  // Nº do Conselho ou Associação (registro profissional no contrato). Doc 27.
  conselho: text("conselho"),
  // Dados que o CONTRATO precisa e só a analista sabe (doc 27). Preenchem os [campos] do modelo:
  // endereço do consultório, cidade e estado (Foro + local da assinatura), plataforma do online.
  enderecoContrato: text("endereco_contrato"),
  cidade: text("cidade"),
  estado: text("estado"),
  plataformaOnline: text("plataforma_online"),
  // Logotipo (doc 31): imagem usada no cabeçalho do contrato e do recibo (quadro 3×3cm, à direita do
  // título). Sem imagem, o espaço fica em branco. Cadastrada uma vez em Ajustes, vale nos dois docs.
  logoUrl: text("logo_url"),

  preferences: text("preferences"), // JSON string
  role: text("role").default("user").notNull(), // user | admin (super admin)
  // Conta demo efêmera (sandbox): clone descartável, expira e é apagada
  isDemo: boolean("is_demo").default(false).notNull(),
  demoExpires: timestamp("demo_expires"),
  // Consentimento (LGPD): obrigatório no 1º acesso
  acceptedTermsAt: timestamp("accepted_terms_at"),
  acceptedPrivacyAt: timestamp("accepted_privacy_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Cache de feriados por cidade+ano (fonte: feriadosapi.com). Global (não por-usuário):
// os feriados de uma cidade valem pra todos. 1 fetch por cidade/ano → respeita a cota da API.
export const holidayCache = pgTable("holiday_cache", {
  id: uuid("id").primaryKey().defaultRandom(),
  cityIbge: integer("city_ibge").notNull(),
  year: integer("year").notNull(),
  data: text("data").notNull(), // JSON: [{ date: "YYYY-MM-DD", nome, tipo }]
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
}, (t) => ([
  uniqueIndex("holiday_cache_city_year").on(t.cityIbge, t.year),
]));

// Log de mensagens enviadas ao paciente (motor de mensageria). Uma linha por tentativa de canal:
// base pra painel de mensagens, cascata (fallback) e telemetria de entrega. Sem PII no corpo.
export const messageLog = pgTable("message_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  patientId: uuid("patient_id"), // ref lógica a patients (sem FK dura p/ preservar o log se o paciente sair)
  event: text("event").notNull(), // session_reminder | session_confirmed | ...
  channel: text("channel").notNull(), // whatsapp | email | telegram | push | sms
  destination: text("destination"), // telefone/e-mail alvo
  status: text("status").notNull(), // sent | failed | skipped
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ([
  index("message_log_user_idx").on(t.userId),
  index("message_log_patient_idx").on(t.patientId),
]));

// Conversa 2-via com o paciente (inbox). Guarda o TEXTO (entrada do paciente + saída do terapeuta).
export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  patientId: uuid("patient_id"), // ref lógica; null = contato não casado com paciente
  direction: text("direction").notNull(), // in (paciente→terapeuta) | out (terapeuta→paciente)
  channel: text("channel").notNull(), // whatsapp | email | sms
  contact: text("contact"), // número/e-mail do contato
  text: text("text").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ([
  index("messages_user_patient_idx").on(t.userId, t.patientId),
  index("messages_user_created_idx").on(t.userId, t.createdAt),
]));

// Material/documento compartilhado do terapeuta PARA o paciente (aparece no app). Texto ou link.
// (Diferente de patient_records, que são notas clínicas confidenciais do terapeuta.)
export const patientDocument = pgTable("patient_document", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  kind: text("kind").default("text").notNull(), // text | link
  content: text("content").notNull(), // texto do material OU url
  // Compartilhado com o paciente (aparece no app dele) ou ANEXO interno do prontuário.
  // O padrão é `true` porque tudo o que já existia era material para o paciente ver; os anexos
  // do prontuário nascem com `false` e nunca saem do lado do terapeuta.
  compartilhado: boolean("compartilhado").default(true).notNull(),
  // Anexo preso a UM registro do histórico terapêutico (prints 6.pdf, item 5). Null = anexo do
  // prontuário em geral (nível do paciente). Cai junto quando o registro é apagado.
  recordId: uuid("record_id").references(() => patientRecords.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ([
  index("patient_document_patient_idx").on(t.patientId),
  index("patient_document_record_idx").on(t.recordId),
]));

// Diário entre sessões (#6/diary): o paciente escreve; o terapeuta lê antes da próxima sessão.
export const patientDiary = pgTable("patient_diary", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
  content: text("content").notNull(),
  mood: integer("mood"), // 1-5 opcional
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ([
  index("patient_diary_patient_idx").on(t.patientId),
]));

// Avaliação pós-sessão (#9/rating): feedback rápido do paciente. Uma avaliação por sessão.
export const sessionRatings = pgTable("session_ratings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
  sessionId: uuid("session_id").references(() => therapySessions.id, { onDelete: "cascade" }).notNull(),
  score: integer("score").notNull(), // 1-5
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ([
  uniqueIndex("session_ratings_session_uq").on(t.sessionId),
  index("session_ratings_patient_idx").on(t.patientId),
]));

// Termo de consentimento do terapeuta (#11/consent): um termo ativo por terapeuta.
export const consentForms = pgTable("consent_forms", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Aceite do paciente (snapshot do termo no momento do aceite + carimbo).
export const patientConsents = pgTable("patient_consents", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(), // snapshot do termo aceito
  acceptedName: text("accepted_name").notNull(),
  formUpdatedAt: timestamp("form_updated_at").notNull(), // versão do termo aceita
  ip: text("ip"),
  acceptedAt: timestamp("accepted_at").defaultNow().notNull(),
}, (t) => ([
  index("patient_consents_patient_idx").on(t.patientId),
]));

// Código de login do paciente (app nativo) — enviado por WhatsApp, curto TTL. Posse do número = auth.
export const patientAuthCode = pgTable("patient_auth_code", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ([
  index("patient_auth_code_patient_idx").on(t.patientId),
]));

export const accounts = pgTable("account", {
    userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    {
      compoundKey: primaryKey({
        columns: [account.provider, account.providerAccountId],
      }),
    }
  ]
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable("verificationToken", {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [
    {
      compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
    }
  ]
);

// --- Application Tables ---

export const financialAccounts = pgTable("financial_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(), // e.g., 'Nubank', 'Carteira', 'Inter'
  type: text("type").notNull(), // 'checking', 'savings', 'credit_card', 'cash'
  balance: numeric("balance", { precision: 12, scale: 2 }).default("0").notNull(),
  color: text("color"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  // NULL = categoria PADRÃO (global, compartilhada por todos). Preenchido = categoria do próprio
  // terapeuta. Os seletores mostram global + a do dono; nunca a de outro tenant.
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: transactionTypeEnum("type").notNull(),
  icon: text("icon"),
  color: text("color"),
}, (t) => [index("categories_user_idx").on(t.userId)]);

export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  accountId: uuid("account_id").references(() => financialAccounts.id, { onDelete: "set null" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  type: transactionTypeEnum("type").notNull(),
  categoryId: uuid("category_id").references(() => categories.id),
  description: text("description"),
  date: timestamp("date").defaultNow().notNull(),
  source: transactionSourceEnum("source").default("manual").notNull(),
  method: text("method"), // forma: pix | debito | credito | dinheiro | deposito | transferencia | boleto | outro
  reconciledAt: timestamp("reconciled_at"), // conciliado com extrato bancário
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("tx_user_idx").on(t.userId),
  index("tx_date_idx").on(t.date),
  index("tx_user_date_idx").on(t.userId, t.date),
]);

// Espaço do Paciente: tarefas (lição de casa) com resposta multimídia.
export const assignments = pgTable("assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
  token: text("token").unique().notNull(), // link mágico do paciente: /p/<token>
  title: text("title").notNull(),
  instructions: text("instructions"),
  responseType: text("response_type").default("texto").notNull(), // texto | foto | audio | video | livre
  status: text("status").default("pendente").notNull(), // pendente | respondida
  dueDate: timestamp("due_date"),
  // resposta do paciente (MVP: uma resposta por tarefa)
  responseText: text("response_text"),
  responseFileUrl: text("response_file_url"),
  responseFileType: text("response_file_type"),
  respondedAt: timestamp("responded_at"),
  therapistComment: text("therapist_comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// --- Tabelas do dominio Terapia (Ledivan) ---
// Todas escopadas por userId (multi-tenant: cada terapeuta isolado).

export const patients = pgTable("patients", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  avatar: text("avatar"),
  photo3x4: text("photo_3x4"), // foto 3x4 de referência do cadastro
  photoExtra1: text("photo_extra1"),
  photoExtra2: text("photo_extra2"),
  photoExtra3: text("photo_extra3"),
  sessionFee: numeric("session_fee", { precision: 10, scale: 2 }).default("0").notNull(),
  frequency: text("frequency"), // ex: "semanal", "quinzenal"
  notes: text("notes"),
  paymentStatus: paymentStatusEnum("payment_status").default("pending").notNull(),
  patientStatus: text("patient_status").default("ativo").notNull(), // ativo | inativo | prospect | pausado
  // Doc 41: um cadastro pode ser um PACIENTE (padrão) ou um SUPERVISIONADO (supervisionando sob
  // acompanhamento). O supervisionado registra só os dados pessoais — sem financeiro, contrato,
  // responsável, devolutiva nem escola. É uma classificação do cadastro, ortogonal ao status.
  cadastroKind: text("cadastro_kind").default("paciente").notNull(), // paciente | supervisionado
  lastReactivationAt: timestamp("last_reactivation_at"), // última mensagem de reativação (throttle da campanha)
  // Quando o paciente VOLTOU a ser atendido, saindo de inativo/pausado para ativo. É a referência
  // do reajuste: contar a validade do preço do início original faria o reajuste vencer no dia em
  // que a pessoa volta, depois de meses parada. Não confundir com `lastReactivationAt`, que é o
  // throttle da campanha de mensagens.
  returnedAt: timestamp("returned_at"),
  featureOverrides: text("feature_overrides"), // JSON: liga/desliga recursos "por paciente" (ver lib/features)
  startedAt: timestamp("started_at"),
  birthDate: timestamp("birth_date"),
  category: text("category"), // LEGADO: crianca | adolescente | adulto | idoso | casal.
  // Não é mais preenchido pelo cadastro. A idade passou a ser CALCULADA da data de nascimento —
  // classificação é rótulo que envelhece sozinho: a criança cadastrada em 2019 continua "criança"
  // até alguém lembrar de editar. Fica a coluna para não perder o que já foi registrado.
  isCouple: boolean("is_couple").default(false).notNull(), // atendimento de casal (abre o bloco do cônjuge)
  guardianRelationship: text("guardian_relationship"), // grau de parentesco do responsável
  // Devolutiva periódica: a cada quantos meses, contados da primeira sessão. Nulo = não combinada.
  devolutivaMeses: integer("devolutiva_meses"),
  // Devolutiva deste ciclo "dispensada" no Dashboard (✓) — guarda a data da própria devolutiva, para
  // ela sumir da lista agora e reaparecer só no ciclo seguinte (doc 9, item 2).
  devolutivaDispensadaEm: timestamp("devolutiva_dispensada_em"),
  queixaPrincipal: text("queixa_principal"), // queixa/demanda principal (lista curada + "Outro:") — ver lib/queixas
  gender: text("gender"), // gênero (texto livre quando "outro")
  cpf: text("cpf"),
  guardianName: text("guardian_name"), // responsável (menores/incapazes)
  guardianCpf: text("guardian_cpf"),
  guardianPhone: text("guardian_phone"),
  guardianEmail: text("guardian_email"),
  // cônjuge (quando classificação = casal)
  spouseName: text("spouse_name"),
  spousePhone: text("spouse_phone"),
  spouseEmail: text("spouse_email"),
  spouseCpf: text("spouse_cpf"),
  // No atendimento de casal os dois são pacientes, e o cônjuge precisa da mesma ficha básica:
  // nascimento (de onde sai a idade), queixa, gênero e endereço.
  spouseBirthDate: timestamp("spouse_birth_date"),
  spouseQueixaPrincipal: text("spouse_queixa_principal"),
  spouseGender: text("spouse_gender"),
  spouseAddress: text("spouse_address"),
  attendanceDay: text("attendance_day"), // dia da semana preferencial (seg..dom)
  attendanceTime: text("attendance_time"), // hora preferencial HH:MM
  address: text("address"),
  // Escola do paciente (relevante em criança/adolescente): nome e um contato da escola. É
  // CAMPO do paciente, não entidade própria — vira filtro e coluna no relatório de pacientes.
  schoolName: text("school_name"),
  schoolContact: text("school_contact"),
  // contato de emergencia (embutido)
  emergencyName: text("emergency_name"),
  emergencyPhone: text("emergency_phone"),
  emergencyEmail: text("emergency_email"),
  emergencyRelationship: text("emergency_relationship"),
  // dados de prospeccao (embutido; tela Prospects filtra patientStatus='prospect')
  prospectDate: timestamp("prospect_date"),
  prospectFechou: text("prospect_fechou"), // 'Fechou' | 'Não fechou' | ''
  prospectObservacoes: text("prospect_observacoes"),
  paymentDay: integer("payment_day"), // dia do mes para cobranca
  priceReviewDate: timestamp("price_review_date"), // vencimento do valor atual (lembrete de reajuste)
  contractType: contractTypeEnum("contract_type").default("avulso"),
  attendanceMode: text("attendance_mode").default("presencial").notNull(), // online | presencial | misto
  attendanceLocation: text("attendance_location"), // endereço pré-selecionado (presencial/misto)
  timesPerPeriod: integer("times_per_period").default(1).notNull(), // vezes por período da recorrência (ex: 2x/semana)
  // gratuito | sessao | mensal | quinzenal | primeira_pacote | ultima_pacote
  // (valores antigos: avulso, pacote — ainda lidos)
  //
  // "avulso" virou "sessao" e "pacote" virou uma FORMA de cobrar dentro de mensal/quinzenal, que
  // é como o dono descreve o combinado com o paciente: primeiro o formato, depois o pacote.
  // Nullable (doc 17): no 1º cadastro o usuário pode salvar só os Dados; aí o financeiro fica
  // "não definido" (null) — nem Gratuito, nem padrão — até ele preencher a guia Financeiro.
  paymentFormat: text("payment_format").default("sessao"),
  // Só para "a cada sessão": quantas horas ANTES do atendimento o pagamento deve estar feito.
  // É o gatilho da cobrança automática, que ainda não foi ligada.
  horasAntesPagamento: integer("horas_antes_pagamento"),
  // Validade do preço em meses, contada do início — ou do RETORNO, quando o paciente parou e
  // voltou. A data vencida fica em `priceReviewDate`, calculada a partir daqui.
  validadePrecoMeses: integer("validade_preco_meses"),
  // Pacote: "completo" são 4 sessões (o padrão do dono); "fragmentado" é por semanas do mês.
  pacoteTipo: text("pacote_tipo"),
  // LEGADO: o terapeuta informava quantas semanas do mês tinham atendimento. Não é mais
  // perguntado — o sistema conta as sessões DENTRO DO MÊS, pelos agendamentos da agenda.
  semanasNoMes: integer("semanas_no_mes"),
  // Quinzenal tem dois dias de pagamento; o primeiro reaproveita `paymentDay`.
  paymentDay2: integer("payment_day_2"),
  sessionsInPacket: integer("sessions_in_packet"), // tamanho do pacote (2/4/8)
  // Contrato editado e SALVO para este paciente (doc 28): quando preenchido, a tela abre com este
  // texto no lugar do contrato gerado. Null = usa o contrato montado dos dados atuais.
  contratoTexto: text("contrato_texto"),
  packageCreditsUsed: integer("package_credits_used").default(0).notNull(), // créditos do pacote já consumidos
  deductPackageOnSession: boolean("deduct_package_on_session").default(true).notNull(), // sessão realizada abate do pacote (senão, abate no pagamento)
  // Lembrete de sessao (escolha do terapeuta por paciente)
  reminderEnabled: boolean("reminder_enabled").default(false).notNull(),
  reminderChannel: text("reminder_channel").default("whatsapp").notNull(), // whatsapp | email | telegram
  reminderLeadMinutes: integer("reminder_lead_minutes").default(60).notNull(), // antecedência (min) do lembrete
  moodToken: text("mood_token").unique(), // link do diário de humor: /humor/<token>
  tags: text("tags"), // etiquetas separadas por vírgula
  // Cadastro (form): número sequencial por terapeuta + identificação na agenda + vencimento.
  registrationNumber: integer("registration_number"), // sequencial por terapeuta (0001, 0002…); gerado no create
  agendaId: text("agenda_id"), // identificação do paciente na agenda
  dueDateType: text("due_date_type"), // avista | 7d | 15d | 30d | fim_mes | data
  dueDate: timestamp("due_date"), // data específica (quando dueDateType = "data")
  // Lembrete de "status do dia": de quantos em quantos dias o app avisa o paciente para mandar
  // o status. 0 = desligado; 1 = diário; 2/3 = a cada 2/3 dias; 7 = semanal. Escolha do terapeuta.
  statusReminderDays: integer("status_reminder_days").default(0).notNull(),
  statusReminderLastAt: timestamp("status_reminder_last_at"), // último lembrete enviado (throttle do cron)
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("pat_user_idx").on(t.userId),
  index("pat_user_status_idx").on(t.userId, t.patientStatus),
  index("pat_user_regnum_idx").on(t.userId, t.registrationNumber),
]);

// Escalas de desfecho (PHQ-9/GAD-7) aplicadas ao paciente via link mágico.
export const scaleApplications = pgTable("scale_applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
  token: text("token").unique().notNull(),
  scaleType: text("scale_type").notNull(), // phq9 | gad7
  status: text("status").default("pendente").notNull(), // pendente | respondida
  answers: text("answers"), // JSON array de números
  score: integer("score"),
  severity: text("severity"),
  appliedAt: timestamp("applied_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Diário de humor do paciente (registros via link mágico).
export const moodLogs = pgTable("mood_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
  mood: integer("mood").notNull(), // 1 a 5
  note: text("note"),
  context: text("context").default("free").notNull(), // free | pre | post (check-in pré/pós sessão)
  loggedAt: timestamp("logged_at").defaultNow().notNull(),
}, (t) => [
  index("mood_patient_idx").on(t.patientId),
]);

// Status do dia: o paciente registra como está chegando (emoji + texto). O terapeuta consulta
// ANTES da sessão, é avisado por push, e pode REAGIR (emoji + nota) — a reação volta ao paciente.
// Entra no prontuário e a série vira uma curva de humor. Recurso ligável por paciente (statusDia).
export const patientDailyStatus = pgTable("patient_daily_status", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
  emoji: text("emoji").notNull(),       // caractere emoji escolhido (grade curada, por faixa etária)
  mood: integer("mood"),                // 1-5 derivado do emoji (p/ a curva de humor), opcional
  text: text("text"),                   // texto livre do paciente
  reactionEmoji: text("reaction_emoji"),// reação do terapeuta
  reactionText: text("reaction_text"),
  reactionAt: timestamp("reaction_at"),
  seenByTherapistAt: timestamp("seen_by_therapist_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("pds_patient_idx").on(t.patientId),
  index("pds_user_created_idx").on(t.userId, t.createdAt),
]);

// Escrita terapêutica: o paciente escreve no app a partir de uma proposta (story). É PRIVADO por
// padrão; o paciente decide se compartilha com o terapeuta (shared). Recurso ligável (escritaTerapeutica).
export const patientWriting = pgTable("patient_writing", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
  promptKey: text("prompt_key"),        // qual story/proposta motivou a escrita
  promptTitle: text("prompt_title"),
  content: text("content").notNull(),
  shared: boolean("shared").default(false).notNull(), // compartilhado com o terapeuta?
  sharedAt: timestamp("shared_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("pw_patient_idx").on(t.patientId),
  index("pw_user_shared_idx").on(t.userId, t.shared),
]);

export const patientStatusHistory = pgTable("patient_status_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
  status: text("status").notNull(),
  date: timestamp("date").defaultNow().notNull(),
});

// Tentativas de contato com um prospect. A MESMA pessoa pode ser contatada mais de uma vez —
// era o que faltava: o cadastro guardava uma observação só, então o segundo contato apagava o
// primeiro. Cada linha é data do contato + observação; a pessoa continua aparecendo uma vez na
// lista, com N contatos dentro.
export const prospectContacts = pgTable("prospect_contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
  date: timestamp("date").defaultNow().notNull(),
  observacao: text("observacao"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ([
  index("prospect_contacts_patient_idx").on(t.patientId),
]));

export const patientPriceHistory = pgTable("patient_price_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
  valor: numeric("valor", { precision: 10, scale: 2 }).notNull(),
  dataEfetiva: timestamp("data_efetiva").notNull(), // quando o novo preco passa a valer
  dataCriacao: timestamp("data_criacao").defaultNow().notNull(),
});

// VIGÊNCIA DO FORMATO DE PAGAMENTO — uma linha por troca, no mesmo modelo do histórico de preço.
//
// Regra do dono (15/09/2026): a troca vale "somente a partir da data definida, sem modificar os
// atendimentos anteriores". `patients.payment_format` continua existindo como o formato ATUAL (é o
// que o cadastro mostra), mas quem decide a cobrança de cada sessão é esta tabela: o formato que
// valia no dia dela. Ver `src/lib/vigenciaDoFormato.ts`.
export const patientPaymentFormatHistory = pgTable("patient_payment_format_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
  formato: text("formato").notNull(), // gratuito | sessao | mensal | quinzenal | primeira_pacote | ultima_pacote
  pacoteTipo: text("pacote_tipo"), // completo | fragmentado — trocar só isto também abre período novo
  dataEfetiva: timestamp("data_efetiva").notNull(), // a partir de quando vale (só o DIA importa)
  dataCriacao: timestamp("data_criacao").defaultNow().notNull(), // desempate de duas trocas no mesmo dia
}, (t) => [
  index("ppfh_patient_idx").on(t.patientId),
]);

// VIGÊNCIA DO TAMANHO DO PACOTE (doc 30) — mesmo modelo do histórico de formato. Mudar a quantidade
// de sessões do pacote com uma data em "Vale a partir de" vale só das sessões com data >= a vigência:
// o anterior fica intacto e a sequência reinicia em 1/N. `patients.sessions_in_packet` segue como o
// tamanho ATUAL; quem decide a numeração por data é esta tabela. Ver `sequenciaPacote.ts`.
export const patientPackageHistory = pgTable("patient_package_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
  tamanho: integer("tamanho").notNull(), // quantidade de sessões do pacote a partir da vigência
  dataEfetiva: timestamp("data_efetiva").notNull(),
  dataCriacao: timestamp("data_criacao").defaultNow().notNull(),
}, (t) => [
  index("pph_patient_idx").on(t.patientId),
]);

export const patientContractHistory = pgTable("patient_contract_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
  type: text("type").notNull(), // contract_type | package_size | frequency | payment_day
  from: text("from"),
  to: text("to"),
  description: text("description"),
  date: timestamp("date").defaultNow().notNull(),
});

export const therapySessions = pgTable("therapy_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
  date: timestamp("date").notNull(),
  duration: integer("duration").default(50).notNull(), // minutos
  fee: numeric("fee", { precision: 10, scale: 2 }).default("0").notNull(),
  status: sessionStatusEnum("status").default("agendada").notNull(),
  notes: text("notes"),
  justificativa: text("justificativa"), // p/ faltas/cancelamentos
  chargeable: boolean("chargeable").default(true).notNull(),
  isOnline: boolean("is_online").default(false).notNull(), // atendimento por vídeo
  location: text("location"), // local presencial (endereço/rótulo) quando não-online
  pendingConfirmation: boolean("pending_confirmation").default(false).notNull(), // agendamento público aguardando confirmação
  patientConfirmedAt: timestamp("patient_confirmed_at"), // paciente confirmou presença (botão/link do lembrete)
  rescheduleRequestedAt: timestamp("reschedule_requested_at"), // paciente pediu p/ remarcar (botão/link)
  timerStartedAt: timestamp("timer_started_at"), // cronômetro da sessão iniciado
  timerEndedAt: timestamp("timer_ended_at"), // cronômetro encerrado
  patientArrivedAt: timestamp("patient_arrived_at"), // paciente tocou "Cheguei" (sala de espera)
  sessionKind: text("session_kind").default("consulta").notNull(), // consulta | devolutiva (devolutiva a responsáveis)
  // Devolutiva marcada para ABATER do pacote: não gera cobrança, mas ocupa uma posição na
  // sequência. Sem a marca, a devolutiva acontece fora do pacote — contá-la ali roubaria uma
  // consulta do paciente.
  abaterDoPacote: boolean("abater_do_pacote").default(false).notNull(),
  // Doc 45: numa sessão "Faltou" (nao_realizada), o dono responde "Considerar sessão realizada?".
  // true = conta para cobrança/pacote (comportamento padrão); false = não cobra (R$0) e não abate do
  // pacote; null = legado (conta, como sempre foi). Só tem efeito quando o status é nao_realizada.
  faltouConta: boolean("faltou_conta"),
  // Doc 55: a sessão avulsa que voltou a ser gratuita E TINHA pagamento lançado, com a terapeuta
  // escolhendo ESTORNAR. O pagamento em si é apagado — então o dinheiro sai de todas as somas
  // sozinho; o que fica aqui é o REGISTRO do estorno, para a guia Geral poder dizer "Estorno
  // realizado no valor de R$ xx,xx" em vez de a linha simplesmente esvaziar sem explicação.
  // Doc 57: a sessão AVUL que virou GRAT e cujo pagamento virou CRÉDITO, por não haver próxima
  // sessão elegível para recebê-lo. Guarda só o valor, para a guia Geral poder dizer que há um
  // crédito esperando — o crédito em si mora em `patient_credits`, com o resto do app.
  creditoValor: numeric("credito_valor", { precision: 10, scale: 2 }),
  estornoValor: numeric("estorno_valor", { precision: 10, scale: 2 }),
  estornoEm: timestamp("estorno_em"),
  // Doc 58: a DATA da sessão que recebeu o pagamento transferido. Sem ela a transferência ficava
  // invisível — a linha esvaziava aqui e o dinheiro aparecia noutro lugar, sem ligar as duas.
  transferidoPara: timestamp("transferido_para"),
  // Doc 58: a data da sessão em que o crédito foi abatido. É ela que troca "possui um crédito que
  // será abatido" por "crédito utilizado na sessão do dia xx/xx/xx".
  creditoUsadoEm: timestamp("credito_usado_em"),
  // Doc 54: atendimento do pacote dado de CORTESIA. Ele não cobra e deixa de ocupar posição na
  // sequência — a sessão seguinte assume o número que ele teria —, mas continua pertencendo ao
  // pacote e ao grupo de pagamento dele. É o que o separa de `extra: "grat"`, que acontece FORA do
  // pacote e seria o lançamento isolado que o doc proíbe.
  cortesia: boolean("cortesia").default(false).notNull(),
  // SESSÃO EXTRA, FORA da sequência do pacote (dono, 15/09/2026). `avul` gera cobrança própria no
  // `valorExtra`; `grat` não gera nada. Nenhuma das duas mexe na numeração nem no valor do pacote, e
  // as duas valem independentemente do formato de pagamento do paciente. `null` = sessão comum.
  extra: text("extra"),
  valorExtra: numeric("valor_extra", { precision: 10, scale: 2 }),
  // presencial | online | misto. O `isOnline` continua existindo porque meia dúzia de telas o
  // leem; ele passa a SAIR daqui, em vez de ser a fonte.
  modality: text("modality"),
  // "Confirmar sessão" do lote: por WhatsApp ou e-mail, tantas horas antes. Diferente de
  // `pendingConfirmation`, que marca reserva pedida pelo link público.
  confirmChannel: text("confirm_channel"),
  confirmLeadHours: integer("confirm_lead_hours"),
  // Qual sessão desmarcada esta aqui REPÕE (documento de 17/09). É o que distingue repor de
  // acrescentar: a reposição ocupa a vaga que a desmarcada deixou no mês, enquanto uma sessão a
  // mais cria vaga nova e aumenta o que o mês cobra. Sem esse vínculo os dois casos chegam ao
  // cálculo com os mesmos dados. Sem FK de propósito: apagar a desmarcada não deve apagar nada,
  // e a conta lida com um vínculo órfão sem quebrar.
  repoeSessaoId: uuid("repoe_sessao_id"),
  packageId: uuid("package_id"), // vínculo opcional com um pacote (patient_packages); numeração 1/N derivada por data
  recurring: boolean("recurring").default(false).notNull(), // reserva recorrente
  recurrenceFreq: text("recurrence_freq"), // semanal | quinzenal | mensal (base p/ "Vago Quinzenal" na agenda)
  recurrenceUntil: timestamp("recurrence_until"), // data limite da recorrência
  // Doc 36: sessão de quinzenal editada "APENAS ESTE" (saiu do compasso da série). NÃO mexe na
  // sequência/numeração/pacote — só faz o espelho projetar a semana ANTERIOR, nunca a posterior.
  espelhoSoAnterior: boolean("espelho_so_anterior").default(false).notNull(),
  googleEventId: text("google_event_id"), // vínculo com evento no Google Calendar (sync)
  meetingUrl: text("meeting_url"), // link Google Meet (se gerado); senão usa Jitsi derivado do id
  reminderSentAt: timestamp("reminder_sent_at"), // evita lembrete duplicado
  // Aviso de pagamento da sessão ("pagar até X horas antes"). É UMA mensagem só, e esta coluna
  // garante isso. Nada acontece sozinho depois dela: quem decide atender ou cancelar é o
  // terapeuta — a agenda só marca a sessão como pagamento atrasado.
  avisoPagamentoAt: timestamp("aviso_pagamento_at"),
  patientSummary: text("patient_summary"), // resumo pós-sessão para o paciente (IA)
  // Rastreio da reunião online (sala Jitsi embutida emite eventos)
  meetingHappened: boolean("meeting_happened").default(false).notNull(),
  meetingOpenedAt: timestamp("meeting_opened_at"), // terapeuta abriu a sala
  guestJoinedAt: timestamp("guest_joined_at"), // primeiro convidado entrou
  meetingEndedAt: timestamp("meeting_ended_at"), // sala encerrada
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("ts_user_idx").on(t.userId),
  index("ts_patient_idx").on(t.patientId),
  index("ts_date_idx").on(t.date),
  index("ts_user_status_idx").on(t.userId, t.status),
  index("ts_user_date_idx").on(t.userId, t.date),
  index("ts_pending_date_idx").on(t.pendingConfirmation, t.date),
]);

// Plano terapêutico: objetivos do tratamento + progresso.
export const treatmentGoals = pgTable("treatment_goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").default("ativo").notNull(), // ativo | atingido | pausado
  progress: integer("progress").default(0).notNull(), // 0-100
  targetDate: timestamp("target_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Prontuário: registros clínicos por paciente (evolução, anamnese, nota).
export const patientRecords = pgTable("patient_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
  sessionId: uuid("session_id").references(() => therapySessions.id, { onDelete: "set null" }),
  type: text("type").default("evolucao").notNull(), // evolucao | anamnese | nota
  title: text("title"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("pr_patient_idx").on(t.patientId),
]);

// Anamnese do paciente (doc 33): cada CAMPO é uma linha, com Salvar/Editar próprios. Os campos
// padrão (identificação, queixa, etc.) e os campos personalizados ("+Adicionar campo") convivem na
// mesma tabela; `position` ordena. `updatedAt` registra o momento da última alteração (o dono pede
// que editar atualize a data/hora). Substitui a anamnese-como-registro-único (patientRecords type
// "anamnese").
export const patientAnamnese = pgTable("patient_anamnese", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  content: text("content").default("").notNull(),
  // Campo do modelo padrão (não removível) vs. personalizado ("+Adicionar campo", removível).
  custom: boolean("custom").default(false).notNull(),
  position: integer("position").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("anamnese_patient_idx").on(t.patientId),
]);

// Atividades e ferramentas realizadas COM o paciente (doc 33): registro interno do profissional
// (não é tarefa enviada ao paciente). Título + descrição; editar atualiza `updatedAt`.
export const patientActivities = pgTable("patient_activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  description: text("description").default("").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("activities_patient_idx").on(t.patientId),
]);

// Documentos individuais do paciente (doc 33): texto livre elaborado pelo profissional, com
// cabeçalho padronizado na impressão. Numerados por paciente (`number`, fixo na criação, sem
// renumerar quando outro é editado/excluído). `updatedAt` = último salvamento/alteração.
export const patientDocuments = pgTable("patient_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
  number: integer("number").notNull(),
  // Doc 34: nome do documento (dado ao salvar); é o rótulo na lista. Null = usa "Documento N".
  name: text("name"),
  content: text("content").default("").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("documents_patient_idx").on(t.patientId),
]);

// Mudanças de configuração que entram no "Histórico de reajuste" (doc 33 F15) além de formato/preço:
// nº de sessões do pacote, dia de vencimento, "pagar até", intervalo de reajuste, pacote
// completo/fragmentado. Uma linha por mudança (campo, de, para, quando). Puramente para EXIBIÇÃO —
// o motor continua lendo vigências/preço/tamanho das tabelas próprias.
export const patientReajusteChanges = pgTable("patient_reajuste_changes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
  campo: text("campo").notNull(), // sessoes | vencimento | vencimento2 | pagarAte | reajuste | pacote
  de: text("de"),
  para: text("para"),
  at: timestamp("at").defaultNow().notNull(),
  // Doc 35 (A1): a data de VIGÊNCIA da mudança ("Vale a partir de"), para agrupar o histórico por
  // vigência (acordeão). Nula nos registros antigos — a tela cai na data do pedido (`at`) nesses.
  vigencia: timestamp("vigencia"),
}, (t) => [
  index("reajuste_changes_patient_idx").on(t.patientId),
]);

// Crédito no saldo do paciente (doc 36): quando paga a mais e o usuário escolhe guardar a sobra.
// Um crédito é consumido no próximo pagamento (abate automático). `consumidoEm` null = disponível.
export const patientCredits = pgTable("patient_credits", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
  valor: numeric("valor", { precision: 10, scale: 2 }).notNull(),
  // O pagamento (sobra) que GEROU este crédito — para reverter se aquele pagamento for removido.
  origemPagamentoId: uuid("origem_pagamento_id"),
  // O pagamento kind="credito" que CONSUMIU este crédito — para reverter se aquele for removido.
  consumidoPagamentoId: uuid("consumido_pagamento_id"),
  consumidoEm: timestamp("consumido_em"),
  // Doc 59: "este crédito não vai mais sozinho". O crédito passou a ir automaticamente para a
  // próxima sessão que tem o que pagar — e, sem esta marca, remover a aplicação para pôr o valor
  // em outra sessão seria impossível: ele voltaria na mesma hora. Posta só quando a pessoa REMOVE
  // uma aplicação automática; o crédito continua disponível, mas só entra onde ela mandar.
  naoAuto: boolean("nao_auto").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("patient_credits_patient_idx").on(t.patientId),
]);

export const sessionPayments = pgTable("session_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
  sessionId: uuid("session_id").references(() => therapySessions.id, { onDelete: "set null" }),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  date: timestamp("date").defaultNow().notNull(),
  method: paymentMethodEnum("method").default("pix").notNull(),
  status: paymentStatusEnum("status").default("paid").notNull(),
  kind: text("kind"), // null = pagamento normal; "pacote" = crédito de pacote (não é receita)
  packageId: uuid("package_id"), // vínculo opcional com um pacote (patient_packages)
  // Quem pagou — a guia Geral pede "o responsável pelo pagamento", que nem sempre é o paciente.
  pagoPor: text("pago_por"),
  // CPF de quem pagou, opcional. Entra no recibo quando informado; sem ele, o recibo simplesmente
  // não traz a linha — "CPF: —" num recibo é pior do que nada.
  pagoPorCpf: text("pago_por_cpf"),
  // Quando o RECIBO em papel foi emitido (documento de 17/09). A nota fiscal tem coluna própria e
  // mais antiga — `receiptIssuedAt`, logo abaixo: é o mesmo fato que a tela do Receita Saúde já
  // acompanha, e duas colunas para ele fariam as duas telas discordarem.
  reciboEmitidoEm: timestamp("recibo_emitido_em"),
  // A qual cobrança este pagamento pertence (a `chave` de `cobrancasDoPaciente`). Pagamento antigo
  // sem chave é distribuído pela ordem de vencimento.
  cobrancaChave: text("cobranca_chave"),
  /**
   * Doc 57: o pagamento foi ESTORNADO — devolvido ao paciente.
   *
   * A linha fica. Apagá-la fazia o dinheiro sumir do histórico sem deixar rastro: a entrada
   * desaparecia do extrato e ninguém conseguia ver que houve pagamento e devolução. Com a marca, o
   * extrato mostra as duas pontas — a entrada no dia em que ela aconteceu e a saída no dia do
   * estorno —, e o saldo fecha em zero, que é a verdade.
   *
   * Um pagamento estornado NÃO quita nada: ele é ignorado ao casar pagamentos com cobranças.
   */
  estornadoEm: timestamp("estornado_em"),
  // Doc 59: de qual sessão este pagamento VEIO, quando ele foi transferido. Ao transferir, ele
  // passa a apontar para o destino — e sem este caminho de volta não haveria como limpar a marca
  // da origem se o pagamento fosse excluído, que é o que o documento pede ("como se nunca tivesse
  // existido"). Só a transferência preenche.
  origemSessaoId: uuid("origem_sessao_id"),
  // "Não haverá diferença de valor" (doc 17): quando a pessoa lança MENOS do que a cobrança e marca
  // esta opção, a cobrança é QUITADA mesmo faltando — a diferença é perdoada, nunca vira "pago em
  // parte". O caixa continua honesto: guarda o valor REALMENTE recebido (`amount`); quem fecha a
  // cobrança é esta marca, lida por `guiaGeral.casarPagamentos`.
  quitaDiferenca: boolean("quita_diferenca").default(false),
  // VINCULO OPCIONAL com o financeiro: se preenchido, este pagamento gerou uma transacao de receita.
  linkedTransactionId: uuid("linked_transaction_id").references(() => transactions.id, { onDelete: "set null" }),
  // Receita Saúde (recibo eletrônico da RF, emissão manual no app): controle de emissão por pagamento.
  receiptNumber: text("receipt_number"), // nº do recibo Receita Saúde (preenchido após emitir no app)
  receiptIssuedAt: timestamp("receipt_issued_at"), // quando o terapeuta marcou como emitido
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("sp_patient_idx").on(t.patientId),
  index("sp_user_idx").on(t.userId),
  index("sp_user_status_idx").on(t.userId, t.status),
]);

// Cobrança marcada como ENVIADA ao paciente (guia Geral). A cobrança em si não é guardada — é
// recalculada pelo motor (`cobrancas.ts`) e identificada pela `chave`. Aqui guardamos só o FATO de
// que a terapeuta avisou o paciente daquela cobrança, com quando e por quem. Uma linha por chave
// (o índice único torna "marcar de novo" um reenvio que atualiza a data, não uma segunda linha).
export const cobrancaEnvios = pgTable("cobranca_envios", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
  // A `chave` de `cobrancasDoPaciente` — a mesma que o pagamento usa para se prender à cobrança.
  cobrancaChave: text("cobranca_chave").notNull(),
  // Hora de parede (ver horaLocal.ts). Agora guarda o INSTANTE do envio, não o dia ao meio-dia: o
  // documento pede a hora junto da data, e dois avisos no mesmo dia precisam ser distinguíveis.
  enviadaEm: timestamp("enviada_em").defaultNow().notNull(),
  enviadaPor: text("enviada_por"), // quem marcou (a terapeuta logada)
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  // Era único por (usuário, paciente, cobrança): cada novo aviso SUBSTITUÍA a data do anterior.
  // O documento de 17/09 pede o contrário — "manter o histórico de todos os envios, sem substituir
  // os registros anteriores" —, então cada clique em Cobrar passa a ser uma LINHA.
  index("cob_envio_chave_idx").on(t.userId, t.patientId, t.cobrancaChave),
  index("cob_envio_patient_idx").on(t.patientId),
]);

// Vencimento EDITADO à mão de uma cobrança (doc 31). A cobrança não é guardada — o motor a
// recalcula e a identifica pela `chave`. Aqui fica só a data que a terapeuta escolheu no lugar da
// calculada. Uma linha por chave (único): editar de novo substitui; DESFAZER é apagar a linha, e o
// motor volta a calcular o vencimento original. Só muda esta cobrança, nunca as outras.
export const cobrancaVencimentos = pgTable("cobranca_vencimentos", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
  // A `chave` de `cobrancasDoPaciente` — a mesma do envio e do vínculo do pagamento.
  cobrancaChave: text("cobranca_chave").notNull(),
  // Hora de parede (ver horaLocal.ts): o dia escolhido, guardado ao meio-dia para não escorregar de
  // fuso. O motor usa o dia; a hora é só âncora.
  vencimento: timestamp("vencimento").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("cob_venc_chave_uq").on(t.userId, t.patientId, t.cobrancaChave),
  index("cob_venc_patient_idx").on(t.patientId),
]);

// Pacotes do paciente (P1, P2, ...). Cada um tem N sessões; consumidas uma a uma
// nas sessões realizadas+cobráveis. Pagamentos podem ser vinculados a um pacote.
export const patientPackages = pgTable("patient_packages", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
  seq: integer("seq").notNull(), // número do pacote por paciente (P{seq})
  sessions: integer("sessions").notNull(), // total de sessões do pacote
  used: integer("used").default(0).notNull(), // sessões já consumidas
  fee: numeric("fee", { precision: 10, scale: 2 }), // valor/sessão na criação (referência)
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("pkg_patient_idx").on(t.patientId),
  index("pkg_user_idx").on(t.userId),
]);

// Rate limit por janela fixa (chave = userId:rota). Protege endpoints de IA (custo).
/**
 * HORÁRIO BLOQUEADO: o que tira um horário do ar sem ser um paciente.
 *
 * Supervisão, curso, médico, a viagem de sexta. Tabela PRÓPRIA, separada das sessões, de propósito:
 * se o bloqueio fosse uma sessão com nome especial, teria que ser excluído à mão de toda contagem
 * — pacote, fechamento, risco de falta, previsão — e bastaria esquecer uma para o bloqueio virar
 * dinheiro. Separado, não tem como vazar.
 */
export const blockedSlots = pgTable("blocked_slots", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  date: timestamp("date").notNull(),
  duration: integer("duration").default(60).notNull(),
  // Vazio vira "HORÁRIO BLOQUEADO" na tela; preenchido, a semana se explica sozinha.
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("blocked_user_date_idx").on(t.userId, t.date),
]);

/**
 * A data que uma serie de agendamentos PULOU por causa de um horario bloqueado (dona, 19/09).
 *
 * Fica guardada, e nao deduzida, por dois motivos. O bloqueio mora em tabela propria e **nao
 * conhece paciente nenhum** — de proposito, para nunca virar contagem de pacote nem dinheiro; e a
 * guia Geral precisa mostrar "Hor. Bloq." NAQUELA linha, o que exige saber de quem era a vaga.
 *
 * Nao e sessao e nao vira sessao: so ocupa a linha da data na tabela, para o historico nao ficar
 * com um buraco inexplicado. Some quando o horario for desbloqueado.
 */
export const sessoesPuladas = pgTable("sessoes_puladas", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
  /** O instante exato que a serie teria usado. Bate com `blocked_slots.date`. */
  date: timestamp("date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("puladas_user_date_idx").on(t.userId, t.date),
  index("puladas_patient_idx").on(t.patientId),
]);

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").default(0).notNull(),
  windowStart: timestamp("window_start").defaultNow().notNull(),
});

// --- Relations ---

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, { fields: [transactions.userId], references: [users.id] }),
  category: one(categories, { fields: [transactions.categoryId], references: [categories.id] }),
  account: one(financialAccounts, { fields: [transactions.accountId], references: [financialAccounts.id] }),
}));

export const financialAccountsRelations = relations(financialAccounts, ({ one, many }) => ({
  user: one(users, { fields: [financialAccounts.userId], references: [users.id] }),
  transactions: many(transactions),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  transactions: many(transactions),
}));

export const usersRelations = relations(users, ({ many }) => ({
  transactions: many(transactions),
  accounts: many(accounts),
  sessions: many(sessions),
  financialAccounts: many(financialAccounts),
  patients: many(patients),
  therapySessions: many(therapySessions),
  sessionPayments: many(sessionPayments),
}));

// --- Relations do dominio Terapia ---

export const patientsRelations = relations(patients, ({ one, many }) => ({
  user: one(users, { fields: [patients.userId], references: [users.id] }),
  sessions: many(therapySessions),
  payments: many(sessionPayments),
  statusHistory: many(patientStatusHistory),
  priceHistory: many(patientPriceHistory),
  contractHistory: many(patientContractHistory),
  prospectContacts: many(prospectContacts),
  records: many(patientRecords),
}));

export const patientRecordsRelations = relations(patientRecords, ({ one }) => ({
  user: one(users, { fields: [patientRecords.userId], references: [users.id] }),
  patient: one(patients, { fields: [patientRecords.patientId], references: [patients.id] }),
  session: one(therapySessions, { fields: [patientRecords.sessionId], references: [therapySessions.id] }),
}));

export const patientStatusHistoryRelations = relations(patientStatusHistory, ({ one }) => ({
  patient: one(patients, { fields: [patientStatusHistory.patientId], references: [patients.id] }),
}));

export const prospectContactsRelations = relations(prospectContacts, ({ one }) => ({
  patient: one(patients, { fields: [prospectContacts.patientId], references: [patients.id] }),
}));

export const patientPriceHistoryRelations = relations(patientPriceHistory, ({ one }) => ({
  patient: one(patients, { fields: [patientPriceHistory.patientId], references: [patients.id] }),
}));

export const patientContractHistoryRelations = relations(patientContractHistory, ({ one }) => ({
  patient: one(patients, { fields: [patientContractHistory.patientId], references: [patients.id] }),
}));

export const therapySessionsRelations = relations(therapySessions, ({ one, many }) => ({
  user: one(users, { fields: [therapySessions.userId], references: [users.id] }),
  patient: one(patients, { fields: [therapySessions.patientId], references: [patients.id] }),
  payments: many(sessionPayments),
}));

export const sessionPaymentsRelations = relations(sessionPayments, ({ one }) => ({
  user: one(users, { fields: [sessionPayments.userId], references: [users.id] }),
  patient: one(patients, { fields: [sessionPayments.patientId], references: [patients.id] }),
  session: one(therapySessions, { fields: [sessionPayments.sessionId], references: [therapySessions.id] }),
  linkedTransaction: one(transactions, { fields: [sessionPayments.linkedTransactionId], references: [transactions.id] }),
}));

/**
 * Taxas de cartão com VIGÊNCIA (doc 49). Cada alteração gera um NOVO registro, preservando os
 * percentuais e a data em que passaram a valer. O cálculo do líquido de um pagamento usa a taxa
 * vigente na DATA DO PAGAMENTO (não a atual) — mudar a taxa nunca recalcula o passado.
 */
export const cardFeeRates = pgTable("card_fee_rates", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  debito: numeric("debito", { precision: 5, scale: 2 }).notNull(), // % no débito
  credito: numeric("credito", { precision: 5, scale: 2 }).notNull(), // % no crédito à vista
  credito2x: numeric("credito_2x", { precision: 5, scale: 2 }), // % no crédito parcelado 2x (doc 50)
  credito3x: numeric("credito_3x", { precision: 5, scale: 2 }), // % no crédito parcelado 3x (doc 50)
  credito4x: numeric("credito_4x", { precision: 5, scale: 2 }), // % no crédito parcelado 4x (doc 53)
  credito5x: numeric("credito_5x", { precision: 5, scale: 2 }), // % no crédito parcelado 5x (doc 53)
  validFrom: timestamp("valid_from").notNull(), // a partir de quando esta configuração vale
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("card_fee_user_from_idx").on(t.userId, t.validFrom)]);

/**
 * Lembretes enviados (doc 49): um registro por vez que o terapeuta confirma TER ENVIADO um lembrete
 * (parabéns de aniversário, aviso de reajuste, chamada de devolutiva). Conta só na confirmação —
 * igual ao "Cobrar" do Vencimentos por dia. A tela mostra "(Nx)" por cadastro.
 */
export const outboundReminders = pgTable("outbound_reminders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
  kind: text("kind").notNull(), // "aniversario" | "reajuste" | "devolutiva"
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("outbound_reminders_user_kind_idx").on(t.userId, t.kind)]);

/**
 * Despesas da clínica (doc 50): nome, valor, data de vencimento e data de pagamento (null = em aberto).
 * A cor no quadro vem do status: paga (tem data de pagamento), em aberto (sem, dentro do prazo) ou em
 * atraso (sem, vencida). A recorrência mensal reaproveita o mesmo caminho dos lançamentos (uma linha
 * por mês). Entra na área Movimentações como saída.
 */
export const despesas = pgTable("despesas", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  nome: text("nome").notNull(),
  valor: numeric("valor", { precision: 12, scale: 2 }).notNull(),
  vencimento: timestamp("vencimento").notNull(),
  pagamentoData: timestamp("pagamento_data"), // null = ainda não paga
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("despesas_user_idx").on(t.userId, t.vencimento)]);

/**
 * Receitas pessoais da terapeuta (doc 50): nome, valor e data de recebimento. `recebido` marca se já
 * entrou (verde no extrato) ou se ainda é previsto (sem valor no extrato). Entra em Movimentações como entrada.
 */
export const receitasPessoais = pgTable("receitas_pessoais", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  nome: text("nome").notNull(),
  valor: numeric("valor", { precision: 12, scale: 2 }).notNull(),
  recebimento: timestamp("recebimento").notNull(),
  recebido: boolean("recebido").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("receitas_pessoais_user_idx").on(t.userId, t.recebimento)]);

// --- Push (app nativo) ---
// Guarda o token Expo de cada aparelho para enviar notificação (lembrete de consulta + aviso de
// atualização do app). Um usuário pode ter vários aparelhos; a chave é o token.
export const pushTokens = pgTable("push_tokens", {
  token: text("token").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  // Null = aparelho do TERAPEUTA. Preenchido = aparelho do PACIENTE (app do paciente).
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "cascade" }),
  platform: text("platform"), // 'android' | 'ios'
  appVersion: text("app_version"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [index("push_user_idx").on(t.userId), index("push_patient_idx").on(t.patientId)]);
