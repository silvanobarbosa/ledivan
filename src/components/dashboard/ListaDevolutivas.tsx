"use client";

import { useState } from "react";
import { MessagesSquare } from "lucide-react";
import { numeroDoWhatsapp } from "@/lib/telefoneWhatsapp";
import { TextoMais } from "./TextoMais";
import { useConfirmarEnvio, ConfirmarEnvioModal } from "./confirmarEnvio";
import { registrarLembrete } from "@/app/dashboard/lembretes-actions";

export type DevolutivaLinha = {
  id: string;
  name: string;
  phone: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  /** Data prevista da próxima devolutiva (YYYY-MM-DD). */
  proxima: string;
  dias: number;
};

/**
 * Próximas devolutivas (doc 9, item 2), logo abaixo de "Sessões do dia".
 *
 * Aparece 1 mês antes da devolutiva prevista. "Lembrar" só ABRE o WhatsApp (responsável, ou paciente)
 * — não cria agendamento na Agenda; o paciente sai sozinho ao agendar uma DEVOLUTIVA na agenda. A
 * mensagem vai como foi escrita (doc 42: a opção {nome} saiu).
 */
export function ListaDevolutivas({ devolutivas, contagem = {} }: { devolutivas: DevolutivaLinha[]; contagem?: Record<string, number> }) {
  const [mensagem, setMensagem] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  // Doc 49: "(Nx)" por cadastro — conta só o que foi confirmado como enviado (igual o Cobrar).
  const [enviados, setEnviados] = useState<Record<string, number>>({});
  const confirmar = useConfirmarEnvio<DevolutivaLinha>();
  const quantos = (d: DevolutivaLinha) => (contagem[`${d.id}:devolutiva`] ?? 0) + (enviados[d.id] ?? 0);

  const vazio = devolutivas.length === 0;

  // Doc 41/42: "Lembrar" vai para o WhatsApp do RESPONSÁVEL (a devolutiva é com os pais do menor);
  // sem responsável, cai no paciente. A mensagem vai como foi escrita — sem substituição de {nome}.
  function lembrar(d: DevolutivaLinha) {
    const num = numeroDoWhatsapp(d.guardianPhone) ?? numeroDoWhatsapp(d.phone);
    if (!num) { setAviso(`${d.name} está sem telefone (responsável ou paciente).`); return; }
    setAviso(null);
    const texto = mensagem;
    confirmar.abrir(texto.trim() ? `https://wa.me/${num}?text=${encodeURIComponent(texto)}` : `https://wa.me/${num}`, d);
  }

  const registrar = (d: DevolutivaLinha) => {
    void registrarLembrete(d.id, "devolutiva");
    setEnviados((e) => ({ ...e, [d.id]: (e[d.id] ?? 0) + 1 }));
  };

  const quando = (n: number) => (n < 0 ? "venceu" : n === 0 ? "hoje" : `em ${n} dia${n === 1 ? "" : "s"}`);

  return (
    <section className="glass-card rounded-[24px] p-5 space-y-3 mt-4">
      <h3 className="text-lg font-display font-bold text-primary flex items-center gap-2">
        <MessagesSquare className="w-5 h-5" /> Próximas devolutivas
      </h3>
      <TextoMais
        resumo={<>Visualize os pacientes que precisam agendar uma <strong>devolutiva no próximo mês</strong>.</>}
        detalhe={<>Clique em <strong>Lembrar</strong> ao lado de cada nome <strong>para enviar uma mensagem individual pelo WhatsApp.</strong> Nesse caso, não é necessário preencher o campo abaixo.<br />
          <strong>Mensagens serão enviadas ao responsável do cadastro.</strong><br />
          Ao <strong>agendar uma devolutiva</strong>, o paciente será <strong>removido automaticamente desta lista.</strong></>}
      />

      {vazio && (
        <p className="text-sm text-foreground/45 py-2">Nenhuma devolutiva prevista no momento.</p>
      )}

      {!vazio && (
      <ul className="divide-y divide-border">
        {devolutivas.map((d) => (
          <li key={d.id} className="py-2 flex items-center gap-3 flex-wrap">
            <span className="font-semibold flex-1 min-w-[140px]">{d.name}</span>
            <span className="text-xs text-foreground/50 tabular-nums">{d.proxima.split("-").reverse().join("/")} · {quando(d.dias)}</span>
            {quantos(d) > 0 && <span className="text-[11px] font-semibold text-emerald-600">lembrado {quantos(d)}x</span>}
            {/* Doc 41: "Agendar" virou "Lembrar". Doc 49: conta "(Nx)" só após confirmar o envio. */}
            <button type="button" onClick={() => lembrar(d)}
              className="text-xs font-bold px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/15 transition">
              Lembrar
            </button>
          </li>
        ))}
      </ul>
      )}

      {!vazio && (
      <div className="space-y-1">
        <label className="text-xs font-bold text-foreground/50 uppercase tracking-wide">Mensagem única para todos</label>
        <p className="text-[11px] text-foreground/60 text-justify">
          Escreva sua mensagem de chamada para devolutiva no campo abaixo e clique em <strong>Lembrar</strong> nos cadastros que deverão recebê-la.
        </p>
        <textarea value={mensagem} onChange={(e) => { setMensagem(e.target.value); setAviso(null); }}
          rows={3} placeholder="Olá! Vamos marcar a devolutiva?"
          className="w-full px-3 py-2 rounded-xl bg-surface border border-border outline-none text-sm" />
      </div>
      )}

      {aviso && <p className="text-xs font-semibold text-[#b45309]">{aviso}</p>}
      <ConfirmarEnvioModal aberto={confirmar.pendente != null} web={confirmar.web} onSim={() => confirmar.resolver(true, registrar)} onNao={() => confirmar.resolver(false, registrar)} />
    </section>
  );
}
