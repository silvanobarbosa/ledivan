"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { salvarProximoReajuste } from "./financeiro-actions";

/**
 * O PRÓXIMO REAJUSTE (doc 63) — um campo só, em um lugar só.
 *
 * Antes ele aparecia dentro de cada formato de pagamento (avulso, mensal, quinzenal), e cada cópia
 * era uma chance de a pessoa achar que estava olhando outra coisa. Agora é um campo único, logo
 * antes das Observações, com de quantos em quantos meses lembrar e a partir de quando contar.
 *
 * É LEMBRETE, e só: o sistema não mexe em valor de sessão, pacote ou cobrança por causa dele. A
 * data serve ao aviso do dashboard e à janela do paciente; o reajuste continua sendo feito à mão.
 */

const inputCls =
  "w-full px-4 py-3 rounded-xl bg-white/70 border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition text-sm";
const labelCls = "block text-[10px] font-bold uppercase tracking-widest text-foreground/40 mb-1";

export function ProximoReajuste({
  patientId,
  meses,
  aPartirDe,
}: {
  patientId: string;
  meses: number | null;
  /** YYYY-MM-DD, ou vazio quando ela ainda não escolheu a data. */
  aPartirDe: string;
}) {
  const router = useRouter();
  const [valorMeses, setValorMeses] = useState(meses != null ? String(meses) : "");
  const [valorData, setValorData] = useState(aPartirDe);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [pendente, iniciar] = useTransition();

  function salvar() {
    setErro(null);
    setSalvo(false);
    const n = valorMeses.trim() ? Number(valorMeses) : null;
    if (n != null && (!Number.isInteger(n) || n < 1 || n > 60)) {
      setErro("Informe de 1 a 60 meses.");
      return;
    }
    iniciar(async () => {
      const r = await salvarProximoReajuste({ patientId, meses: n, aPartirDe: valorData || null });
      if (!r.ok) { setErro(r.error ?? "Não deu para salvar."); return; }
      setSalvo(true);
      router.refresh();
    });
  }

  return (
    <div className="pt-2 border-t border-border">
      <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest mb-2 mt-3">Próximo reajuste</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="proximoReajusteMeses" className={labelCls}>Próximo reajuste em</label>
          <div className="flex items-center gap-2">
            <input
              id="proximoReajusteMeses" type="number" min={1} max={60} inputMode="numeric"
              value={valorMeses} onChange={(e) => { setValorMeses(e.target.value); setSalvo(false); }}
              className={inputCls} placeholder="ex: 12"
            />
            <span className="text-xs text-foreground/50 whitespace-nowrap">meses</span>
          </div>
        </div>
        <div>
          <label htmlFor="proximoReajusteData" className={labelCls}>A partir da data</label>
          <input
            id="proximoReajusteData" type="date"
            value={valorData} onChange={(e) => { setValorData(e.target.value); setSalvo(false); }}
            className={inputCls}
          />
        </div>
      </div>
      <p className="text-[10px] text-foreground/50 mt-1">
        Serve só de lembrete: o aviso aparece no dashboard e na janela do paciente um mês antes da data
        prevista. Nenhum valor de sessão, pacote ou cobrança é alterado — o reajuste continua sendo
        feito por você, quando for o caso.
      </p>
      {erro && <p className="text-xs text-red-600 mt-2">{erro}</p>}
      <div className="flex flex-wrap items-center gap-3 mt-3">
        {/* `type="button"`: esta área salva sozinha e não envia o formulário do cadastro. */}
        <button type="button" onClick={salvar} disabled={pendente}
          className="bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-sm disabled:opacity-60 cursor-pointer">
          {pendente ? "Salvando…" : "Salvar reajuste"}
        </button>
        {salvo && <span className="text-xs font-bold text-[#047857]">Salvo.</span>}
      </div>
    </div>
  );
}
