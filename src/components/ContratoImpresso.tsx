"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { salvarContrato } from "@/app/dashboard/patients/actions";
import { photoSrc } from "@/lib/photo";

const AUTO_L = "\u0001";
const AUTO_R = "\u0002";

/**
 * Logotipo do documento (doc 32): a imagem anexada em Ajustes, CENTRALIZADA e ACIMA do título, no
 * fluxo do papel (não mais no canto). Abaixo dela, duas quebras de linha antes do título — é o espaço
 * do `mb`. Sem imagem, não ocupa linha nenhuma.
 */
function LogoCentral({ logoUrl }: { logoUrl?: string | null }) {
  if (!logoUrl) return null;
  return (
    <div className="doc-logo flex justify-center mb-12">
      {/* eslint-disable-next-line @next/next/no-img-element -- logo em blob URL; não passa pelo otimizador e precisa sair na impressão. */}
      <img src={photoSrc(logoUrl) ?? undefined} alt="" className="h-[3cm] w-auto max-w-[8cm] object-contain" />
    </div>
  );
}

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

export function ContratoImpresso({ texto, textoPadrao, patientId, logoUrl }: { texto: string; textoPadrao?: string; patientId: string; logoUrl?: string | null }) {
  const ref = useRef<HTMLElement>(null);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [salvo, setSalvo] = useState(false);
  // Doc 30: Restaurar volta o texto ao modelo padrão do sistema. O `conteudo` é o que o papel mostra;
  // `versao` força o remonte do contentEditable (ele é não-controlado — só re-renderiza trocando a key).
  const [conteudo, setConteudo] = useState(texto);
  const [versao, setVersao] = useState(0);
  const padrao = textoPadrao ?? texto;

  function imprimir() {
    // Doc 33: via ÚNICA. Quantas cópias sair é escolha do usuário na própria caixa de impressão.
    window.print();
  }

  function salvar() {
    const t = ref.current?.innerText ?? "";
    start(async () => {
      const r = await salvarContrato(patientId, t);
      if (r.ok) { setSalvo(true); router.refresh(); setTimeout(() => setSalvo(false), 2500); }
    });
  }

  function restaurar() {
    // Volta o papel ao modelo padrão e limpa o contrato salvo deste paciente (texto vazio = override nulo).
    setConteudo(padrao);
    setVersao((v) => v + 1);
    start(async () => { await salvarContrato(patientId, ""); router.refresh(); });
  }

  return (
    <main id="contrato-root" className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
      <nav className="no-print">
        <Link href={`/dashboard/patients/${patientId}`} className="text-sm text-foreground/60 hover:text-foreground">
          ← voltar para o paciente
        </Link>
      </nav>

      <ul className="no-print rounded-xl border border-border bg-surface px-4 py-3 pl-7 text-sm text-foreground/60 space-y-2 list-disc">
        <li>O contrato será preenchido automaticamente com os dados cadastrados do paciente e as informações do profissional definidas em <Link href="/dashboard/settings" className="underline font-semibold">Ajustes</Link>. Clique no texto para preencher os campos entre colchetes. Após concluir as edições, basta imprimir o contrato.</li>
        <li>Ao clicar em Imprimir, sai uma via do documento. Se quiser mais de uma cópia, defina a quantidade na própria caixa de impressão. Todas as alterações feitas no contrato saem na impressão, salvas ou não.</li>
        <li>O botão Salvar guarda apenas a alteração do contrato deste paciente, não a de todos.</li>
      </ul>

      {/* O papel editável. Logotipo (doc 32) centralizado ACIMA do título. Justificado (doc 28).
          Doc 33: via única — a 2ª via saiu. */}
      <div id="contrato-wrap" className="bg-white border border-border rounded-2xl p-6 sm:p-10 print:border-0 print:rounded-none print:p-0">
        <LogoCentral logoUrl={logoUrl} />
        <article
          key={versao}
          id="contrato-papel"
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          className="outline-none focus:ring-2 focus:ring-primary/30 rounded-lg whitespace-pre-wrap text-justify font-sans text-[15px] leading-relaxed text-foreground"
        >
          {renderContrato(conteudo)}
        </article>
      </div>

      <div className="no-print flex flex-wrap items-center gap-3">
        <button onClick={imprimir} className="bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-sm cursor-pointer">
          Imprimir
        </button>
        <button onClick={salvar} disabled={pending} className="bg-surface border border-border px-5 py-2.5 rounded-xl font-bold text-sm text-foreground disabled:opacity-60 cursor-pointer">
          {pending ? "Salvando…" : "Salvar"}
        </button>
        {/* Doc 30: ao lado do Salvar — volta o contrato ao modelo padrão do sistema. */}
        <button onClick={restaurar} disabled={pending} className="border border-border px-5 py-2.5 rounded-xl font-semibold text-sm text-foreground/70 hover:text-foreground disabled:opacity-60 cursor-pointer">
          Restaurar contrato
        </button>
        {salvo && <span className="text-sm text-[#047857] font-semibold">salvo ✓</span>}
      </div>

      <style>{`
        @page { margin: 20mm; }
        @media print {
          .no-print { display: none !important; }
          body * { visibility: hidden; }
          #contrato-papel, #contrato-papel *, .doc-logo, .doc-logo * { visibility: visible; }
          #contrato-papel { width: 100%; }
          /* Doc 33: sem recuo herdado no topo — o papel (com o logo) começa colado à margem da
             página, sem o vão que o padding/space-y da tela deixava. */
          #contrato-root { padding: 0 !important; }
          #contrato-wrap { margin-top: 0 !important; }
        }
      `}</style>
    </main>
  );
}
