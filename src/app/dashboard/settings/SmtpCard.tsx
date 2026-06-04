"use client";

import { useState, useTransition } from "react";
import { Mail, Check, Loader2, ChevronDown } from "lucide-react";
import { testAndSaveSmtp, disableSmtp } from "./actions";

const inputCls = "w-full px-4 py-2.5 rounded-xl bg-surface border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition text-sm";

const APP_PASS_HELP: Record<string, string> = {
  gmail: "https://myaccount.google.com/apppasswords",
  outlook: "https://account.live.com/proofs/AppPassword",
};

export function SmtpCard({ configured, currentEmail, loginEmail }: { configured: boolean; currentEmail: string | null; loginEmail: string }) {
  const [open, setOpen] = useState(!configured);
  const [advanced, setAdvanced] = useState(false);
  const [email, setEmail] = useState(currentEmail || loginEmail || "");
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setResult(null);
    startTransition(async () => {
      const res = await testAndSaveSmtp(formData);
      if (res.ok) setResult({ ok: true, msg: `Conectado e salvo (${res.host}).` });
      else setResult({ ok: false, msg: res.error || "Falha." });
    });
  }

  const domain = email.split("@")[1]?.toLowerCase() || "";
  const helpUrl = domain.includes("gmail") ? APP_PASS_HELP.gmail : (domain.includes("outlook") || domain.includes("hotmail") || domain.includes("live")) ? APP_PASS_HELP.outlook : null;

  return (
    <div className="p-8 bg-white rounded-[48px] shadow-sm border border-border space-y-4">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><Mail className="w-6 h-6" /></div>
        <div className="flex-1">
          <h4 className="font-bold text-primary">Enviar e-mails pelo seu próprio e-mail</h4>
          <p className="text-sm text-foreground/50 mt-1 leading-relaxed">
            Lembretes e recibos saem do seu endereço. Funciona com Gmail, Outlook, Yahoo ou e-mail do seu domínio.
          </p>
          {configured && (
            <span className="inline-flex items-center gap-1.5 mt-2 text-xs font-bold text-[#047857] bg-[#ecfdf5] px-3 py-1 rounded-full">
              <Check className="w-3.5 h-3.5" /> Configurado: {currentEmail}
            </span>
          )}
        </div>
        <button onClick={() => setOpen((o) => !o)} className="text-sm font-semibold text-primary hover:underline shrink-0">
          {open ? "Fechar" : configured ? "Alterar" : "Configurar"}
        </button>
      </div>

      {open && (
        <form action={onSubmit} className="space-y-3 border-t border-border pt-4">
          <ol className="text-xs text-foreground/60 space-y-1 list-decimal pl-4">
            <li>Use uma <strong>senha de app</strong> (não a senha normal do e-mail).{helpUrl && <> <a href={helpUrl} target="_blank" rel="noreferrer" className="text-primary underline">Gerar senha de app</a></>}</li>
            <li>Cole abaixo. A gente detecta o servidor e testa o envio.</li>
          </ol>
          <div>
            <label className="text-xs font-semibold text-foreground/60">Seu e-mail</label>
            <input name="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="voce@dominio.com" />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground/60">Senha de app</label>
            <input name="pass" type="password" required className={inputCls} placeholder="senha de aplicativo" />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground/60">Nome de exibição (opcional)</label>
            <input name="fromName" className={inputCls} placeholder="ex: Dra. Helena Moraes" />
          </div>

          <button type="button" onClick={() => setAdvanced((a) => !a)} className="text-xs font-semibold text-foreground/50 inline-flex items-center gap-1">
            <ChevronDown className={`w-3.5 h-3.5 transition ${advanced ? "rotate-180" : ""}`} /> Avançado (servidor manual)
          </button>
          {advanced && (
            <div className="grid grid-cols-2 gap-3">
              <input name="host" className={inputCls} placeholder="smtp.seudominio.com" />
              <input name="port" type="number" className={inputCls} placeholder="587" />
            </div>
          )}

          {result && <p className={`text-sm ${result.ok ? "text-[#047857]" : "text-red-600"}`}>{result.msg}</p>}

          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="inline-flex items-center gap-2 bg-primary text-white py-2.5 px-5 rounded-xl font-bold transition hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100">
              {pending ? <><Loader2 className="w-4 h-4 animate-spin" /> Testando…</> : "Testar e salvar"}
            </button>
            {configured && (
              <button type="button" onClick={() => startTransition(() => disableSmtp())} className="text-sm font-semibold text-red-500/70 hover:text-red-600 px-3">
                Desativar
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
