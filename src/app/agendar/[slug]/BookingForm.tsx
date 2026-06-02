"use client";

import { useState, useTransition } from "react";
import { CalendarCheck, Check } from "lucide-react";
import { createPublicBooking } from "../actions";

const inputCls =
  "w-full rounded-2xl border border-[rgba(43,24,48,0.12)] bg-white/70 px-4 py-3 text-sm text-ink placeholder:text-[color:var(--muted-foreground)] focus:outline-none focus:border-[color:var(--accent-violet)] focus:ring-4 focus:ring-[rgba(139,92,246,0.15)] transition";

export function BookingForm({ slug }: { slug: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createPublicBooking(slug, formData);
      if (res.ok) setDone(true);
      else setError(res.error || "Não foi possível agendar.");
    });
  }

  if (done) {
    return (
      <div className="mt-7 rounded-2xl border border-[rgba(139,92,246,0.3)] bg-[rgba(139,92,246,0.08)] p-6 text-center">
        <Check className="mx-auto h-7 w-7 text-[color:var(--accent-violet)]" />
        <p className="font-display mt-2 text-xl font-medium text-[color:var(--brand-eggplant)]">Pedido enviado!</p>
        <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
          O terapeuta vai confirmar seu horário. Obrigado!
        </p>
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
      <textarea name="note" rows={3} placeholder="Algo que queira adiantar? (opcional)" className={inputCls} />
      {error && <p className="text-sm text-[#b91c1c]">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[color:var(--brand-eggplant)] px-6 py-3.5 text-sm font-medium text-cream shadow-[var(--shadow-eggplant)] hover:bg-[color:var(--brand-eggplant-soft)] transition disabled:opacity-60"
      >
        <CalendarCheck className="h-4 w-4" />
        {pending ? "Enviando..." : "Solicitar agendamento"}
      </button>
    </form>
  );
}
