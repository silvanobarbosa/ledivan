import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// TOOLCHAIN: o lint ficou 5 dias sem rodar (saía com exit 2) por duas incompatibilidades
// empilhadas, e ninguém via porque a CI roda um eslint próprio com continue-on-error.
//   1) typescript@7 × @typescript-eslint (nem a 8.70 aceita: peer é <6.1.0) → "reading 'Cjs'"
//   2) eslint@10 × eslint-plugin-react@7.37.5 (peer até ^9.7) → "getFilename is not a function"
// Por isso o package.json fixa typescript ~6.0 e eslint ~9.39. Antes de subir qualquer um dos
// dois, confira o peer do @typescript-eslint e do eslint-plugin-react — subir sozinho quebra
// o lint inteiro em silêncio.

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // O prefixo "_" é a convenção para "existe, mas de propósito não é usado" — parâmetro que a
  // assinatura exige, erro que não interessa no catch, campo descartado numa desestruturação.
  // Sem isto o lint reclamava de código que JÁ estava dizendo a intenção dele.
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
      }],
    },
  },

  // Ferramental (scripts de importação, testes, utilitários de manutenção) não é código de
  // produto: `any` ali é aceitável e estava afogando o sinal — 97 dos 162 erros vinham daqui.
  // Variável de rascunho em script de migração também não é dívida do produto.
  {
    files: ["scripts/**", "src/scripts/**", "tests/**", "**/*.config.*"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },

  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
