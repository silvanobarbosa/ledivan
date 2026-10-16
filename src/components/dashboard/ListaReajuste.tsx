"use client";

import { useState } from "react";
import { TrendingUp } from "lucide-react";
import { numeroDoWhatsapp } from "@/lib/telefoneWhatsapp";

export type ReajusteLinha = {
  id: string;
  name: string;
  /** ID da agenda — é o que identifica o paciente na lista (doc 21), caindo no nome quando vazio. */
  agendaId: string | null;
  phone: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  /** Data prevista do reajuste (YYYY-MM-DD). */
  review: string;
  dias: number;
};

/**
 * Lista de reajustes a vencer (doc 9, item 1), logo abaixo da área de Pagamento do Dashboard.
 *
 * Aparece a partir de 1 mês antes da data prevista e fica até o valor ser alterado no Financeiro
 * (quando o reajuste é lançado, a data recua para o próximo ciclo e o paciente sai desta lista). O
 * botão "Lembrar" abre o WhatsApp do RESPONSÁVEL (ou, sem ele, do paciente) com a mensagem digitada
 * abaixo — mesmo padrão da Mensagem dos Prospectados; `{nome}` vira o primeiro nome do paciente.
 */
export function ListaReajuste({ reajustes }: { reajustes: ReajusteLinha[] }) {
  const [mensagem, setMensagem] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);

  const vazio = reajustes.length === 0;

  // Doc 41: {nome} e o WhatsApp são do RESPONSÁVEL financeiro; sem responsável, caem no paciente.
  function lembrar(r: ReajusteLinha) {
    const num = numeroDoWhatsapp(r.guardianPhone) ?? numeroDoWhatsapp(r.phone);
    if (!num) { setAviso(`${r.name} está sem telefone (responsável ou paciente) para o WhatsApp.`); return; }
    setAviso(null);
    // Doc 42: a opção {nome} saiu — a mensagem vai como foi escrita, sem substituição.
    const texto = mensagem;
    const url = texto.trim() ? `https://wa.me/${num}?text=${encodeURIComponent(texto)}` : `https://wa.me/${num}`;
    window.open(url, "_blank", "noopener");
  }

  const quando = (d: number) => (d < 0 ? "venceu" : d === 0 ? "hoje" : `em ${d} dia${d === 1 ? "" : "s"}`);

  return (
    <section className="glass-card rounded-[24px] p-5 space-y-3">
      <h3 className="text-lg font-display font-bold text-primary flex items-center gap-2">
        <TrendingUp className="w-5 h-5" /> Reajustes a vencer
      </h3>
      <p className="text-xs text-foreground/60 text-justify">
        Visualize os cadastros com reajuste <strong>previsto para os próximos 30 dias.</strong><br />
        Clique em <strong>Lembrar</strong> ao lado de cada nome <strong>para enviar uma mensagem individual pelo WhatsApp</strong>. Nesse caso, não é necessário preencher o campo abaixo.<br />
        <strong>Mensagens serão enviadas ao responsável financeiro do cadastro ou, se não houver, à própria pessoa cadastrada.</strong>
      </p>

      {vazio && <p className="text-sm text-foreground/45 py-2">Nenhum reajuste previsto no momento.</p>}

      {!vazio && (
      <ul className="divide-y divide-border">
        {reajustes.map((r) => (
          <li key={r.id} className="py-2 flex items-center gap-3 flex-wrap">
            <span className="font-semibold flex-1 min-w-[140px]" title={r.name}>{r.agendaId?.trim() ? r.agendaId : r.name}</span>
            <span className="text-xs text-foreground/50 tabular-nums">{r.review.split("-").reverse().join("/")} · {quando(r.dias)}</span>
            <button type="button" onClick={() => lembrar(r)}
              className="text-xs font-bold px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/15 transition">
              Lembrar
            </button>
          </li>
        ))}
      </ul>
      )}

      {!vazio && (
      <p className="text-xs text-foreground/60 text-justify">
        Ao <strong>atualizar</strong> o valor do cadastro, o registro será <strong>removido automaticamente desta lista.</strong>
      </p>
      )}

      {!vazio && (
      <div className="space-y-1">
        <label className="text-sm font-semibold text-foreground/60">Mensagem única para todos</label>
        <p className="text-[11px] text-foreground/60 text-justify">
          Escreva sua mensagem de lembrete de reajuste no campo abaixo e clique em <strong>Lembrar</strong> nos cadastros que deverão recebê-la.
        </p>
        <textarea value={mensagem} onChange={(e) => { setMensagem(e.target.value); setAviso(null); }}
          rows={3} placeholder="Olá! Passando para avisar sobre o reajuste…"
          className="w-full px-3 py-2 rounded-xl bg-surface border border-border outline-none text-sm" />
      </div>
      )}

      {aviso && <p className="text-xs font-semibold text-[#b45309]">{aviso}</p>}
    </section>
  );
}
