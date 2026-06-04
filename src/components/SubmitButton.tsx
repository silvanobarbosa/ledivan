"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

type Props = {
  children: React.ReactNode;
  /** Texto/conteúdo exibido durante o envio. Default: "Enviando…" */
  pendingLabel?: React.ReactNode;
  className?: string;
  /** Desabilita mesmo fora do pending (ex.: validação) */
  disabled?: boolean;
};

/**
 * Botão de submit com feedback de clique e loading.
 * Usa useFormStatus → enquanto a server action roda: spinner, texto de
 * progresso, fica desabilitado (evita duplo clique) e some o cursor.
 * Precisa estar dentro de um <form action={...}>.
 */
export function SubmitButton({
  children,
  pendingLabel = "Enviando…",
  className = "",
  disabled,
}: Props) {
  const { pending } = useFormStatus();
  const isOff = pending || disabled;
  return (
    <button
      type="submit"
      disabled={isOff}
      aria-busy={pending}
      className={`${className} active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100`}
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
