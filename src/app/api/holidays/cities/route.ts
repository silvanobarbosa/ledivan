import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";

export const runtime = "nodejs";

type IbgeMun = { id: number; nome: string; microrregiao?: { mesorregiao?: { UF?: { sigla?: string } } } };
type City = { ibge: number; nome: string; uf: string };

// Lista completa de municípios do IBGE (5570), cacheada 7 dias pela camada de fetch do Next.
async function allCities(): Promise<City[]> {
  const res = await fetch("https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome", {
    next: { revalidate: 604800 },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as IbgeMun[];
  return data.map((m) => ({ ibge: m.id, nome: m.nome, uf: m.microrregiao?.mesorregiao?.UF?.sigla ?? "" }));
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[^a-z0-9 ]/g, "").trim();

// GET /api/holidays/cities?q=... — busca municípios por nome (retorna até 15). Requer sessão.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = norm(req.nextUrl.searchParams.get("q") ?? "");
  if (q.length < 2) return NextResponse.json({ cities: [] });

  const cities = await allCities();
  const starts: City[] = [], contains: City[] = [];
  for (const c of cities) {
    const n = norm(c.nome);
    if (n.startsWith(q)) starts.push(c);
    else if (n.includes(q)) contains.push(c);
    if (starts.length >= 15) break;
  }
  const out = [...starts, ...contains].slice(0, 15);
  return NextResponse.json({ cities: out });
}
