"use client";

import { useEffect, useRef } from "react";

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
 * mandar o foco para lá, então ouvir só no painel não pegaria a tecla.
 *
 * **Por que `fechar` fica numa ref, e não nas dependências do efeito.** Com ele nas dependências,
 * uma arrow nova a cada render fazia o efeito desinscrever e reinscrever a cada render — e isso
 * quebrava o caso de DUAS janelas abertas, que é o comum (a janela da falta abre por cima da
 * janela da sessão). O caminho, medido no navegador:
 *
 * 1. Escape chega ao documento; os dois ouvintes estão inscritos.
 * 2. O primeiro roda e fecha a janela de baixo. `keydown` é evento DISCRETO, então o React
 *    descarrega a atualização de forma SÍNCRONA, ainda dentro do disparo.
 * 3. O re-render roda os cleanups. Como `fechar` mudou de identidade, o efeito da janela de cima
 *    também desinscreve — e, pela especificação do DOM, ouvinte removido durante o disparo não é
 *    chamado.
 * 4. A janela de cima fica aberta. Era exatamente o sintoma: um Escape fechava a de baixo e
 *    deixava a da falta na tela.
 *
 * Com a ref, o efeito depende só de `aberto`: ninguém desinscreve por causa de re-render, e as
 * duas fecham no mesmo Escape.
 */
export function useFecharComEscape(aberto: boolean, fechar: () => void): void {
  const fecharRef = useRef(fechar);
  // Atualizada DEPOIS do render, não durante: escrever em ref no corpo do componente é o que a
  // regra `react-hooks/refs` proíbe, e com razão — em render concorrente o corpo pode rodar mais
  // de uma vez. Aqui o efeito sem dependências roda após todo render, que é o que se quer.
  useEffect(() => { fecharRef.current = fechar; });

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") fecharRef.current(); };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberto]);
}
