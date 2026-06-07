"use client";

import { useMemo, useState } from "react";
import {
  Sparkles, Search, LayoutDashboard, Users, CalendarDays, Video, Activity, HeartHandshake,
  Wallet, BarChart3, Trophy, Megaphone, UserPlus, Settings, FileText, Shield, MessageCircle,
} from "lucide-react";

type Guide = { id: string; icon: typeof Users; title: string; items: { q: string; a: string }[] };

const GUIDES: Guide[] = [
  {
    id: "inicio", icon: LayoutDashboard, title: "Dashboard (início)",
    items: [
      { q: "O que aparece no Dashboard?", a: "Visão geral do consultório e das finanças: receita do mês, sessões da semana, pacientes ativos, pagamentos pendentes e um resumo de Atenção clínica. É o primeiro item do menu." },
      { q: "Como navego no app?", a: "Pelo menu lateral (no computador) ou pelo botão ☰ no celular, que abre o menu completo. A barra inferior no celular dá atalho rápido às áreas principais." },
    ],
  },
  {
    id: "pacientes", icon: Users, title: "Pacientes",
    items: [
      { q: "Como cadastrar um paciente?", a: "Menu Pacientes → 'Novo paciente'. Preencha nome (obrigatório), contato, valor da sessão, frequência, contrato e, se quiser, lembrete, etiquetas e fotos. Os ícones (i) explicam cada campo." },
      { q: "Foto 3x4 e fotos extras", a: "No cadastro há um slot de foto 3x4 (referência do paciente) e mais 3 slots opcionais. As fotos ficam guardadas de forma privada, acessíveis só para você." },
      { q: "Contrato avulso x pacote", a: "Avulso: paga por sessão. Pacote: você informa quantos atendimentos o pacote tem; a cada sessão cobrada, 1 crédito do pacote é descontado automaticamente." },
      { q: "Onde vejo o histórico do paciente?", a: "Abra o paciente: abas Dados, Prontuário, Atividades (tarefas/humor/escalas), Sessões, Financeiro e Linha do tempo. No topo aparecem os cards de Reservadas, Agendadas futuras, Status de crédito e Realizadas." },
      { q: "Para que servem as etiquetas?", a: "Organizar e filtrar pacientes (ex: TCC, ansiedade). Ficam no cabeçalho do Prontuário e filtram a lista de Pacientes." },
    ],
  },
  {
    id: "agenda", icon: CalendarDays, title: "Agenda e sessões",
    items: [
      { q: "Como funciona a agenda?", a: "Grade semanal (7h–21h). Navegue por semana ou clique em 'Hoje'. As sessões aparecem coloridas por status." },
      { q: "Mudar o status de uma sessão", a: "Clique no bloco da sessão → escolha realizada, cancelada, remarcada, etc. O ícone ⚠️ indica risco de falta." },
      { q: "A sessão será cobrada?", a: "Cada sessão tem a opção 'Cobrar' (ligada por padrão). Desligue para sessões de cortesia/devolutiva. Ao cobrar um paciente com pacote, é debitado 1 crédito do pacote." },
      { q: "Lembrete automático", a: "No cadastro do paciente, ligue o lembrete e escolha o canal (WhatsApp/E-mail/Telegram) e a antecedência (de 10 minutos até 24 horas)." },
    ],
  },
  {
    id: "video", icon: Video, title: "Atendimento por vídeo",
    items: [
      { q: "Como faço atendimento online?", a: "Ao criar a sessão, marque 'Atendimento online'. O link de vídeo (Jitsi por padrão, ou Google Meet conforme Ajustes) é gerado e fica no botão 'Entrar'." },
      { q: "Entro como anfitrião?", a: "Sim. Ao abrir a sala pela agenda, você entra já como moderador, sem precisar logar de novo. O paciente entra pelo link como convidado." },
      { q: "A reunião fica registrada?", a: "Sim. O app registra quando a sala foi aberta, quando o convidado entrou e quando encerrou. Isso fica salvo nos dados da sessão, na agenda." },
      { q: "Jitsi ou Google Meet?", a: "Jitsi é o padrão (não exige conta). Para usar o Google Meet, conecte sua conta Google em Ajustes → Atendimento por vídeo." },
    ],
  },
  {
    id: "clinico", icon: Activity, title: "Atenção clínica",
    items: [
      { q: "O que é a tela Atenção clínica?", a: "Lista pacientes que merecem atenção agora, cruzando: risco de falta, escala (PHQ-9/GAD-7) em alerta, humor baixo e pagamento atrasado. Há também um resumo na tela inicial." },
    ],
  },
  {
    id: "espaco", icon: HeartHandshake, title: "Atividades do Paciente (tarefas, humor, escalas)",
    items: [
      { q: "Enviar uma tarefa (lição de casa)", a: "No paciente → aba Atividades → 'Nova tarefa'. Use um modelo TCC pronto se quiser. Copie o link e envie ao paciente — ele responde com texto, foto, áudio ou vídeo, e você vê aqui." },
      { q: "Diário de humor", a: "Na aba Atividades, ative o diário e envie o link. O paciente registra o humor (emoji 1–5) quando quiser; você acompanha por gráfico." },
      { q: "Escalas de desfecho", a: "Aplique PHQ-9 (depressão) ou GAD-7 (ansiedade). O paciente responde pelo link e o resultado é pontuado e interpretado automaticamente, com gráfico de evolução." },
      { q: "Transcrição por IA", a: "Opcional, ative em Ajustes. No prontuário, envie o áudio da sessão → a IA gera um rascunho de evolução. Exige consentimento do paciente, confirmado em tela." },
    ],
  },
  {
    id: "prontuario", icon: FileText, title: "Prontuário e recibo",
    items: [
      { q: "O que tem no prontuário?", a: "É o cenário completo de cada consulta, da mais recente para a mais antiga: data e status da sessão, se foi cobrada/paga, se houve tarefa, e as anotações de evolução. Junta tudo o que também sai no Prontuário PDF." },
      { q: "Exportar o prontuário", a: "No topo do paciente, botão 'Prontuário PDF' → Imprimir/Salvar PDF." },
      { q: "Emitir recibo", a: "No paciente → aba Financeiro → no Fluxo financeiro, clique em 'recibo' no pagamento desejado → Imprimir/Salvar PDF." },
    ],
  },
  {
    id: "financeiro", icon: Wallet, title: "Financeiro",
    items: [
      { q: "Lançar receita/despesa", a: "Menu Transações → 'Novo lançamento'. Para despesas do consultório, escolha a categoria. Exporte tudo em CSV quando quiser." },
      { q: "Pagamento de sessão vira receita?", a: "Ao registrar um pagamento, marque 'Lançar como receita'. Ou ative o vínculo automático em Ajustes." },
      { q: "Escanear recibo com IA", a: "Use o botão 📸 (canto inferior). A IA lê a nota e cria o lançamento de despesa automaticamente." },
    ],
  },
  {
    id: "relatorios", icon: BarChart3, title: "Relatórios e metas",
    items: [
      { q: "Relatórios", a: "Veja receita/despesa/saldo mês a mês (filtro 6m/12m/tudo), por categoria e origem." },
      { q: "Metas", a: "Em Metas, defina objetivos de poupança e registre quanto guardou; a barra mostra o progresso." },
    ],
  },
  {
    id: "gamification", icon: Trophy, title: "Conquistas",
    items: [
      { q: "Para que servem as conquistas?", a: "Marcos que você desbloqueia ao usar o sistema e bater metas — um empurrãozinho para manter a organização em dia." },
    ],
  },
  {
    id: "prospects", icon: UserPlus, title: "Prospects e autoagendamento",
    items: [
      { q: "O que são Prospects?", a: "Possíveis pacientes que ainda não fecharam. Acompanhe o status e converta em paciente ativo quando fechar." },
      { q: "Link de autoagendamento", a: "Ajustes → defina seu link /agendar/seu-nome. O paciente solicita horário e entra na sua agenda como prospect." },
    ],
  },
  {
    id: "divulgacao", icon: Megaphone, title: "Divulgação",
    items: [
      { q: "Gerar posts para redes sociais", a: "Menu Divulgação → escolha tema, rede e tom → a IA gera a legenda + hashtags. Copie ou compartilhe direto." },
    ],
  },
  {
    id: "integracoes", icon: Settings, title: "Integrações (Ajustes)",
    items: [
      { q: "Conectar meu WhatsApp", a: "Ajustes → WhatsApp → Conectar → escaneie o QR com o WhatsApp do celular (Aparelhos conectados). Lembretes saem do SEU número." },
      { q: "Conectar Telegram", a: "Ajustes → Telegram → Conectar → toque em 'Abrir no Telegram e conectar'. Vincula automaticamente." },
      { q: "Enviar e-mails pelo meu e-mail", a: "Ajustes → e-mail → informe seu e-mail e uma senha de app. Detectamos o servidor, testamos e salvamos (criptografado)." },
      { q: "Google Meet", a: "Ajustes → Atendimento por vídeo → escolha Google Meet e faça login com Google (autorize a Agenda). As sessões online passam a gerar link Meet." },
      { q: "Minha foto no cabeçalho", a: "Ajustes → Perfil → envie sua foto 3x4. Ela aparece no topo, ao lado do seu nome." },
    ],
  },
  {
    id: "seguranca", icon: Shield, title: "Segurança e privacidade",
    items: [
      { q: "Meus dados são isolados?", a: "Sim. Cada profissional só acessa os próprios pacientes e dados (multi-tenant). Fotos e anexos ficam em armazenamento privado, servidos só para você." },
      { q: "Senhas e integrações", a: "Senhas de e-mail são guardadas criptografadas. As integrações (WhatsApp/Telegram/E-mail/Google) respeitam o isolamento por profissional." },
      { q: "LGPD", a: "Veja a Política de Privacidade e os Termos no rodapé do login. O paciente consente antes de transcrições por IA." },
    ],
  },
];

