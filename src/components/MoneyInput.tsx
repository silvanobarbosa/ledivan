"use client";

import { useState } from "react";
import { parseMoedaBR } from "@/lib/money";

/**
 * Campo de dinheiro que já mostra R$ enquanto se digita (dono, 16/09/2026). Trata os dígitos como
 * centavos e formata em pt-BR; envia o texto formatado, que o servidor parseia por `parseMoedaBR`.
 *
 * Compartilhado (cadastro de paciente e prospecção, doc 19). O `className` entra de fora para o
 * campo herdar o estilo da tela onde está.
 */
export function MoneyInput({ name, defaultValue, placeholder, className }: {
  name: string; defaultValue?: string | number | null; placeholder?: string; className?: string;
}) {
  const fmt = (centavos: number) => (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const inicial = (() => {
    const canon = parseMoedaBR(defaultValue);
    if (!canon) return "";
    const centavos = Math.round(Number(canon) * 100);
    return centavos > 0 ? fmt(centavos) : "";
  })();
  const [val, setVal] = useState(inicial);
  return (
    <input
      name={name}
      inputMode="numeric"
      value={val}
      onChange={(e) => {
        const digitos = e.target.value.replace(/\D/g, "");
        setVal(digitos ? fmt(parseInt(digitos, 10)) : "");
      }}
      className={className}
      placeholder={placeholder}
    />
  );
}
