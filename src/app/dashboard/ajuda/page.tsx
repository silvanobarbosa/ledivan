import Link from "next/link";
import {
  Sparkles, Users, CalendarDays, Activity, HeartHandshake, Wallet, Megaphone, Settings, MessageCircle, Video, FileText,
} from "lucide-react";

export const metadata = { title: "Ajuda — Ledivan" };

type Guide = { icon: typeof Users; title: string; items: { q: string; a: string }[] };

const GUIDES: Guide[] = [
  {
    icon: Users, title: "Pacientes",
    items: [
      { q: "Como cadastrar um paciente?", a: "Menu Pacientes → 'Novo paciente'. Preencha nome (obrigatório), contato, valor da sessão, frequência e, se quiser, lembrete e etiquetas. Os ícones (i) ao lado dos campos explicam cada um." },
      { q: "Onde vejo o histórico?", a: "Abra o paciente: abas Dados, Prontuário, Espaço (tarefas/humor/escalas), Sessões, Pagamentos, Linha do tempo e Histórico." },
      { q: "Como exportar o prontuário?", a: "No topo do paciente, botão 'Prontuário PDF' → Imprimir/Salvar PDF." },
      { q: "Para que servem as etiquetas?", a: "Organizar e filtrar pacientes (ex: TCC, ansiedade). Filtre pelos chips na lista de Pacientes." },
    ],
  },
  {
    icon: CalendarDays, title: "Agenda e sessões",
    items: [
      { q: "Como funciona a agenda?", a: "Grade semanal (7h–21h). Navegue por semana ou clique em 'Hoje'. As sessões aparecem coloridas por status." },
      { q: "Como mudar o status de uma sessão?", a: "Clique no bloco da sessão → escolha realizada, cancelada, remarcada, etc. Ícone ⚠️ indica risco de falta." },
      { q: "Atendimento online?", a: "Ao criar a sessão, marque 'Atendimento online'. O link de vídeo (Jitsi ou Google Meet, conforme Ajustes) é gerado e fica no botão 'Entrar'." },
    ],
  },
  {
    icon: Activity, title: "Atenção clínica",
    items: [
      { q: "O que é a tela Atenção clínica?", a: "Lista pacientes que merecem atenção agora, cruzando: risco de falta, escala (PHQ-9/GAD-7) em alerta, humor baixo e pagamento atrasado. Também aparece um resumo na tela inicial." },
    ],
  },
  {
    icon: HeartHandshake, title: "Espaço do Paciente (tarefas, humor, escalas)",
    items: [
      { q: "Como enviar uma tarefa (lição de casa)?", a: "No paciente → aba Espaço → 'Nova tarefa'. Use um modelo TCC pronto se quiser. Copie o link e envie ao paciente — ele responde com texto, foto, áudio ou vídeo, e você vê aqui." },
      { q: "Diário de humor", a: "Na aba Espaço, ative o diário e envie o link. O paciente registra o humor (emoji 1–5) quando quiser; você acompanha por gráfico." },
      { q: "Escalas de desfecho", a: "Aplique PHQ-9 (depressão) ou GAD-7 (ansiedade). O paciente responde pelo link e o resultado é pontuado e interpretado automaticamente, com gráfico de evolução." },
      { q: "Transcrição por IA", a: "Opcional, ative em Ajustes. No prontuário, envie o áudio da sessão → a IA gera um rascunho de evolução. Exige consentimento do paciente, confirmado em tela." },
    ],
  },
  {
    icon: Wallet, title: "Financeiro",
    items: [
      { q: "Como lançar receita/despesa?", a: "Menu Transações → 'Novo lançamento'. Para despesas do consultório, escolha a categoria. Exporte tudo em CSV quando quiser." },
      { q: "Pagamento de sessão vira receita?", a: "Ao registrar um pagamento, marque 'Lançar como receita'. Ou ative o vínculo automático em Ajustes." },
      { q: "Relatórios e metas", a: "Em Relatórios veja receita/despesa/saldo mês a mês (filtro 6m/12m/tudo). Em Metas, acompanhe objetivos de poupança." },
      { q: "Recibo", a: "Em Pagamentos do paciente, clique em 'Recibo' (pagamentos pagos) → Imprimir/Salvar PDF." },
    ],
  },
  {
    icon: Settings, title: "Integrações (Ajustes)",
    items: [
      { q: "Conectar meu WhatsApp", a: "Ajustes → WhatsApp → Conectar → escaneie o QR com o WhatsApp do celular (Aparelhos conectados). Lembretes saem do SEU número." },
      { q: "Conectar Telegram", a: "Ajustes → Telegram → Conectar → toque em 'Abrir no Telegram e conectar'. Vincula automaticamente." },
      { q: "Enviar e-mails pelo meu e-mail", a: "Ajustes → e-mail → informe seu e-mail e uma senha de app. Detectamos o servidor, testamos e salvamos (criptografado)." },
      { q: "Google Meet", a: "Ajustes → Atendimento por vídeo → escolha Google Meet. Faça login com Google (autorize a Agenda). Sessões online passam a gerar link Meet." },
      { q: "Link de autoagendamento", a: "Ajustes → defina seu link /agendar/seu-nome. O paciente solicita horário e entra na sua agenda como prospect." },
    ],
  },
  {
    icon: Megaphone, title: "Divulgação",
    items: [
      { q: "Gerar posts para redes sociais", a: "Menu Divulgação → escolha tema, rede e tom → a IA gera a legenda + hashtags. Copie ou compartilhe direto." },
    ],
  },
];

