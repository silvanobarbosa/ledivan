"use client";

import { useRef, useState, useTransition } from "react";
import { Download, Upload, FileSpreadsheet, AlertTriangle, Check } from "lucide-react";
import { conferirPlanilha, aplicarPlanilha, type ResumoDaImportacao } from "./importar-actions";

/**
 * IMPORTAR DADOS DE OUTRO SISTEMA — baixar o modelo, mandar, CONFERIR, e só então confirmar.
 *
 * A confirmação não é cerimônia: a planilha vem de fora e cria paciente, agenda e pagamento de
 * uma vez. Mostrar o que foi entendido ANTES de gravar é o que transforma um erro de coluna em
 * "ah, errei a aba" em vez de uma base suja que alguém vai limpar à mão depois.
 *
 * O mesmo arquivo é enviado duas vezes, de propósito: o servidor confere de novo antes de
 * gravar. A tela é onde ela decide, não onde o dado é validado.
 */
export function ImportarCard() {
  const campo = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [conferido, setConferido] = useState<ResumoDaImportacao | null>(null);
  const [feito, setFeito] = useState<{ pacientes: number; sessoes: number; pagamentos: number; pulados: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function escolher(f: File | null) {
    setArquivo(f);
    setConferido(null);
    setFeito(null);
    setErro(null);
    if (!f) return;
    start(async () => {
      const fd = new FormData();
      fd.append("arquivo", f);
      const r = await conferirPlanilha(fd);
      setConferido(r);
      if (!r.ok) setErro(r.error);
    });
  }

  function confirmar() {
    if (!arquivo) return;
    setErro(null);
    start(async () => {
      const fd = new FormData();
      fd.append("arquivo", arquivo);
      const r = await aplicarPlanilha(fd);
      if (!r.ok) { setErro(r.error); return; }
      setFeito({ ...r.criados, pulados: r.pulados });
      setConferido(null);
      setArquivo(null);
      if (campo.current) campo.current.value = "";
    });
  }

  const resumo = conferido?.ok ? conferido.resumo : null;
  const nada = resumo && resumo.pacientes + resumo.sessoes + resumo.pagamentos === 0;

  return (
    <div className="glass-card rounded-[24px] p-6 space-y-4">
      <div>
        <h3 className="font-display font-bold text-primary flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4" /> Importar dados de outro sistema
        </h3>
        <p className="text-sm text-foreground/50">
          Baixe a planilha modelo, preencha com seus pacientes, atendimentos e pagamentos, e envie.
          Nada é gravado antes de você conferir e confirmar.
        </p>
      </div>

      <a href="/api/importar/modelo"
        className="inline-flex items-center gap-2 rounded-2xl border border-border/60 px-4 py-2.5 text-sm font-semibold hover:bg-surface transition">
        <Download className="w-4 h-4" /> Baixar planilha modelo
      </a>

      <div className="pt-2 border-t border-border/60 space-y-3">
        <label className="block">
          <span className="text-xs font-bold text-foreground/30 uppercase tracking-widest">Enviar planilha preenchida</span>
          <input ref={campo} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => escolher(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary" />
        </label>

        {pending && <p className="text-sm text-foreground/50">Conferindo…</p>}
        {erro && <p className="text-sm text-[#b91c1c]">{erro}</p>}

        {resumo && (
          <div className="rounded-2xl bg-surface/70 border border-border p-4 space-y-3" data-testid="conferencia-da-planilha">
            <p className="text-sm font-semibold text-foreground/80">O que eu encontrei na planilha</p>
            <ul className="text-sm text-foreground/70 space-y-1">
              <li><b>{resumo.pacientes}</b> paciente(s)</li>
              <li><b>{resumo.sessoes}</b> atendimento(s)</li>
              <li><b>{resumo.pagamentos}</b> pagamento(s){resumo.dinheiro > 0 ? ` — ${resumo.dinheiro.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : ""}</li>
            </ul>

            {conferido?.ok && (conferido.repetidos.pacientes + conferido.repetidos.sessoes + conferido.repetidos.pagamentos > 0) && (
              <p className="text-xs text-foreground/60">
                Já existem aqui e serão <b>pulados</b>: {conferido.repetidos.pacientes} paciente(s),{" "}
                {conferido.repetidos.sessoes} atendimento(s), {conferido.repetidos.pagamentos} pagamento(s).
              </p>
            )}

            {conferido?.ok && conferido.problemas.length > 0 && (
              <div className="rounded-xl bg-[#fef3c7] p-3 space-y-1">
                <p className="text-xs font-bold text-[#92400e] flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {resumo.problemas} linha(s) com problema — essas ficam de fora, o resto entra
                </p>
                <ul className="text-[11px] text-[#92400e]/90 space-y-0.5 max-h-40 overflow-y-auto">
                  {conferido.problemas.map((p, i) => (
                    <li key={i}>{p.aba}{p.linha ? `, linha ${p.linha}` : ""}{p.coluna ? ` (${p.coluna})` : ""}: {p.texto}</li>
                  ))}
                </ul>
                {resumo.problemas > conferido.problemas.length && (
                  <p className="text-[11px] text-[#92400e]/70">…e mais {resumo.problemas - conferido.problemas.length}.</p>
                )}
              </div>
            )}

            <p className="text-[11px] text-foreground/50">
              Os pagamentos entram como histórico do paciente e encaixam nas cobranças em aberto, da mais
              antiga para a mais nova. Eles <b>não</b> entram no Caixa como dinheiro recebido hoje.
            </p>

            {nada
              ? <p className="text-sm text-foreground/60">Não há nada para importar nesta planilha.</p>
              : (
                <button type="button" onClick={confirmar} disabled={pending}
                  className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-2xl font-bold disabled:opacity-60">
                  <Upload className="w-4 h-4" /> Confirmar importação
                </button>
              )}
          </div>
        )}

        {feito && (
          <div className="rounded-2xl bg-[#ecfdf5] border border-[#a7f3d0] p-4 text-sm text-[#047857] space-y-1" data-testid="importacao-concluida">
            <p className="font-bold flex items-center gap-1.5"><Check className="w-4 h-4" /> Importação concluída</p>
            <p>
              {feito.pacientes} paciente(s), {feito.sessoes} atendimento(s) e {feito.pagamentos} pagamento(s) criados
              {feito.pulados > 0 ? ` · ${feito.pulados} já existiam e foram pulados` : ""}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
