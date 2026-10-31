"use client";

import { useState, useTransition } from "react";
import { Sparkles, Check, Trash2 } from "lucide-react";
import { saveAiKey, clearAiKey, setIaDaCasa } from "./ai-actions";

export function AiKeyCard({ configured, provider, iaDaCasa, casaDisponivel }: { configured: boolean; provider: string | null; iaDaCasa: boolean; casaDisponivel: boolean }) {
  const [prov, setProv] = useState(provider ?? "openai");
  const [casa, setCasa] = useState(iaDaCasa);
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
  const remove = () => { if (!confirm("Remover a chave de IA salva?")) return; start(async () => { await clearAiKey(); setKey(""); }); };
  const trocarCasa = (ligada: boolean) => { setCasa(ligada); start(async () => { await setIaDaCasa(ligada); }); };

  const field = "w-full rounded-2xl border border-border/60 bg-white/60 px-4 py-3 text-sm outline-none focus:border-primary";

  return (
    <section className="glass-card rounded-[28px] p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-display font-bold text-primary flex items-center gap-2"><Sparkles className="w-5 h-5" /> IA da transcrição</h3>
        {saved && <span className="text-xs text-green-600 font-semibold">salvo ✓</span>}
      </div>

      {/* A promessa tem de acompanhar a escolha: dizer "não usamos chave própria" com a IA da casa
          ligada seria falso, e é justamente sobre o áudio do paciente. */}
      <ul className="text-sm text-foreground/50 list-disc pl-5 space-y-1">
        {casa ? (
          <>
            <li>A transcrição usa a IA do Le&rsquo;Divan, sem custo para você.</li>
            <li>O áudio é processado em servidor próprio do Le&rsquo;Divan e não é enviado a nenhum provedor externo.</li>
            <li>Se esse servidor não responder, a transcrição usa automaticamente a sua chave, quando houver uma cadastrada.</li>
          </>
        ) : (
          <>
            <li>A transcrição das sessões utiliza sua própria conta de IA.</li>
            <li>O áudio é enviado diretamente ao provedor de IA escolhido por você, utilizando sua própria chave de API.</li>
            <li>O Le&rsquo;Divan não utiliza uma chave própria nem armazena o áudio das sessões.</li>
          </>
        )}
        <li>Sua chave de API é armazenada de forma criptografada.</li>
      </ul>

      {casaDisponivel && (
        <label className="flex items-start gap-3 rounded-2xl bg-[#eff6ff] border border-[#bfdbfe] px-4 py-3 cursor-pointer">
          <input type="checkbox" checked={casa} onChange={(e) => trocarCasa(e.target.checked)} disabled={pending} className="mt-0.5 accent-primary w-4 h-4" />
          <span className="text-sm">
            <span className="font-semibold text-[#1e40af]">Usar a IA do Le&rsquo;Divan (sem custo)</span>
            <span className="block text-xs text-foreground/55 mt-0.5">
              Dispensa a chave própria. Sua chave, se houver, fica como reserva.
            </span>
          </span>
        </label>
      )}

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
          {casa
            ? "Sem chave cadastrada, a transcrição depende apenas da IA do Le’Divan — sem reserva se ela ficar indisponível."
            : "Sem chave cadastrada, a transcrição por IA fica indisponível."}
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
