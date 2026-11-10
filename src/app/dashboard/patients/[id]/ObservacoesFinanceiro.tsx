"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Pencil, Trash2, X } from "lucide-react";
import { criarObservacao, editarObservacao, excluirObservacao, type Observacao } from "./financeiro-actions";

/**
 * OBSERVAÇÕES do Financeiro (doc 63), logo antes do Histórico de reajuste.
 *
 * Assunto e texto. O assunto vira o título na lista; clicar nele abre e fecha a observação daquele
 * assunto. Cada registro traz a data e a hora à direita, um lápis e uma lixeira — e a lixeira apaga
 * só aquele assunto com a sua observação, nada mais.
 *
 * Os registros NÃO viajam no formulário do cadastro: salvam e apagam por ação própria, e por isso
 * sobrevivem a sair da tela sem salvar o resto.
 */

const inputCls =
  "w-full px-4 py-3 rounded-xl bg-white/70 border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition text-sm";
const labelCls = "block text-[10px] font-bold uppercase tracking-widest text-foreground/40 mb-1";

const quando = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
};

export function ObservacoesFinanceiro({ patientId, observacoes }: { patientId: string; observacoes: Observacao[] }) {
  const router = useRouter();
  const [assunto, setAssunto] = useState("");
  const [texto, setTexto] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function limpar() {
    setEditId(null);
    setAssunto("");
    setTexto("");
    setErro(null);
  }

  function salvar() {
    setErro(null);
    if (!assunto.trim()) { setErro("Escreva o assunto."); return; }
    if (!texto.trim()) { setErro("Escreva a observação."); return; }
    iniciar(async () => {
      const dados = { patientId, assunto: assunto.trim(), observacao: texto.trim() };
      const r = editId ? await editarObservacao({ ...dados, id: editId }) : await criarObservacao(dados);
      if (!r.ok) { setErro(r.error ?? "Não deu para salvar."); return; }
      limpar();
      router.refresh();
    });
  }

  function editar(o: Observacao) {
    setEditId(o.id);
    setAssunto(o.assunto);
    setTexto(o.observacao);
    setErro(null);
  }

  function excluir(o: Observacao) {
    if (!window.confirm(`Excluir a observação "${o.assunto}"? Esta ação não pode ser desfeita.`)) return;
    iniciar(async () => {
      const r = await excluirObservacao({ patientId, id: o.id });
      if (!r.ok) { setErro(r.error ?? "Não deu para excluir."); return; }
      if (editId === o.id) limpar();
      router.refresh();
    });
  }

  return (
    <div className="pt-2 border-t border-border">
      <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest mb-2 mt-3">Observações</p>

      <div className="space-y-3">
        <div>
          <label htmlFor="observacaoAssunto" className={labelCls}>Assunto</label>
          <input
            id="observacaoAssunto" value={assunto} maxLength={120}
            onChange={(e) => setAssunto(e.target.value)}
            className={inputCls} placeholder="Título da observação"
          />
        </div>
        <div>
          <label htmlFor="observacaoTexto" className={labelCls}>Observação</label>
          <textarea
            id="observacaoTexto" value={texto} rows={3} maxLength={4000}
            onChange={(e) => setTexto(e.target.value)}
            className={inputCls} placeholder="O que precisa ficar registrado"
          />
        </div>
        {erro && <p className="text-xs text-red-600">{erro}</p>}
        <div className="flex flex-wrap items-center gap-2">
          {/* `type="button"`: esta área tem ação própria e não pode enviar o formulário do cadastro. */}
          <button type="button" onClick={salvar} disabled={pendente}
            className="bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-sm disabled:opacity-60 cursor-pointer">
            {pendente ? "Salvando…" : editId ? "Salvar alterações" : "Salvar observação"}
          </button>
          {editId && (
            <button type="button" onClick={limpar} className="text-foreground/50 text-sm px-2 inline-flex items-center gap-1 cursor-pointer">
              <X className="w-3.5 h-3.5" /> Cancelar edição
            </button>
          )}
        </div>
      </div>

      {observacoes.length > 0 && (
        <div className="space-y-1 mt-4">
          {observacoes.map((o) => {
            const expandido = aberto === o.id;
            return (
              <div key={o.id} className="rounded-xl bg-surface/60 overflow-hidden">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setAberto(expandido ? null : o.id)}
                    aria-expanded={expandido}
                    className="flex flex-1 min-w-0 items-center gap-2 text-left cursor-pointer"
                  >
                    <ChevronRight className={`w-4 h-4 shrink-0 text-foreground/40 transition ${expandido ? "rotate-90" : ""}`} />
                    <span className="truncate text-sm font-bold text-primary">{o.assunto}</span>
                  </button>
                  <span className="ml-auto font-mono text-[11px] text-foreground/40 whitespace-nowrap">{quando(o.at)}</span>
                  <button type="button" onClick={() => editar(o)} title="Editar" aria-label={`Editar ${o.assunto}`}
                    className="text-foreground/40 hover:text-primary transition cursor-pointer">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => excluir(o)} disabled={pendente} title="Excluir" aria-label={`Excluir ${o.assunto}`}
                    className="text-foreground/40 hover:text-red-600 transition disabled:opacity-50 cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {expandido && (
                  <p className="px-3 pb-3 pl-9 text-sm text-foreground/70 whitespace-pre-wrap">{o.observacao}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
