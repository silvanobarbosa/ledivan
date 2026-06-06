"use client";

import { useState, useTransition } from "react";
import { CalendarCheck, Check, Loader2 } from "lucide-react";
import { createPublicBooking } from "../actions";

const inputCls =
  "w-full rounded-2xl border border-[rgba(43,24,48,0.12)] bg-white/70 px-4 py-3 text-sm text-ink placeholder:text-[color:var(--muted-foreground)] focus:outline-none focus:border-[color:var(--accent-violet)] focus:ring-4 focus:ring-[rgba(139,92,246,0.15)] transition";

type Result = { ok: boolean; mode?: string; online?: boolean; meetingLink?: string | null; error?: string };

export function BookingForm({ slug }: { slug: string }) {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = (await createPublicBooking(slug, formData)) as Result;
      if (res.ok) setResult(res);
      else setError(res.error || "Não foi possível agendar.");
    });
  }

  if (result?.ok) {
    const auto = result.mode === "auto";
    return (
      <div className="mt-7 rounded-2xl border border-[rgba(139,92,246,0.3)] bg-[rgba(139,92,246,0.08)] p-6 text-center">
        <Check className="mx-auto h-7 w-7 text-[color:var(--accent-violet)]" />
        <p className="font-display mt-2 text-xl font-medium text-[color:var(--brand-eggplant)]">
          {auto ? "Agendamento confirmado!" : "Pedido enviado!"}
        </p>
        <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
          {auto
            ? "Seu horário está confirmado. Até lá! 🌿"
            : "O terapeuta vai confirmar seu horário. Aguarde a confirmação, por favor."}
        </p>
        {auto && result.online && result.meetingLink && (
          <a
            href={result.meetingLink}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-[color:var(--brand-eggplant)] px-5 py-3 text-sm font-medium text-cream"
          >
            Link da sala de vídeo
          </a>
        )}
        {auto && result.online && result.meetingLink && (
          <p className="mt-2 text-xs text-[color:var(--muted-foreground)] break-all">{result.meetingLink}</p>
        )}
      </div>
    );
  }

  return (
    <form action={onSubmit} className="mt-7 space-y-3">
      <input type="text" name="website" className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <input name="name" required placeholder="Seu nome" className={inputCls} />
      <input name="phone" placeholder="Telefone (WhatsApp)" className={inputCls} />
      <input name="email" type="email" placeholder="E-mail" className={inputCls} />
      <div>
        <label className="text-xs font-semibold text-[color:var(--muted-foreground)]">Data e horário desejados</label>
        <input name="date" type="datetime-local" required className={`${inputCls} mt-1`} />
      </div>
      <label className="flex items-center gap-2 text-sm text-ink cursor-pointer px-1">
        <input type="checkbox" name="online" className="accent-[color:var(--accent-violet)] w-4 h-4" />
        Prefiro atendimento online (por vídeo)
      </label>
      <textarea name="note" rows={3} placeholder="Algo que queira adiantar? (opcional)" className={inputCls} />
      {error && <p className="text-sm text-[#b91c1c]">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[color:var(--brand-eggplant)] px-6 py-3.5 text-sm font-medium text-cream shadow-[var(--shadow-eggplant)] hover:bg-[color:var(--brand-eggplant-soft)] transition active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />}
        {pending ? "Enviando…" : "Solicitar agendamento"}
      </button>
    </form>
  );
}
