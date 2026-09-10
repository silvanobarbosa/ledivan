"use client";

import { useEffect } from "react";
import Link from "next/link";
import { X } from "lucide-react";

export type PacienteDaLista = { id: string; name: string; detalhe?: string | null };

/**
 * Janela com uma lista de pacientes. Usada pelos painéis que passaram a abrir a lista no
 * clique do NÚMERO (ativos, inativos, quem não veio na semana, pacientes por queixa) em vez de
 * empilhar listas dentro do cartão.
 *
 * Fecha no Esc, no clique fora e no X — as três saídas que quem abre um modal espera.
 */
export function ModalPacientes({
  titulo, pacientes, onFechar,
}: {
  titulo: string;
  pacientes: PacienteDaLista[];
  onFechar: () => void;
}) {
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  return (
    <div className="print:hidden fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/30 p-4" onClick={onFechar}>
      <div className="bg-white rounded-[28px] w-full max-w-md shadow-2xl flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <p className="font-display text-lg font-bold text-primary">{titulo} <span className="text-sm font-normal text-foreground/40">({pacientes.length})</span></p>
          <button onClick={onFechar} aria-label="Fechar lista" className="p-1.5 rounded-lg hover:bg-surface transition"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto p-3 space-y-1">
          {pacientes.length === 0 ? (
            <p className="text-sm text-foreground/40 text-center py-8">Ninguém nesta lista.</p>
          ) : pacientes.map((p) => (
            <Link key={p.id} href={`/dashboard/patients/${p.id}`} className="flex items-center justify-between gap-2 rounded-xl bg-surface/60 px-3 py-2 hover:bg-surface transition">
              <span className="text-sm truncate">{p.name}</span>
              {p.detalhe && <span className="text-xs text-foreground/40 shrink-0">{p.detalhe}</span>}
              <span className="text-xs font-semibold text-primary shrink-0">abrir →</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
