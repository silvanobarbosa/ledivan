"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Mic, Square, X, ChevronRight, Loader2 } from "lucide-react";
import { abreSozinho, avisosDoDiva, TAREFAS, type EstadoDoDiva, type TarefaDoDiva } from "@/lib/diva";
import { useJanela } from "@/lib/useJanela";
import { anotarPorVoz, cancelarPorVoz } from "@/app/dashboard/diva-actions";
import { FLUTUANTE_DIVA, FUNDO_DA_JANELA, JANELA } from "@/lib/modal";

/**
 * O DIVÃ na tela.
 *
 * Um ícone flutuante que abre a pergunta — "o que deseja fazer?" — com o catálogo do que o app faz
 * e, para quem tem chave de IA cadastrada, um botão de falar.
 *
 * A pergunta aparece sozinha na primeira visita do dia e é DISPENSÁVEL: três dispensas seguidas e
 * ela para de abrir por conta própria, ficando só no ícone. Quem abre o app vinte vezes por dia
 * para olhar a agenda não pode ser interrogado nas vinte.
 *
 * A contagem mora no navegador (localStorage), de propósito: é preferência de uso, não dado
 * clínico, e não vale uma coluna no banco nem uma ida ao servidor a cada abertura.
 */

const CHAVE_DISPENSAS = "ledivan_diva_dispensas";
const CHAVE_DIA = "ledivan_diva_dia";
/**
 * O aviso de que a VOZ ficou pronta. Uma vez por pessoa, e só.
 *
 * Recurso novo que ninguém sabe que existe é recurso que não existe — e o microfone do Divã não
 * se anuncia sozinho. O aviso abre o Divã na primeira visita depois de a função entrar no ar,
 * mesmo para quem já tinha dispensado a pergunta do dia, e some para sempre ao ser lido.
 */
const CHAVE_AVISO_VOZ = "ledivan_diva_aviso_voz";

const leNumero = (chave: string): number => {
  try { return Number(localStorage.getItem(chave) ?? "0") || 0; } catch { return 0; }
};
const grava = (chave: string, valor: string) => {
  try { localStorage.setItem(chave, valor); } catch { /* navegador sem storage: o Divã só não lembra */ }
};
const hojeISO = () => new Date().toISOString().slice(0, 10);

type PacienteNaTela = { id: string; nome: string };
type PreviaNaTela = {
  acao: "anotar" | "reservar" | "cancelar" | "pagar";
  paciente: { tipo: "um"; paciente: PacienteNaTela } | { tipo: "varios"; candidatos: PacienteNaTela[] } | { tipo: "nenhum" };
  quando: { iso: string; porExtenso: string } | null;
  texto: string;
  valor: number | null;
  forma: string | null;
  cobranca?: { chave: string; porExtenso: string; falta: number; ano: number } | null;
  sessoes?: { id: string; porExtenso: string }[];
  faltando: string[];
};

const VERBO: Record<PreviaNaTela["acao"], string> = {
  anotar: "Anotar no prontuário",
  reservar: "Marcar atendimento",
  cancelar: "Cancelar atendimento",
  pagar: "Lançar pagamento",
};

