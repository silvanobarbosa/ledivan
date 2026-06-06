"use client";

import { useState, useTransition } from "react";
import { Upload, Check, X, Loader2, FileText, Link2 } from "lucide-react";
import { reconcileEntries, acceptReconciliation, createFromBankEntry, type BankEntry, type Match } from "./actions";
import { PAYMENT_FORMS } from "@/lib/finance";

type Cat = { id: string; name: string; type: string };

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (s: string) => { const d = new Date(s); return isNaN(+d) ? s : d.toLocaleDateString("pt-BR"); };

// ---- Parsers ----
function parseAmountUS(s: string) { return parseFloat(s.replace(/[^\d.-]/g, "")) || 0; }
function parseAmountBR(s: string) {
  const neg = /-/.test(s);
  const clean = s.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Math.abs(parseFloat(clean) || 0);
  return neg ? -n : n;
}
function normDate(s: string): string {
  const br = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const ofx = s.match(/(\d{4})(\d{2})(\d{2})/);
  if (ofx) return `${ofx[1]}-${ofx[2]}-${ofx[3]}`;
  return s;
}

function parseOFX(text: string): BankEntry[] {
  const out: BankEntry[] = [];
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  blocks.forEach((b, i) => {
    const dt = b.match(/<DTPOSTED>\s*([0-9]{8})/i);
    const amt = b.match(/<TRNAMT>\s*(-?[0-9.,]+)/i);
    const memo = b.match(/<MEMO>\s*([^<\r\n]+)/i) || b.match(/<NAME>\s*([^<\r\n]+)/i);
    if (dt && amt) out.push({ id: `o${i}`, date: normDate(dt[1]), amount: parseAmountUS(amt[1]), description: (memo?.[1] || "").trim() });
  });
  return out;
}

function parseCSV(text: string): BankEntry[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const delim = (lines[0]?.match(/;/g)?.length || 0) >= (lines[0]?.match(/,/g)?.length || 0) ? ";" : ",";
  const out: BankEntry[] = [];
  lines.forEach((line, i) => {
    const cols = line.split(delim).map((c) => c.trim().replace(/^"|"$/g, ""));
    const dateCol = cols.find((c) => /\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2}/.test(c));
    if (!dateCol) return; // pula cabeçalho/linhas sem data
    // valor: célula com vírgula/ponto decimal e dígitos
    const amtCol = [...cols].reverse().find((c) => /-?\s*R?\$?\s*\d{1,3}([.,]\d{3})*([.,]\d{2})\s*$/.test(c) || /^-?\d+[.,]\d{2}$/.test(c.replace(/[R$\s]/g, "")));
    if (!amtCol) return;
    const amount = /,\d{2}\s*$/.test(amtCol) ? parseAmountBR(amtCol) : parseAmountUS(amtCol);
    const desc = cols.filter((c) => c !== dateCol && c !== amtCol).sort((a, b) => b.length - a.length)[0] || "Lançamento";
    out.push({ id: `c${i}`, date: normDate(dateCol), amount, description: desc });
  });
  return out;
}

