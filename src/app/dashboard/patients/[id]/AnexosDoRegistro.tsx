"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Paperclip, Printer, Trash2 } from "lucide-react";
import {
  deleteMaterial,
  listAnexosDaAtividade,
  listAnexosDoRegistro,
  uploadAnexoDaAtividade,
  uploadAnexoDoRegistro,
} from "./materials-actions";

type Anexo = { id: string; title: string; kind: string; content: string; at: string };

/**
 * Anexos de UM item do prontuário: um registro do histórico terapêutico (prints 6.pdf, item 5) ou
 * uma atividade (doc 9) — "incluir botão para anexos em cada inclusão", agora nos dois lugares.
 *
 * Mesmo cofre privado dos demais anexos do prontuário: o paciente não vê. Preso ao item, cai junto
 * quando o item é apagado. Um componente só porque é a mesma tela e a mesma regra — dois iguais
 * divergem na primeira correção que alguém faz num deles.
 */
function Anexos({
  patientId,
  itemId,
  campo,
  carregarItens,
  enviar,
}: {
  patientId: string;
  itemId: string;
  campo: "recordId" | "activityId";
  carregarItens: (id: string) => Promise<Anexo[]>;
  enviar: (fd: FormData) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [itens, setItens] = useState<Anexo[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    setItens(await carregarItens(itemId));
  }, [carregarItens, itemId]);

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
    fd.set(campo, itemId);
    fd.set("file", arquivo);
    iniciar(async () => {
      const r = await enviar(fd);
      if (!r.ok) { setErro(r.error ?? "Não deu para anexar."); return; }
      await carregar();
    });
  }

  /**
   * Doc 63: o ícone de baixar virou IMPRESSORA, e ela faz o que a impressora da área Documentos
   * faz — manda o papel para a impressora, sem passo de download no meio.
   *
   * O arquivo é aberto por `/api/files/<id>/raw`, que o serve pelo nosso domínio: só assim o
   * navegador deixa a página chamar `print()` no que o quadro carregou. Se o visualizador não
   * aceitar imprimir (o Safari do iPhone é o caso), o arquivo abre numa aba e ela imprime de lá —
   * nunca fica sem saída.
   */
  function imprimir(id: string) {
    const url = `/api/files/${id}/raw`;
    const quadro = document.createElement("iframe");
    quadro.setAttribute("aria-hidden", "true");
    quadro.style.cssText = "position:absolute;width:0;height:0;border:0;visibility:hidden";
    const abrirEmAba = () => window.open(url, "_blank", "noopener");
    quadro.onload = () => {
      try {
        quadro.contentWindow?.focus();
        quadro.contentWindow?.print();
      } catch {
        abrirEmAba();
      }
      // O quadro não pode sair antes de a janela de impressão abrir; sai depois, para não acumular.
      setTimeout(() => quadro.remove(), 60_000);
    };
    quadro.onerror = () => { quadro.remove(); abrirEmAba(); };
    quadro.src = url;
    document.body.appendChild(quadro);
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
          <button type="button" onClick={() => imprimir(a.id)} title="Imprimir" aria-label={`Imprimir ${a.title}`} className="p-1 rounded text-primary hover:bg-surface cursor-pointer">
            <Printer className="w-3.5 h-3.5" />
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

/** Anexos de um registro do histórico terapêutico. */
export function AnexosDoRegistro({ patientId, recordId }: { patientId: string; recordId: string }) {
  return (
    <Anexos
      patientId={patientId}
      itemId={recordId}
      campo="recordId"
      carregarItens={listAnexosDoRegistro}
      enviar={uploadAnexoDoRegistro}
    />
  );
}

/** Anexos de uma atividade (doc 9). */
export function AnexosDaAtividade({ patientId, activityId }: { patientId: string; activityId: string }) {
  return (
    <Anexos
      patientId={patientId}
      itemId={activityId}
      campo="activityId"
      carregarItens={listAnexosDaAtividade}
      enviar={uploadAnexoDaAtividade}
    />
  );
}
