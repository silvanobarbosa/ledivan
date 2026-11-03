/**
 * A TRANSCRIÇÃO POR ARQUIVO DE ÁUDIO — desligada, com o código no lugar (doc 76).
 *
 * O dono circulou o bloco inteiro de "Transcrever sessão (IA)" na guia Registros — escolher
 * arquivo, consentimento, "Gerar evolução", o aviso de 25 MB — e pediu para tirar da tela. O
 * substituto está especificado no mesmo documento: um microfone POR CAMPO, que grava na hora e
 * escreve no campo correspondente. Enquanto esse caminho não está no ar, o antigo sai de vista
 * mas não é apagado: a rota `/api/transcribe` e a tela continuam inteiras, e voltar é trocar
 * este `false` por `true`.
 *
 * Apagar agora custaria reescrever depois para descobrir que a decisão era outra. Esconder atrás
 * de uma constante custa uma linha — e deixa escrito na tela de Ajustes por que o liga/desliga de
 * transcrição não produz mais efeito nenhum.
 */
export const TRANSCRICAO_POR_ARQUIVO_LIGADA = false;
