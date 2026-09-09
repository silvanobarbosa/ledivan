"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatBRL, formatDate } from "@/lib/therapy";
import { queixaGroup } from "@/lib/queixas";

export type LinhaRelatorio = {
  id: string;
  name: string;
  status: string;
  gender: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  schoolName: string | null;
  birthDate: string | null;
  startedAt: string | null;
  priceReviewDate: string | null;
  paymentFormat: string;
  contractType: string | null;
  paymentDay: number | null;
  dueDateType: string | null;
  dueDate: string | null;
  sessionFee: string;
  queixaPrincipal: string | null;
};

const idade = (nasc: string | null): number | null => {
  if (!nasc) return null;
  const b = new Date(nasc), h = new Date();
  let a = h.getFullYear() - b.getFullYear();
  if (h.getMonth() < b.getMonth() || (h.getMonth() === b.getMonth() && h.getDate() < b.getDate())) a--;
  return a >= 0 && a < 130 ? a : null;
};

const VENCIMENTO: Record<string, string> = {
  avista: "À vista", "7d": "7 dias", "15d": "15 dias", "30d": "30 dias", fim_mes: "Fim do mês", data: "Data fixa",
};
/** Vencimento legível: o dia do mês manda quando existe; senão cai no tipo de prazo. */
const vencimentoDe = (p: LinhaRelatorio): string => {
  if (p.paymentDay) return `dia ${p.paymentDay}`;
  if (p.dueDateType === "data" && p.dueDate) return formatDate(p.dueDate);
  if (p.dueDateType) return VENCIMENTO[p.dueDateType] ?? p.dueDateType;
  return "—";
};

/** Avulso ou pacote: `paymentFormat` é mais específico que `contractType`, então vem primeiro. */
const contratoDe = (p: LinhaRelatorio): string => {
  const f = p.paymentFormat || p.contractType || "";
  return ({ avulso: "Avulso", mensal: "Mensal", quinzenal: "Quinzenal", pacote: "Pacote" } as Record<string, string>)[f] ?? (f || "—");
};

// Cada coluna sabe o próprio rótulo e como se extrai do paciente. Assim o cabeçalho, o corpo da
// tabela e o CSV nunca saem de sincronia — é uma lista só.
const COLUNAS: { chave: string; rotulo: string; valor: (p: LinhaRelatorio) => string }[] = [
  { chave: "name", rotulo: "Nome", valor: (p) => p.name },
  { chave: "gender", rotulo: "Sexo", valor: (p) => p.gender || "—" },
  { chave: "email", rotulo: "E-mail", valor: (p) => p.email || "—" },
  { chave: "phone", rotulo: "Telefone", valor: (p) => p.phone || "—" },
  { chave: "address", rotulo: "Endereço", valor: (p) => p.address || "—" },
  { chave: "school", rotulo: "Escola", valor: (p) => p.schoolName || "—" },
  { chave: "idade", rotulo: "Idade", valor: (p) => { const a = idade(p.birthDate); return a === null ? "—" : String(a); } },
  { chave: "contrato", rotulo: "Avulso / Pacote", valor: contratoDe },
  { chave: "vencimento", rotulo: "Vencim.", valor: vencimentoDe },
  { chave: "valor", rotulo: "Valor", valor: (p) => formatBRL(p.sessionFee) },
  { chave: "inicio", rotulo: "Data início", valor: (p) => (p.startedAt ? formatDate(p.startedAt) : "—") },
  { chave: "reajuste", rotulo: "Data reajuste", valor: (p) => (p.priceReviewDate ? formatDate(p.priceReviewDate) : "—") },
  { chave: "queixa", rotulo: "Queixa principal", valor: (p) => queixaGroup(p.queixaPrincipal) },
];
const PADRAO = new Set(["name", "phone", "contrato", "valor", "inicio"]);

const inp = "px-3 py-2 rounded-xl bg-surface border border-border outline-none text-sm";
const lbl = "text-[11px] font-semibold uppercase tracking-wide text-foreground/40";

