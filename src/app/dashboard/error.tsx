"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCw } from "lucide-react";

/**
 * A TELA DE QUANDO ALGO QUEBRA (doc 64).
 *
 * Até aqui o app não tinha nenhuma: qualquer exceção numa Server Action ou no render de uma página
 * entregava a tela crua do navegador — "This page couldn't load. A server error occurred." —, em
 * inglês, sem dizer o que falhou, sem código e sem caminho de volta. Foi o que a dona fotografou.
 *
 * Esta tela não conserta o erro; ela devolve três coisas que faltavam: o aviso de que o que estava
 * sendo salvo PODE não ter sido salvo, um botão para tentar de novo sem perder a navegação, e o
 * código do `digest` — que é o mesmo gravado em `app_falhas` e o que liga o relato à causa.
 */
export default function ErroDoDashboard({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // O console do navegador é o único lugar onde o erro completo existe no computador dela; em
    // produção o Next já redigiu a mensagem, então aqui costuma sobrar só o digest.
    console.error("Falha no dashboard:", error);
  }, [error]);

  return (
    <div className="max-w-xl mx-auto px-6 py-16 text-center space-y-5">
      <div className="w-14 h-14 rounded-2xl bg-[#fee2e2] text-[#b91c1c] flex items-center justify-center mx-auto">
        <AlertTriangle className="w-7 h-7" />
      </div>
      <h2 className="text-2xl font-display font-bold text-primary">Não deu para concluir</h2>
      <p className="text-foreground/60">
        Algo falhou no meio do caminho. <strong>Confira se o que você estava salvando foi mesmo gravado</strong> antes
        de digitar de novo.
      </p>
      {error.digest && (
        <p className="text-sm text-foreground/50">
          Código da falha: <span className="font-mono font-bold text-foreground/70">{error.digest}</span>
        </p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 bg-primary text-white px-5 py-3 rounded-2xl font-bold cursor-pointer"
        >
          <RotateCw className="w-4 h-4" /> Tentar de novo
        </button>
        <Link href="/dashboard" className="px-5 py-3 rounded-2xl font-semibold text-foreground/60 hover:bg-surface transition">
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
