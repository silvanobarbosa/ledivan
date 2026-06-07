import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { get } from "@vercel/blob";

// Serve uma foto privada (terapeuta/paciente) SOMENTE ao tenant dono.
// Segurança: o pathname é prefixado por "fotos/<userId>/"; só serve se bater
// com o usuário autenticado, isolando os tenants.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const pathname = req.nextUrl.searchParams.get("p");
  if (!pathname) return NextResponse.json({ error: "Faltou o parâmetro" }, { status: 400 });

  const prefix = `fotos/${session.user.id}/`;
  if (!pathname.startsWith(prefix)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  try {
    const blob = await get(pathname, { access: "private" });
    if (!blob) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    return new NextResponse(blob.stream as unknown as BodyInit, {
      headers: {
        "Content-Type": blob.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    console.error("Erro ao servir foto:", e);
    return NextResponse.json({ error: "Falha ao carregar" }, { status: 500 });
  }
}
