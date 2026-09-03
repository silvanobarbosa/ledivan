// Numeração de parcela do pacote (1/N, 2/N…) — DERIVADA da ordem de data das sessões do pacote.
// Sessões canceladas/realocadas saem da contagem, então as seguintes renumeram sozinhas.

export type PkgSession = { id: string; date: string | Date; status: string; packageId: string | null };
export type Pkg = { id: string; seq: number; sessions: number };

export type PkgLabel = { seq: number; index: number; total: number };

const OUT = new Set(["cancelada", "realocada"]); // não contam na numeração

// Retorna um mapa sessionId -> {seq do pacote, posição i, total N}.
export function derivePackageLabels(sessions: PkgSession[], packages: Pkg[]): Map<string, PkgLabel> {
  const bySeq = new Map(packages.map((p) => [p.id, p]));
  const map = new Map<string, PkgLabel>();

  // agrupa sessões por pacote
  const groups = new Map<string, PkgSession[]>();
  for (const s of sessions) {
    if (!s.packageId || !bySeq.has(s.packageId)) continue;
    const arr = groups.get(s.packageId) ?? [];
    arr.push(s);
    groups.set(s.packageId, arr);
  }

  for (const [pkgId, arr] of groups) {
    const pkg = bySeq.get(pkgId)!;
    const active = arr
      .filter((s) => !OUT.has(s.status))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    active.forEach((s, i) => map.set(s.id, { seq: pkg.seq, index: i + 1, total: pkg.sessions }));
  }
  return map;
}
