# Análise de Concorrentes — Ledivan+ (L'E-Divan+)

Pesquisa jun/2026. Comparação com as principais plataformas de gestão para psicólogos no Brasil e plano de ação.

## Quadro comparativo

| Recurso | **Ledivan+** | PsicoManager | Plenne | Agendart | Psicoplanner | Allminds |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| Foco | **Consultório + financeiro forte** | Clínica robusta | Automação autônomo | IA/produtividade | Simplicidade/agenda | Gestão + captação |
| Pacientes/cadastro | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Agenda visual (grade) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Prontuário eletrônico/evoluções** | ⚠️ só notas | ✅ | ✅ (IA) | ✅ (IA) | ✅ | ✅ |
| **Teleatendimento (vídeo)** | ❌ (só link na copy) | ✅ | — | ✅ | ✅ | ✅ |
| **Lembrete automático de sessão** | ❌ | ✅ (multi-canal) | ✅ (WhatsApp) | ✅ | ✅ (ilimitado) | ✅ |
| **Autoagendamento (link público)** | ❌ | ✅ | ✅ 24/7 | ✅ | ✅ | ✅ |
| Financeiro / relatórios | ✅ **forte** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Pagamento → receita automático** | ✅ **único** | parcial | parcial | parcial | parcial | parcial |
| **Lançar gasto por WhatsApp/Telegram/foto+IA** | ✅ **único** | ❌ | ❌ | ❌ | ❌ | ❌ |
| Scan de recibo com IA | ✅ | — | — | — | — | — |
| Transcrição de sessão por IA | ❌ | ✅ | — | ✅ | ✅ (PsiAssist) | — |
| Risco de falta (IA) | ❌ | — | — | ✅ (−70%) | — | — |
| Documentos + assinatura digital | ❌ | ✅ | — | ✅ | ✅ | ✅ |
| Anamnese/formulários | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Multi-profissional (clínica) | ⚠️ multi-tenant, sem equipe | ✅ | — | ✅ | — | parcial |
| Captação de pacientes (portal) | ❌ | — | — | — | EncontrePsi | ✅ |
| Gamificação | ✅ **único** | ❌ | ❌ | ❌ | ❌ | ❌ |
| Preço (ref.) | R$49/mês (proposto) | ~R$589 (indiv., anual) | trial 14d | sob consulta | mensalidade única | ~R$59/mês |

Legenda: ✅ tem · ⚠️ parcial · ❌ não tem · — não confirmado.

---

## Leitura estratégica

**O mercado é clínico-first.** Todos os concorrentes giram em torno de **prontuário eletrônico + teleatendimento + lembrete/autoagendamento**. A IA deles é de **transcrição de sessão → prontuário** (Agendart, PsicoManager, Psicoplanner).

**O Ledivan+ é financeiro-first** e tem 3 diferenciais que ninguém tem:
1. **Pagamento de sessão vira receita automaticamente** (vínculo opcional).
2. **Lançar financeiro por mensagem** (WhatsApp/Telegram) e **foto de recibo com IA** — concorrentes usam WhatsApp só para *lembrete*, não para *lançar caixa*.
3. **Gamificação**.

**Risco:** sem prontuário, teleatendimento e lembrete automático, o Ledivan+ não bate os requisitos básicos que um psicólogo espera — pode perder a venda mesmo sendo melhor no financeiro. Esses três são **paridade competitiva obrigatória**.

---

## Plano de ação

### P0 — Paridade essencial (sem isto, não vende para psicólogo)
1. **Prontuário eletrônico / evoluções por sessão** — campo de evolução por sessão, anamnese inicial, histórico clínico seguro (LGPD). *Já temos `therapy_sessions.notes`; evoluir para prontuário estruturado por paciente.*
2. **Lembrete automático de sessão** (WhatsApp via Evolution + e-mail/Gmail) 24h e 1h antes. *Já temos webhook Evolution e número do paciente — falta o agendador (cron) + template.*
3. **Teleatendimento:** gerar link de vídeo (Google Meet ou Jitsi) na sessão e enviar ao paciente. *A landing já promete Google Meet — priorizar.*

### P1 — Diferenciação + retenção
4. **Autoagendamento:** link público por terapeuta (`/agendar/[slug]`) para o paciente marcar — reduz fricção, está em todos os concorrentes.
5. **Transcrição de sessão por IA** (Whisper + GPT → rascunho de evolução) — alinha com nosso uso de IA e iguala Agendart/Psicoplanner.
6. **Documentos + recibo em PDF** (recibo de pagamento, declaração de comparecimento) — fácil e esperado.
7. **Risco de falta (IA/heurística)** sobre histórico de faltas do paciente — barato de fazer, marketing forte (Agendart vende "−70%").

### P2 — Expansão
8. **Multi-profissional / clínica** (equipe sob um mesmo espaço, agendas consolidadas).
9. **Captação/portal** de pacientes (estilo Allminds/EncontrePsi).
10. **NF-e / integração contábil** (a própria landing já cita "em breve módulo contábil").

### Posicionamento e preço
- Manter **plano único ~R$49–59/mês, tudo incluso** (a landing já fixa R$49) — agressivo vs PsicoManager (caro) e alinhado a Allminds/Psicoplanner.
- Mensagem de venda: **"O único que junta consultório + financeiro de verdade — e deixa você lançar o caixa por WhatsApp."**
- Trial 14 dias sem cartão (já na copy) + onboarding guiado (concorrentes destacam "pessoa real acompanha").

### Quick wins de marketing (já dá pra fazer)
- Landing no ar (feita). Adicionar página `/precos` e captura de e-mail/waitlist.
- Comparativo público "Ledivan+ vs planilha" e destaque do diferencial financeiro.
- Provas sociais reais (trocar depoimento placeholder por casos reais).

---

## Resumo executivo
**Ganhamos** em financeiro integrado, automação por mensagem e gamificação. **Perdemos** em prontuário, teleatendimento e lembrete automático — que são obrigatórios. Prioridade imediata: **P0 (prontuário, lembrete automático, teleatendimento)** para alcançar paridade, mantendo nossos diferenciais como argumento de venda.

### Fontes
- [PsicoManager](https://www.psicomanager.com.br/) · [Planos](https://www.psicomanager.com.br/planos) · [Capterra](https://www.capterra.com/p/10008424/PsicoManager/)
- [Plenne](https://plenne.com.br/)
- [Agendart](https://www.agendart.com.br/) · [Funcionalidades](https://www.agendart.com.br/mais-funcionalidades)
- [Psicoplanner](https://psicoplanner.com.br/)
- [Allminds](https://allminds.app/) · [Planos](https://allminds.app/planos/)
