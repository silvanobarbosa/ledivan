"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { marcarEmissao } from "../../recibo-actions";

/**
 * O recibo na tela, pronto para conferir e imprimir.
 *
 * Duas coisas que o documento pediu e que o desenho respeita: **sem logotipo** do sistema, e a
 * emissão só é marcada quando a terapeuta diz que emitiu — imprimir é dela, o registro é nosso.
 *
 * O aviso do que falta (nome, CPF) aparece ANTES do papel: um recibo sem o CPF do terapeuta é um
 * documento incompleto, e descobrir isso depois de entregar ao paciente é tarde.
 */
export function ReciboImpresso({
  texto,
  patientId,
  pagamentoId,
  faltando,
  semDatasDeSessao,
}: {
  texto: string;
  patientId: string;
  pagamentoId: string;
  faltando: string[];
  semDatasDeSessao: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const marcar = () =>
    start(async () => {
      await marcarEmissao({ pagamentoId, patientId, tipo: "recibo" });
      router.refresh();
    });

  return (
    <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
      <nav className="no-print">
        <Link href={`/dashboard/patients/${patientId}`} className="text-sm text-foreground/60 hover:text-foreground">
          ← voltar para o paciente
        </Link>
      </nav>

      {faltando.length > 0 && (
        <p className="no-print rounded-xl border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-sm text-[#92400e]">
          Falta {faltando.join(" e ")} no cadastro. O recibo sai sem essa informação — preencha em{" "}
          <Link href="/dashboard/settings" className="underline font-semibold">Ajustes</Link> e volte aqui.
        </p>
      )}

      {semDatasDeSessao && (
        <p className="no-print rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground/60">
          Este pagamento não está preso a uma sessão específica, então o recibo traz a data do
          pagamento. Confira se é o que você quer declarar.
        </p>
      )}

      {/* O papel. Sem logotipo, como o documento pede. */}
      <article className="bg-white border border-border rounded-2xl p-6 sm:p-10 print:border-0 print:rounded-none print:p-0">
        <pre className="whitespace-pre-wrap font-sans text-[15px] leading-relaxed text-foreground">{texto}</pre>
      </article>

      <div className="no-print flex flex-wrap items-center gap-3">
        <button onClick={() => window.print()} className="bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-sm">
          Imprimir
        </button>
        <button onClick={marcar} disabled={pending} className="border border-border px-5 py-2.5 rounded-xl font-bold text-sm disabled:opacity-60">
          {pending ? "Marcando…" : "Marcar como emitido"}
        </button>
        <span className="text-xs text-foreground/50">
          Marcar registra a emissão ao lado do pagamento; imprimir é com você.
        </span>
      </div>

      <style>{`@media print { .no-print { display: none !important; } }`}</style>
    </main>
  );
}
