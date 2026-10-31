"use client";

import { useState } from "react";
import { mascaraMoeda } from "@/lib/mascaraMoeda";
import { parseMoedaBR } from "@/lib/money";

/**
 * Campo de dinheiro que já mostra R$ enquanto se digita (dono, 16/09/2026).
 *
 * A REGRA de formatação mora em `mascaraMoeda`, não aqui. Ela nasceu duplicada: o doc 57 pediu a
 * máscara na janela do valor da falta, que é um campo CONTROLADO dentro de um modal, e este
 * componente não servia lá — ele guarda o próprio estado e se identifica por `name`, como campo de
 * formulário. Duas formas de campo, uma regra só; duas regras seria o caminho para elas divergirem
 * num detalhe de centavo e ninguém perceber.
 *
 * O `className` entra de fora para o campo herdar o estilo da tela onde está.
 */
export function MoneyInput({ name, defaultValue, placeholder, className, required, onValueChange }: {
  name: string; defaultValue?: string | number | null; placeholder?: string; className?: string; required?: boolean;
  /** Avisa quem está de fora a cada tecla — o formulário precisa saber se o VALOR mudou (doc 69). */
  onValueChange?: (valor: string) => void;
}) {
  const inicial = (() => {
    const canon = parseMoedaBR(defaultValue);
    if (!canon || Number(canon) <= 0) return "";
    return mascaraMoeda(String(Math.round(Number(canon) * 100)));
  })();
  const [val, setVal] = useState(inicial);
  return (
    <input
      name={name}
      inputMode="numeric"
      required={required}
      value={val}
      onChange={(e) => {
        const v = mascaraMoeda(e.target.value);
        setVal(v);
        onValueChange?.(v);
      }}
      className={className}
      placeholder={placeholder ?? "R$ 0,00"}
    />
  );
}
