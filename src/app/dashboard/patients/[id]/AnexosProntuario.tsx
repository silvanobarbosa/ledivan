"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Paperclip, Eye, Printer, Trash2, Plus, X } from "lucide-react";
import { deleteMaterial, listAnexosProntuario, uploadAnexoProntuario } from "./materials-actions";

type Anexo = { id: string; title: string; kind: string; content: string; at: string };

/**
 * Anexos do prontuário.
 *
 * Substitui a aba "Fotos" do cadastro, que só aceitava três imagens soltas. O que chega na mão do
 * terapeuta é laudo, relatório da escola, encaminhamento, exame — e quase nunca é foto.
 *
 * Eles ficam no MESMO cofre dos materiais (arquivo privado, link assinado só na hora de abrir),
 * com a diferença que importa: não são compartilhados. O aplicativo do paciente não os lista, e a
 * rota de download recusa o token dele mesmo que ele acerte o id.
 */
export function AnexosProntuario({ patientId }: { patientId: string }) {
  const [itens, setItens] = useState<Anexo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    setItens(await listAnexosProntuario(patientId));
    setCarregando(false);
  }, [patientId]);

  // Carregamento na montagem: `carregar` é async, então o setState acontece DEPOIS do await, e
  // não durante o efeito. Some de verdade só com Suspense ou biblioteca de dados; reescrever à
  // mão aqui trocaria o aviso por risco de piscar a lista. Mesma decisão já tomada em MaterialsTab.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void carregar(); }, [carregar]);

  // Doc 33: "Anexar arquivo" abre DIRETO o seletor; o nome do arquivo vira o título do anexo.
  function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!arquivo) return;
    setErro(null);
    const fd = new FormData();
    fd.set("patientId", patientId);
    fd.set("title", arquivo.name.replace(/\.[^.]+$/, ""));
    fd.set("file", arquivo);
    iniciar(async () => {
      const r = await uploadAnexoProntuario(fd);
      if (!r.ok) { setErro(r.error ?? "Não deu para anexar."); return; }
      await carregar();
    });
  }

  // Doc 36: visualizar o anexo DENTRO do app (não em aba nova), com Fechar e Imprimir.
  const [vendo, setVendo] = useState<{ url: string; title: string; pdf: boolean } | null>(null);

  async function abrir(a: Anexo) {
    const r = await fetch(`/api/files/${a.id}`);
    const d = await r.json().catch(() => null);
    if (!d?.url) { setErro("Não consegui abrir o arquivo."); return; }
    const pdf = /\.pdf(\?|$)/i.test(String(d.url)) || /\.pdf$/i.test(a.title);
    setVendo({ url: String(d.url), title: a.title, pdf });
  }

  // Imprimir abre o arquivo numa janela própria e manda imprimir — caminho confiável para imagem e
  // PDF (o arquivo mora em domínio externo/cofre, então imprimir o iframe daqui esbarra em CORS).
  function imprimir() {
    if (!vendo) return;
    const w = window.open(vendo.url, "_blank");
    if (w) w.addEventListener("load", () => { try { w.print(); } catch { /* bloqueado: a janela abriu, o usuário imprime manualmente */ } });
  }

  function excluir(a: Anexo) {
    if (!confirm(`Excluir o anexo "${a.title}"?`)) return;
    iniciar(async () => { await deleteMaterial(a.id); await carregar(); });
  }

  return (
    <div className="glass-card rounded-[24px] p-5 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest flex items-center gap-1.5">
          <Paperclip className="w-4 h-4" /> Anexos
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
          onChange={aoEscolher}
          className="hidden"
        />
        <button type="button" onClick={() => inputRef.current?.click()} disabled={pendente} className="inline-flex items-center gap-1.5 bg-surface border border-border text-primary text-sm px-3 py-2 rounded-xl font-semibold disabled:opacity-60 cursor-pointer">
          <Plus className="w-4 h-4" /> {pendente ? "Anexando…" : "Anexar arquivo"}
        </button>
      </div>
      <p className="text-xs text-foreground/50 -mt-1">
        Laudos, relatórios escolares, encaminhamentos e exames ficam disponíveis apenas para você.
        Esses arquivos são confidenciais e não ficam visíveis para o paciente no aplicativo dele.
      </p>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      {carregando ? (
        <p className="text-sm text-foreground/40">Carregando…</p>
      ) : itens.length === 0 ? (
        <p className="text-sm text-foreground/40">Nenhum anexo neste prontuário.</p>
      ) : (
        <ul className="space-y-2">
          {itens.map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded-xl bg-surface/60 px-3 py-2">
              <Paperclip className="w-4 h-4 text-primary shrink-0" />
              <span className="flex-1 text-sm font-semibold truncate">{a.title}</span>
              <span className="text-xs text-foreground/40 shrink-0">{new Date(a.at).toLocaleDateString("pt-BR")}</span>
              <button type="button" onClick={() => void abrir(a)} title="Visualizar" aria-label="Visualizar anexo" className="p-2 rounded-lg border border-border text-primary">
                <Eye className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => excluir(a)} title="Excluir" className="p-2 rounded-lg border border-border text-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Doc 36: visualizador do anexo DENTRO do app — sobreposição com Fechar e Imprimir. */}
      {vendo && createPortal(
        <div className="fixed inset-0 z-50 flex flex-col bg-black/70" role="dialog" aria-modal="true" aria-label={`Anexo: ${vendo.title}`}>
          <div className="flex items-center justify-between gap-3 bg-white px-4 py-3 shadow">
            <span className="font-semibold text-sm truncate">{vendo.title}</span>
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" onClick={imprimir} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary border border-border rounded-lg px-3 py-1.5 hover:bg-surface cursor-pointer">
                <Printer className="w-4 h-4" /> Imprimir
              </button>
              <button type="button" onClick={() => setVendo(null)} aria-label="Fechar" className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground/70 border border-border rounded-lg px-3 py-1.5 hover:bg-surface cursor-pointer">
                <X className="w-4 h-4" /> Fechar
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-auto flex items-center justify-center p-3">
            {vendo.pdf ? (
              <iframe src={vendo.url} title={vendo.title} className="w-full h-full bg-white rounded" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- arquivo do cofre em URL assinada; não passa pelo otimizador.
              <img src={vendo.url} alt={vendo.title} className="max-w-full max-h-full object-contain" />
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
