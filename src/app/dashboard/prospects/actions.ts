"use server";

import { db } from "@/db";
import { patients, patientStatusHistory, prospectContacts } from "@/db/schema";
import { auth } from "@/auth";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { moedaOuPadrao } from "@/lib/money";
import { dataDeFormulario } from "@/lib/dataForm";

async function donoDoProspect(patientId: string, userId: string) {
  return db.query.patients.findFirst({
    where: and(eq(patients.id, patientId), eq(patients.userId, userId)),
  });
}

/**
 * Volta para a lista DEPOIS de escrever.
 *
 * Três tentativas foram precisas para acertar isto, e vale registrar por quê:
 *   - `revalidatePath` sozinho não faz nada aqui: a página é `force-dynamic`, não há cache para
 *     invalidar, e nada avisa o navegador;
 *   - `router.refresh()` no cliente dispara a busca, mas o resultado não substituía a tela;
 *   - `redirect` para o MESMO endereço é navegação para onde já se está — o roteador serve do
 *     cache e a lista continua a de antes.
 *
 * Com um parâmetro que muda a cada gravação, o endereço é outro, a navegação acontece de verdade
 * e a linha nova aparece na hora. É o sintoma que o dono relatou como "cadastrei e não apareceu".
 */
function voltarParaLista(): never {
  redirect(`/dashboard/prospects?salvo=${Date.now()}`);
}

export async function createProspect(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = session.user.id;

  const name = formData.get("name") as string;
  if (!name?.trim()) throw new Error("Nome obrigatório");

  const prospectDate = dataDeFormulario(formData.get("prospectDate")) ?? new Date();

  // Número do cadastro sequencial por terapeuta — o prospect também recebe (antes nascia vazio
  // e, convertido em paciente, ficava sem número para sempre).
  const [{ maxNum }] = await db.select({ maxNum: sql<number>`coalesce(max(${patients.registrationNumber}), 0)` })
    .from(patients).where(eq(patients.userId, userId));

  const [created] = await db.insert(patients).values({
    userId,
    registrationNumber: Number(maxNum) + 1,
    name: name.trim(),
    phone: (formData.get("phone") as string) || null,
    email: (formData.get("email") as string) || null,
    birthDate: dataDeFormulario(formData.get("birthDate")),
    gender: (formData.get("gender") as string) || null,
    patientStatus: "prospect",
    prospectDate,
    prospectFechou: (formData.get("prospectFechou") as string) || "",
    prospectObservacoes: (formData.get("prospectObservacoes") as string) || null,
    sessionFee: moedaOuPadrao(formData.get("sessionFee"), "0"),
  }).returning();

  // histórico começa já na fase de prospect (se soma ao prontuário depois)
  await db.insert(patientStatusHistory).values({ patientId: created.id, status: "prospect", date: prospectDate });

  // A primeira observação também nasce como CONTATO, senão o histórico começaria vazio mesmo
  // tendo havido conversa.
  const obs = (formData.get("prospectObservacoes") as string)?.trim();
  if (obs) await db.insert(prospectContacts).values({ patientId: created.id, date: prospectDate, observacao: obs });

  // NÃO redireciona para a ficha do paciente. Era esta a queixa de "o cadastro do prospect não
  // aparece": o formulário jogava o dono direto na ficha, e ele nunca via a lista embaixo.
  //
  // Mas `revalidatePath` sozinho também não resolvia: a página é `force-dynamic`, então não há
  // cache para invalidar e nada manda o navegador buscar de novo. O prospect entrava no banco e a
  // lista continuava a de antes até alguém recarregar na mão — a mesma queixa, por outro caminho.
  // O redirecionamento PARA A PRÓPRIA LISTA força a busca nova e mantém o dono onde ele quer estar.
  revalidatePath("/dashboard/prospects");
  revalidatePath("/dashboard");
  voltarParaLista();
}

export async function updateProspect(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");

  const id = formData.get("id") as string;
  const existente = await donoDoProspect(id, session.user.id);
  if (!existente) throw new Error("Prospect não encontrado");

  const name = (formData.get("name") as string)?.trim();

  await db.update(patients).set({
    name: name || existente.name,
    phone: (formData.get("phone") as string) || null,
    email: (formData.get("email") as string) || null,
    birthDate: dataDeFormulario(formData.get("birthDate")),
    gender: (formData.get("gender") as string) || null,
    prospectDate: dataDeFormulario(formData.get("prospectDate")) ?? existente.prospectDate,
    prospectFechou: (formData.get("prospectFechou") as string) ?? existente.prospectFechou,
    sessionFee: moedaOuPadrao(formData.get("sessionFee"), existente.sessionFee),
  }).where(and(eq(patients.id, id), eq(patients.userId, session.user.id)));

  revalidatePath("/dashboard/prospects");
  revalidatePath("/dashboard");
  voltarParaLista();
}

/**
 * Apaga o prospect. Só apaga quem AINDA é prospect: a mesma linha da tabela `patients` vira
 * paciente ao converter, e apagar paciente levaria sessões, pagamentos e prontuário na cascata.
 */
export async function deleteProspect(patientId: string): Promise<{ ok: boolean; erro?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, erro: "Não autorizado" };

  const existente = await donoDoProspect(patientId, session.user.id);
  if (!existente) return { ok: false, erro: "Prospect não encontrado" };
  if (existente.patientStatus !== "prospect") {
    return { ok: false, erro: "Já é paciente — use a ficha dele para inativar ou excluir." };
  }

  await db.delete(patients).where(and(eq(patients.id, patientId), eq(patients.userId, session.user.id)));
  revalidatePath("/dashboard/prospects");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function addProspectContact(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");

  const patientId = formData.get("patientId") as string;
  const existente = await donoDoProspect(patientId, session.user.id);
  if (!existente) throw new Error("Prospect não encontrado");

  await db.insert(prospectContacts).values({
    patientId,
    date: dataDeFormulario(formData.get("date")) ?? new Date(),
    observacao: ((formData.get("observacao") as string) || "").trim() || null,
  });

  revalidatePath("/dashboard/prospects");
  voltarParaLista();
}

export async function deleteProspectContact(contactId: string, patientId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");

  // o dono é checado pelo PACIENTE: a linha de contato não guarda userId
  const existente = await donoDoProspect(patientId, session.user.id);
  if (!existente) throw new Error("Prospect não encontrado");

  await db.delete(prospectContacts).where(and(eq(prospectContacts.id, contactId), eq(prospectContacts.patientId, patientId)));
  revalidatePath("/dashboard/prospects");
  voltarParaLista();
}

// Converte prospect em paciente ativo
export async function convertProspect(patientId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");

  await db.update(patients)
    .set({ patientStatus: "ativo", prospectFechou: "Fechou", startedAt: new Date() })
    .where(and(eq(patients.id, patientId), eq(patients.userId, session.user.id)));

  await db.insert(patientStatusHistory).values({ patientId, status: "ativo" });

  revalidatePath("/dashboard/prospects");
  revalidatePath("/dashboard/patients");
  redirect(`/dashboard/patients/${patientId}`);
}

export async function updateProspectOutcome(patientId: string, fechou: string, observacoes?: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");

  await db.update(patients)
    .set({ prospectFechou: fechou, prospectObservacoes: observacoes || null })
    .where(and(eq(patients.id, patientId), eq(patients.userId, session.user.id)));

  revalidatePath("/dashboard/prospects");
  voltarParaLista();
}