export function RelatorioPacientes({ linhas }: { linhas: LinhaRelatorio[] }) {
  const [tipo, setTipo] = useState("todos");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [colunas, setColunas] = useState<Set<string>>(new Set(PADRAO));

  const visiveis = COLUNAS.filter((c) => colunas.has(c.chave));

  const filtradas = useMemo(() => {
    const dentro = (iso: string | null) => {
      if (!de && !ate) return true;
      if (!iso) return false;
      const t = new Date(iso).getTime();
      if (de && t < new Date(de + "T00:00:00").getTime()) return false;
      if (ate && t > new Date(ate + "T23:59:59").getTime()) return false;
      return true;
    };
    return linhas
      .filter((p) => (tipo === "todos" ? p.status !== "prospect" : p.status === tipo))
      .filter((p) => dentro(p.startedAt))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [linhas, tipo, de, ate]);

  // Três queixas mais frequentes no recorte atual — o resumo que o dono pediu antes da tabela.
  const topQueixas = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of filtradas) { const g = queixaGroup(p.queixaPrincipal); if (g === "—") continue; m.set(g, (m.get(g) ?? 0) + 1); }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [filtradas]);

  function alternar(chave: string) {
    setColunas((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave); else novo.add(chave);
      return novo;
    });
  }

  return (
    <div className="space-y-5">
      <div className="glass-card rounded-[24px] p-5 space-y-4">
        <div className="flex gap-3 flex-wrap items-end">
          <div>
            <span className={lbl}>Tipo</span>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inp}>
              <option value="todos">Todos</option>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>
          <div><span className={lbl}>Início de</span><input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={inp} /></div>
          <div><span className={lbl}>até</span><input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={inp} /></div>
        </div>

        <div>
          <span className={lbl}>Colunas</span>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {COLUNAS.map((c) => (
              <label key={c.chave} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold cursor-pointer transition ${colunas.has(c.chave) ? "bg-primary text-white border-primary" : "bg-white/60 border-border text-foreground/60 hover:bg-white"}`}>
                <input type="checkbox" checked={colunas.has(c.chave)} onChange={() => alternar(c.chave)} className="accent-primary w-3.5 h-3.5" />
                {c.rotulo}
              </label>
            ))}
          </div>
        </div>
      </div>

      {topQueixas.length > 0 && (
        <div className="glass-card rounded-[24px] p-5 space-y-2">
          <h2 className="font-display font-bold text-primary">Queixas principais no recorte</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            {topQueixas.map(([nome, n]) => (
              <div key={nome} className="rounded-2xl bg-surface/60 border border-border px-4 py-3">
                <p className="text-2xl font-display font-bold text-primary">{n}</p>
                <p className="text-xs text-foreground/50">{nome}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-sm text-foreground/50">{filtradas.length} paciente(s) no recorte.</p>

      {visiveis.length === 0 ? (
        <p className="glass-card rounded-[24px] p-10 text-center text-foreground/40">Marque ao menos uma coluna.</p>
      ) : filtradas.length === 0 ? (
        <p className="glass-card rounded-[24px] p-10 text-center text-foreground/40">Nenhum paciente nesse recorte.</p>
      ) : (
        // overflow-x-auto no contêiner: com todas as colunas marcadas a tabela passa da tela, e
        // é ela que precisa rolar — nunca a página inteira.
        <div className="glass-card rounded-[24px] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {visiveis.map((c) => (
                  <th key={c.chave} className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide text-foreground/40 whitespace-nowrap">{c.rotulo}</th>
                ))}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtradas.map((p) => (
                <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-surface/40 transition">
                  {visiveis.map((c) => (
                    <td key={c.chave} className="px-4 py-2.5 whitespace-nowrap max-w-[280px] truncate" title={c.valor(p)}>{c.valor(p)}</td>
                  ))}
                  <td className="px-4 py-2.5 text-right">
                    <Link href={`/dashboard/patients/${p.id}`} className="text-xs font-bold text-primary hover:underline whitespace-nowrap">abrir →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