const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function Diva({ estado, podeOuvir }: { estado: EstadoDoDiva; podeOuvir: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [ouvindo, setOuvindo] = useState(false);
  const [fala, setFala] = useState<string | null>(null);
  const [sugestao, setSugestao] = useState<TarefaDoDiva | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [avisoDaVoz, setAvisoDaVoz] = useState(false);
  /** A prévia do comando ditado: o que ele entendeu, esperando o toque dela. */
  const [comando, setComando] = useState<PreviaNaTela | null>(null);
  const [executando, setExecutando] = useState(false);
  const gravador = useRef<MediaRecorder | null>(null);
  const pedacos = useRef<Blob[]>([]);
  const router = useRouter();
  const janela = useJanela(aberto, () => fechar(false));

  const avisos = avisosDoDiva(estado);

  // Abre sozinho UMA vez por dia, e só enquanto ela não tiver dispensado três vezes seguidas.
  useEffect(() => {
    try {
      /**
       * Chegou numa tela POR PEDIDO do próprio Divã (`?novo=1`, `?bloquear=1`)? Então ele fica
       * quieto: a pessoa já disse o que queria, e abrir a pergunta por cima da janela que ela
       * acabou de pedir é atrapalhar justamente quem foi atendido.
       */
      if (/[?&](novo|bloquear)=1/.test(window.location.search)) return;

      // O aviso da voz vem primeiro e vale uma abertura própria, independente da pergunta do dia.
      const jaViuOAviso = localStorage.getItem(CHAVE_AVISO_VOZ) === "1";
      if (!jaViuOAviso) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- anunciar o recurso novo é o efeito desejado
        setAvisoDaVoz(true);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- idem
        setAberto(true);
        grava(CHAVE_DIA, hojeISO());
        return;
      }

      if (localStorage.getItem(CHAVE_DIA) === hojeISO()) return;
      grava(CHAVE_DIA, hojeISO());
      if (abreSozinho(leNumero(CHAVE_DISPENSAS))) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- abrir na primeira visita do dia é o efeito desejado
        setAberto(true);
      }
    } catch { /* sem storage: não abre sozinho, e está tudo bem */ }
  }, []);

  const pararGravador = useCallback(() => {
    gravador.current?.stream.getTracks().forEach((t) => t.stop());
    gravador.current = null;
  }, []);

  function fechar(escolheu: boolean) {
    setAberto(false);
    setFala(null);
    setSugestao(null);
    setComando(null);
    setErro(null);
    setGravando(false);
    pararGravador();
    // Fechar a janela já conta como ter lido o aviso: ele não volta a perseguir ninguém.
    if (avisoDaVoz) { grava(CHAVE_AVISO_VOZ, "1"); setAvisoDaVoz(false); }
    // Escolher uma tarefa zera a contagem: ali ele provou que serve.
    grava(CHAVE_DISPENSAS, escolheu ? "0" : String(leNumero(CHAVE_DISPENSAS) + 1));
  }

  function ir(tarefa: { rota: string }) {
    fechar(true);
    router.push(tarefa.rota);
  }

  /** Ela escolheu entre os homônimos: a prévia é refeita com o paciente resolvido. */
  function escolherPaciente(p: PacienteNaTela) {
    setComando((c) => (c ? { ...c, paciente: { tipo: "um", paciente: p }, faltando: c.faltando.filter((f) => !/paciente/i.test(f)) } : c));
  }
  function escolherSessao(id: string) {
    setComando((c) => (c ? { ...c, sessoes: c.sessoes?.filter((s) => s.id === id), faltando: c.faltando.filter((f) => !/atendimento nesse dia/i.test(f)) } : c));
  }

  /**
   * O TOQUE que executa. Daqui para baixo alguma coisa acontece de verdade — e só chega aqui o
   * que ela leu na tela e confirmou.
   */
  function confirmarComando() {
    if (!comando || comando.paciente.tipo !== "um" || comando.faltando.length) return;
    const paciente = comando.paciente.paciente;

    /**
     * PAGAR não escreve por voz, pelo mesmo motivo que reservar não escreve.
     *
     * O lançamento carrega escolhas com consequência em dinheiro — a cobrança que ele quita, quem
     * pagou, a forma, o que fazer com a sobra e com a diferença. A voz leva a tela até ali, com a
     * cobrança certa aberta e o valor preenchido; quem aperta "Lançar pagamento" é ela.
     */
    if (comando.acao === "pagar" && comando.cobranca && comando.valor != null) {
      const q = new URLSearchParams({
        ano: String(comando.cobranca.ano),
        cobranca: comando.cobranca.chave,
        pagar: "1",
        valor: comando.valor.toFixed(2),
      });
      if (comando.forma) q.set("forma", comando.forma);
      fechar(true);
      router.push(`/dashboard/patients/${paciente.id}?${q.toString()}`);
      return;
    }

    if (comando.acao === "reservar" && comando.quando) {
      // Reservar não escreve por voz: leva à janela preenchida, e ela aperta Agendar.
      fechar(true);
      router.push(`/dashboard/agenda?novo=1&paciente=${paciente.id}&quando=${encodeURIComponent(comando.quando.iso)}`);
      return;
    }

    setExecutando(true);
    setErro(null);
    void (async () => {
      try {
        if (comando.acao === "anotar") {
          const r = await anotarPorVoz(paciente.id, comando.texto);
          if (!r.ok) { setErro(r.error ?? "Não consegui anotar."); return; }
          fechar(true);
          router.push(`/dashboard/patients/${paciente.id}`);
          return;
        }
        const alvo = comando.sessoes?.[0];
        if (!alvo) { setErro("Não sei qual atendimento cancelar."); return; }
        const r = await cancelarPorVoz(alvo.id);
        if (!r.ok) { setErro(r.error ?? "Não consegui cancelar."); return; }
        fechar(true);
        router.push("/dashboard/agenda");
      } finally {
        setExecutando(false);
      }
    })();
  }

  async function falar() {
    setErro(null);
    setFala(null);
    setSugestao(null);
    setComando(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      pedacos.current = [];
      mr.ondataavailable = (e) => { if (e.data.size) pedacos.current.push(e.data); };
      mr.onstop = async () => {
        pararGravador();
        const blob = new Blob(pedacos.current, { type: mr.mimeType || "audio/webm" });
        if (blob.size < 1000) { setErro("Não ouvi nada. Segure o botão enquanto fala."); return; }
        setOuvindo(true);
        try {
          const fd = new FormData();
          fd.append("audio", blob, "fala.webm");
          const r = await fetch("/api/diva/ouvir", { method: "POST", body: fd });
          const j = await r.json();
          if (!j.ok) { setErro(j.error ?? "Não consegui ouvir."); return; }
          setFala(j.fala || null);
          setComando(j.comando ?? null);
          setSugestao(j.tarefa ?? null);
          if (!j.tarefa && !j.comando) setErro("Entendi o que você disse, mas não sei fazer isso. Escolha abaixo.");
        } catch {
          setErro("Erro de rede ao ouvir.");
        } finally {
          setOuvindo(false);
        }
      };
      gravador.current = mr;
      mr.start();
      setGravando(true);
    } catch {
      setErro("Preciso de permissão para usar o microfone.");
    }
  }

  function pararDeFalar() {
    setGravando(false);
    gravador.current?.stop();
  }

  return (
    <>
      {/* O ícone. Fica acima da barra inferior do celular para não cobrir a navegação. */}
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label="Abrir o Divã"
        title="Divã — o que deseja fazer?"
        className={`print:hidden ${FLUTUANTE_DIVA} z-[60] h-14 w-14 lg:h-16 lg:w-16 rounded-full shadow-2xl ring-4 ring-white overflow-hidden transition hover:scale-110 active:scale-95`}
      >
        <Image src="/diva.png" alt="" width={64} height={64} className="h-full w-full object-cover" />
      </button>

      {aberto && (
        <div className={FUNDO_DA_JANELA} onClick={() => fechar(false)}>
          <div
            ref={janela}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Divã"
            className={`${JANELA} max-w-md outline-none`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Image src="/diva.png" alt="" width={40} height={40} className="h-10 w-10 rounded-full object-cover shrink-0" />
                <div className="min-w-0">
                  <p className="text-lg font-display font-bold text-primary leading-tight">O que deseja fazer?</p>
                  <p className="text-xs text-foreground/50">Escolha abaixo{podeOuvir ? " ou fale comigo" : ""}.</p>
                </div>
              </div>
              <button type="button" onClick={() => fechar(false)} aria-label="Fechar" className="p-1.5 rounded-lg hover:bg-surface transition shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* O ANÚNCIO da voz: uma vez por pessoa, e com o caminho inteiro escrito. Quem não
                tem chave de IA recebe o passo que falta, não um "indisponível". */}
            {avisoDaVoz && (
              <div className="rounded-2xl border border-[#a7f3d0] bg-[#ecfdf5] px-4 py-3 space-y-2">
                <p className="text-sm font-bold text-[#047857] flex items-center gap-2">
                  <Mic className="w-4 h-4 shrink-0" /> Novidade: agora você pode FALAR comigo
                </p>
                {podeOuvir ? (
                  <ol className="text-xs text-[#065f46] space-y-1 list-decimal pl-4">
                    <li>Toque em <strong>Falar com o Divã</strong>, aqui embaixo.</li>
                    <li>Diga o que quer — por exemplo: <em>“quem está devendo?”</em>, <em>“quero marcar um atendimento”</em>, <em>“me mostra a agenda de hoje”</em>.</li>
                    <li>Toque de novo para enviar. Eu mostro o que entendi e <strong>você confirma</strong> antes de eu abrir a tela.</li>
                  </ol>
                ) : (
                  <>
                    <p className="text-xs text-[#065f46]">
                      Falta um passo: a escuta usa a <strong>sua</strong> conta de IA. Em{" "}
                      <strong>Ajustes → IA da transcrição</strong> há um caminho <strong>gratuito</strong> (Groq,
                      sem cartão) com o passo a passo. Depois de colar a chave, o microfone aparece aqui.
                    </p>
                    <button type="button" onClick={() => ir({ rota: "/dashboard/settings" })}
                      className="inline-flex items-center gap-1 rounded-xl bg-[#047857] px-3 py-1.5 text-xs font-bold text-white">
                      Abrir os Ajustes <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
                <button type="button" onClick={() => { grava(CHAVE_AVISO_VOZ, "1"); setAvisoDaVoz(false); }}
                  className="text-[11px] font-semibold text-[#047857] underline">
                  Entendi, não mostrar de novo
                </button>
              </div>
            )}

            {/* O que espera por ela. Só aparece o que existe — ver `avisosDoDiva`. */}
            {avisos.length > 0 && (
              <div className="rounded-2xl bg-secondary-container/25 px-3 py-2.5 space-y-1">
                {avisos.map((a) => (
                  <button key={a.id} type="button" onClick={() => ir({ rota: a.rota })}
                    className="flex w-full items-center justify-between gap-2 text-left text-sm text-foreground/75 hover:text-primary transition">
                    <span>{a.texto}</span>
                    <ChevronRight className="w-4 h-4 shrink-0 opacity-50" />
                  </button>
                ))}
              </div>
            )}

            {podeOuvir && (
              <div className="rounded-2xl border border-border/60 bg-white/50 p-3 space-y-2">
                <button
                  type="button"
                  onClick={gravando ? pararDeFalar : falar}
                  disabled={ouvindo}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition disabled:opacity-60 ${
                    gravando ? "bg-red-600 text-white" : "bg-primary text-white"
                  }`}
                >
                  {ouvindo ? <><Loader2 className="w-4 h-4 animate-spin" /> Ouvindo…</>
                    : gravando ? <><Square className="w-4 h-4" /> Parar e enviar</>
                    : <><Mic className="w-4 h-4" /> Falar com o Divã</>}
                </button>
                {gravando && <p className="text-[11px] text-center text-foreground/50">Pode falar. Clique de novo quando terminar.</p>}
                {fala && <p className="text-xs text-foreground/60">Você disse: <span className="italic">“{fala}”</span></p>}
                {/* A confirmação é obrigatória: o Divã nunca sai andando sozinho com o que ouviu. */}
                {/* A PRÉVIA do comando: o que ele entendeu, por extenso, antes de qualquer escrita.
                    Nome COMPLETO do paciente e data por extenso de propósito — é aqui que um
                    engano tem de saltar aos olhos, porque depois do toque a coisa aconteceu. */}
                {comando && (
                  <div className="rounded-xl border border-[#c7d2fe] bg-[#eef2ff] px-3 py-2.5 space-y-2">
                    <p className="text-xs font-bold text-[#4338ca]">{VERBO[comando.acao]}</p>

                    {comando.paciente.tipo === "um" && (
                      <p className="text-sm font-semibold text-foreground/80">{comando.paciente.paciente.nome}</p>
                    )}

                    {/* Homônimas: o Divã NÃO escolhe. Na base real há Thais Alves e Thais Duarte,
                        e uma Eloá e uma Eloah — nenhuma transcrição separa essas duas. */}
                    {comando.paciente.tipo === "varios" && (
                      <div className="space-y-1">
                        <p className="text-xs text-[#4338ca]">Qual delas?</p>
                        {comando.paciente.candidatos.map((c) => (
                          <button key={c.id} type="button" onClick={() => escolherPaciente(c)}
                            className="flex w-full items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-left text-sm hover:bg-surface transition">
                            <span>{c.nome}</span>
                            <ChevronRight className="w-4 h-4 opacity-40" />
                          </button>
                        ))}
                      </div>
                    )}

                    {comando.acao === "anotar" && comando.texto && (
                      <p className="text-xs text-foreground/70 bg-white rounded-lg px-3 py-2">“{comando.texto}”</p>
                    )}

                    {comando.acao === "reservar" && comando.quando && (
                      <p className="text-sm text-foreground/80">{comando.quando.porExtenso}</p>
                    )}

                    {comando.acao === "cancelar" && (comando.sessoes?.length ?? 0) > 0 && (
                      (comando.sessoes?.length ?? 0) === 1 ? (
                        <p className="text-sm text-foreground/80">{comando.sessoes![0].porExtenso}</p>
                      ) : (
                        <div className="space-y-1">
                          <p className="text-xs text-[#4338ca]">Qual atendimento?</p>
                          {comando.sessoes!.map((x) => (
                            <button key={x.id} type="button" onClick={() => escolherSessao(x.id)}
                              className="flex w-full items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-left text-sm hover:bg-surface transition">
                              <span>{x.porExtenso}</span>
                              <ChevronRight className="w-4 h-4 opacity-40" />
                            </button>
                          ))}
                        </div>
                      )
                    )}

                    {/* PAGAR: o valor e a cobrança que ele vai quitar, antes de a tela abrir. */}
                    {comando.acao === "pagar" && comando.valor != null && (
                      <p className="text-sm font-bold text-foreground/80">{reais(comando.valor)}</p>
                    )}
                    {comando.acao === "pagar" && comando.cobranca && (
                      <p className="text-xs text-foreground/60">{comando.cobranca.porExtenso}</p>
                    )}

                    {comando.faltando.length > 0 && (
                      <p className="text-xs text-[#92400e]">{comando.faltando[0]}</p>
                    )}

                    {/* Não reconheceu o nome? Isso acontece — nome curto some na transcrição ("Thais"
                        virou "Taz" no teste). O certo é NÃO adivinhar, e o útil é dar a saída: a
                        lista de cadastros, onde ela acha e segue. Beco sem saída é o que faz a
                        pessoa desistir do recurso. */}
                    {comando.paciente.tipo === "nenhum" && (
                      <button type="button" onClick={() => ir({ rota: "/dashboard/patients" })}
                        className="flex w-full items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-left text-sm hover:bg-surface transition">
                        <span>Escolher o paciente na lista</span>
                        <ChevronRight className="w-4 h-4 opacity-40" />
                      </button>
                    )}

                    {comando.paciente.tipo === "um" && comando.faltando.length === 0 && (
                      <button type="button" onClick={confirmarComando} disabled={executando}
                        className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white transition disabled:opacity-60 ${
                          comando.acao === "cancelar" ? "bg-[#b91c1c]" : "bg-[#4338ca]"
                        }`}>
                        {executando ? <><Loader2 className="w-4 h-4 animate-spin" /> Fazendo…</>
                          : comando.acao === "reservar" ? "Abrir o agendamento preenchido"
                          : comando.acao === "cancelar" ? "Confirmar o cancelamento"
                          : comando.acao === "pagar" ? "Abrir o lançamento preenchido"
                          : "Confirmar a anotação"}
                      </button>
                    )}
                  </div>
                )}

                {sugestao && (
                  <div className="space-y-1">
                    <button type="button" onClick={() => ir(sugestao)}
                      className="flex w-full items-center justify-between gap-2 rounded-xl bg-[#ecfdf5] border border-[#a7f3d0] px-3 py-2.5 text-left">
                      <span className="text-sm font-bold text-[#047857]">{sugestao.rotulo}</span>
                      <ChevronRight className="w-4 h-4 text-[#047857]" />
                    </button>
                    {/* O rótulo é um verbo, mas aqui ele só NAVEGA. Dizer isso é o conserto do
                        caso de 01/11: ela ditou um pagamento, foi levada à tela e saiu achando
                        que tinha lançado. Ver `soLeva` em `lib/diva.ts`. */}
                    {sugestao.soLeva && (
                      <p className="text-[11px] text-foreground/50 px-1">
                        Por voz eu te levo até a tela — o preenchimento é lá.
                      </p>
                    )}
                  </div>
                )}
                {erro && <p className="text-xs text-red-600">{erro}</p>}
              </div>
            )}

            <div className="space-y-1.5 max-h-[45vh] overflow-y-auto">
              {TAREFAS.map((t) => (
                <button key={t.id} type="button" onClick={() => ir(t)}
                  className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left hover:bg-surface transition">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground/80">{t.rotulo}</span>
                    {t.dica && <span className="block text-[11px] text-foreground/45">{t.dica}</span>}
                  </span>
                  <ChevronRight className="w-4 h-4 shrink-0 opacity-40" />
                </button>
              ))}
            </div>

            {/* A fronteira, dita em voz alta: o Divã é do consultório, não da clínica. */}
            <p className="text-[10px] text-foreground/40 text-center">
              O Divã ajuda com o Le&rsquo;Divan e com a rotina do consultório. Ele não opina sobre conduta clínica.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
