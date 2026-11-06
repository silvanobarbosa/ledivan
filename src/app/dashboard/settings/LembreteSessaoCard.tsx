"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveLembreteQuando } from "./actions";
import { ROTULO_DO_LEMBRETE, type QuandoLembrar } from "@/lib/lembreteDaSessao";

/**
 * Quando o LEMBRETE DE SESSÃO sai (doc 61).
 *
 * A escolha é da terapeuta e vale para todos os pacientes dela. Quem recebe lembrete continua
 * sendo decidido no cadastro de cada paciente — aqui só se define a HORA.
 */
export function LembreteSessaoCard({ initial }: { initial: string | null }) {
  const router = useRouter();
  const [quando, setQuando] = useState<QuandoLembrar>(initial === "vespera" ? "vespera" : "dia");
  const [pending, start] = useTransition();
  const [salvo, setSalvo] = useState(false);

  function salvar(valor: QuandoLembrar) {
    setQuando(valor);
    const fd = new FormData();
    fd.set("lembreteQuando", valor);
    start(async () => { await saveLembreteQuando(fd); setSalvo(true); router.refresh(); setTimeout(() => setSalvo(false), 2000); });
  }

  return (
    <div className="glass-card rounded-[24px] p-6 space-y-3">
      <div>
        <h3 className="font-display font-bold text-primary">Lembrete de sessão</h3>
        <p className="text-sm text-foreground/50 mt-1">
          Quando o lembrete é enviado ao paciente. Quem recebe lembrete é definido no cadastro de cada um.
        </p>
      </div>
      <div className="space-y-2">
        {(["dia", "vespera"] as const).map((op) => (
          <label key={op} className={`flex items-center gap-3 px-4 py-3 rounded-2xl border cursor-pointer transition ${quando === op ? "border-accent bg-accent/5" : "border-border bg-white/60"}`}>
            <input
              type="radio"
              name="lembreteQuando"
              value={op}
              checked={quando === op}
              onChange={() => salvar(op)}
              disabled={pending}
              className="accent-[#0b3d91]"
            />
            <span className="text-sm font-semibold text-primary">{ROTULO_DO_LEMBRETE[op]}</span>
          </label>
        ))}
      </div>
      {salvo && <span className="text-sm text-[#047857] font-semibold">Salvo ✓</span>}
    </div>
  );
}
