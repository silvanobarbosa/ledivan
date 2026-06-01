# Reanálise competitiva + Diferenciação — Ledivan+ (jun/2026)

Atualização após entregarmos P0 (prontuário, lembrete, teleatendimento), P1 (autoagendamento, transcrição IA, recibo, risco de falta) e P2 (divulgação).

## 1. Onde estamos agora vs concorrentes

| Eixo | Ledivan+ | PsicoManager | Plenne | Agendart | Psicoplanner | Allminds |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| Gestão (agenda/pacientes) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Prontuário | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Teleatendimento | ✅ (Jitsi) | ✅ | — | ✅ | ✅ | ✅ |
| Lembrete | ✅ (por paciente, multicanal) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Autoagendamento | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Transcrição IA | ✅ | ✅ | — | ✅ | ✅ | — |
| Risco de falta | ✅ | — | — | ✅ | — | — |
| **Financeiro forte + relatórios** | ✅✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Pagamento→receita automático** | ✅ único | parcial | parcial | parcial | parcial | parcial |
| **Lançar caixa por WhatsApp/foto+IA** | ✅ único | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Divulgação (posts IA)** | ✅ único | ❌ | ❌ | ❌ | ❌ | ❌ |
| Gamificação | ✅ único | ❌ | ❌ | ❌ | ❌ | ❌ |
| **App/portal do PACIENTE** | ❌ (ainda) | ✅ (básico: diário + atividades) | parcial | — | parcial | parcial |
| Diário de humor do paciente | ❌ | ✅ | — | — | — | — |

**Conclusão:** alcançamos paridade no lado do terapeuta e temos diferenciais fortes (financeiro, automação por mensagem, divulgação, gamificação). O **território aberto** é o **lado do PACIENTE entre as sessões** — onde o líder (PsicoManager) só tem o básico (diário + envio de atividades) e os apps avulsos (Cíngulo, Daylio, MoodKit) são desconectados do terapeuta.

---

## 2. A grande aposta — "Espaço do Paciente" (lição de casa + engajamento)

> Ideia central: o terapeuta envia uma **tarefa** (lição de casa); o paciente **responde no app** com texto, **foto, vídeo, áudio ou desenho**; o terapeuta **vê, comenta e leva pra sessão**. Loop bidirecional que ninguém faz bem.

### Por que isso ganha
- **Resultado clínico:** adesão à lição de casa é preditor de melhora (forte na TCC). Vendemos *desfecho*, não só agenda.
- **Vínculo + retenção:** paciente abre o app entre sessões → reduz faltas e abandono → retém o terapeuta também.
- **Defensável:** integra tarefa ↔ resposta multimídia ↔ revisão ↔ prontuário ↔ lembrete. Apps avulsos não têm o terapeuta; os concorrentes de gestão não têm o loop rico.
- **Reposiciona o produto:** de "gestão de consultório" para **"plataforma de cuidado contínuo"**.

### Como funciona
**Terapeuta (no app):**
- Cria uma **tarefa** para um paciente a partir de:
  - **Questionário** (perguntas abertas/múltipla escolha/escala 0–10)
  - **Registro livre** (texto + anexos)
  - **Pedido de mídia** (foto/vídeo/áudio — ex.: "grave um áudio do que sentiu")
  - **Desenho** (canvas no app ou foto de desenho no papel)
  - **Diário de humor / hábitos** (recorrente, ex.: diário por 7 dias)
  - **Modelos prontos** (TCC: Registro de Pensamentos Disfuncionais, diário de gratidão, escala de ansiedade, etc.)
- Define prazo + se é recorrente. Dispara aviso pelo canal já existente (WhatsApp/e-mail).

**Paciente (sem instalar app):**
- Recebe **link mágico** (token) por WhatsApp/e-mail → abre o **Espaço do Paciente** (PWA, sem senha).
- Vê tarefas pendentes, responde (texto/foto/vídeo/áudio/desenho), envia.
- Pode manter um diário de humor rápido.

