"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Loader2 } from "lucide-react";

/**
 * O MICROFONE DE UM CAMPO (doc 76).
 *
 * Clica, fala, clica de novo — e o texto entra NO CAMPO DESTE botão, nunca no de outro. Cada
 * microfone é uma instância própria com o seu `campo` e o seu `rotulo`; não existe estado
 * compartilhado entre eles, que é o item 4 do documento ("sem misturar informações de campos
 * diferentes").
 *
 * Doc 63: era SEGURAR, virou alternar. Segurar custava a frase inteira quando o dedo escorregava
 * do botão. O risco que o segurar evitava continua de pé — esquecer de desligar grava a sala, e
 * áudio de sessão é o dado mais sensível que este app encosta —, então o alternar tem teto: o
 * cronômetro na tela mostra o que já foi gravado e a gravação se encerra sozinha em TETO_SEGUNDOS.
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

/** Teto da gravação: ninguém dita um registro por mais de cinco minutos seguidos. */
const TETO_SEGUNDOS = 300;

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
  const [segundos, setSegundos] = useState(0);
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
        if (blob.size < 1000) { setErro("Não ouvi nada. Clique no microfone e fale."); return; }
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
      setSegundos(0);
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

  /**
   * O cronômetro da gravação, e o teto. Um botão que alterna só é seguro se ele próprio desliga:
   * a tela mostra quanto já gravou e, no teto, a gravação encerra como se ela tivesse clicado.
   */
  useEffect(() => {
    if (!gravando) return;
    const t = setInterval(() => {
      setSegundos((s) => {
        if (s + 1 >= TETO_SEGUNDOS) {
          setGravando(false);
          gravador.current?.stop();
        }
        return s + 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [gravando]);

  // Só com resposta na mão. `null` é "ainda não sei", e botão que pisca é pior do que botão que
  // demora: ela tenta usar o que está saindo da tela.
  if (disponivel !== true) return null;

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        // Doc 63: um clique começa, o seguinte encerra. `onPointerLeave` saiu junto com o segurar
        // — era ele que cortava a frase quando o dedo escorregava do botão.
        onClick={() => (gravando ? parar() : void comecar())}
        onContextMenu={(e) => e.preventDefault()}
        disabled={ouvindo}
        aria-label={titulo ?? `Ditar ${rotulo ?? "o campo"}`}
        title={titulo ?? (gravando ? "Clique para finalizar a gravação" : "Clique para iniciar a gravação")}
        /* Doc 59: 44px CRAVADOS, o alvo de toque mínimo. Em px, e não `w-11`: a fonte raiz do app
           é 15px, e a medida em rem entregava 41. */
        className={`shrink-0 w-[44px] h-[44px] rounded-full inline-flex items-center justify-center transition select-none touch-none disabled:opacity-50 ${
          gravando ? "bg-red-500 text-white scale-110" : "bg-primary/10 text-primary hover:bg-primary/20"
        }`}
      >
        {ouvindo ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mic className="w-5 h-5" />}
      </button>
      {gravando && (
        <span className="text-[11px] font-bold text-red-600 tabular-nums">
          gravando… {String(Math.floor(segundos / 60)).padStart(2, "0")}:{String(segundos % 60).padStart(2, "0")}
        </span>
      )}
      {ouvindo && <span className="text-[11px] text-foreground/50">transcrevendo…</span>}
      {erro && <span className="text-[11px] text-red-600">{erro}</span>}
    </span>
  );
}
