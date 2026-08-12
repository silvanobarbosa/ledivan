import OpenAI from "openai";

/**
 * Cliente OpenAI construído sob demanda (lazy).
 *
 * Instanciar `new OpenAI({ apiKey })` no escopo do módulo faz o SDK exigir a chave já no import.
 * No build da Vercel, `next build` importa cada rota para coletar dados — e se `OPENAI_API_KEY`
 * não está naquele ambiente (o preview não recebe envs marcadas só como `production`), o build
 * quebra inteiro com "Missing credentials", mesmo sem ninguém chamar a rota.
 *
 * Adiando a construção para a primeira chamada, o import fica barato: o build passa sem a chave
 * e a exigência só aparece quando a rota é de fato usada, que é quando a chave existe.
 */
let cliente: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!cliente) {
    cliente = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return cliente;
}
