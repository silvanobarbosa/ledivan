"use client";

import { useState, useTransition } from "react";
import { savePix, type PixConfig } from "./pix-actions";

export function PixCard({ initial }: { initial: PixConfig | null }) {
  const [key, setKey] = useState(initial?.key ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const save = () => start(async () => {
    const r = await savePix({ key, name, city });
    if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 1500); }
  });

  const field = "w-full rounded-2xl border border-border/60 bg-white/60 px-4 py-3 text-sm outline-none focus:border-primary";

  return (
    <section className="glass-card rounded-[28px] p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-display font-bold text-primary">Pix (pagamento no app)</h3>
        {saved && <span className="text-xs text-green-600 font-semibold">salvo ✓</span>}
      </div>
      <ul className="text-sm text-foreground/50 list-disc pl-5 space-y-1">
        <li>Ative o recurso <b>Pagamento via Pix</b> acima.</li>
        <li>O paciente poderá gerar um código Pix copia e cola com o valor da sessão e realizar o pagamento diretamente para a sua chave Pix, sem intermediários ou taxas de gateway.</li>
        <li>A confirmação do recebimento deverá ser feita manualmente por você, diretamente no seu banco.</li>
      </ul>

      <div className="space-y-3">
        <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="Chave Pix (e-mail, telefone, CPF/CNPJ ou aleatória)" maxLength={77} className={field} />
        <div className="grid grid-cols-2 gap-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do recebedor" maxLength={25} className={field} />
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cidade" maxLength={15} className={field} />
        </div>
      </div>

      <button onClick={save} disabled={pending || !key.trim() || !name.trim() || !city.trim()} className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
        {pending ? "Salvando…" : "Salvar chave Pix"}
      </button>
    </section>
  );
}
