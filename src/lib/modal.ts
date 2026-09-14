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

/** O de escanear: o primeiro degrau acima da barra. */
export const FLUTUANTE_BAIXO = "fixed right-5 bottom-28 lg:right-10 lg:bottom-10";

/** O de suporte: o degrau de cima, livre do anterior nos dois tamanhos. */
export const FLUTUANTE_ALTO = "fixed right-5 bottom-[11.5rem] lg:right-10 lg:bottom-28";
