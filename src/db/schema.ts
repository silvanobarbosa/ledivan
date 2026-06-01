import { pgTable, text, numeric, timestamp, uuid, pgEnum, boolean, integer, primaryKey } from "drizzle-orm/pg-core";
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
  // WhatsApp do profissional (instância Evolution própria) — por tenant
  whatsappInstance: text("whatsapp_instance"),
  whatsappConnected: boolean("whatsapp_connected").default(false).notNull(),

  preferences: text("preferences"), // JSON string
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const goals = pgTable("goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  targetAmount: numeric("target_amount", { precision: 12, scale: 2 }).notNull(),
  currentAmount: numeric("current_amount", { precision: 12, scale: 2 }).default("0").notNull(),
  deadline: timestamp("deadline"),
  isCompleted: boolean("is_completed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const achievements = pgTable("achievements", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  earnedAt: timestamp("earned_at").defaultNow().notNull(),
});

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

// Divulgação: posts para redes sociais gerados com IA.
export const socialPosts = pgTable("social_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  theme: text("theme"),
  network: text("network").default("instagram").notNull(),
  tone: text("tone"),
  content: text("content").notNull(),
  hashtags: text("hashtags"),
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
  sessionFee: numeric("session_fee", { precision: 10, scale: 2 }).default("0").notNull(),
  frequency: text("frequency"), // ex: "semanal", "quinzenal"
  notes: text("notes"),
  paymentStatus: paymentStatusEnum("payment_status").default("pending").notNull(),
  patientStatus: text("patient_status").default("ativo").notNull(), // ativo | inativo | prospect | pausado
  startedAt: timestamp("started_at"),
  birthDate: timestamp("birth_date"),
  address: text("address"),
  // contato de emergencia (embutido)
  emergencyName: text("emergency_name"),
  emergencyPhone: text("emergency_phone"),
  emergencyRelationship: text("emergency_relationship"),
  // dados de prospeccao (embutido; tela Prospects filtra patientStatus='prospect')
  prospectDate: timestamp("prospect_date"),
  prospectFechou: text("prospect_fechou"), // 'Fechou' | 'Não fechou' | ''
  prospectObservacoes: text("prospect_observacoes"),
  paymentDay: integer("payment_day"), // dia do mes para cobranca
  contractType: contractTypeEnum("contract_type").default("avulso"),
  sessionsInPacket: integer("sessions_in_packet"),
  // Lembrete de sessao (escolha do terapeuta por paciente)
  reminderEnabled: boolean("reminder_enabled").default(false).notNull(),
  reminderChannel: text("reminder_channel").default("whatsapp").notNull(), // whatsapp | email | telegram
  moodToken: text("mood_token").unique(), // link do diário de humor: /humor/<token>
  tags: text("tags"), // etiquetas separadas por vírgula
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
  loggedAt: timestamp("logged_at").defaultNow().notNull(),
});

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
  isOnline: boolean("is_online").default(false).notNull(), // atendimento por vídeo (Jitsi)
  reminderSentAt: timestamp("reminder_sent_at"), // evita lembrete duplicado
  patientSummary: text("patient_summary"), // resumo pós-sessão para o paciente (IA)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
});

export const sessionPayments = pgTable("session_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
  sessionId: uuid("session_id").references(() => therapySessions.id, { onDelete: "set null" }),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  date: timestamp("date").defaultNow().notNull(),
  method: paymentMethodEnum("method").default("pix").notNull(),
  status: paymentStatusEnum("status").default("paid").notNull(),
  // VINCULO OPCIONAL com o financeiro: se preenchido, este pagamento gerou uma transacao de receita.
  linkedTransactionId: uuid("linked_transaction_id").references(() => transactions.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
  goals: many(goals),
  achievements: many(achievements),
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
