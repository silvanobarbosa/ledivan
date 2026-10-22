"use client";

import { useEffect } from "react";

/**
 * ESCAPE FECHA A JANELA.
 *
 * Faltava em todas elas. Quem abriu a pergunta "Abater esta sessão do pacote?" sem querer ficava
 * preso: o fundo fecha no clique, mas a tecla que todo mundo aperta primeiro não fazia nada — e
 * algumas dessas janelas não têm botão de cancelar, só Sim e Não, as duas com consequência em
 * dinheiro. A saída era sair da página.
 *
 * Mora num arquivo próprio, e não junto das medidas em `modal.ts`, porque este é código de cliente:
 * `modal.ts` só exporta texto de classe e pode ser lido por um componente de servidor sem problema.
 *
 * O `keydown` vai no DOCUMENTO porque o foco quase nunca está dentro da janela — ela abre sem
 * mandar o foco para lá, então ouvir só no painel não pegaria a tecla. Prender o foco dentro da
 * janela é outro trabalho, maior, e continua pendente.
 */
export function useFecharComEscape(aberto: boolean, fechar: () => void): void {
  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") fechar(); };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberto, fechar]);
}
