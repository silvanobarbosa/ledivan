"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { PERIODOS, type Periodo } from "@/lib/periodoFiltro";

/**
 * O filtro do alto da tela de Transações (doc 64): Mês atual · 6 meses · 12 meses · Tudo, mais um
 * intervalo escolhido à mão. "Mês atual" é o que vale ao entrar — quem quiser outro recorte troca.
 *
 * O recorte vive na URL para a tela inteira responder a ele de uma vez (quadros e extrato vêm do
 * servidor) e para o endereço poder ser guardado ou recarregado sem perder o que se estava vendo.
 */
export function FiltroPeriodo({ periodo, de, ate }: { periodo: Periodo; de?: string; ate?: string }) {
  const router = useRouter();
  const sp = useSearchParams();

  const ir = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) { if (v === null || v === "") q.delete(k); else q.set(k, v); }
    // `scroll: false`: trocar o recorte não pode jogar a página para o topo — quem filtra está
    // olhando um quadro lá embaixo e perderia o lugar.
    router.push(`/dashboard/transactions?${q.toString()}`, { scroll: false });
  };

  return (
    <div className="glass-card rounded-2xl px-4 py-3 flex flex-wrap items-center gap-2">
      {PERIODOS.map((p) => (
        <button key={p.k} type="button" onClick={() => ir({ periodo: p.k, de: null, ate: null })}
          className={`px-4 py-2 rounded-full text-sm font-semibold transition ${periodo === p.k ? "bg-primary text-white" : "bg-white/60 text-foreground/60 hover:bg-white"}`}>
          {p.rotulo}
        </button>
      ))}
      <form
        onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); ir({ periodo: "custom", de: (fd.get("de") as string) || null, ate: (fd.get("ate") as string) || null }); }}
        className="flex items-center gap-1.5 rounded-full bg-white/60 px-2 py-1"
      >
        <input type="date" name="de" defaultValue={de || ""} aria-label="Início do período" className="text-xs bg-transparent outline-none px-1 py-1" />
        <span className="text-xs text-foreground/40">→</span>
        <input type="date" name="ate" defaultValue={ate || ""} aria-label="Fim do período" className="text-xs bg-transparent outline-none px-1 py-1" />
        <button className={`px-3 py-1 rounded-full text-xs font-bold transition ${periodo === "custom" ? "bg-primary text-white" : "bg-primary/10 text-primary hover:bg-primary/20"}`}>Aplicar</button>
      </form>
    </div>
  );
}