export default function AjudaPage() {
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<string | null>(null);

  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    return GUIDES
      .filter((g) => !topic || g.id === topic)
      .map((g) => ({
        ...g,
        items: q
          ? g.items.filter((it) => (it.q + " " + it.a).toLowerCase().includes(q))
          : g.items,
      }))
      .filter((g) => g.items.length > 0);
  }, [q, topic]);

  const total = filtered.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="max-w-3xl space-y-6 pb-20">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl lg:text-4xl font-display font-bold text-primary">Central de Ajuda</h1>
          <p className="text-foreground/50 mt-1">Perguntas frequentes sobre todo o sistema. Busque ou navegue por tema.</p>
        </div>
        <button
          onClick={() => window.dispatchEvent(new Event("ledivan-open-tour"))}
          className="inline-flex items-center gap-2 bg-primary text-white px-5 py-3 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition"
        >
          <Sparkles className="w-5 h-5" /> Iniciar tutorial
        </button>
      </div>

      {/* Busca */}
      <div className="flex items-center gap-3 bg-white px-5 py-3.5 rounded-2xl border border-border focus-within:border-primary transition">
        <Search className="w-5 h-5 text-foreground/40" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar na ajuda (ex: lembrete, pacote, vídeo, recibo)…"
          className="bg-transparent outline-none text-sm w-full placeholder:text-foreground/30"
        />
        {query && (
          <button onClick={() => setQuery("")} className="text-xs font-semibold text-foreground/40 hover:text-primary">limpar</button>
        )}
      </div>

      {/* Chips de temas */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setTopic(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${topic === null ? "bg-primary text-white" : "bg-white border border-border text-foreground/60 hover:text-primary"}`}
        >
          Todos
        </button>
        {GUIDES.map((g) => (
          <button
            key={g.id}
            onClick={() => setTopic(topic === g.id ? null : g.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition ${topic === g.id ? "bg-primary text-white" : "bg-white border border-border text-foreground/60 hover:text-primary"}`}
          >
            <g.icon className="w-3.5 h-3.5" /> {g.title}
          </button>
        ))}
      </div>

      {q && <p className="text-sm text-foreground/40">{total} resultado(s) para “{query}”.</p>}

      <div className="space-y-5">
        {filtered.map((g) => (
          <div key={g.id} className="glass-card rounded-[24px] p-6">
            <h2 className="font-display text-xl font-bold text-primary flex items-center gap-2 mb-3">
              <g.icon className="w-5 h-5" /> {g.title}
            </h2>
            <div className="space-y-2">
              {g.items.map((it) => (
                <details key={it.q} open={!!q} className="group rounded-xl bg-surface/50 border border-border px-4 py-3 [&[open]>summary>span:last-child]:rotate-45">
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

        {total === 0 && (
          <div className="glass-card rounded-[24px] p-10 text-center text-foreground/50">
            Nada encontrado. Tente outro termo ou{" "}
            <a href="mailto:contato@ledivan.com.br" className="text-primary underline">fale com a gente</a>.
          </div>
        )}

        <div className="glass-card rounded-[24px] p-6 flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5 text-sm text-foreground/60"><MessageCircle className="w-4 h-4 text-primary" /> Mais dúvidas?</span>
          <p className="text-sm text-foreground/50">Fale com a gente: <a href="mailto:contato@ledivan.com.br" className="text-primary underline">contato@ledivan.com.br</a></p>
        </div>
      </div>
    </div>
  );
}
