"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { salvarContrato } from "@/app/dashboard/patients/actions";

const AUTO_L = "\u0001";
const AUTO_R = "\u0002";

/**
 * O contrato na tela: já preenchido com o que o sistema sabe, e EDITÁVEL para a analista completar os
 * [campos] antes de imprimir. Sem logotipo. O corpo é um `contentEditable`: o que a pessoa digitar
 * sai na impressão.
 *
 * Doc 28: os campos que o SISTEMA preencheu (entre \u0001…\u0002) e os que ainda faltam ([colchetes])
 * saem em negrito; a impressão gera 2 vias (uma de cada parte); há um botão Salvar que guarda o texto
 * editado para este paciente. A impressão usa sempre o que está na tela — salvar ou não não muda isso.
 */
function renderContrato(texto: string) {
  return texto.split(/(\u0001[^\u0002]*\u0002|\[[^\]]+\])/).map((parte, i) => {
    if (parte.startsWith(AUTO_L) && parte.endsWith(AUTO_R)) return <strong key={i}>{parte.slice(1, -1)}</strong>;
    if (parte.startsWith("[") && parte.endsWith("]")) return <strong key={i}>{parte}</strong>;
    return parte;
  });
}

export function ContratoImpresso({ texto, patientId }: { texto: string; patientId: string }) {
  const ref = useRef<HTMLElement>(null);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [salvo, setSalvo] = useState(false);

  function imprimir() {
    // Doc 28: 2 vias (uma de cada parte). A cópia espelha o que está editado na tela na hora de imprimir.
    const copia = document.getElementById("contrato-copia");
    if (copia && ref.current) copia.innerHTML = ref.current.innerHTML;
    window.print();
  }

  function salvar() {
    const t = ref.current?.innerText ?? "";
    start(async () => {
      const r = await salvarContrato(patientId, t);
      if (r.ok) { setSalvo(true); router.refresh(); setTimeout(() => setSalvo(false), 2500); }
    });
  }

  return (
    <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
      <nav className="no-print">
        <Link href={`/dashboard/patients/${patientId}`} className="text-sm text-foreground/60 hover:text-foreground">
          ← voltar para o paciente
        </Link>
      </nav>

      <ul className="no-print rounded-xl border border-border bg-surface px-4 py-3 pl-7 text-sm text-foreground/60 space-y-2 list-disc">
        <li>O contrato será preenchido automaticamente com os dados cadastrados do paciente e as informações do profissional definidas em <Link href="/dashboard/settings" className="underline font-semibold">Ajustes</Link>. Clique no texto para preencher os campos entre colchetes. Após concluir as edições, basta imprimir o contrato.</li>
        <li>Ao clicar em Imprimir, são impressas 2 vias do documento, uma para cada parte. Todas as alterações realizadas no contrato serão refletidas na impressão, independentemente de serem salvas ou não.</li>
        <li>O botão Salvar guarda apenas a alteração do contrato deste paciente, não a de todos.</li>
      </ul>

      {/* O papel editável. Sem logotipo, como os outros documentos. Alinhamento justificado (doc 28). */}
      <article
        id="contrato-papel"
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className="bg-white border border-border rounded-2xl p-6 sm:p-10 outline-none focus:ring-2 focus:ring-primary/30 whitespace-pre-wrap text-justify font-sans text-[15px] leading-relaxed text-foreground print:border-0 print:rounded-none print:p-0"
      >
        {renderContrato(texto)}
      </article>

      {/* 2ª via (só impressão): preenchida a partir da 1ª no momento de imprimir. */}
      <article id="contrato-copia" aria-hidden className="hidden print:block whitespace-pre-wrap text-justify font-sans text-[15px] leading-relaxed text-foreground" />

      <div className="no-print flex flex-wrap items-center gap-3">
        <button onClick={imprimir} className="bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-sm cursor-pointer">
          Imprimir
        </button>
        <button onClick={salvar} disabled={pending} className="bg-surface border border-border px-5 py-2.5 rounded-xl font-bold text-sm text-foreground disabled:opacity-60 cursor-pointer">
          {pending ? "Salvando…" : "Salvar"}
        </button>
        {salvo && <span className="text-sm text-[#047857] font-semibold">salvo ✓</span>}
      </div>

      <style>{`
        @page { margin: 20mm; }
        @media print {
          .no-print { display: none !important; }
          body * { visibility: hidden; }
          #contrato-papel, #contrato-papel *, #contrato-copia, #contrato-copia * { visibility: visible; }
          /* As duas vias no fluxo, a 2ª começando em nova página. (body * escondido deixa só estas.) */
          #contrato-papel { width: 100%; }
          #contrato-copia { display: block !important; width: 100%; break-before: page; }
        }
      `}</style>
    </main>
  );
}
