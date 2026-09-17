"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveDadosDoRecibo } from "./actions";
import { DESCRICOES, descricaoValida, montarRecibo, type DescricaoAtendimento } from "@/lib/recibo";

/**
 * Os dados da terapeuta que entram no RECIBO (dono, 17/09/2026).
 *
 * A descrição do atendimento não é preferência de texto: "atendimentos psicológicos" num recibo de
 * quem não é psicóloga é declaração errada num documento que vai para o imposto de renda do
 * paciente. Por isso a escolha é dela, e o exemplo aqui embaixo mostra o resultado antes de o
 * primeiro recibo sair.
 */
export function ReciboCard({ cpf, descricao, nome }: { cpf: string | null; descricao: string | null; nome: string | null }) {
  const router = useRouter();
  const [valorCpf, setCpf] = useState(cpf ?? "");
  const [desc, setDesc] = useState<DescricaoAtendimento>(descricaoValida(descricao));
  const [pending, start] = useTransition();
  const [salvo, setSalvo] = useState(false);

  function salvar() {
    const fd = new FormData();
    fd.set("therapistCpf", valorCpf);
    fd.set("descricaoAtendimento", desc);
    start(async () => { await saveDadosDoRecibo(fd); setSalvo(true); router.refresh(); setTimeout(() => setSalvo(false), 2000); });
  }

  const exemplo = montarRecibo({
    responsavel: "Maria da Silva",
    responsavelCpf: "000.000.000-00",
    paciente: "João da Silva",
    datas: [new Date(2026, 8, 14, 12), new Date(2026, 8, 21, 12)],
    valorTotal: 200,
    dataPagamento: new Date(2026, 8, 21, 12),
    terapeuta: nome || "seu nome",
    terapeutaCpf: valorCpf,
    descricao: desc,
  });

  return (
    <div className="glass-card rounded-[24px] p-6 space-y-3">
      <div>
        <h3 className="font-display font-bold text-primary">Recibo</h3>
        <p className="text-sm text-foreground/50">O que entra no recibo que você entrega ao paciente.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-semibold text-foreground/60">Seu CPF</span>
          <input
            value={valorCpf}
            onChange={(e) => setCpf(e.target.value)}
            inputMode="numeric"
            placeholder="000.000.000-00"
            className="mt-1 w-full px-4 py-2.5 rounded-2xl bg-white/70 border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition text-sm"
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-foreground/60">Descrição do atendimento</span>
          <select
            value={desc}
            onChange={(e) => setDesc(e.target.value as DescricaoAtendimento)}
            className="mt-1 w-full px-4 py-2.5 rounded-2xl bg-white/70 border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition text-sm"
          >
            {DESCRICOES.map((d) => <option key={d.valor} value={d.valor}>{d.rotulo}</option>)}
          </select>
        </label>
      </div>

      <div>
        <p className="text-xs font-semibold text-foreground/40 uppercase tracking-widest mb-1">Como vai sair</p>
        <pre className="text-[11px] leading-relaxed bg-black/[0.03] rounded-xl p-3 whitespace-pre-wrap font-sans text-foreground/70">{exemplo}</pre>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={salvar} disabled={pending} className="bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-sm disabled:opacity-60">
          {pending ? "Salvando…" : "Salvar"}
        </button>
        {salvo && <span className="text-sm text-[#047857] font-semibold">salvo ✓</span>}
      </div>
    </div>
  );
}
