"use client";

import { useState } from "react";
import Link from "next/link";
import { Wallet, Search, ChevronDown, AlertTriangle, Package, Clock } from "lucide-react";
import { formatBRL, formatDate } from "@/lib/therapy";

type Row = {
  id: string; name: string; status: string; frequency: string | null;
  balance: number; creditSessions: number; debtSessions: number; situacao: string;
  pkg: { seq: number; pos: number; total: number } | null;
  priceReviewDate: string | null; reajusteVencido: boolean; reajusteProximo: boolean;
  lastSession: string | null;
};

const SIT = [
  { k: "devedor", l: "Devedor" },
  { k: "credito", l: "Pago não realizado" },
  { k: "emdia", l: "Pago realizado" },
];

export function VisaoFinanceiraClient({ rows }: { rows: Row[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("todos");
  const [sit, setSit] = useState("todos");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = rows.filter((r) => {
    const mQ = r.name.toLowerCase().includes(query.toLowerCase());
    const mS = status === "todos" || r.status === status;
    const mSit = sit === "todos" || r.situacao === sit;
    let mP = true;
    if (from || to) {
      const t = r.lastSession ? new Date(r.lastSession).getTime() : 0;
      if (from && t < new Date(from).getTime()) mP = false;
      if (to && t > new Date(to + "T23:59:59").getTime()) mP = false;
    }
    return mQ && mS && mSit && mP;
  }).sort((a, b) => a.balance - b.balance);

  const devedores = filtered.filter((r) => r.situacao === "devedor").length;
  const totalDevido = filtered.filter((r) => r.balance < 0).reduce((a, r) => a + Math.abs(r.balance), 0);
  const comCredito = filtered.filter((r) => r.situacao === "credito").length;
  const reajustes = filtered.filter((r) => r.reajusteVencido).length;
  const pacotesAcabando = filtered.filter((r) => r.pkg && r.pkg.total - r.pkg.pos <= 1).length;

  const selCls = "appearance-none w-full pl-3.5 pr-8 py-2.5 rounded-full bg-white/70 border border-border text-sm font-medium text-foreground/70 hover:bg-white outline-none transition cursor-pointer";
  const Sel = ({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) => (
    <div className="relative"><select value={value} onChange={(e) => onChange(e.target.value)} className={selCls}>{children}</select><ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" /></div>
  );

  return (
    <div className="max-w-5xl space-y-5 pb-20">
      <div>
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#0f766e] bg-[#ccfbef] px-3 py-1.5 rounded-full mb-2">💼 Financeiro</div>
        <h1 className="text-3xl lg:text-4xl font-display font-bold text-primary flex items-center gap-2"><Wallet className="w-7 h-7" /> Visão financeira</h1>
        <p className="text-foreground/50 mt-1">Situação financeira geral dos pacientes — quem deve, créditos, pacotes e reajustes.</p>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass-card rounded-[20px] p-4"><p className="text-2xl font-display font-bold text-[#b91c1c]">{devedores}</p><p className="text-xs text-foreground/50">Devedores · {formatBRL(totalDevido.toFixed(2))}</p></div>
        <div className="glass-card rounded-[20px] p-4"><p className="text-2xl font-display font-bold text-[#047857]">{comCredito}</p><p className="text-xs text-foreground/50">Com sessões pagas não usadas</p></div>
        <div className="glass-card rounded-[20px] p-4"><p className="text-2xl font-display font-bold text-[#92400e]">{pacotesAcabando}</p><p className="text-xs text-foreground/50">Pacotes acabando (≤1)</p></div>
        <div className="glass-card rounded-[20px] p-4"><p className="text-2xl font-display font-bold text-primary">{reajustes}</p><p className="text-xs text-foreground/50">Reajustes vencidos</p></div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground/40" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar paciente..." className="w-full pl-12 pr-4 py-3 rounded-full bg-white/70 border border-border outline-none transition" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Sel value={status} onChange={setStatus}><option value="todos">Status: todos</option><option value="ativo">Ativos</option><option value="inativo">Inativos</option><option value="pausado">Pausados</option></Sel>
          <Sel value={sit} onChange={setSit}><option value="todos">Pagamento: todos</option>{SIT.map((s) => <option key={s.k} value={s.k}>{s.l}</option>)}</Sel>
          <form onSubmit={(e) => e.preventDefault()} className="flex items-center gap-1 rounded-full bg-white/70 border border-border px-2">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="text-xs bg-transparent outline-none w-full" title="De" />
            <span className="text-foreground/30">→</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="text-xs bg-transparent outline-none w-full" title="Até" />
          </form>
        </div>
      </div>

      {/* Tabela */}
      {filtered.length === 0 ? (
        <div className="glass-card rounded-[24px] p-10 text-center text-foreground/40">Nenhum paciente no filtro.</div>
      ) : (
        <div className="glass-card rounded-[24px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-widest text-foreground/40 border-b border-border">
                  <th className="px-4 py-3">Paciente</th>
                  <th className="px-4 py-3">Situação</th>
                  <th className="px-4 py-3">Pacote</th>
                  <th className="px-4 py-3">Reajuste</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Última sessão</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface/40 transition">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/patients/${r.id}`} className="font-semibold hover:text-primary transition">{r.name}</Link>
                      <span className={`ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${r.status === "ativo" ? "bg-[#ecfdf5] text-[#047857]" : "bg-surface text-foreground/40"}`}>{r.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      {r.situacao === "devedor" ? <span className="text-[#b91c1c] font-semibold">Devendo {formatBRL(Math.abs(r.balance).toFixed(2))} <span className="text-foreground/40">· {r.debtSessions} sess.</span></span>
                        : r.situacao === "credito" ? <span className="text-[#047857] font-semibold">{r.creditSessions} sess. pagas <span className="text-foreground/40">· {formatBRL(r.balance.toFixed(2))}</span></span>
                        : <span className="text-foreground/50">Em dia</span>}
                    </td>
                    <td className="px-4 py-3">
                      {r.pkg ? <span className="inline-flex items-center gap-1 font-semibold text-primary"><Package className="w-3.5 h-3.5" />{r.pkg.pos}/{r.pkg.total} do P{r.pkg.seq}</span> : <span className="text-foreground/30">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {r.priceReviewDate ? (
                        <span className={`inline-flex items-center gap-1 font-medium ${r.reajusteVencido ? "text-[#b91c1c]" : r.reajusteProximo ? "text-[#92400e]" : "text-foreground/50"}`}>
                          {(r.reajusteVencido || r.reajusteProximo) && <AlertTriangle className="w-3.5 h-3.5" />}{formatDate(r.priceReviewDate)}
                        </span>
                      ) : <span className="text-foreground/30">—</span>}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-foreground/50">{r.lastSession ? <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{formatDate(r.lastSession)}</span> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
