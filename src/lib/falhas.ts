import "server-only";
import { db } from "@/db";
import { appFalhas } from "@/db/schema";
import { unstable_rethrow } from "next/navigation";
import { codigoDaFalha, peneirar } from "@/lib/peneiraDeSegredo";

/**
 * ONDE A FALHA FICA REGISTRADA.
 *
 * O problema que isto resolve: uma Server Action que joga exceção derruba a tela num "A server
 * error occurred" genérico, e em produção o Next apaga a mensagem antes de ela chegar ao navegador.
 * Quem usa o app relata "deu erro ao salvar" e não existe de onde tirar o que aconteceu — foi o que
 * custou a investigação do erro relatado no Financeiro, que não reproduziu em nenhum dos cadastros.
 *
 * O `codigo` é o par entre as duas pontas: a tela de erro mostra esses seis caracteres para a
 * pessoa, e eles acham a linha gravada aqui. Esse par só existe porque `registrarFalha` ESCREVE o
 * código no `digest` do erro antes de ele subir — ver o comentário da função.
 */

export { peneirar, codigoDaFalha };

/**
 * Grava a falha, marca o erro com o código e devolve o código.
 *
 * **NUNCA joga**: um erro ao registrar o erro não pode virar o erro que a pessoa vê. Se o banco for
 * justamente o que está fora, sobra só o código na tela — e já é mais do que havia antes.
 *
 * **A marca no `digest` é o que faz o código casar.** O Next calcula o `digest` de um erro como
 * hash da mensagem mais a pilha, e é esse valor que a tela de erro recebe; mas ele RESPEITA um
 * digest já posto no erro (`next/dist/server/app-render/create-error-handler.js`: só calcula no
 * `else` de `if (err.digest)`). Sem esta linha, a tela mostra um hash e o banco guarda outro
 * número, e o código ditado pela pessoa não acha nada — era o estado em que isto nasceu.
 */
export async function registrarFalha(entrada: {
  acao: string;
  erro: unknown;
  userId?: string | null;
  alvo?: string | null;
}): Promise<string> {
  const codigo = codigoDaFalha();
  // Valor jogado que não é objeto (um `throw "texto"`) não tem onde receber a marca: nesse caso o
  // código vive só no banco, e a tela cai no hash do Next.
  if (entrada.erro && typeof entrada.erro === "object") {
    const comDigest = entrada.erro as { digest?: string };
    comDigest.digest ??= codigo;
  }
  try {
    const e = entrada.erro;
    const mensagem = e instanceof Error ? e.message : String(e);
    const pilha = e instanceof Error ? e.stack ?? null : null;
    await db.insert(appFalhas).values({
      userId: entrada.userId ?? null,
      acao: entrada.acao.slice(0, 120),
      alvo: entrada.alvo?.slice(0, 120) ?? null,
      codigo,
      mensagem: peneirar(mensagem, 600) || "(sem mensagem)",
      pilha: peneirar(pilha, 2000) || null,
    });
  } catch { /* o registro é melhor-esforço: ver o comentário acima */ }
  return codigo;
}

/**
 * Embrulha uma ação que devolve `{ ok, error }`: a exceção vira mensagem na tela, com o código.
 *
 * É a diferença entre a pessoa perder o que digitou numa tela branca e ela ler "não deu para
 * salvar (código ABC123)" com o formulário ainda preenchido na frente. Vale para a ação que já
 * conversa por `{ ok, error }`; a que joga (e derruba a tela) é embrulhada com `unstable_rethrow`
 * mais `registrarFalha`, porque ali o `redirect()` também viaja como exceção.
 */
export async function comRegistro<T extends { ok: boolean; error?: string }>(
  entrada: { acao: string; userId?: string | null; alvo?: string | null },
  fn: () => Promise<T>,
): Promise<T | { ok: false; error: string }> {
  try {
    return await fn();
  } catch (erro) {
    // `redirect()` e `notFound()` funcionam JOGANDO: sem esta linha, uma ação que redireciona com
    // sucesso seria registrada como falha e o redirecionamento sumiria dentro do `{ ok: false }`.
    unstable_rethrow(erro);
    const codigo = await registrarFalha({ ...entrada, erro });
    return { ok: false, error: `Não deu para concluir agora. Tente de novo; se repetir, informe o código ${codigo}.` };
  }
}
