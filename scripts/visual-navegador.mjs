// De onde sai o Chromium para os harnesses visuais.
//
// O projeto NÃO tem playwright como dependência, de propósito: são ~300MB de navegador para uma
// ferramenta de conferência local, que nunca roda em CI. Então tentamos, em ordem:
//   1. um `playwright` instalado no projeto (se alguém adicionar, passa a valer);
//   2. o playwright que vem embutido no pacote global @playwright/mcp.
//
// Se nenhum dos dois existir, o erro diz o que instalar em vez de estourar um MODULE_NOT_FOUND.

import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);

const CAMINHOS = [
  "playwright",
  "C:/Users/User/AppData/Roaming/npm/node_modules/@playwright/mcp/node_modules/playwright",
];

export function abrirPlaywright() {
  for (const caminho of CAMINHOS) {
    try {
      return require_(caminho);
    } catch {
      // tenta o próximo
    }
  }
  throw new Error(
    "Playwright não encontrado. Instale com `npm i -D playwright && npx playwright install chromium` " +
      "ou globalmente com `npm i -g @playwright/mcp`.",
  );
}

/** Corre `promessa` com prazo. Sem isso, imagem que nunca carrega pendura o harness inteiro. */
export const comPrazo = (promessa, ms, oque) =>
  Promise.race([
    promessa,
    new Promise((_, rej) => setTimeout(() => rej(new Error("prazo estourado: " + oque)), ms)),
  ]);
