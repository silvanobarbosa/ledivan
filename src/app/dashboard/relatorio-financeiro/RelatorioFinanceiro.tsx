"use client";

import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { formatBRL } from "@/lib/therapy";
import { matrizFinanceira, type PacienteFin, type SituacaoFiltro, type SituacaoCelula } from "@/lib/matrizFinanceira";
import { type VigenciaTaxa } from "@/lib/taxaCartao";
import { ExportXLSX } from "@/components/ExportXLSX";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const SITUACOES: { v: SituacaoFiltro; r: string }[] = [
  { v: "todos", r: "Todos" },
  { v: "pagos", r: "Pagos" },
  { v: "aberto", r: "Em aberto" },
  { v: "atraso", r: "Em atraso" },
];
const brl = (n: number) => (n > 0.005 ? formatBRL(n) : "—");

export function RelatorioFinanceiro({ pacientes, vigencias }: { pacientes: PacienteFin[]; vigencias: VigenciaTaxa[] }) {
  // `anos` sai do próprio cálculo; começa no mais recente, ou no ano corrente se não houver dados.
  const anosBase = useMemo(() => matrizFinanceira(pacientes, 0, "todos", vigencias).anos, [pacientes, vigencias]);
  const [situacao, setSituacao] = useState<SituacaoFiltro>("todos");
  const [ano, setAno] = useState<number>(anosBase[0] ?? new Date().getFullYear());

  // Doc 50: nos filtros "Pagos"/"Todos" o valor recebido entra pelo LÍQUIDO (taxa do cartão).
  const m = useMemo(() => matrizFinanceira(pacientes, ano, situacao, vigencias), [pacientes, ano, situacao, vigencias]);

  // Doc 51: a cor passa a vir do VALOR, não do filtro. Antes, escolher "Em atraso" pintava a
  // tabela inteira de vermelho e "Todos" deixava tudo preto — o que escondia justamente a
  // informação útil quando se olha tudo junto.
  // Quando a célula mistura (pago e atrasado no mesmo mês), o pior manda: ver `situacaoDe`.
  const COR: Record<SituacaoCelula, string> = {
    pago: "text-[#2563eb]",     // azul
    atraso: "text-[#b91c1c]",   // vermelho
    aberto: "text-foreground/80", // preto
    vazio: "text-foreground/30",
  };

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-[24px] p-5 flex flex-wrap items-end gap-4 no-print">
        <div>
          <span className="text-[11px] font-semibold text-foreground/60 block mb-1">Situação do pagamento</span>
          <div className="inline-flex rounded-xl overflow-hidden border border-border">
            {SITUACOES.map((s) => (
              <button key={s.v} type="button" onClick={() => setSituacao(s.v)}
                className={`px-3 py-2 text-sm font-bold transition ${situacao === s.v ? "bg-primary text-white" : "bg-white text-foreground/60 hover:bg-surface"}`}>
                {s.r}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="text-[11px] font-semibold text-foreground/60 block mb-1">Ano</span>
          <select value={ano} onChange={(e) => setAno(Number(e.target.value))} className="px-3 py-2 rounded-xl bg-white border border-border text-sm">
            {(anosBase.length ? anosBase : [ano]).map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        {/* Exportar XLS à ESQUERDA do imprimir (doc 51). A planilha leva a matriz exatamente
            como está na tela — mesmo ano, mesma situação, mesma ordem — e os valores vão como
            NÚMERO, não como texto "R$ 1.200,00": no Excel eles precisam somar. O "—" da tela
            (valor zerado) vira célula vazia, que é o equivalente numa planilha. */}
        <div className="ml-auto flex items-center gap-2">
          <ExportXLSX
            cabecalho={["Cadastro", ...MESES, "Total"]}
            linhas={[
              ...m.linhas.map((l) => [l.nome, ...l.meses.map((v) => (v > 0.005 ? v : "")), l.total]),
              ["Total mensal", ...m.totalMes.map((v) => (v > 0.005 ? v : "")), m.totalGeral],
            ]}
            nomeArquivo={`relatorio-financeiro-${ano}`}
            aba={String(ano)}
          />
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 text-sm font-semibold text-primary border border-border rounded-xl px-4 py-2 hover:bg-surface cursor-pointer">
            <Printer className="w-4 h-4" /> Imprimir
          </button>
        </div>
      </div>

      <div className="glass-card rounded-[24px] p-5 overflow-x-auto">
        {m.linhas.length === 0 ? (
          <p className="text-sm text-foreground/40 py-6 text-center">Nenhum valor para esta situação em {ano}.</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-foreground/50">
                <th className="px-2 py-2 text-left font-bold sticky left-0 bg-surface" aria-label="Cadastro"></th>
                {/* Doc 50: títulos centralizados. */}
                {MESES.map((mes) => <th key={mes} className="px-2 py-2 text-center font-bold tabular-nums">{mes}</th>)}
                <th className="px-2 py-2 text-center font-bold tabular-nums">Total</th>
              </tr>
            </thead>
            <tbody>
              {m.linhas.map((l) => (
                <tr key={l.id} className="border-b border-border/60">
                  <td className="px-2 py-2 font-medium sticky left-0 bg-white truncate max-w-[180px]" title={l.nome}>{l.nome}</td>
                  {l.meses.map((v, i) => <td key={i} className={`px-2 py-2 text-right tabular-nums ${COR[l.mesesSituacao[i]]}`}>{brl(v)}</td>)}
                  <td className={`px-2 py-2 text-right tabular-nums font-bold ${COR[l.totalSituacao]}`}>{brl(l.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border font-bold">
                <td className="px-2 py-2 text-left sticky left-0 bg-surface">Total mensal</td>
                {m.totalMes.map((v, i) => <td key={i} className={`px-2 py-2 text-right tabular-nums ${COR[m.totalMesSituacao[i]]}`}>{brl(v)}</td>)}
                <td className="px-2 py-2 text-right tabular-nums text-primary">{brl(m.totalGeral)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
