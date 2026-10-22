"use client";

import { useState, useRef } from "react";
import { Loader2, Camera, Sparkles, X, Info } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { FLUTUANTE_BAIXO, FUNDO_DA_JANELA, JANELA } from "@/lib/modal";
import { useFecharComEscape } from "@/lib/useFecharComEscape";
import { lerReciboTexto } from "@/lib/reciboOcr";
import { createTransaction } from "@/app/dashboard/transactions/actions";
import { PAYMENT_FORMS } from "@/lib/finance";

// Só aparece na tela inicial e nas telas do Financeiro.
const ALLOWED = ["/dashboard", "/dashboard/transactions", "/dashboard/reports"];

type Campos = { type: "expense" | "income"; amount: string; date: string; description: string; method: string };
const VAZIO: Campos = { type: "expense", amount: "", date: "", description: "", method: "" };

const inputCls = "w-full px-3 py-2 rounded-xl bg-white border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition text-sm";

/**
 * Ler recibo (doc 47). Dois caminhos, UM resultado conferível:
 *  - grátis: OCR no navegador (Tesseract) + heurística `lerReciboTexto`. Bom, mas tem limitação.
 *  - preciso: a IA do próprio terapeuta (BYOK), quando ele cadastrou a chave.
 * Em ambos a leitura só PREENCHE os campos; a pessoa confere e confirma antes de virar lançamento.
 */
