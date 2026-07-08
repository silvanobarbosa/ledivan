"use client";

import { useState } from "react";
import { LifeBuoy, X, MessageCircle, TriangleAlert, Send, CheckCircle2, Loader2 } from "lucide-react";

type Kind = "message" | "error";
type Status = "idle" | "sending" | "sent" | "error";

const ENDPOINT = "https://reverblabs.com.br/api/support/report";

export function SupportWidget() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("message");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  function reset() {
    setKind("message");
    setMessage("");
    setEmail("");
    setStatus("idle");
  }

  function close() {
    setOpen(false);
    // pequeno atraso para não “piscar” o reset durante o fade
    setTimeout(reset, 200);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || status === "sending") return;
    setStatus("sending");
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app: "Ledivan",
          kind,
          message: message.trim(),
          email: email.trim() || undefined,
          context: {
            url: typeof location !== "undefined" ? location.href : "",
            ua: typeof navigator !== "undefined" ? navigator.userAgent : "",
          },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  return (
    <>
      {/* Botão flutuante */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir suporte"
          className="fixed bottom-5 right-5 z-[60] inline-flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-on-primary shadow-[var(--shadow-eggplant)] hover:brightness-110"
        >
          <LifeBuoy className="h-5 w-5" />
          <span className="hidden sm:inline">Suporte</span>
        </button>
      )}

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:justify-end p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Suporte técnico"
        >
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-primary/30 backdrop-blur-[2px]"
            onClick={close}
          />

          <div className="glass-card-lg relative w-full max-w-sm p-5 reveal-up">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg text-primary">Suporte</h2>
              <button
                type="button"
                onClick={close}
                aria-label="Fechar"
                className="rounded-full p-1.5 text-foreground/50 hover:bg-primary/5 hover:text-primary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {status === "sent" ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <CheckCircle2 className="h-12 w-12 text-[var(--color-success)]" />
                <p className="font-medium text-foreground">Recebemos sua mensagem!</p>
                <p className="text-sm text-foreground/60">
                  Obrigado pelo contato. Retornaremos em breve
                  {email.trim() ? ` em ${email.trim()}` : ""}.
                </p>
                <button
                  type="button"
                  onClick={close}
                  className="mt-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-on-primary hover:brightness-110"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                {/* Seletor de tipo */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setKind("message")}
                    aria-pressed={kind === "message"}
                    className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-medium transition ${
                      kind === "message"
                        ? "border-transparent bg-primary text-on-primary"
                        : "border-[var(--border)] bg-[var(--color-surface-container-lowest)] text-foreground/70 hover:border-secondary"
                    }`}
                  >
                    <MessageCircle className="h-4 w-4" />
                    Mensagem
                  </button>
                  <button
                    type="button"
                    onClick={() => setKind("error")}
                    aria-pressed={kind === "error"}
                    className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-medium transition ${
                      kind === "error"
                        ? "border-transparent bg-primary text-on-primary"
                        : "border-[var(--border)] bg-[var(--color-surface-container-lowest)] text-foreground/70 hover:border-secondary"
                    }`}
                  >
                    <TriangleAlert className="h-4 w-4" />
                    Reportar erro
                  </button>
                </div>

                <div>
                  <label htmlFor="support-message" className="mb-1.5 block text-xs font-medium text-foreground/60">
                    {kind === "error" ? "Descreva o que aconteceu" : "Sua mensagem"}
                  </label>
                  <textarea
                    id="support-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    rows={4}
                    placeholder={
                      kind === "error"
                        ? "O que você tentou fazer e o que deu errado?"
                        : "Como podemos ajudar?"
                    }
                    className="w-full resize-none rounded-2xl border border-[var(--border)] bg-[var(--color-surface-container-lowest)] px-3.5 py-2.5 text-sm text-foreground placeholder:text-foreground/35"
                  />
                </div>

                <div>
                  <label htmlFor="support-email" className="mb-1.5 block text-xs font-medium text-foreground/60">
                    E-mail (opcional)
                  </label>
                  <input
                    id="support-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@exemplo.com"
                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--color-surface-container-lowest)] px-3.5 py-2.5 text-sm text-foreground placeholder:text-foreground/35"
                  />
                </div>

                {status === "error" && (
                  <p className="rounded-xl bg-[var(--color-error-container)] px-3 py-2 text-xs text-[var(--color-on-error-container)]">
                    Não foi possível enviar agora. Verifique sua conexão e tente novamente.
                  </p>
                )}

                <button
                  type="submit"
                  disabled={status === "sending" || !message.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-on-primary hover:brightness-110 disabled:opacity-50"
                >
                  {status === "sending" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enviando…
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Enviar
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