export function ConciliacaoClient({ categories }: { categories: Cat[] }) {
  const [entries, setEntries] = useState<BankEntry[]>([]);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<{ matches: Match[]; unmatched: BankEntry[] } | null>(null);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [doneMsg, setDoneMsg] = useState<string | null>(null);
  const [handledUnmatched, setHandledUnmatched] = useState<Record<string, boolean>>({});
  const [pending, start] = useTransition();

  async function onFile(file: File) {
    setParseError(null); setResult(null); setDoneMsg(null);
    setFileName(file.name);
    const text = await file.text();
    let parsed: BankEntry[] = [];
    if (/<OFX>|<STMTTRN>/i.test(text)) parsed = parseOFX(text);
    else parsed = parseCSV(text);
    if (!parsed.length) { setParseError("Não consegui ler lançamentos. Use CSV (data; descrição; valor) ou OFX do seu banco."); setEntries([]); return; }
    setEntries(parsed);
  }

  function runReconcile() {
    setDoneMsg(null);
    start(async () => {
      const r = await reconcileEntries(entries);
      setResult(r);
      const acc: Record<string, boolean> = {};
      r.matches.forEach((m) => { acc[m.txId] = true; });
      setAccepted(acc);
    });
  }

  function acceptAll() {
    const ids = result!.matches.filter((m) => accepted[m.txId]).map((m) => m.txId);
    start(async () => {
      const r = await acceptReconciliation(ids);
      setDoneMsg(`${r.count} lançamento(s) conciliado(s) e marcado(s) no sistema.`);
    });
  }

  return (
    <div className="space-y-6">
      {/* Upload */}
      <div className="glass-card rounded-[28px] p-6 space-y-3">
        <label className="flex items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border px-6 py-8 cursor-pointer hover:border-accent transition">
          <Upload className="w-6 h-6 text-primary" />
          <div>
            <p className="font-semibold text-primary">{fileName || "Enviar extrato do banco"}</p>
            <p className="text-xs text-foreground/50">Formatos: CSV ou OFX (exportados do app do seu banco)</p>
          </div>
          <input type="file" accept=".csv,.ofx,.txt,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
        </label>
        {parseError && <p className="text-sm text-red-600">{parseError}</p>}
        {entries.length > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-foreground/60"><FileText className="w-4 h-4 inline mr-1" /> {entries.length} lançamentos lidos.</p>
            <button onClick={runReconcile} disabled={pending} className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-sm disabled:opacity-60">
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />} Conciliar com o sistema
            </button>
          </div>
        )}
      </div>

      {doneMsg && (
        <div className="rounded-2xl bg-[#ecfdf5] border border-[#a7f3d0] px-4 py-3 text-sm font-semibold text-[#047857]">✅ {doneMsg}</div>
      )}

      {result && (
        <>
          {/* Conciliados */}
          <div className="glass-card rounded-[28px] p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="font-display text-xl font-bold text-primary">Conciliados ({result.matches.length})</h2>
              {result.matches.length > 0 && (
                <button onClick={acceptAll} disabled={pending} className="inline-flex items-center gap-2 bg-[#047857] text-white px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-60">
                  <Check className="w-4 h-4" /> Aceitar selecionados
                </button>
              )}
            </div>
            {result.matches.length === 0 ? (
              <p className="text-sm text-foreground/40">Nenhum lançamento bateu com o sistema.</p>
            ) : result.matches.map((m) => (
              <div key={m.entryId} className={`rounded-2xl border p-4 flex items-center gap-3 ${accepted[m.txId] ? "border-[#a7f3d0] bg-[#ecfdf5]/40" : "border-border bg-surface/40 opacity-60"}`}>
                <div className="flex-1 min-w-0 grid sm:grid-cols-2 gap-2 text-sm">
                  <div><p className="text-[10px] font-bold uppercase text-foreground/40">Extrato</p><p className="truncate">{fmtDate(m.entryDate)} · {m.entryDesc}</p></div>
                  <div><p className="text-[10px] font-bold uppercase text-foreground/40">Sistema</p><p className="truncate">{fmtDate(m.txDate)} · {m.txDesc}</p></div>
                </div>
                <span className={`font-bold text-sm shrink-0 ${m.amount >= 0 ? "text-[#047857]" : "text-[#b91c1c]"}`}>{brl(m.amount)}</span>
                <button onClick={() => setAccepted((p) => ({ ...p, [m.txId]: !p[m.txId] }))} title={accepted[m.txId] ? "Rejeitar" : "Aceitar"} className="p-2 rounded-lg hover:bg-white transition shrink-0">
                  {accepted[m.txId] ? <Check className="w-4 h-4 text-[#047857]" /> : <X className="w-4 h-4 text-foreground/40" />}
                </button>
              </div>
            ))}
          </div>

          {/* Não conciliados */}
          <div className="glass-card rounded-[28px] p-6 space-y-4">
            <h2 className="font-display text-xl font-bold text-primary">Não conciliados ({result.unmatched.filter((e) => !handledUnmatched[e.id]).length})</h2>
            <p className="text-sm text-foreground/50">Estão no extrato mas não no sistema. Qualifique para lançar (já entram como conciliados).</p>
            {result.unmatched.filter((e) => !handledUnmatched[e.id]).length === 0 ? (
              <p className="text-sm text-foreground/40">Tudo certo — nada pendente.</p>
            ) : result.unmatched.filter((e) => !handledUnmatched[e.id]).map((e) => (
              <UnmatchedRow key={e.id} entry={e} categories={categories} onDone={() => setHandledUnmatched((p) => ({ ...p, [e.id]: true }))} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function UnmatchedRow({ entry, categories, onDone }: { entry: BankEntry; categories: Cat[]; onDone: () => void }) {
  const isIncome = entry.amount >= 0;
  const [categoryId, setCategoryId] = useState("");
  const [method, setMethod] = useState("");
  const [pending, start] = useTransition();
  const cats = categories.filter((c) => c.type === (isIncome ? "income" : "expense"));
  const sel = "px-3 py-2 rounded-xl bg-surface border border-border outline-none text-sm";

  function qualify() {
    start(async () => { await createFromBankEntry(entry, categoryId || null, method || null); onDone(); });
  }

  return (
    <div className="rounded-2xl border border-border p-4 flex flex-wrap items-center gap-3">
      <div className="flex-1 min-w-0 text-sm">
        <p className="truncate font-semibold">{fmtDate(entry.date)} · {entry.description}</p>
        <span className={`text-xs font-bold ${isIncome ? "text-[#047857]" : "text-[#b91c1c]"}`}>{isIncome ? "Receita" : "Despesa"} · {brl(entry.amount)}</span>
      </div>
      <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={sel}>
        <option value="">Categoria…</option>
        {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <select value={method} onChange={(e) => setMethod(e.target.value)} className={sel}>
        <option value="">Forma…</option>
        {PAYMENT_FORMS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
      </select>
      <button onClick={qualify} disabled={pending} className="inline-flex items-center gap-1.5 bg-primary text-white px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-60">
        {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Lançar
      </button>
    </div>
  );
}
