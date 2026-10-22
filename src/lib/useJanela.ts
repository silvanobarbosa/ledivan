"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * O FOCO FICA DENTRO DA JANELA ENQUANTO ELA ESTÁ ABERTA.
 *
 * Sem isto, a janela é só um desenho por cima da página: o Tab continua passeando pelos links e
 * botões ATRÁS dela, que o olho não alcança. Quem navega por teclado — ou com leitor de tela —
 * perde a referência do que está ativando, e pode acionar um botão escondido debaixo do painel.
 *
 * Três coisas, e a ordem importa:
 *
 * 1. **Ao abrir**, guarda quem tinha o foco e leva o foco para dentro. Sem este passo o Tab
 *    começaria do topo da página, não da janela.
 * 2. **Enquanto aberta**, o Tab circula: do último elemento volta para o primeiro, e o Shift+Tab
 *    do primeiro vai para o último.
 * 3. **Ao fechar**, devolve o foco a quem o tinha. Quem apertou um botão para abrir volta a esse
 *    botão, em vez de ser jogado no começo da página.
 *
 * Escape continua fechando — é o mesmo hook, porque as duas coisas são a mesma preocupação e
 * separá-las obrigaria toda janela a lembrar de chamar duas.
 *
 * **`fechar` fica numa ref de propósito**, e isto NÃO é detalhe: com ele nas dependências do
 * efeito, uma arrow nova a cada render desinscrevia e reinscrevia o ouvinte a cada render. Como
 * `keydown` é evento DISCRETO, o React descarrega a atualização de forma síncrona dentro do
 * disparo — então fechar a janela de baixo removia o ouvinte da de cima ANTES dele ser chamado, e
 * ouvinte removido durante o disparo não executa. Com duas janelas abertas, um Escape fechava só
 * uma. Medido no navegador, em produção.
 */
export function useJanela<T extends HTMLElement = HTMLDivElement>(
  aberto: boolean,
  fechar: () => void,
): RefObject<T | null> {
  const painel = useRef<T>(null);
  const fecharRef = useRef(fechar);
  // Atualizada DEPOIS do render, não durante: escrever em ref no corpo do componente é o que a
  // regra `react-hooks/refs` proíbe, e com razão — em render concorrente o corpo pode rodar duas vezes.
  useEffect(() => { fecharRef.current = fechar; });

  useEffect(() => {
    if (!aberto) return;

    const anterior = document.activeElement as HTMLElement | null;

    /**
     * O que recebe foco, na ordem do documento.
     *
     * `tabindex="-1"` fica de fora de propósito: ele serve para receber foco por código, não pelo
     * Tab. O painel em si entra na lista por último, como rede — uma janela sem nenhum botão (só
     * texto) precisa de algum lugar onde pousar o foco.
     */
    const focaveis = (): HTMLElement[] => {
      const raiz = painel.current;
      if (!raiz) return [];
      const alvo = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
      return [...raiz.querySelectorAll<HTMLElement>(alvo)].filter((el) => el.offsetParent !== null || el === document.activeElement);
    };

    // O foco entra na janela. `requestAnimationFrame` porque o painel só existe depois da pintura.
    const quadro = requestAnimationFrame(() => {
      const lista = focaveis();
      (lista[0] ?? painel.current)?.focus();
    });

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") { fecharRef.current(); return; }
      if (e.key !== "Tab") return;
      const lista = focaveis();
      if (!lista.length) { e.preventDefault(); painel.current?.focus(); return; }
      const primeiro = lista[0];
      const ultimo = lista[lista.length - 1];
      const atual = document.activeElement;
      // Saiu da janela (ou nunca entrou): traz de volta para a ponta certa.
      if (!painel.current?.contains(atual)) { e.preventDefault(); (e.shiftKey ? ultimo : primeiro).focus(); return; }
      if (!e.shiftKey && atual === ultimo) { e.preventDefault(); primeiro.focus(); }
      else if (e.shiftKey && atual === primeiro) { e.preventDefault(); ultimo.focus(); }
    };

    document.addEventListener("keydown", aoTeclar);
    return () => {
      cancelAnimationFrame(quadro);
      document.removeEventListener("keydown", aoTeclar);
      // Devolve o foco a quem o tinha — se ele ainda estiver na página.
      if (anterior && document.contains(anterior)) anterior.focus();
    };
  }, [aberto]);

  return painel;
}