export function ScanRecibo({ hasAiKey }: { hasAiKey: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const fileRef = useRef<HTMLInputElement>(null);
  const [aberto, setAberto] = useState(false);
  useFecharComEscape(aberto, () => setAberto(false));
  const [imagem, setImagem] = useState<string | null>(null);
  const [lendo, setLendo] = useState<null | "livre" | "ia">(null);
  const [erro, setErro] = useState<string | null>(null);
  const [campos, setCampos] = useState<Campos>(VAZIO);
  const [salvando, setSalvando] = useState(false);

  if (!ALLOWED.includes(pathname)) return null;

  const aplicar = (r: { valor?: number; dataISO?: string; descricao?: string }) => {
    setCampos((c) => ({
      ...c,
      amount: r.valor != null ? r.valor.toFixed(2).replace(".", ",") : c.amount,
      date: r.dataISO ?? c.date,
      description: r.descricao ?? c.description,
    }));
  };

  const escolher = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setImagem(dataUrl);
      setCampos(VAZIO);
      setErro(null);
      setAberto(true);
      await lerLivre(dataUrl); // leitura grátis já de cara
    };
    reader.readAsDataURL(file);
    e.target.value = ""; // permite reescolher a mesma foto
  };

  const lerLivre = async (dataUrl: string) => {
    setLendo("livre");
    setErro(null);
    try {
      const { recognize } = await import("tesseract.js");
      const { data } = await recognize(dataUrl, "por");
      const r = lerReciboTexto(data.text || "");
      aplicar(r);
      if (r.valor == null) setErro("Não encontrei o valor automaticamente. Preencha à mão — a foto difícil costuma pedir a leitura com IA.");
    } catch {
      setErro("Não consegui ler a imagem no navegador. Preencha os campos à mão.");
    } finally {
      setLendo(null);
    }
  };

  const lerIA = async () => {
    if (!imagem) return;
    setLendo("ia");
    setErro(null);
    try {
      const resp = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imagem }),
      });
      const json = await resp.json();
      if (!resp.ok) { setErro(json.error || "Falha na leitura com IA."); return; }
      aplicar({
        valor: typeof json.amount === "number" ? json.amount : undefined,
        dataISO: typeof json.date === "string" ? json.date : undefined,
        descricao: typeof json.description === "string" ? json.description : undefined,
      });
    } catch {
      setErro("Falha ao falar com a IA. Tente de novo ou preencha à mão.");
    } finally {
      setLendo(null);
    }
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      const fd = new FormData();
      fd.set("type", campos.type);
      fd.set("amount", campos.amount);
      if (campos.date) fd.set("date", campos.date);
      fd.set("description", campos.description);
      if (campos.method) fd.set("method", campos.method);
      fd.set("source", "scan");
      await createTransaction(fd);
      setAberto(false);
      setImagem(null);
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui salvar o lançamento.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <input type="file" accept="image/*" capture="environment" className="hidden" ref={fileRef} onChange={escolher} />
      <button
        onClick={() => fileRef.current?.click()}
        className={`print:hidden ${FLUTUANTE_BAIXO} w-14 h-14 lg:w-16 lg:h-16 bg-accent text-primary rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50 border-4 border-white`}
        title="Ler um recibo e lançar"
        aria-label="Ler um recibo e lançar"
      >
        <Camera className="w-7 h-7" />
      </button>

      {aberto && (
        <div className={FUNDO_DA_JANELA} role="dialog" aria-modal="true">
          <div className={`${JANELA} max-w-md`}>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-primary">Ler recibo</h3>
              <button onClick={() => { setAberto(false); setImagem(null); }} aria-label="Fechar" className="text-foreground/40 hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>

            {/* Alerta de limitação (doc 47): o recurso é bom, mas erra — confira sempre. */}
            <div className="flex gap-2 rounded-2xl bg-[#fef9c3] border border-[#fde68a] p-3 text-[13px] text-[#854d0e]">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <p>A leitura automática é um apoio e <strong>tem limitações</strong> — confira os campos antes de salvar. Para notas difíceis, {hasAiKey ? "use “Ler com IA” (mais preciso)." : "cadastre sua chave de IA em Configurações → IA e a leitura fica mais precisa."}</p>
            </div>

            {imagem && (
              // eslint-disable-next-line @next/next/no-img-element -- prévia de um dataURL local, não vai pro next/image
              <img src={imagem} alt="Recibo" className="w-full max-h-40 object-contain rounded-xl border border-border bg-surface" />
            )}

            {lendo && (
              <p className="text-sm text-foreground/50 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {lendo === "ia" ? "Lendo com IA…" : "Lendo a imagem…"}</p>
            )}
            {erro && <p className="text-sm text-[#b91c1c]">{erro}</p>}

            <div className="flex gap-2">
              {(["expense", "income"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setCampos((c) => ({ ...c, type: t }))}
                  className={`flex-1 py-2 rounded-xl font-semibold text-sm transition ${campos.type === t ? (t === "income" ? "bg-[#ecfdf5] text-[#047857] ring-2 ring-[#047857]/30" : "bg-[#fee2e2] text-[#b91c1c] ring-2 ring-[#b91c1c]/30") : "bg-white/60 text-foreground/50 border border-border"}`}>
                  {t === "income" ? "Receita" : "Despesa"}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground/60">Valor (R$)</label>
                <input value={campos.amount} onChange={(e) => setCampos((c) => ({ ...c, amount: e.target.value }))} inputMode="decimal" placeholder="0,00" className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground/60">Data</label>
                <input value={campos.date} onChange={(e) => setCampos((c) => ({ ...c, date: e.target.value }))} type="date" className={inputCls} />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground/60">Descrição</label>
              <input value={campos.description} onChange={(e) => setCampos((c) => ({ ...c, description: e.target.value }))} placeholder="ex: Material de escritório" className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground/60">Forma de {campos.type === "income" ? "recebimento" : "pagamento"}</label>
              <select value={campos.method} onChange={(e) => setCampos((c) => ({ ...c, method: e.target.value }))} className={inputCls}>
                <option value="">— Não informar —</option>
                {PAYMENT_FORMS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              {hasAiKey && (
                <button type="button" onClick={lerIA} disabled={lendo != null || !imagem}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm bg-primary/10 text-primary hover:bg-primary/15 transition disabled:opacity-50">
                  <Sparkles className="w-4 h-4" /> Ler com IA (mais preciso)
                </button>
              )}
              <button type="button" onClick={salvar} disabled={salvando || lendo != null || !campos.amount.trim()}
                className="bg-primary text-white py-3 rounded-xl font-bold disabled:opacity-50">
                {salvando ? "Salvando…" : "Salvar lançamento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
