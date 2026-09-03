"use client";

import { useState, useTransition } from "react";
import { Sparkles, Check, Trash2 } from "lucide-react";
import { saveAiKey, clearAiKey } from "./ai-actions";

export function AiKeyCard({ configured, provider }: { configured: boolean; provider: string | null }) {
  const [prov, setProv] = useState(provider ?? "openai");
  const [key, setKey] = useState("");
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = () => start(async () => {
    setErr(null);
    const r = await saveAiKey(prov, key);
    if (r.ok) { setKey(""); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    else setErr(r.error ?? "Falha ao salvar.");
  });
  const remove = () => start(async () => { await clearAiKey(); setKey(""); });

  const field = "w-full rounded-2xl border border-border/60 bg-white/60 px-4 py-3 text-sm outline-none focus:border-primary";

  return (
    <section className="glass-card rounded-[28px] p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-display font-bold text-primary flex items-center gap-2"><Sparkles className="w-5 h-5" /> IA da transcrição</h3>
        {saved && <span className="text-xs text-green-600 font-semibold">salvo ✓</span>}
      </div>

      <p className="text-sm text-foreground/50">
        A transcrição da sessão usa <b>a sua própria conta de IA</b>. O áudio vai direto para o provedor que você escolher,
        com a sua chave — o Ledivan não usa chave própria nem guarda o áudio. Sua chave fica <b>criptografada</b>.
      </p>

      {configured ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#ecfdf5] border border-[#a7f3d0] px-4 py-3">
          <span className="text-sm text-[#047857] font-semibold inline-flex items-center gap-2">
            <Check className="w-4 h-4" /> Chave configurada ({provider === "groq" ? "Groq" : "OpenAI"})
          </span>
          <button onClick={remove} disabled={pending} className="text-xs text-red-600 hover:underline inline-flex items-center gap-1 disabled:opacity-50">
            <Trash2 className="w-3.5 h-3.5" /> remover
          </button>
        </div>
      ) : (
        <p className="text-xs text-[#92400e] bg-[#fffbeb] border border-[#fde68a] rounded-xl px-3 py-2">
          Sem chave cadastrada, a transcrição por IA fica indisponível.
        </p>
      )}

      <div className="grid sm:grid-cols-[160px_1fr] gap-3">
        <select value={prov} onChange={(e) => setProv(e.target.value)} className={field}>
          <option value="openai">OpenAI</option>
          <option value="groq">Groq</option>
        </select>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={configured ? "Cole uma nova chave para substituir" : "Cole sua chave do provedor"}
          autoComplete="off"
          className={field}
        />
      </div>

      {err && <p className="text-xs text-red-600">{err}</p>}

      <button onClick={save} disabled={pending || key.trim().length < 20} className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
        {pending ? "Salvando…" : configured ? "Substituir chave" : "Salvar chave"}
      </button>
    </section>
  );
}
