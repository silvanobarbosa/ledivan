/**
 * ABRIR A CONVERSA NO APLICATIVO DO COMPUTADOR (doc 63).
 *
 * `wa.me` é o endereço certo no CELULAR: o sistema entrega o link ao WhatsApp instalado e a conversa
 * abre pronta. No computador, o mesmo link cai numa página da Meta com dois botões ("Abrir app" /
 * "Continuar para o WhatsApp Web") — foi o que a dona relatou: ela cobra do notebook e a conversa
 * não chega ao WhatsApp Business dela.
 *
 * O caminho direto é o esquema `whatsapp://`, que o Windows entrega ao WhatsApp instalado (seja o
 * comum, seja o Business — quem decide é o registro do sistema, não o app; não existe esquema
 * separado para o Business).
 *
 * Como não há como saber, pelo navegador, se o esquema foi atendido, o endereço da WEB continua à
 * mão na confirmação de envio ("Não abriu? Abrir no WhatsApp Web"). Sem essa saída, um computador
 * sem o aplicativo instalado ficaria sem nenhum caminho.
 *
 * Funções puras; quem abre é o chamador.
 */

/** `https://wa.me/5511…?text=oi` → `whatsapp://send?phone=5511…&text=oi`. Null quando não é wa.me. */
export function urlDoAplicativo(urlWeb: string | null | undefined): string | null {
  if (!urlWeb) return null;
  const m = /^https:\/\/wa\.me\/(\d+)(?:\?text=(.*))?$/.exec(urlWeb.trim());
  if (!m) return null;
  const texto = m[2] ? `&text=${m[2]}` : "";
  return `whatsapp://send?phone=${m[1]}${texto}`;
}

/**
 * É um computador?
 *
 * Pelo PONTEIRO, não pelo texto do navegador: `matchMedia("(pointer: coarse)")` é verdadeiro em
 * celular e tablet (dedo) e falso no computador (mouse). A string do navegador mente há anos — o
 * iPad se diz Macintosh — e aqui errar significa abrir a tela errada para cobrar.
 */
export function ehComputador(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  try {
    return !window.matchMedia("(pointer: coarse)").matches;
  } catch {
    return false; // navegador sem suporte: cai no caminho da web, que funciona em todo lugar
  }
}

/**
 * Abre a conversa: no computador, pelo aplicativo; no celular, pelo `wa.me`.
 *
 * Devolve o endereço da WEB sempre que houver um — é ele que a confirmação oferece como saída
 * quando o aplicativo não abre.
 */
export function abrirWhatsapp(urlWeb: string | null | undefined): string | null {
  if (!urlWeb) return null;
  const app = ehComputador() ? urlDoAplicativo(urlWeb) : null;
  if (app) window.location.href = app;
  else window.open(urlWeb, "_blank", "noopener");
  return urlWeb;
}
