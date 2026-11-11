"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
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
 * O anexo é uma IMAGEM? (doc 64)
 *
 * Decide por qual caminho a impressão vai, e as duas naturezas que o upload aceita se comportam de
 * forma diferente: imagem o navegador desenha dentro da nossa página, PDF não. Olha a extensão do
 * nome e, na falta dela, a do arquivo guardado — é o que temos; o tipo MIME não é gravado.
 */
function ehImagem(a: Anexo): boolean {
  const alvo = `${a.title} ${a.content}`.toLowerCase();
  return /\.(jpe?g|png|webp|gif|bmp|avif)(\?|$|\s)/.test(alvo);
}

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
  // Doc 64: o bloco de impressão da imagem, no molde do da área Documentos.
  const [montado, setMontado] = useState(false);
  const [printAnexo, setPrintAnexo] = useState<Anexo | null>(null);
  const [printNonce, setPrintNonce] = useState(0);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMontado(true); }, []);

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
   * Doc 64: a IMAGEM imprime como a área Documentos imprime.
   *
   * O quadro escondido (doc 63) manda o `print()` para OUTRO documento, e no celular isso não abre
   * a janela de Cancelar/Imprimir — foi o que a dona viu. O caminho que abre é o mesmo dos
   * documentos: desenhar o que se quer imprimir num bloco da PRÓPRIA página e chamar
   * `window.print()`. Um nonce dispara, e o bloco não é desmontado antes da captura (no celular o
   * `print()` não trava a execução).
   *
   * PDF segue pelo caminho antigo: navegador de celular não desenha PDF dentro da página, então
   * não há como pôr o arquivo no nosso bloco — ele abre no visualizador, que tem a impressão dele.
   */
  function imprimir(a: Anexo) {
    if (ehImagem(a)) {
      setPrintAnexo(a);
      setPrintNonce((n) => n + 1);
      return;
    }
    const id = a.id;
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
          <button type="button" onClick={() => imprimir(a)} title="Imprimir" aria-label={`Imprimir ${a.title}`} className="p-1 rounded text-primary hover:bg-surface cursor-pointer">
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

      {/* Doc 64: o bloco que vai para o papel. Mesmo molde do da área Documentos — portal no body,
          escondido na tela, visível só na impressão. A impressão é disparada no `onLoad` da imagem:
          chamar `print()` antes de ela carregar imprime uma folha em branco. */}
      {montado && printAnexo && createPortal(
        <div id="anexo-print-root">
          <style>{`
            #anexo-print-root { display: none; }
            @media print {
              @page { margin: 12mm; }
              body > *:not(#anexo-print-root) { display: none !important; }
              #anexo-print-root { display: block !important; }
              /* A tela do paciente injeta um "body * { visibility: hidden }" para imprimir só o
                 Controle, e ele vale em qualquer aba. Sem reverter aqui, o anexo sai em branco. */
              #anexo-print-root, #anexo-print-root * { visibility: visible !important; }
            }
          `}</style>
          {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido pela nossa rota, sem otimização do Next */}
          <img
            key={printNonce}
            src={`/api/files/${printAnexo.id}/raw`}
            alt={printAnexo.title}
            onLoad={() => window.print()}
            style={{ maxWidth: "100%", display: "block", margin: "0 auto" }}
          />
        </div>,
        document.body,
      )}
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
