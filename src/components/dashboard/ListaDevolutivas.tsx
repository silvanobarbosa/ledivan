"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessagesSquare, Check } from "lucide-react";
import { numeroDoWhatsapp } from "@/lib/telefoneWhatsapp";
import { dispensarDevolutiva } from "@/app/dashboard/patients/actions";

export type DevolutivaLinha = {
  id: string;
  name: string;
  phone: string | null;
  guardianPhone: string | null;
  /** Data prevista da próxima devolutiva (YYYY-MM-DD). */
  proxima: string;
  /** ISO completo, para a ação de dispensa guardar o ciclo certo. */
  proximaISO: string;
  dias: number;
};

/**
 * Próximas devolutivas (doc 9, item 2), logo abaixo de "Sessões do dia".
 *
 * Aparece 7 dias antes da devolutiva prevista. "Agendar" só ABRE o WhatsApp (responsável, ou paciente)
 * — não cria agendamento na Agenda; o ✓ dispensa esta devolutiva (resolvida sem agendar) e ela volta
 * no ciclo seguinte. A mensagem é a mesma lógica da dos Prospectados; `{nome}` vira o 1º nome.
 */
export function ListaDevolutivas({ devolutivas }: { devolutivas: DevolutivaLinha[] }) {
  const router = useRouter();
  const [mensagem, setMensagem] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [indo, comecar] = useTransition();

  const vazio = devolutivas.length === 0;

  function agendar(d: DevolutivaLinha) {
    const num = numeroDoWhatsapp(d.guardianPhone) ?? numeroDoWhatsapp(d.phone);
    if (!num) { setAviso(`${d.name} está sem telefone (responsável ou paciente).`); return; }
    setAviso(null);
    const texto = mensagem.replace(/\{nome\}/g, d.name.split(" ")[0]);
    window.open(texto.trim() ? `https://wa.me/${num}?text=${encodeURIComponent(texto)}` : `https://wa.me/${num}`, "_blank", "noopener");
  }

  function resolver(d: DevolutivaLinha) {
    setAviso(null);
    comecar(async () => {
      const r = await dispensarDevolutiva(d.id, d.proximaISO);
      if (r.ok) router.refresh();
      else setAviso(r.error ?? "Não deu para dispensar.");
    });
  }

  const quando = (n: number) => (n < 0 ? "venceu" : n === 0 ? "hoje" : `em ${n} dia${n === 1 ? "" : "s"}`);

  return (
    <section className="glass-card rounded-[24px] p-5 space-y-3 mt-4">
      <h3 className="text-lg font-display font-bold text-primary flex items-center gap-2">
        <MessagesSquare className="w-5 h-5" /> Próximas devolutivas
      </h3>
      <p className="text-xs text-foreground/50">Aparece 7 dias antes. “Agendar” abre o WhatsApp (não marca na agenda); ✓ resolve este ciclo.</p>

      {vazio && (
        <p className="text-sm text-foreground/45 py-2">Nenhuma devolutiva prevista no momento.</p>
      )}

      {!vazio && (
      <ul className="divide-y divide-border">
        {devolutivas.map((d) => (
          <li key={d.id} className="py-2 flex items-center gap-3 flex-wrap">
            <span className="font-semibold flex-1 min-w-[140px]">{d.name}</span>
            <span className="text-xs text-foreground/50 tabular-nums">{d.proxima.split("-").reverse().join("/")} · {quando(d.dias)}</span>
            <button type="button" onClick={() => agendar(d)}
              className="text-xs font-bold px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/15 transition">
              Agendar
            </button>
            <button type="button" onClick={() => resolver(d)} disabled={indo} title="Resolvida — tirar da lista"
              className="w-7 h-7 inline-flex items-center justify-center rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition disabled:opacity-50">
              <Check className="w-4 h-4" />
            </button>
          </li>
        ))}
      </ul>
      )}

      {!vazio && (
      <div className="space-y-1">
        <label className="text-xs font-bold text-foreground/50 uppercase tracking-wide">Mensagem para agendar</label>
        <textarea value={mensagem} onChange={(e) => { setMensagem(e.target.value); setAviso(null); }}
          rows={3} placeholder="Olá! Vamos marcar a devolutiva de {nome}?"
          className="w-full px-3 py-2 rounded-xl bg-surface border border-border outline-none text-sm" />
        <p className="text-[11px] text-foreground/40">Vai no WhatsApp do responsável (ou do paciente). Vazio: abre a conversa sem texto.</p>
      </div>
      )}

      {aviso && <p className="text-xs font-semibold text-[#b45309]">{aviso}</p>}
    </section>
  );
}
