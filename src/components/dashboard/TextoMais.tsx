"use client";

import { useState, type ReactNode } from "react";

/**
 * Texto com [Mais…] / [Menos…] (doc 45): mostra só o `resumo`; ao clicar em [Mais…] expande o
 * `detalhe` (mesma formatação) e o gatilho vira [Menos…]. Recolhe de volta no [Menos…].
 */
export function TextoMais({ resumo, detalhe, className }: { resumo: ReactNode; detalhe: ReactNode; className?: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <p className={className ?? "text-xs text-foreground/60 text-justify"}>
      {resumo}{" "}
      {aberto && <>{detalhe}{" "}</>}
      <button type="button" onClick={() => setAberto((v) => !v)} className="font-semibold text-primary hover:underline whitespace-nowrap">
        {aberto ? "[Menos…]" : "[Mais…]"}
      </button>
    </p>
  );
}
