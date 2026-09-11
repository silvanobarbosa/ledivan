"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Paperclip, Download, Trash2, Plus } from "lucide-react";
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
  const [abrir, setAbrir] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const carregar = useCallback(async () => {
    setItens(await listAnexosProntuario(patientId));
    setCarregando(false);
  }, [patientId]);

  // Carregamento na montagem: `carregar` é async, então o setState acontece DEPOIS do await, e
  // não durante o efeito. Some de verdade só com Suspense ou biblioteca de dados; reescrever à
  // mão aqui trocaria o aviso por risco de piscar a lista. Mesma decisão já tomada em MaterialsTab.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void carregar(); }, [carregar]);

  function enviar() {
    if (!arquivo) { setErro("Escolha um arquivo."); return; }
    setErro(null);
    const fd = new FormData();
    fd.set("patientId", patientId);
    fd.set("title", titulo);
    fd.set("file", arquivo);
    iniciar(async () => {
      const r = await uploadAnexoProntuario(fd);
      if (!r.ok) { setErro(r.error ?? "Não deu para anexar."); return; }
      setTitulo(""); setArquivo(null); setAbrir(false);
      await carregar();
    });
  }

  async function baixar(id: string) {
    const r = await fetch(`/api/files/${id}`);
    const d = await r.json().catch(() => null);
    if (d?.url) window.open(d.url, "_blank", "noopener");
    else setErro("Não consegui abrir o arquivo.");
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
        <button type="button" onClick={() => setAbrir((v) => !v)} className="inline-flex items-center gap-1.5 bg-surface border border-border text-primary text-sm px-3 py-2 rounded-xl font-semibold">
          <Plus className="w-4 h-4" /> Anexar arquivo
        </button>
      </div>
      <p className="text-xs text-foreground/50 -mt-1">
        Laudo, relatório da escola, encaminhamento, exame. Fica só com você: o paciente não vê
        estes arquivos no aplicativo dele.
      </p>

      {abrir && (
        <div className="rounded-2xl bg-surface/70 border border-border p-4 space-y-3">
          <div>
            <label className="text-xs font-semibold text-foreground/60">Nome do anexo</label>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="ex: Laudo neuropsicológico" className="w-full px-4 py-2.5 rounded-xl bg-white border border-border outline-none text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground/60">Arquivo</label>
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
              className="w-full text-sm"
            />
            <p className="text-[11px] text-foreground/40 mt-1">PDF ou imagem, até 15 MB.</p>
          </div>
          <button type="button" onClick={enviar} disabled={pendente} className="bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-sm disabled:opacity-60">
            {pendente ? "Anexando…" : "Anexar"}
          </button>
        </div>
      )}

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
              <button type="button" onClick={() => void baixar(a.id)} title="Abrir" className="p-2 rounded-lg border border-border text-primary">
                <Download className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => excluir(a)} title="Excluir" className="p-2 rounded-lg border border-border text-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
