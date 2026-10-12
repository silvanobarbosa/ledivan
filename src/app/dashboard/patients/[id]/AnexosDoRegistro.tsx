"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Paperclip, Download, Trash2 } from "lucide-react";
import { deleteMaterial, listAnexosDoRegistro, uploadAnexoDoRegistro } from "./materials-actions";

type Anexo = { id: string; title: string; kind: string; content: string; at: string };

/**
 * Anexos de UM registro do histórico terapêutico (prints 6.pdf, item 5): "incluir botão para anexos
 * em cada inclusão". Mesmo cofre privado dos demais anexos do prontuário — o paciente não vê. Preso
 * ao registro: cai junto quando o registro é apagado.
 */
export function AnexosDoRegistro({ patientId, recordId }: { patientId: string; recordId: string }) {
  const [itens, setItens] = useState<Anexo[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    setItens(await listAnexosDoRegistro(recordId));
  }, [recordId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void carregar(); }, [carregar]);

  // Doc 33: "Anexar arquivo" abre DIRETO o seletor de arquivos do dispositivo; escolhido o arquivo,
  // o upload começa na hora — sem passo intermediário.
  function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0] ?? null;
    e.target.value = ""; // permite escolher o mesmo arquivo de novo depois
    if (!arquivo) return;
    setErro(null);
    const fd = new FormData();
    fd.set("patientId", patientId);
    fd.set("recordId", recordId);
    fd.set("file", arquivo);
    iniciar(async () => {
      const r = await uploadAnexoDoRegistro(fd);
      if (!r.ok) { setErro(r.error ?? "Não deu para anexar."); return; }
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
    <div className="mt-2 pt-2 border-t border-border/60 space-y-1.5">
      {itens.map((a) => (
        <div key={a.id} className="flex items-center gap-2 text-xs">
          <Paperclip className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="flex-1 truncate font-medium text-foreground/70">{a.title}</span>
          <button type="button" onClick={() => void baixar(a.id)} title="Abrir" className="p-1 rounded text-primary hover:bg-surface">
            <Download className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={() => excluir(a)} title="Excluir" className="p-1 rounded text-red-600 hover:bg-surface">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
        onChange={aoEscolher}
        className="hidden"
      />
      <button type="button" onClick={() => inputRef.current?.click()} disabled={pendente} className="inline-flex items-center gap-1 text-primary text-xs font-semibold hover:underline disabled:opacity-60 cursor-pointer">
        <Paperclip className="w-3.5 h-3.5" /> {pendente ? "Anexando…" : "Anexar arquivo"}
      </button>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
    </div>
  );
}
