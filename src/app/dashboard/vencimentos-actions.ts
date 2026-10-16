"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { auth } from "@/auth";
import { patients } from "@/db/schema";
import { geralDoPaciente, type LinhaNaTela } from "@/lib/geralDoPaciente";
import { registrarCobrancaEnviada } from "@/app/dashboard/patients/[id]/geral-actions";
import { vencimentosNoDia, type CobrancaResolvida, type SituacaoVenc, type TipoVencimentoPacote } from "@/lib/vencimentosDoDia";

const grupoDe = (tipo: string): "avulsa" | "pacote" => (tipo === "pacote" || tipo === "quinzena" ? "pacote" : "avulsa");

function tipoVencimentoDe(formato: string | null | undefined, paymentFormat: string | null | undefined): TipoVencimentoPacote {
  const f = `${formato ?? ""} ${paymentFormat ?? ""}`.toLowerCase();
  if (f.includes("primeira")) return "primeira";
  if (f.includes("ultima") || f.includes("última")) return "ultima";
  return "dia";
}

/**
 * Os vencimentos de uma data (doc 44): roda o motor de cobrança de cada cadastro ATIVO e resolve as
 * cobranças que vencem no dia — sessões avulsas e pacotes. Sem persistir a data (o cliente manda).
 */
export async function vencimentosEm(diaISO: string): Promise<{ ok: boolean; avulsas?: CobrancaResolvida[]; pacotes?: CobrancaResolvida[]; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sessão inválida." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(diaISO)) return { ok: false, error: "Data inválida." };
  const userId = session.user.id;

  const lista = await db
    .select({ id: patients.id, name: patients.name, phone: patients.phone, guardianPhone: patients.guardianPhone, paymentFormat: patients.paymentFormat })
    .from(patients)
    .where(and(eq(patients.userId, userId), eq(patients.patientStatus, "ativo")));

  const todas: CobrancaResolvida[] = [];
  await Promise.all(lista.map(async (p) => {
    const geral = await geralDoPaciente(userId, p.id);
    if (!geral) return;
    // Mapa id da sessão → data/status, para resolver primeira/última e a última realizada.
    const sessaoPorId = new Map<string, { data: string; status: string }>();
    for (const l of geral.linhas) {
      if (l.tipo === "sessao") sessaoPorId.set(l.id, { data: l.data, status: l.status });
    }
    const telefone = p.guardianPhone?.trim() ? p.guardianPhone : p.phone;

    for (const l of geral.linhas as LinhaNaTela[]) {
      if (l.tipo !== "pagamento") continue;
      if (!l.vencimento) continue;
      const datas = l.ids.map((id) => sessaoPorId.get(id)?.data).filter(Boolean) as string[];
      datas.sort();
      const realizadas = l.ids
        .map((id) => sessaoPorId.get(id))
        .filter((s): s is { data: string; status: string } => !!s && s.status !== "agendada")
        .sort((a, b) => a.data.localeCompare(b.data));
      const ultimaRealizada = realizadas.length ? realizadas[realizadas.length - 1] : null;
      const grupo = grupoDe(l.tipoDeCobranca);
      todas.push({
        cadastroId: p.id,
        nome: p.name,
        telefone: telefone ?? null,
        chave: l.chave,
        grupo,
        vencimento: l.vencimento,
        situacao: l.situacao as SituacaoVenc,
        valor: l.valor,
        falta: l.falta,
        enviosTotal: l.envio?.total ?? 0,
        dataSessao: grupo === "avulsa" ? (datas[0] ?? null) : null,
        horarioAtraso: grupo === "avulsa" ? l.vencimento : null,
        tipoVencimento: grupo === "pacote" ? tipoVencimentoDe(l.formato, p.paymentFormat) : undefined,
        primeiraSessao: datas[0] ?? null,
        ultimaSessao: datas.length ? datas[datas.length - 1] : null,
        ultimaRealizada,
      });
    }
  }));

  const { avulsas, pacotes } = vencimentosNoDia(todas, diaISO);
  return { ok: true, avulsas, pacotes };
}

/** Registra um acionamento de cobrança (doc 44: conta só o clique no botão, não a abertura do WhatsApp). */
export async function registrarCobranca(cadastroId: string, cobrancaChave: string): Promise<{ ok: boolean; error?: string }> {
  return registrarCobrancaEnviada({ patientId: cadastroId, cobrancaChave });
}
