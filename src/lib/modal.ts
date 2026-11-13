/**
 * AS MEDIDAS DE UMA JANELA QUE CABE NA TELA.
 *
 * Uma beta tester relatou não conseguir ver a janela inteira no celular nem rolando até o fim.
 * Eram dois problemas somados, e nenhum aparece no computador:
 *
 * 1. **A barra de navegação de baixo pinta por cima.** Ela é `fixed` no `z-50`, e as janelas
 *    estavam no mesmo `z-50`. Empate de camada resolve pela ordem do documento, e a barra é
 *    desenhada depois — então o botão de salvar ficava atrás dela, visível e inclicável.
 * 2. **A janela não tinha teto de altura.** Sem teto, o conteúdo cresce além da tela e o excesso
 *    fica fora de alcance: a página não rola porque a janela é `fixed`, e a janela não rola porque
 *    ninguém mandou.
 *
 * As medidas ficam aqui, num lugar só, porque o app tem uma dúzia de janelas e a próxima nasceria
 * com o mesmo defeito se cada uma escolhesse a sua.
 *
 * `dvh` em vez de `vh` de propósito: no celular a barra do navegador aparece e some, e `vh` mede a
 * tela como se ela nunca estivesse lá — o que corta justamente o rodapé da janela.
 */

/** O fundo escuro e o alinhamento. Reserva embaixo o espaço da barra de navegação. */
export const FUNDO_DA_JANELA =
  "fixed inset-0 z-[70] flex items-center justify-center bg-black/30 p-4 pb-28 lg:pb-4";

/** O painel branco: nunca maior que a tela, e rola por dentro quando o conteúdo passa. */
export const PAINEL_DA_JANELA =
  "bg-white rounded-[28px] w-full max-h-[calc(100dvh-9rem)] lg:max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain shadow-2xl";

/** O painel com o respiro interno padrão. A maioria das janelas usa este. */
export const JANELA = `${PAINEL_DA_JANELA} p-6 space-y-4`;

/**
 * ONDE FICAM OS BOTÕES FLUTUANTES.
 *
 * Medido, não estimado: no celular a barra de navegação tem **96px** de altura — bem mais do que
 * os ~70 que se imagina olhando. O botão de suporte estava a 20px do fundo, dentro dela e do lado
 * direito, bem onde fica o último item ("Ajustes").
 *
 * E há DOIS flutuantes disputando o mesmo canto: o suporte e o de escanear recibo. Eles se
 * cruzavam também no computador, onde a barra nem existe — ninguém tinha relatado porque o de cima
 * ainda era clicável, e o de baixo simplesmente não recebia o toque.
 *
 * A saída é empilhar, com as alturas saindo daqui. Cada um escolhendo a sua é como os dois
 * acabaram no mesmo lugar.
 */

/**
 * Doc 64: NO CELULAR, dois destes saem do canto e sobem para a barra do topo.
 *
 * A pilha resolvia a briga entre eles, mas não o problema maior: três círculos empilhados sobre a
 * direita de uma tela de 390px cobrem justamente onde os formulários põem os campos e o botão
 * Salvar. Na barra do topo eles ficam sempre à mão e não tapam nada.
 *
 * No computador a tela sobra e eles continuam flutuando, como estavam — é por isso que as classes
 * de posição ficam todas com prefixo `lg:` daqui para baixo.
 */

/** O de escanear: na barra do topo no celular; o primeiro degrau do canto no computador. */
export const FLUTUANTE_BAIXO = "lg:fixed lg:right-10 lg:bottom-10";

/** O de suporte: continua flutuando nos dois tamanhos — é o único que leva rótulo, não é círculo. */
export const FLUTUANTE_ALTO = "fixed right-5 bottom-28 lg:right-10 lg:bottom-28";

/**
 * O do Divã: na barra do topo no celular; o degrau de cima do canto no computador.
 *
 * A medida do computador sai da mesma régua dos outros dois — a diferença entre `bottom-28` (7rem)
 * e `bottom-[11.5rem]` é de 4.5rem, e este degrau repete o espaço. Escolher uma altura "que parece
 * boa" é exatamente como os dois primeiros acabaram em cima um do outro.
 */
export const FLUTUANTE_DIVA = "lg:fixed lg:right-10 lg:bottom-[11.5rem]";
