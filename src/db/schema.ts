import { pgTable, text, numeric, timestamp, uuid, pgEnum, boolean, integer, primaryKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import type { AdapterAccountType } from "next-auth/adapters"

export const transactionTypeEnum = pgEnum("transaction_type", ["income", "expense"]);
// 'session_payment' = receita gerada automaticamente de um pagamento de sessao (Ledivan)
export const transactionSourceEnum = pgEnum("transaction_source", ["manual", "telegram", "scan", "session_payment"]);

// --- Enums do dominio Terapia (Ledivan) ---
export const sessionStatusEnum = pgEnum("session_status", ["realizada", "nao_realizada", "cancelada", "realocada", "agendada"]);
export const paymentMethodEnum = pgEnum("payment_method", ["pix", "card", "cash", "transfer"]);
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ([
  index("patient_document_patient_idx").on(t.patientId),
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
  name: text("name").notNull(),
  type: transactionTypeEnum("type").notNull(),
  icon: text("icon"),
  color: text("color"),
});

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
  lastReactivationAt: timestamp("last_reactivation_at"), // última mensagem de reativação (throttle da campanha)
  featureOverrides: text("feature_overrides"), // JSON: liga/desliga recursos "por paciente" (ver lib/features)
  startedAt: timestamp("started_at"),
  birthDate: timestamp("birth_date"),
  category: text("category"), // crianca | adolescente | adulto | idoso | casal
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
  attendanceDay: text("attendance_day"), // dia da semana preferencial (seg..dom)
  attendanceTime: text("attendance_time"), // hora preferencial HH:MM
  address: text("address"),
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
  paymentFormat: text("payment_format").default("avulso").notNull(), // avulso | mensal | quinzenal | pacote
  sessionsInPacket: integer("sessions_in_packet"), // tamanho do pacote (2/4/8)
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

export const patientStatusHistory = pgTable("patient_status_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
  status: text("status").notNull(),
  date: timestamp("date").defaultNow().notNull(),
});

export const patientPriceHistory = pgTable("patient_price_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
  valor: numeric("valor", { precision: 10, scale: 2 }).notNull(),
  dataEfetiva: timestamp("data_efetiva").notNull(), // quando o novo preco passa a valer
  dataCriacao: timestamp("data_criacao").defaultNow().notNull(),
});

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
  packageId: uuid("package_id"), // vínculo opcional com um pacote (patient_packages); numeração 1/N derivada por data
  recurring: boolean("recurring").default(false).notNull(), // reserva recorrente
  recurrenceFreq: text("recurrence_freq"), // semanal | quinzenal | mensal (base p/ "Vago Quinzenal" na agenda)
  recurrenceUntil: timestamp("recurrence_until"), // data limite da recorrência
  googleEventId: text("google_event_id"), // vínculo com evento no Google Calendar (sync)
  meetingUrl: text("meeting_url"), // link Google Meet (se gerado); senão usa Jitsi derivado do id
  reminderSentAt: timestamp("reminder_sent_at"), // evita lembrete duplicado
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
