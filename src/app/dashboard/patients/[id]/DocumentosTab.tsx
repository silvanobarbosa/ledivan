"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Printer, Pencil, Trash2, X } from "lucide-react";
import { photoSrc } from "@/lib/photo";
import { formatDateTime } from "@/lib/therapy";
import { createDocument, updateDocument, deleteDocument } from "../actions";

const inputCls = "w-full px-4 py-3 rounded-xl bg-white/70 border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition text-sm";

export type CabecalhoDoc = {
  profissional: { nome: string; registro: string | null; registroLabel: string; telefone: string | null; email: string | null; logoUrl: string | null };
  paciente: { nome: string; nascimento: string | null; idade: string | null; sessoesPresente: number };
};
export type DocumentoSalvo = { id: string; number: number; content: string; updatedAt: string };

/** O cabeçalho padronizado do documento — logo centralizado (como no contrato) + dados do profissional e do paciente. */
function Cabecalho({ cab }: { cab: CabecalhoDoc }) {
  const { profissional: p, paciente: pac } = cab;
  return (
    <div>
      {p.logoUrl && (
        <div className="flex justify-center mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo em blob URL; precisa sair na impressão. */}
          <img src={photoSrc(p.logoUrl) ?? undefined} alt="" className="h-[3cm] w-auto max-w-[8cm] object-contain" />
        </div>
      )}
      <div className="text-sm leading-relaxed text-foreground">
        <p className="font-bold">{p.nome || "—"}</p>
        {p.registro && <p>{p.registroLabel}: {p.registro}</p>}
        {p.telefone && <p>Telefone: {p.telefone}</p>}
        {p.email && <p>E-mail: {p.email}</p>}
        <p className="mt-3"><span className="font-bold">Paciente:</span> {pac.nome}</p>
        {pac.nascimento && <p>Data de nascimento: {pac.nascimento}{pac.idade ? ` (${pac.idade})` : ""}</p>}
        <p>Sessões realizadas: {pac.sessoesPresente}</p>
      </div>
      <hr className="my-4 border-border" />
    </div>
  );
}

export function DocumentosTab({ patientId, cabecalho, documentos }: { patientId: string; cabecalho: CabecalhoDoc; documentos: DocumentoSalvo[] }) {
  const router = useRouter();
  const [conteudo, setConteudo] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [montado, setMontado] = useState(false);
  const [textoImpressao, setTextoImpressao] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMontado(true); }, []);

  // Imprime assim que o bloco de impressão reflete o texto escolhido; depois limpa (fora do efeito,
  // para não disparar re-render em cascata — o reset é só para permitir imprimir o mesmo doc de novo).
  useEffect(() => {
    if (textoImpressao == null) return;
    window.print();
    queueMicrotask(() => setTextoImpressao(null));
  }, [textoImpressao]);

  function salvar() {
    setErro(null);
    if (!conteudo.trim()) { setErro("Escreva o conteúdo do documento."); return; }
    start(async () => {
      const r = editId ? await updateDocument(editId, conteudo) : await createDocument(patientId, conteudo);
      if (r.ok) { setConteudo(""); setEditId(null); router.refresh(); }
      else setErro(r.error ?? "Não deu para salvar.");
    });
  }

  function editar(d: DocumentoSalvo) {
    setEditId(d.id); setConteudo(d.content); setErro(null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function excluir(d: DocumentoSalvo) {
    // O viewer não mostra confirm() nativo em alguns contextos; usamos o window.confirm padrão do painel.
    if (!window.confirm(`Excluir o Documento ${d.number}? Esta ação não pode ser desfeita.`)) return;
    start(async () => { const r = await deleteDocument(d.id); if (r.ok) router.refresh(); else setErro(r.error ?? "Não deu para excluir."); });
  }

  return (
    <div className="space-y-4">
      {/* Área de elaboração: cabeçalho automático + campo de texto. */}
      <div className="glass-card rounded-[24px] p-5 space-y-3">
        <Cabecalho cab={cabecalho} />
        <textarea
          rows={12}
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
          className={inputCls}
          placeholder="Escreva o documento…"
        />
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={salvar} disabled={pending} className="bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-sm disabled:opacity-60 cursor-pointer">
            {pending ? "Salvando…" : editId ? "Salvar alterações" : "Salvar"}
          </button>
          <button type="button" onClick={() => conteudo.trim() && setTextoImpressao(conteudo)} disabled={!conteudo.trim()} className="inline-flex items-center gap-1.5 border border-border px-5 py-2.5 rounded-xl font-bold text-sm text-foreground disabled:opacity-50 cursor-pointer">
            <Printer className="w-4 h-4" /> Imprimir
          </button>
          {editId && (
            <button type="button" onClick={() => { setEditId(null); setConteudo(""); setErro(null); }} className="text-foreground/50 text-sm px-2 inline-flex items-center gap-1 cursor-pointer">
              <X className="w-3.5 h-3.5" /> Cancelar edição
            </button>
          )}
        </div>
      </div>

      {/* Lista de documentos salvos — do mais recente para o mais antigo. */}
      {documentos.length === 0 ? (
        <p className="text-sm text-foreground/40 py-4 text-center">Nenhum documento salvo ainda.</p>
      ) : (
        <div className="space-y-2">
          {documentos.map((d) => (
            <div key={d.id} className="glass-card rounded-2xl p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-primary">Documento {d.number}</p>
                <p className="text-[11px] text-foreground/40">{formatDateTime(d.updatedAt)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button type="button" onClick={() => editar(d)} title="Editar" aria-label="Editar documento" className="text-foreground/40 hover:text-primary transition cursor-pointer"><Pencil className="w-4 h-4" /></button>
                <button type="button" onClick={() => setTextoImpressao(d.content)} title="Imprimir" aria-label="Imprimir documento" className="text-foreground/40 hover:text-primary transition cursor-pointer"><Printer className="w-4 h-4" /></button>
                <button type="button" onClick={() => excluir(d)} disabled={pending} title="Excluir" aria-label="Excluir documento" className="text-foreground/40 hover:text-red-600 transition cursor-pointer disabled:opacity-50"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bloco de IMPRESSÃO via portal no body: direto no body, sem recuo herdado; some na tela, aparece
          só na impressão, e flui em quantas páginas forem necessárias (margem 2cm). */}
      {montado && textoImpressao != null && createPortal(
        <div id="doc-print-root">
          <style>{`
            #doc-print-root { display: none; }
            @media print {
              @page { margin: 20mm; }
              body > *:not(#doc-print-root) { display: none !important; }
              #doc-print-root { display: block; }
            }
          `}</style>
          <div className="font-sans text-[15px] leading-relaxed text-black">
            <Cabecalho cab={cabecalho} />
            <pre className="whitespace-pre-wrap font-sans text-[15px] leading-relaxed">{textoImpressao}</pre>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
