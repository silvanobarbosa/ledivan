"use client";

import Link from "next/link";

/**
 * O contrato na tela: já preenchido com o que o sistema sabe, e EDITÁVEL para a analista completar os
 * [campos] antes de imprimir (doc 9, menu Contratos — "preencher e imprimir", como o recibo). Sem
 * logotipo. O corpo é um `contentEditable`: o que a pessoa digitar sai na impressão.
 */
export function ContratoImpresso({ texto, patientId }: { texto: string; patientId: string }) {
  return (
    <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
      <nav className="no-print">
        <Link href={`/dashboard/patients/${patientId}`} className="text-sm text-foreground/60 hover:text-foreground">
          ← voltar para o paciente
        </Link>
      </nav>

      <p className="no-print rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground/60">
        O contrato já vem preenchido com o que está no cadastro e nos Ajustes. Clique no texto para
        completar os campos entre colchetes (endereço, chave PIX, horário…) e depois imprima. Os dados
        fixos da analista ficam em <Link href="/dashboard/settings" className="underline font-semibold">Ajustes</Link>.
      </p>

      {/* O papel editável. Sem logotipo, como os outros documentos. */}
      <article
        id="contrato-papel"
        contentEditable
        suppressContentEditableWarning
        className="bg-white border border-border rounded-2xl p-6 sm:p-10 outline-none focus:ring-2 focus:ring-primary/30 whitespace-pre-wrap font-sans text-[15px] leading-relaxed text-foreground print:border-0 print:rounded-none print:p-0"
      >
        {texto}
      </article>

      <div className="no-print flex flex-wrap items-center gap-3">
        <button onClick={() => window.print()} className="bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-sm">
          Imprimir
        </button>
        <span className="text-xs text-foreground/50">Imprimir gera 2 vias (uma de cada parte). O que você editar acima sai no papel.</span>
      </div>

      <style>{`
        @page { margin: 20mm; }
        @media print {
          .no-print { display: none !important; }
          body * { visibility: hidden; }
          #contrato-papel, #contrato-papel * { visibility: visible; }
          #contrato-papel { position: absolute; inset: 0 auto auto 0; width: 100%; }
        }
      `}</style>
    </main>
  );
}
