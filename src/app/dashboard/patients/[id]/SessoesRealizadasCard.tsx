"use client";

import { useState } from "react";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/**
 * Doc 41: card "Sessões Realizadas" (abaixo de "Sessões agendadas"). Mostra o total de sessões com
 * status Presente (realizada) e, ao clicar em "detalhe", abre a escolha de mês/ano e exibe quantas
 * presenças houve naquele período. A contagem por mês já vem pronta do servidor (chave "YYYY-MM").
 */
export function SessoesRealizadasCard({ total, porMes }: { total: number; porMes: Record<string, number> }) {
  const hoje = new Date();
  const [aberto, setAberto] = useState(false);
  const [mes, setMes] = useState(hoje.getMonth() + 1); // 1-12
  const [ano, setAno] = useState(hoje.getFullYear());

  // Anos com presença + o ano atual, do mais recente ao mais antigo.
  const anos = Array.from(new Set([hoje.getFullYear(), ...Object.keys(porMes).map((k) => Number(k.slice(0, 4)))]))
    .sort((a, b) => b - a);

  const chave = `${ano}-${String(mes).padStart(2, "0")}`;
  const noPeriodo = porMes[chave] ?? 0;

  const sel = "px-2 py-1.5 rounded-xl bg-surface border border-border outline-none text-sm";

  return (
    <div className="glass-card rounded-[20px] p-4">
      <p className="text-2xl font-display font-bold text-primary">{total}</p>
      <p className="text-xs text-foreground/50">Sessões realizadas</p>
      <button type="button" onClick={() => setAberto((v) => !v)}
        className="text-xs font-semibold text-primary/80 hover:text-primary transition mt-1">
        {aberto ? "ocultar" : "detalhe"}
      </button>

      {aberto && (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2 flex-wrap">
            <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className={sel} aria-label="Mês">
              {MESES.map((nome, i) => <option key={i} value={i + 1}>{nome}</option>)}
            </select>
            <select value={ano} onChange={(e) => setAno(Number(e.target.value))} className={sel} aria-label="Ano">
              {anos.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <p className="text-sm text-foreground/70">
            <strong className="text-primary">{noPeriodo}</strong> presença{noPeriodo === 1 ? "" : "s"} em {MESES[mes - 1]} de {ano}.
          </p>
        </div>
      )}
    </div>
  );
}
