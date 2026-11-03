"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Loader2 } from "lucide-react";

/**
 * O MICROFONE DE UM CAMPO (doc 76).
 *
 * Segura, fala, solta — e o texto entra NO CAMPO DESTE botão, nunca no de outro. Cada microfone
 * é uma instância própria com o seu `campo` e o seu `rotulo`; não existe estado compartilhado
 * entre eles, que é o item 4 do documento ("sem misturar informações de campos diferentes").
 *
 * Segurar, e não alternar: a terapeuta fala enquanto segura e o fim da fala é o fim do toque.
 * Com um botão de liga/desliga, esquecer de desligar grava a sala inteira — e áudio de sessão é
 * o dado mais sensível que este app encosta.
 *
 * O botão só existe quando há motor para ouvir (`GET /api/ditado`). Um microfone que falha ao
 * ser apertado é pior do que microfone nenhum: ela grava a fala inteira antes de descobrir.
 *
 * E ele não aparece ANTES da resposta (doc 57). Desenhar primeiro e esconder depois foi o que a
 * terapeuta viu: "o microfone e a instrução aparecem e logo somem da tela". O que sumia era a
 * resposta chegando com `disponivel: false` — e, no meio-tempo, o botão estava desabilitado, por
 * isso o clique rápido também não fazia nada. Enquanto não se sabe, não se desenha.
 */

export type CampoDoDitado = "titulo" | "registro" | "anamnese";

export function BotaoMicrofone({
  patientId, campo, rotulo, onTexto, titulo,
}: {
  patientId: string;
  campo: CampoDoDitado;
  /** O nome do campo, que o modelo usa para saber o que está organizando. */
  rotulo?: string;
  /** Recebe o texto pronto. Quem decide se acrescenta ou substitui é o campo. */
  onTexto: (texto: string) => void;
  titulo?: string;
}) {
  const [disponivel, setDisponivel] = useState<boolean | null>(null);
  const [gravando, setGravando] = useState(false);
  const [ouvindo, setOuvindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const gravador = useRef<MediaRecorder | null>(null);
  const pedacos = useRef<Blob[]>([]);

  useEffect(() => {
    let vivo = true;
    fetch("/api/ditado")
      .then((r) => r.json())
      .then((j) => { if (vivo) setDisponivel(!!j?.disponivel); })
      .catch(() => { if (vivo) setDisponivel(false); });
    return () => { vivo = false; };
  }, []);

  function soltarMicrofone() {
    gravador.current?.stream.getTracks().forEach((t) => t.stop());
    gravador.current = null;
  }
  useEffect(() => () => soltarMicrofone(), []);

  async function comecar() {
    if (gravando || ouvindo) return;
    setErro(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      pedacos.current = [];
      mr.ondataavailable = (e) => { if (e.data.size) pedacos.current.push(e.data); };
      mr.onstop = async () => {
        const blob = new Blob(pedacos.current, { type: mr.mimeType || "audio/webm" });
        soltarMicrofone();
        if (blob.size < 1000) { setErro("Não ouvi nada. Segure enquanto fala."); return; }
        setOuvindo(true);
        try {
          const fd = new FormData();
          /**
           * A extensão acompanha o que o gravador entregou — Chrome dá webm, o Safari do iPhone
           * dá mp4. Os provedores farejam o conteúdo, mas recusam com 400 um arquivo SEM extensão.
           */
          const tipo = (blob.type.split(";")[0] || "").split("/")[1] || "webm";
          fd.append("audio", blob, `ditado.${tipo}`);
          fd.append("campo", campo);
          fd.append("patientId", patientId);
          if (rotulo) fd.append("rotulo", rotulo);
          const r = await fetch("/api/ditado", { method: "POST", body: fd });
          // A resposta pode não ser JSON: 413 da plataforma, 504 de tempo, página de erro no meio.
          const j = await r.json().catch(() => null);
          if (!j) { setErro(`Não consegui transcrever (resposta ${r.status}).`); return; }
          if (!j.ok) { setErro(j.error ?? "Não consegui transcrever."); return; }
          onTexto(String(j.texto ?? ""));
        } catch {
          setErro("Erro de rede ao transcrever.");
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

  function parar() {
    if (!gravando) return;
    setGravando(false);
    gravador.current?.stop();
  }

  // Só com resposta na mão. `null` é "ainda não sei", e botão que pisca é pior do que botão que
  // demora: ela tenta usar o que está saindo da tela.
  if (disponivel !== true) return null;

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        // Segurar com o dedo e segurar com o mouse são eventos diferentes; os dois terminam a
        // gravação, e `onPointerLeave` cobre quem arrasta o dedo para fora do botão antes de soltar.
        onPointerDown={comecar}
        onPointerUp={parar}
        onPointerLeave={parar}
        onContextMenu={(e) => e.preventDefault()}
        disabled={ouvindo}
        aria-label={titulo ?? `Ditar ${rotulo ?? "o campo"}`}
        title={titulo ?? "Segure para falar"}
        className={`shrink-0 w-8 h-8 rounded-full inline-flex items-center justify-center transition select-none touch-none disabled:opacity-50 ${
          gravando ? "bg-red-500 text-white scale-110" : "bg-primary/10 text-primary hover:bg-primary/20"
        }`}
      >
        {ouvindo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
      </button>
      {gravando && <span className="text-[11px] font-bold text-red-600">gravando…</span>}
      {ouvindo && <span className="text-[11px] text-foreground/50">transcrevendo…</span>}
      {erro && <span className="text-[11px] text-red-600">{erro}</span>}
    </span>
  );
}