export default function AjudaPage() {
  return (
    <div className="max-w-3xl space-y-8 pb-20">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl lg:text-4xl font-display font-bold text-primary">Central de Ajuda</h1>
          <p className="text-foreground/50 mt-1">Guias rápidos de cada área. Dúvida num campo? Passe o mouse no ícone (i).</p>
        </div>
        <Link href="/dashboard?tour=1" className="inline-flex items-center gap-2 bg-primary text-white px-5 py-3 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition">
          <Sparkles className="w-5 h-5" /> Iniciar tour guiado
        </Link>
      </div>

      <div className="space-y-5">
        {GUIDES.map((g) => (
          <div key={g.title} className="glass-card rounded-[24px] p-6">
            <h2 className="font-display text-xl font-bold text-primary flex items-center gap-2 mb-3">
              <g.icon className="w-5 h-5" /> {g.title}
            </h2>
            <div className="space-y-2">
              {g.items.map((it) => (
                <details key={it.q} className="group rounded-xl bg-surface/50 border border-border px-4 py-3 [&[open]>summary>span:last-child]:rotate-45">
                  <summary className="flex items-center justify-between gap-3 cursor-pointer list-none">
                    <span className="text-sm font-semibold text-foreground/80">{it.q}</span>
                    <span className="text-xl text-accent transition-transform shrink-0">+</span>
                  </summary>
                  <p className="text-sm text-foreground/60 leading-relaxed mt-2">{it.a}</p>
                </details>
              ))}
            </div>
          </div>
        ))}

        <div className="glass-card rounded-[24px] p-6 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3 text-sm text-foreground/60">
            <span className="inline-flex items-center gap-1.5"><MessageCircle className="w-4 h-4 text-primary" /> WhatsApp/Telegram</span>
            <span className="inline-flex items-center gap-1.5"><Video className="w-4 h-4 text-primary" /> Vídeo</span>
            <span className="inline-flex items-center gap-1.5"><FileText className="w-4 h-4 text-primary" /> PDF</span>
          </div>
          <p className="text-sm text-foreground/50">Mais dúvidas? Fale com a gente: <a href="mailto:contato@ledivan.com.br" className="text-primary underline">contato@ledivan.com.br</a></p>
        </div>
      </div>
    </div>
  );
}
