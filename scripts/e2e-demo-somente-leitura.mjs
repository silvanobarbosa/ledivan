// A CONTA DE DEMONSTRAÇÃO CONTINUA SOMENTE LEITURA, ENTRE POR ONDE ENTRAR (13/11/2026).
//
// A senha do Dr. Sócrates está no repositório de propósito — é uma conta pública de demonstração —
// e o repositório é público. O que impede um visitante de ESTRAGAR a conta que todo prospecto vê é
// um claim só: `demo` no token. O proxy recusa escrita quando ele está lá.
//
// O furo: o claim era posto à mão em cada porta, e o login por SENHA do site não o punha. Entrar
// pelo site com a senha publicada devolvia sessão de ESCRITA.
//
// Este percurso entra pela porta do furo e cobra as duas coisas: a marca no token, e a recusa de
// uma escrita de verdade. Teste de unidade não alcança isso — o claim atravessa HTTP, cookie e
// proxy, e é no meio do caminho que ele se perdia.
//
// Uso: npm run build && npm start, depois `node scripts/e2e-demo-somente-leitura.mjs`.

import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

const BASE = process.env.BASE_URL || "http://localhost:3000";
// Credenciais PÚBLICAS da conta de demonstração (src/scripts/seedSocrates.ts). Não são segredo:
// é a conta que o botão "Experimentar" abre para qualquer visitante.
const DEMO_EMAIL = "socrates@ledivan.com.br";
const DEMO_SENHA = "demo-ledivan";

let falhas = 0;
const check = (nome, ok, detalhe = "") => {
  console.log(`${ok ? "  ok  " : "FALHA "} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  if (!ok) falhas++;
};

/** Lê o miolo do JWT sem verificar assinatura: aqui interessa o CONTEÚDO dos claims. */
const claims = (jwt) => {
  try {
    return JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
};

try {
  const r = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_SENHA }),
  });
  check("o login por senha do site aceita a conta de demonstração", r.ok, `status ${r.status}`);

  const cookie = (r.headers.get("set-cookie") ?? "").split(";")[0];
  const token = cookie.replace(/^auth-session=/, "");
  check("a resposta traz o cookie de sessão", token.length > 20);

  const c = claims(token);
  check("o token carrega a marca de demonstração", c?.demo === true, JSON.stringify(c));

  /**
   * E a prova que importa: uma ESCRITA de verdade. Sem a marca, o proxy deixa passar e a conta
   * que todo visitante vê fica editável. Qualquer rota de escrita serve; esta não altera nada
   * quando é recusada, que é o esperado.
   */
  const escrita = await fetch(`${BASE}/api/agent/heartbeat`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ source: "e2e", status: "up" }),
  });
  check("o proxy recusa a escrita (403)", escrita.status === 403, `status ${escrita.status}`);
  const corpo = await escrita.text();
  check("e diz por quê, em português", /somente leitura/i.test(corpo), corpo.slice(0, 90));
} catch (e) {
  console.error("\nERRO NO PERCURSO:", e?.message ?? e);
  falhas++;
} finally {
  console.log(falhas ? `\n${falhas} FALHA(S)` : "\ntudo certo");
  process.exit(falhas ? 1 : 0);
}
