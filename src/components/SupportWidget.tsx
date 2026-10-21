"use client";

import { useState } from "react";
import { LifeBuoy, X, MessageCircle, TriangleAlert, Send, CheckCircle2, Loader2, Paperclip } from "lucide-react";
import { FLUTUANTE_ALTO } from "@/lib/modal";
import { aceitaArquivo, dimensaoReduzida, LIMITE_ANEXOS } from "@/lib/anexoImagem";

type Kind = "message" | "error";
type Status = "idle" | "sending" | "sent" | "error";

const ENDPOINT = "https://reverblabs.com.br/api/support/report";

export function SupportWidget() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("message");
  const [message, setMessage] = useState("");
  const [anexos, setAnexos] = useState<string[]>([]);
  const [anexoErro, setAnexoErro] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  function reset() {
    setAnexos([]);
    setAnexoErro(null);
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

  /**

   * Reduz o print no navegador antes de anexar (doc 51). Sem isso um print de celular passa de

   * 3 MB e vai como base64 para dentro de um campo jsonb — o chamado incha e pode nem chegar.

   * O suporte precisa ENXERGAR a tela, não ter o original.

   */

  async function anexar(f: File) {

    const check = aceitaArquivo({ type: f.type, size: f.size }, anexos.length);

    if (!check.ok) return setAnexoErro(check.motivo);

    setAnexoErro(null);

    try {

      const bitmap = await createImageBitmap(f);

      const { largura, altura } = dimensaoReduzida(bitmap.width, bitmap.height);

      const canvas = document.createElement("canvas");

      canvas.width = largura; canvas.height = altura;

      const ctx = canvas.getContext("2d");

      if (!ctx) return setAnexoErro("Não consegui preparar a imagem neste navegador.");

      ctx.drawImage(bitmap, 0, 0, largura, altura);

      bitmap.close?.();

      setAnexos((a) => [...a, canvas.toDataURL("image/jpeg", 0.7)]);

    } catch {

      setAnexoErro("Não consegui ler esta imagem. Tente outro print.");

    }

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
            // Doc 51: os prints viajam no próprio chamado. O hub grava `extra` como veio, então
            // não foi preciso criar rota de upload nem armazenamento só para isto.
            extra: anexos.length ? { anexos } : null,
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
          // print:hidden porque o widget é montado no layout raiz e, sem isto, o botão
          // "Suporte" sai impresso no canto do prontuário e do recibo entregues ao paciente.
          className={`print:hidden ${FLUTUANTE_ALTO} z-[60] inline-flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-on-primary shadow-[var(--shadow-eggplant)] hover:brightness-110`}
        >
          <LifeBuoy className="h-5 w-5" />
          <span className="hidden sm:inline">Suporte</span>
        </button>
      )}

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:justify-end p-4 pb-28 lg:pb-4"
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

                {/* Doc 51: anexar prints, logo abaixo da caixa de descrição. Só no Reportar erro —
                    numa mensagem comum o anexo não tem uso e só atrapalharia. */}
                {kind === "error" && (
                  <div>
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-foreground/70 hover:bg-[var(--color-surface-container-lowest)]">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          const fs = Array.from(e.target.files ?? []);
                          for (const f of fs) void anexar(f);
                          e.target.value = "";
                        }}
                      />
                      <Paperclip className="h-3.5 w-3.5" /> Anexar imagem
                    </label>
                    <p className="mt-1.5 text-[11px] text-foreground/50">
                      Anexe prints das telas que o problema foi identificado (opcional)
                    </p>
                    {anexoErro && <p className="mt-1 text-[11px] text-red-600">{anexoErro}</p>}
                    {anexos.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {anexos.map((src, i) => (
                          <div key={i} className="relative">
                            {/* eslint-disable-next-line @next/next/no-img-element -- miniatura de data URL local */}
                            <img src={src} alt={`Print ${i + 1}`} className="h-16 w-16 rounded-lg border border-[var(--border)] object-cover" />
                            <button
                              type="button"
                              aria-label={`Remover print ${i + 1}`}
                              onClick={() => setAnexos((a) => a.filter((_, j) => j !== i))}
                              className="absolute -right-1.5 -top-1.5 rounded-full bg-red-600 p-0.5 text-white"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                        <span className="self-center text-[11px] text-foreground/40">{anexos.length}/{LIMITE_ANEXOS}</span>
                      </div>
                    )}
                  </div>
                )}

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
