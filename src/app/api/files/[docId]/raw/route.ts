import { NextResponse } from "next/server";
import { anexoAutorizado, urlAssinada } from "@/lib/anexoAutorizado";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/files/<docId>/raw — o MESMO arquivo, servido pelo nosso domínio (doc 63).
 *
 * O anexo mora num Blob privado, de outra origem. Para IMPRIMIR é preciso que o navegador deixe a
 * página chamar `print()` no arquivo aberto, e isso só vale entre páginas da mesma origem — com a
 * URL assinada direta, o `print()` do iframe estoura em erro de origem cruzada. Então o arquivo
 * passa por aqui, com a mesma autorização do link assinado, e o visualizador do navegador o abre
 * como se fosse nosso.
 *
 * `inline`, nunca `attachment`: o objetivo é exibir para imprimir, não baixar.
 */
export async function GET(req: Request, { params }: { params: Promise<{ docId: string }> }) {
  const { docId } = await params;
  const doc = await anexoAutorizado(req, docId);
  if ("error" in doc) return NextResponse.json({ error: doc.error }, { status: doc.status });

  try {
    const r = await fetch(await urlAssinada(doc.pathname));
    if (!r.ok || !r.body) return NextResponse.json({ error: "Falha ao abrir o arquivo." }, { status: 502 });
    return new NextResponse(r.body, {
      headers: {
        "Content-Type": r.headers.get("content-type") || "application/octet-stream",
        // O nome do anexo não vem do usuário sem passar por aqui: aspas e quebras sairiam do campo.
        "Content-Disposition": `inline; filename="${doc.titulo.replace(/[^\w .-]/g, "_").slice(0, 80)}"`,
        "Cache-Control": "private, no-store",
        // Arquivo de paciente não é recurso para outra página embutir.
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    console.error("raw material:", e);
    return NextResponse.json({ error: "Falha ao abrir o arquivo." }, { status: 500 });
  }
}
