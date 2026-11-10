import { NextResponse } from "next/server";
import { anexoAutorizado, urlAssinada } from "@/lib/anexoAutorizado";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/files/<docId> — devolve uma URL assinada (curta) do arquivo privado no Blob.
// Autorizado para: o TERAPEUTA dono (sessão) OU o PACIENTE do documento (bearer do app).
export async function GET(req: Request, { params }: { params: Promise<{ docId: string }> }) {
  const { docId } = await params;
  const doc = await anexoAutorizado(req, docId);
  if ("error" in doc) return NextResponse.json({ error: doc.error }, { status: doc.status });

  try {
    return NextResponse.json({ ok: true, url: await urlAssinada(doc.pathname), title: doc.titulo });
  } catch (e) {
    console.error("presign material:", e);
    return NextResponse.json({ error: "Falha ao gerar o link." }, { status: 500 });
  }
}