**Volta pro terapeuta:**
- Respostas entram no **prontuário** do paciente, com mídia anexada.
- Terapeuta **comenta**/marca como vista; usa na próxima sessão.
- **IA opcional:** resumo das respostas da semana ("paciente relatou X, humor médio Y").

### Necessidades técnicas
- **Armazenamento de mídia:** Vercel Blob (ou S3) p/ foto/vídeo/áudio. (hoje não temos blob.)
- **Auth do paciente:** token por link (sem senha) — simples e sem fricção; escopo só às tarefas dele.
- **Novas tabelas:** `assignments`, `assignment_items` (perguntas), `assignment_responses` (+ URLs de mídia), `mood_logs`.
- **LGPD:** mídia sensível — consentimento, criptografia em repouso, retenção/exclusão, acesso só do terapeuta dono. Termo de uso do paciente no primeiro acesso.

### MVP sugerido (enxuto, entregável)
1. Tarefa do tipo **questionário + texto livre + anexo único (foto/áudio)**.
2. Link mágico do paciente → página de resposta (PWA).
3. Resposta cai no prontuário; terapeuta vê e comenta.
4. Aviso pelo canal de lembrete já existente.
> Depois: vídeo, desenho (canvas), recorrência, diário de humor com gráfico, modelos TCC, resumo IA.

---

## 3. Outros diferenciais (priorizados)

| Ideia | Impacto | Esforço | Nota |
|---|:--:|:--:|---|
| **Espaço do Paciente / lição de casa** (acima) | 🔥🔥🔥 | Médio-alto | aposta principal; precisa blob + auth paciente |
| **Acompanhamento de desfecho** (PHQ-9, GAD-7 periódicos → gráfico de evolução) | 🔥🔥🔥 | Médio | baseado em evidência; vende *resultado*; combina c/ tarefas |
| **Resumo pós-sessão para o paciente** (IA gera resumo + tarefas e envia) | 🔥🔥 | Baixo | reaproveita transcrição IA que já temos |
| **Plano terapêutico** (objetivos do tratamento + progresso) | 🔥🔥 | Baixo-médio | estrutura clínica, poucos têm bem |
| **Biblioteca de modelos de tarefas TCC** | 🔥🔥 | Baixo | acelera adoção do módulo de tarefas |
| **Diário de humor do paciente + correlações** | 🔥 | Médio | paridade c/ PsicoManager + nossos gráficos |
| Programa de indicação/captação leve | 🔥 | Baixo | crescimento |
| Contábil/NF (via Asaas/NFe.io) | 🔥 | Alto/externo | deixar p/ integração futura |

---

## 4. Recomendação

**Construir o "Espaço do Paciente" como bandeira**, começando pelo MVP (questionário + texto + 1 anexo + link mágico + revisão no prontuário), e logo emendar **acompanhamento de desfecho (escalas)** e **resumo pós-sessão por IA** (barato, reusa o que já temos).

Isso muda o discurso de venda para:
> **"O único que cuida do paciente também ENTRE as sessões — com tarefas, registros e evolução medida — e ainda organiza seu consultório e seu caixa."**

Pré-requisito técnico do módulo: adicionar **armazenamento de mídia (Vercel Blob)** + **acesso do paciente por link mágico**.

### Fontes
- [PsicoManager para Pacientes (App Store)](https://apps.apple.com/br/app/psicomanager-para-pacientes/id1611560393)
- [Tarefas terapêuticas em Psicologia — Sinopsys](https://sinopsyseditora.com.br/blog/tarefas-terapeuticas-em-psicologia-quais-as-mais-utilizadas-455)
- [Apps terapêuticos (Cíngulo, Daylio, MoodKit) — psicologo.com.br](https://www.psicologo.com.br/blog/apps-terapeuticos/)
- [Allminds — funções de sistema p/ psicólogos](https://allminds.app/blog/sistema-para-psicologos/)
