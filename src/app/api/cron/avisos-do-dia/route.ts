import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { patients, pushTokens } from "@/db/schema";
import { avisoDeAniversario, avisoDeVencimento, diaEAniversario } from "@/lib/avisosDoDia";
import { pushToTherapist } from "@/lib/push";
import { vencimentosDoUsuarioEm } from "@/lib/vencimentosDoUsuario";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * CRON DIÁRIO: os avisos do dia para a terapeuta (doc 63).
 *
 * Dois avisos, no aparelho dela: quem faz aniversário hoje, e o que vence hoje — "pacotes e sessões
 * a vencer hoje", com paciente e valor. Nada vai para o paciente: é lembrete de trabalho.
 *
 * Só roda para quem TEM aparelho registrado. O cálculo de vencimento percorre o motor de cobrança
 * de cada cadastro ativo, e rodá-lo para uma conta que não receberia nada seria gastar à toa.
 *
 * `?dry=1` percorre tudo e diz o que sairia, sem enviar — é como se confere o cron sem tocar o
 * telefone de ninguém.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "CRON_SECRET não configurado" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ ok: false }, { status: 401 });

  const simulacao = req.nextUrl.searchParams.get("dry") === "1";
  const { diaISO, mesDia } = diaEAniversario(new Date());

  // Os terapeutas com aparelho registrado (token do app do terapeuta tem `patientId` nulo).
  const donos = await db
    .selectDistinct({ userId: pushTokens.userId })
    .from(pushTokens)
    .where(isNull(pushTokens.patientId));

  const relatorio: { userId: string; aniversarios: number; vencimentos: number }[] = [];

  for (const { userId } of donos) {
    if (!userId) continue;

    const aniversariantes = await db
      .select({ name: patients.name })
      .from(patients)
      .where(
        and(
          eq(patients.userId, userId),
          eq(patients.patientStatus, "ativo"),
          isNotNull(patients.birthDate),
          sql`to_char(${patients.birthDate}, 'MM-DD') = ${mesDia}`,
        ),
      );

    const { avulsas, pacotes } = await vencimentosDoUsuarioEm(userId, diaISO);
    // O que já foi quitado hoje não é cobrança a fazer: entra quem ainda tem o que receber.
    const aCobrar = [...pacotes, ...avulsas]
      .filter((c) => c.falta > 0)
      .map((c) => ({ nome: c.nome, valor: c.falta }));

    const avisos = [
      avisoDeAniversario(aniversariantes.map((a) => a.name)),
      avisoDeVencimento(aCobrar),
    ].filter((a) => a !== null);

    if (!simulacao) {
      for (const aviso of avisos) {
        await pushToTherapist(userId, aviso.title, aviso.body, { type: "avisos_do_dia" });
      }
    }
    relatorio.push({ userId, aniversarios: aniversariantes.length, vencimentos: aCobrar.length });
  }

  return NextResponse.json({ ok: true, dia: diaISO, simulacao, contas: relatorio.length, relatorio });
}
