"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Mic, Square, X, ChevronRight, Loader2 } from "lucide-react";
import { abreSozinho, avisosDoDiva, TAREFAS, type EstadoDoDiva, type TarefaDoDiva } from "@/lib/diva";
import { useJanela } from "@/lib/useJanela";
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

const leNumero = (chave: string): number => {
  try { return Number(localStorage.getItem(chave) ?? "0") || 0; } catch { return 0; }
};
const grava = (chave: string, valor: string) => {
  try { localStorage.setItem(chave, valor); } catch { /* navegador sem storage: o Divã só não lembra */ }
};
const hojeISO = () => new Date().toISOString().slice(0, 10);

export function Diva({ estado, podeOuvir }: { estado: EstadoDoDiva; podeOuvir: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [ouvindo, setOuvindo] = useState(false);
  const [fala, setFala] = useState<string | null>(null);
  const [sugestao, setSugestao] = useState<TarefaDoDiva | null>(null);
  const [erro, setErro] = useState<string | null>(null);
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
    setErro(null);
    setGravando(false);
    pararGravador();
    // Escolher uma tarefa zera a contagem: ali ele provou que serve.
    grava(CHAVE_DISPENSAS, escolheu ? "0" : String(leNumero(CHAVE_DISPENSAS) + 1));
  }

  function ir(tarefa: { rota: string }) {
    fechar(true);
    router.push(tarefa.rota);
  }

  async function falar() {
    setErro(null);
    setFala(null);
    setSugestao(null);
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
          setSugestao(j.tarefa ?? null);
          if (!j.tarefa) setErro("Entendi o que você disse, mas não sei fazer isso. Escolha abaixo.");
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
                {sugestao && (
                  <button type="button" onClick={() => ir(sugestao)}
                    className="flex w-full items-center justify-between gap-2 rounded-xl bg-[#ecfdf5] border border-[#a7f3d0] px-3 py-2.5 text-left">
                    <span className="text-sm font-bold text-[#047857]">{sugestao.rotulo}</span>
                    <ChevronRight className="w-4 h-4 text-[#047857]" />
                  </button>
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
