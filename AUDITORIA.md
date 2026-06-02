# Auditoria geral — Ledivan+ (jun/2026)

Revisão de boas práticas, isolamento multi-tenant, segurança e completude das funcionalidades.

## 1. Isolamento multi-tenant — CORRIGIDO ✅
Auditados todos os server actions, route handlers e libs. Toda leitura/escrita de domínio é escopada por `userId` (sessão) ou por **token de capacidade** (links públicos resolvem o `userId` no servidor — nunca vem do cliente).

**Corrigido nesta auditoria (defense-in-depth):** todos os `update`/`delete` por id agora incluem `userId` no `WHERE` (antes a posse era checada antes, mas o mutador usava só o id). Cobertos: pacientes, sessões, pagamentos, registros, objetivos, escalas, tarefas, humor.

**Endpoints públicos (tokens) — OK:** `/agendar/[slug]`, `/p/[token]`, `/humor/[token]`, `/escala/[token]` resolvem o tenant pelo token/slug no servidor. `/api/scan|insights|transcribe` exigem sessão e ignoram qualquer `userId` do body. `/api/cron` exige `CRON_SECRET`. Telegram/WhatsApp resolvem o tenant por `telegramId`/`whatsappId` únicos.

**Observação de design (não é falha de segurança):** a tabela `categories` é global (taxonomia compartilhada de rótulos — sem PII). Transações continuam escopadas por `userId`. Pode virar por-tenant no futuro, mas não vaza dados.

## 2. Segurança (OWASP) 
**Corrigido nesta auditoria:**
- Código de verificação do Telegram agora usa **CSPRNG** (`crypto.randomInt`) em vez de `Math.random`.
- **Webhook WhatsApp** passou a exigir `EVOLUTION_WEBHOOK_TOKEN` (configurado também na instância Evolution) — antes ficava aberto se o token não estivesse setado.
- **Agendamento público**: honeypot anti-bot + limite de 10 pedidos/hora por terapeuta.

**Já estava correto:**
- Sem segredos no git (`.env.local` ignorado; histórico limpo).
- Senha SMTP **criptografada** (AES-256-GCM, `ENCRYPTION_KEY`), nunca exposta.
- SQL parametrizado (Drizzle `${}`) — sem concatenação de input.
- Sem `dangerouslySetInnerHTML` (React escapa) — sem XSS.
- Tokens de links públicos com ~160 bits (crypto.randomUUID×2).
- CRON protegido por Bearer; NextAuth com `trustHost`.

**Recomendações futuras (não bloqueiam, anotadas):**
- Rate limiting dedicado (Vercel KV/Upstash) nos endpoints de IA autenticados (controle de custo OpenAI).
- **Vercel Blob**: ao conectar o store, servir anexos de tarefas como **privado** + endpoint autorizado (dado clínico = PII). Hoje o upload está inativo (store não conectado).
- Expiração opcional nos tokens de paciente (mood/escala/tarefa).
- `allowDangerousEmailAccountLinking=true`: aceitável porque o Google verifica o e-mail; reavaliar se adicionar provedores não verificados.
- LGPD: fluxo de exclusão de conta/dados + log de auditoria + TCLE.

## 3. Boas práticas
- Build de produção limpo a cada deploy; TypeScript checado.
- Migrações versionadas (Drizzle) e aplicadas; schema único.
- Componentização (server/client) coerente; ações server com `auth()`.
- Segredos por ambiente (Vercel) + criptografia para credenciais de tenant.
- Degradação graciosa quando integração externa não está configurada (Blob/Evolution/Resend/Meet).

## 4. Completude — todas as ideias da conversa
| Ideia / pedido | Status |
|---|---|
| App master Ledivan + financeiro CapiCash, multi-tenant | ✅ |
| Vínculo opcional pagamento→receita | ✅ |
| Pacientes, sessões, agenda, prospects, pagamentos | ✅ |
| Financeiro: transações, lançamento manual, CSV, contas, **relatórios** com filtro, **metas**, **gamificação** | ✅ |
| IA: scan de recibo, insights | ✅ |
| Telegram (bot) + **WhatsApp** lançamento por mensagem | ✅ |
| Deploy (Vercel), Git, Google OAuth, banco Neon | ✅ |
| Identidade: logo L'E-Divan + fontes Fraunces/Inter (handoff) | ✅ |
| Seed 15 meses (Silvano) + carga 3x | ✅ |
| Agenda estilo Google Calendar (grade) | ✅ |
| Landing + login do Lovable integrados | ✅ |
| Análise de concorrentes + plano de ação | ✅ |
| P0: prontuário, lembrete (por paciente + canal), teleatendimento (Jitsi) | ✅ |
| P1: autoagendamento, transcrição IA, recibo PDF, risco de falta | ✅ |
| P2: módulo de divulgação (posts IA + compartilhar) | ✅ |
| Espaço do Paciente: tarefas multimídia + **modelos TCC** | ✅ (anexos aguardam Blob) |
| Diário de humor + gráfico | ✅ |
| Escalas de desfecho PHQ-9/GAD-7 + evolução | ✅ |
| Resumo pós-sessão por IA | ✅ |
| Plano terapêutico | ✅ |
| Dashboard clínico (atenção) + widget na home | ✅ |
| Linha do tempo unificada | ✅ |
| Anamnese estruturada · Tags/etiquetas + filtro | ✅ |
| E-mail pelo próprio e-mail do profissional (SMTP, por tenant) | ✅ |
| Telegram à prova de leigo (deep-link) | ✅ |
| WhatsApp por profissional (QR, número próprio) | ✅ |
| Google Meet opcional (Jitsi padrão) | ✅ (requer re-login Google p/ escopo) |
| Isolamento por tenant em todas as integrações | ✅ |

**Pendências externas (do usuário, não do código):**
- Conectar **Vercel Blob** (ativa anexos de mídia das tarefas).
- Re-login Google p/ conceder escopo Calendar (ativa Meet).
- Verificar domínio no **Resend** (e-mails de login a terceiros).
- **Excel import**: dispensado pelo usuário.
