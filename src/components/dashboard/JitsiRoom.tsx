"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (domain: string, options: Record<string, unknown>) => {
      addEventListener: (e: string, cb: (...args: unknown[]) => void) => void;
      executeCommand: (cmd: string, ...args: unknown[]) => void;
      dispose: () => void;
    };
  }
}

// Sala Jitsi embutida. Com JaaS (jwt+domain 8x8.vc) o moderador é garantido pelo
// token (sempre o terapeuta). Sem JaaS, cai no meet.jit.si público.
// Reporta eventos (abriu/convidado/encerrou) p/ a sessão.
export function JitsiRoom({
  roomName,
  displayName,
  sessionId,
  domain = "meet.jit.si",
  jwt,
  reportEvents = true,
  onLeaveHref = "/dashboard/agenda",
  inline = false,
}: {
  roomName: string;
  displayName: string;
  sessionId: string;
  domain?: string;
  jwt?: string | null;
  reportEvents?: boolean;
  onLeaveHref?: string;
  inline?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  // Sem isto, qualquer falha (script bloqueado, JWT recusado, sala fechada) deixava o spinner
  // "Entrando na sala…" para sempre, escondendo o motivo. Agora a falha aparece.
  const [erro, setErro] = useState<string | null>(null);
  const guestReported = useRef(false);

  function report(event: "opened" | "guest" | "ended") {
    if (!reportEvents) return;
    // keepalive p/ o "ended" sobreviver ao fechamento da aba
    fetch(`/api/meeting/${sessionId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event }),
      keepalive: true,
    }).catch(() => {});
  }

  useEffect(() => {
    function start() {
      if (!window.JitsiMeetExternalAPI || !ref.current) return;
      const api = new window.JitsiMeetExternalAPI(domain, {
        roomName,
        jwt: jwt || undefined,
        parentNode: ref.current,
        width: "100%",
        height: "100%",
        userInfo: { displayName },
        configOverwrite: {
          prejoinPageEnabled: false,
          prejoinConfig: { enabled: false },
          disableDeepLinking: true,
          startWithAudioMuted: false,
        },
        interfaceConfigOverwrite: {
          MOBILE_APP_PROMO: false,
          SHOW_JITSI_WATERMARK: false,
        },
      });

      api.addEventListener("videoConferenceJoined", () => {
        setLoaded(true);
        report("opened");
      });
      api.addEventListener("participantJoined", () => {
        if (!guestReported.current) {
          guestReported.current = true;
          report("guest");
        }
      });
      api.addEventListener("readyToClose", () => {
        report("ended");
        window.location.href = onLeaveHref;
      });
      // Falhas que antes passavam em silêncio: token recusado, sala só para membros, conexão caiu.
      api.addEventListener("errorOccurred", (e: unknown) => {
        const nome = (e as { error?: { name?: string } })?.error?.name;
        setErro(nome ? `A sala recusou a entrada (${nome}).` : "Não consegui entrar na sala.");
      });

      return api;
    }

    let apiInstance: ReturnType<typeof start> | undefined;

    if (window.JitsiMeetExternalAPI) {
      apiInstance = start();
    } else {
      const script = document.createElement("script");
      script.src = `https://${domain}/external_api.js`;
      script.async = true;
      script.onload = () => { apiInstance = start(); };
      // O script do Jitsi não carregou (bloqueado por CSP, rede, etc.) — não deixar o spinner eterno.
      script.onerror = () => setErro("Não consegui carregar a sala de vídeo. Verifique a conexão e tente de novo.");
      document.body.appendChild(script);
    }

    const onUnload = () => report("ended");
    window.addEventListener("pagehide", onUnload);

    return () => {
      window.removeEventListener("pagehide", onUnload);
      try { apiInstance?.dispose(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomName, displayName, sessionId, domain, jwt, onLeaveHref]);

  return (
    <div className={inline ? "relative h-full w-full bg-black overflow-hidden" : "fixed inset-0 bg-black"}>
      {!loaded && !erro && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-white/80">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm">Entrando na sala como anfitrião…</p>
        </div>
      )}
      {erro && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 px-6 text-center text-white/90">
          <p className="text-sm max-w-sm">{erro}</p>
          <a href={onLeaveHref} className="rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/25">
            Voltar
          </a>
        </div>
      )}
      <div ref={ref} className="h-full w-full" />
    </div>
  );
}
