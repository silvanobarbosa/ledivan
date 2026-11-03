import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, loginCodes } from "@/db/schema";
import { rateLimit } from "@/lib/rateLimit";
import { gerarCodigo, hashDoCodigo, mensagemDoCodigo, VALIDADE_MS } from "@/lib/codigoDeAcesso";
import { enviarCodigoPorEmail, enviarCodigoPorTelegram } from "@/lib/envioDoCodigo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PEDE O CÓDIGO DE ACESSO (doc 55) — entrar só com e-mail, sem senha.
 *
 * **A resposta é SEMPRE a mesma**, exista a conta ou não. Dizer "e-mail não cadastrado" entrega
 * de graça a lista de quem usa o sistema — e, num app de consultório, isso é informação sobre
 * pessoas, não sobre software.
 *
 * O código vai por TODOS os canais que a conta tem (e-mail e Telegram, se vinculado). Perguntar
 * antes "por onde quer receber?" obrigaria a responder quais canais existem naquela conta, que é
 * a mesma fuga por outro caminho.
 */
export async function POST(req: Request) {
  let corpo: { email?: string };
  try { corpo = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  const email = String(corpo.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: false, error: "Informe o seu e-mail." }, { status: 400 });
  }

  /**
   * Dois limites, os dois fail-closed: por IP (o por e-mail é burlável variando o endereço) e
   * por e-mail (senão alguém usa o app para encher a caixa de outra pessoa).
   */
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "ip-desconhecido";
  if (!(await rateLimit(ip, "codigo-pedir-ip", 20, 600, { failClosed: true }))) {
    return NextResponse.json({ ok: true });
  }
  if (!(await rateLimit(`codigo-pedir:${email}`, "codigo-pedir", 3, 600, { failClosed: true }))) {
    return NextResponse.json({ ok: true });
  }

  const segredo = process.env.AUTH0_SECRET;
  if (!segredo) {
    // Sem o segredo não há como guardar o código com segurança — e gravar em claro não é opção.
    console.error("[codigo/pedir] AUTH0_SECRET ausente: o acesso por código fica indisponível.");
    return NextResponse.json({ ok: true });
  }

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });

  if (user) {
    const codigo = gerarCodigo();
    // Códigos anteriores morrem: deixar dois válidos dobra a chance de acerto de um chute.
    await db.delete(loginCodes).where(eq(loginCodes.userId, user.id)).catch(() => {});

    const canais: string[] = [];
    const texto = mensagemDoCodigo(codigo);
    if (user.telegramId && (await enviarCodigoPorTelegram(user.telegramId, texto))) canais.push("telegram");
    if (await enviarCodigoPorEmail(user.id, email, texto)) canais.push("email");

    /**
     * Só grava o código se ALGUM canal recebeu. Gravar sem enviar deixaria a pessoa diante de uma
     * tela pedindo um código que nunca vai chegar.
     */
    if (canais.length) {
      await db.insert(loginCodes).values({
        userId: user.id,
        codigoHash: hashDoCodigo(codigo, segredo),
        canal: canais.join("+"),
        expiraEm: new Date(Date.now() + VALIDADE_MS),
      }).catch(() => {});
    } else {
      console.error("[codigo/pedir] nenhum canal entregou o código para o usuário", user.id);
    }
  }

  return NextResponse.json({ ok: true });
}
