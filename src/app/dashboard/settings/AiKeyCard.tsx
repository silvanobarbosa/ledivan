"use client";

import { useState, useTransition } from "react";
import { Sparkles, Check, Trash2, Gift, ExternalLink, ChevronDown } from "lucide-react";
import { saveAiKey, clearAiKey } from "./ai-actions";

/**
 * O passo a passo mora NA TELA, não num manual à parte.
 *
 * O recurso existia e ficava mudo: quem não tem conta de IA (a maioria) via "Cadastre sua chave"
 * sem saber o que é uma chave, onde se pega, nem que existe um caminho gratuito. Instrução que só
 * vive na Ajuda não chega a quem está parado na tela que pede a chave.
 */
export function AiKeyCard({ configured, provider }: { configured: boolean; provider: string | null }) {
  const [prov, setProv] = useState(provider ?? "groq");
  const [key, setKey] = useState("");
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [comoFaz, setComoFaz] = useState(!configured);

  const save = () => start(async () => {
    setErr(null);
    const r = await saveAiKey(prov, key);
    if (r.ok) { setKey(""); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    else setErr(r.error ?? "Falha ao salvar.");
  });
  const remove = () => { if (!confirm("Remover a chave de IA salva?")) return; start(async () => { await clearAiKey(); setKey(""); }); };

  const field = "w-full rounded-2xl border border-border/60 bg-white/60 px-4 py-3 text-sm outline-none focus:border-primary";
  const passo = "flex gap-3";
  const numero = "shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center";

  return (
    <section className="glass-card rounded-[28px] p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-display font-bold text-primary flex items-center gap-2"><Sparkles className="w-5 h-5" /> IA da transcrição</h3>
        {saved && <span className="text-xs text-green-600 font-semibold">salvo ✓</span>}
      </div>

      <p className="text-sm text-foreground/60">
        Com ela, você envia o áudio de uma sessão e o Le&rsquo;Divan devolve um rascunho de evolução
        no prontuário do paciente. Você revisa antes de usar — é um rascunho, não um laudo.
      </p>

      <ul className="text-sm text-foreground/50 list-disc pl-5 space-y-1">
        <li>A transcrição das sessões utiliza sua própria conta de IA.</li>
        <li>O áudio é enviado diretamente ao provedor de IA escolhido por você, utilizando sua própria chave de API.</li>
        <li>O Le&rsquo;Divan não utiliza uma chave própria nem armazena o áudio das sessões.</li>
        <li>Sua chave de API é armazenada de forma criptografada.</li>
      </ul>

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

      <button
        type="button"
        onClick={() => setComoFaz((v) => !v)}
        aria-expanded={comoFaz}
        className="flex w-full items-center justify-between gap-2 rounded-2xl bg-secondary-container/25 px-4 py-3 text-left"
      >
        <span className="text-sm font-bold text-primary">Não tenho uma conta de IA. E agora?</span>
        <ChevronDown className={`w-4 h-4 text-primary transition ${comoFaz ? "rotate-180" : ""}`} />
      </button>

      {comoFaz && (
        <div className="space-y-4 rounded-2xl border border-border/60 bg-white/50 p-4">
          <div className="flex items-start gap-3 rounded-xl bg-[#ecfdf5] border border-[#a7f3d0] px-3 py-2.5">
            <Gift className="w-4 h-4 text-[#047857] mt-0.5 shrink-0" />
            <p className="text-xs text-[#065f46]">
              <strong>Existe um caminho gratuito.</strong> A <strong>Groq</strong> oferece um plano
              grátis que já cobre a transcrição e o rascunho da evolução. Não pede cartão de crédito.
            </p>
          </div>

          <ol className="space-y-3 text-sm text-foreground/70">
            <li className={passo}>
              <span className={numero}>1</span>
              <span>
                Abra <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer"
                  className="font-semibold text-primary underline inline-flex items-center gap-1">console.groq.com/keys <ExternalLink className="w-3 h-3" /></a>{" "}
                e crie uma conta (dá para entrar com Google).
              </span>
            </li>
            <li className={passo}>
              <span className={numero}>2</span>
              <span>Clique em <strong>Create API Key</strong>, dê um nome qualquer (ex.: <em>Le&rsquo;Divan</em>) e confirme.</span>
            </li>
            <li className={passo}>
              <span className={numero}>3</span>
              <span>
                <strong>Copie a chave na hora.</strong> Ela começa com <code className="text-xs bg-surface px-1 rounded">gsk_</code> e
                só aparece uma vez — fechando a janela, não dá mais para vê-la, só criar outra.
              </span>
            </li>
            <li className={passo}>
              <span className={numero}>4</span>
              <span>Volte aqui, escolha <strong>Groq</strong> no campo abaixo, cole a chave e clique em <strong>Salvar chave</strong>.</span>
            </li>
          </ol>

          <div className="rounded-xl bg-surface/60 px-3 py-2.5">
            <p className="text-xs font-bold text-primary mb-1">Depois de salvar, para usar:</p>
            <p className="text-xs text-foreground/60 leading-relaxed">
              Ligue a chave <strong>Transcrição de sessão por IA</strong> aqui mesmo nos Ajustes.
              Depois, no paciente, abra a guia <strong>Registros</strong> e clique em{" "}
              <strong>Transcrever sessão (IA)</strong>: escolha o arquivo de áudio, confirme que o
              paciente consentiu e clique em <strong>Gerar evolução</strong>. Áudio de até 25 MB.
            </p>
          </div>

          <p className="text-[11px] text-foreground/45">
            Prefere a OpenAI? Funciona igual — a chave sai de{" "}
            <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline">platform.openai.com/api-keys</a>,
            mas lá o uso é pago por consumo.
          </p>
        </div>
      )}

      <div className="grid sm:grid-cols-[160px_1fr] gap-3">
        <select value={prov} onChange={(e) => setProv(e.target.value)} className={field} aria-label="Provedor de IA">
          <option value="groq">Groq (tem plano grátis)</option>
          <option value="openai">OpenAI (pago)</option>
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
