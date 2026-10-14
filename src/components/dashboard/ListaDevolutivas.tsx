"use client";

import { useState } from "react";
import { MessagesSquare } from "lucide-react";
import { numeroDoWhatsapp } from "@/lib/telefoneWhatsapp";
import { InfoTip } from "@/components/InfoTip";

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
 * Aparece 7 dias antes da devolutiva prevista. "Agendar" só ABRE o WhatsApp (responsável, ou paciente)
 * — não cria agendamento na Agenda; o ✓ dispensa esta devolutiva (resolvida sem agendar) e ela volta
 * no ciclo seguinte. A mensagem é a mesma lógica da dos Prospectados; `{nome}` vira o 1º nome.
 */
export function ListaDevolutivas({ devolutivas }: { devolutivas: DevolutivaLinha[] }) {
  const [mensagem, setMensagem] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);

  const vazio = devolutivas.length === 0;

  // Doc 41: "Lembrar" vai para o WhatsApp do RESPONSÁVEL (a devolutiva é com os pais do menor);
  // {nome} é o nome do responsável. Sem responsável, cai no paciente como rede de segurança.
  function lembrar(d: DevolutivaLinha) {
    const num = numeroDoWhatsapp(d.guardianPhone) ?? numeroDoWhatsapp(d.phone);
    if (!num) { setAviso(`${d.name} está sem telefone (responsável ou paciente).`); return; }
    setAviso(null);
    const alvo = (d.guardianName?.trim() || d.name).split(" ")[0];
    const texto = mensagem.replace(/\{nome\}/g, alvo);
    window.open(texto.trim() ? `https://wa.me/${num}?text=${encodeURIComponent(texto)}` : `https://wa.me/${num}`, "_blank", "noopener");
  }

  const quando = (n: number) => (n < 0 ? "venceu" : n === 0 ? "hoje" : `em ${n} dia${n === 1 ? "" : "s"}`);

  return (
    <section className="glass-card rounded-[24px] p-5 space-y-3 mt-4">
      <h3 className="text-lg font-display font-bold text-primary flex items-center gap-2">
        <MessagesSquare className="w-5 h-5" /> Próximas devolutivas
        <InfoTip text="O botão Lembrar abre o WhatsApp do cadastro para enviar mensagens individuais. Para enviar uma mensagem padrão a vários, digite o texto na caixa Mensagem e clique em Lembrar para cada paciente desejado. Esta mensagem será enviada para ao responsável do paciente." />
      </h3>
      <p className="text-xs text-foreground/60 text-justify">
        Visualize os pacientes que precisam agendar uma devolutiva no <strong>próximo mês</strong>.<br />
        Ao <strong>agendar uma devolutiva</strong>, o paciente será <strong>removido automaticamente desta lista</strong>.
      </p>

      {vazio && (
        <p className="text-sm text-foreground/45 py-2">Nenhuma devolutiva prevista no momento.</p>
      )}

      {!vazio && (
      <ul className="divide-y divide-border">
        {devolutivas.map((d) => (
          <li key={d.id} className="py-2 flex items-center gap-3 flex-wrap">
            <span className="font-semibold flex-1 min-w-[140px]">{d.name}</span>
            <span className="text-xs text-foreground/50 tabular-nums">{d.proxima.split("-").reverse().join("/")} · {quando(d.dias)}</span>
            {/* Doc 41: "Agendar" virou "Lembrar"; o tick de confirmação saiu (o paciente sai sozinho
                ao agendar uma DEVOLUTIVA na agenda). */}
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
        <label className="text-xs font-bold text-foreground/50 uppercase tracking-wide">Mensagem</label>
        <textarea value={mensagem} onChange={(e) => { setMensagem(e.target.value); setAviso(null); }}
          rows={3} placeholder="Olá, {nome}! Vamos marcar a devolutiva?"
          className="w-full px-3 py-2 rounded-xl bg-surface border border-border outline-none text-sm" />
        <p className="text-[11px] text-foreground/60 text-justify">
          Digite o texto de chamada para devolutiva no campo Mensagem e, em seguida, clique em <strong>Lembrar</strong>
          em cada paciente cujo responsável deverá receber essa mensagem.<br />
          Se desejar <strong>personalizar o texto</strong>, utilize &ldquo;{"{nome}"}&rdquo;. O sistema substituirá esse
          marcador pelo nome do <strong>responsável</strong> do paciente.
        </p>
      </div>
      )}

      {aviso && <p className="text-xs font-semibold text-[#b45309]">{aviso}</p>}
    </section>
  );
}
