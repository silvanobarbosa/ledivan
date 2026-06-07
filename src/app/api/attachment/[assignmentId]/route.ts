import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { assignments } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { get } from "@vercel/blob";

// Serve o anexo (privado) de uma tarefa SOMENTE ao terapeuta dono.
export async function GET(req: NextRequest, { params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const a = await db.query.assignments.findFirst({
    where: and(eq(assignments.id, assignmentId), eq(assignments.userId, session.user.id)),
  });
  if (!a || !a.responseFileUrl) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  try {
    const blob = await get(a.responseFileUrl, { access: "private" });
    if (!blob) return NextResponse.json({ error: "Arquivo indisponível" }, { status: 404 });
    return new NextResponse(blob.stream as unknown as BodyInit, {
      headers: {
        "Content-Type": a.responseFileType || "application/octet-stream",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    console.error("Erro ao servir anexo:", e);
    return NextResponse.json({ error: "Falha ao carregar" }, { status: 500 });
  }
}
