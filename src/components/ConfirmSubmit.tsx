"use client";

import type { ReactNode } from "react";

/**
 * Botão de submit que pede confirmação antes de enviar o form (doc 42: toda exclusão confirma).
 * Serve dentro de forms de Server Component, onde onSubmit do form não é possível — o clique é
 * tratado no cliente e cancela o envio se a pessoa não confirmar.
 */
export function ConfirmSubmit({ message, title, className, children }: {
  message: string;
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      title={title}
      className={className}
      onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}
    >
      {children}
    </button>
  );
}
