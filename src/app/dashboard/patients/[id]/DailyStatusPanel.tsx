"use client";

import { useState } from "react";
import { reagirStatus, type StatusRow } from "./status-actions";

const REACOES = ["❤️", "🫂", "👍", "🙂", "💪", "🌱"];
const fmt = (iso: string) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

// Painel do "status do dia" na ficha do paciente. Recebe os status JÁ carregados (server-side),
// para funcionar também na conta demo (read-only) — carregar por server action seria POST.
export function DailyStatusPanel({ enabled, statuses }: { enabled: boolean; statuses: StatusRow[] }) {
  const [rows, setRows] = useState<StatusRow[]>(statuses);
  const [reagindo, setReagindo] = useState<string | null>(null);

  if (!enabled || !rows.length) return null;

  const ultimo = rows[0];
  const curva = rows.filter((r) => r.mood).slice(0, 14).reverse();

  async function react(id: string, emoji: string) {
    setReagindo(id);
    try {
      const r = await reagirStatus(id, emoji);
      if (r.ok) setRows((prev) => prev.map((x) => x.id === id ? { ...x, reactionEmoji: emoji, reactionAt: new Date().toISOString() } : x));
    } catch { /* read-only (demo) ou erro de rede: ignora */ }
    setReagindo(null);
  }

  return (
    <div className="rounded-[20px] border border-[#e9d5ff] bg-[#faf5ff] p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-primary flex items-center gap-2">Status do dia
          {!ultimo.reactionAt && <span className="text-[10px] font-bold uppercase tracking-wide bg-accent text-white px-2 py-0.5 rounded-full">novo</span>}
        </h3>
        <span className="text-xs text-foreground/40">{fmt(ultimo.createdAt)}</span>
      </div>

      <div className="mt-3 flex items-start gap-3">
        <div className="text-4xl leading-none">{ultimo.emoji}</div>
        <div className="flex-1">
          {ultimo.text && <p className="text-sm text-foreground/80">{ultimo.text}</p>}
          {ultimo.reactionEmoji ? (
            <p className="mt-1 text-xs text-foreground/50">Você reagiu: {ultimo.reactionEmoji}{ultimo.reactionText ? ` — ${ultimo.reactionText}` : ""}</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {REACOES.map((e) => (
                <button key={e} disabled={reagindo === ultimo.id} onClick={() => react(ultimo.id, e)}
                  className="text-lg leading-none rounded-full bg-white border border-black/5 px-2 py-1 hover:scale-110 transition disabled:opacity-50">{e}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {curva.length > 1 && (
        <div className="mt-4">
          <p className="text-[11px] text-foreground/40 mb-1">Curva do humor</p>
          <div className="flex items-end gap-1 h-10">
            {curva.map((r) => (
              <div key={r.id} className="flex-1 rounded-t bg-primary/60" style={{ height: `${((r.mood || 3) / 5) * 100}%` }} title={`${r.emoji} ${fmt(r.createdAt)}`} />
            ))}
          </div>
        </div>
      )}

      {rows.length > 1 && (
        <details className="mt-4">
          <summary className="text-xs text-primary cursor-pointer">Ver histórico ({rows.length})</summary>
          <ul className="mt-2 space-y-1.5">
            {rows.slice(1, 12).map((r) => (
              <li key={r.id} className="text-sm flex items-center gap-2">
                <span className="text-lg">{r.emoji}</span>
                <span className="text-foreground/40 text-xs">{fmt(r.createdAt)}</span>
                {r.text && <span className="text-foreground/70 truncate">{r.text}</span>}
                {r.reactionEmoji && <span className="ml-auto text-xs">{r.reactionEmoji}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
