"use server";

/**
 * CONFIGURAÇÃO FISCAL E CERTIFICADO A1 (doc 76).
 *
 * Duas regras valem em tudo aqui:
 *
 * 1. **A senha do certificado entra, valida e sai.** Ela nunca é gravada, nunca é devolvida e
 *    nunca vai para log. O que fica no banco é o `.pfx` CIFRADO e os dados de leitura (titular,
 *    documento, validade), que não assinam nada sozinhos.
 * 2. **Nada de segredo em mensagem de erro.** O motivo técnico que volta para a tela vem de
 *    `lerCertificado`, que já corta em 180 caracteres e nunca inclui a senha.
 */

import { auth } from "@/auth";
import { db } from "@/db";
import { fiscalConfig } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { encryptSecret } from "@/lib/crypto";
import { lerCertificado, TETO_DO_CERTIFICADO } from "@/lib/certificadoDigital";

export type RespostaFiscal = { ok: true; aviso?: string } | { ok: false; erro: string; motivo?: string };

const soDigitos = (s: string) => (s ?? "").replace(/\D/g, "");

const DadosFiscais = z.object({
  municipioUf: z.string().trim().max(2).optional().nullable(),
  municipioNome: z.string().trim().max(120).optional().nullable(),
  inscricaoMunicipal: z.string().trim().max(40).optional().nullable(),
  cpf: z.string().trim().max(20).optional().nullable(),
  cnpjTecnico: z.string().trim().max(20).optional().nullable(),
  enderecoFiscal: z.string().trim().max(300).optional().nullable(),
  codigoServico: z.string().trim().max(40).optional().nullable(),
  regimeTributario: z.string().trim().max(60).optional().nullable(),
});

/** Grava os dados fiscais. Não toca no certificado. */
export async function salvarDadosFiscais(entrada: unknown): Promise<RespostaFiscal> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, erro: "Não autorizado." };
  const userId = session.user.id;

  const lido = DadosFiscais.safeParse(entrada);
  if (!lido.success) return { ok: false, erro: "Dados inválidos." };
  const d = lido.data;

  const cpf = d.cpf ? soDigitos(d.cpf) : null;
  if (cpf && cpf.length !== 11) return { ok: false, erro: "O CPF precisa ter 11 dígitos." };
  const cnpj = d.cnpjTecnico ? soDigitos(d.cnpjTecnico) : null;
  if (cnpj && cnpj.length !== 14) return { ok: false, erro: "O CNPJ precisa ter 14 dígitos." };

  const valores = {
    municipioUf: d.municipioUf?.toUpperCase() || null,
    municipioNome: d.municipioNome || null,
    inscricaoMunicipal: d.inscricaoMunicipal || null,
    cpf, cnpjTecnico: cnpj,
    enderecoFiscal: d.enderecoFiscal || null,
    codigoServico: d.codigoServico || null,
    regimeTributario: d.regimeTributario || null,
    updatedAt: new Date(),
  };

  await db.insert(fiscalConfig).values({ userId, ...valores })
    .onConflictDoUpdate({ target: fiscalConfig.userId, set: valores });

  revalidatePath("/dashboard/settings");
  return { ok: true };
}

/**
 * Recebe o `.pfx`, confere com a senha, guarda CIFRADO e descarta a senha.
 *
 * O arquivo chega em base64 porque vem de um `<input type="file">` lido no cliente — Server
 * Action não transporta `File` cru. O teto é conferido nos DOIS lados: base64 infla ~33%, e
 * medir só o lado errado é o defeito que já custou caro na frota.
 */
export async function enviarCertificado(
  nomeArquivo: string,
  base64: string,
  senha: string,
): Promise<RespostaFiscal> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, erro: "Não autorizado." };
  const userId = session.user.id;

  if (!base64) return { ok: false, erro: "Escolha o arquivo do certificado." };
  if (!senha) return { ok: false, erro: "Informe a senha do certificado." };

  let pfx: Buffer;
  try { pfx = Buffer.from(base64, "base64"); }
  catch { return { ok: false, erro: "Não consegui ler o arquivo enviado." }; }
  if (pfx.length > TETO_DO_CERTIFICADO) {
    return { ok: false, erro: "Arquivo grande demais para um certificado A1." };
  }

  const leitura = lerCertificado(pfx, senha);
  if (!leitura.ok) return { ok: false, erro: leitura.erro, motivo: leitura.motivo };
  const c = leitura.dados;

  /**
   * Certificado VENCIDO é aceito e denunciado, não recusado.
   *
   * Recusar esconderia o motivo: ela ficaria trocando de arquivo sem entender. Guardado, a tela
   * mostra "venceu em tal dia" — que é a informação que resolve.
   */
  const valores = {
    certificadoEnc: encryptSecret(pfx.toString("base64")),
    certificadoNomeArquivo: nomeArquivo.slice(0, 120) || "certificado.pfx",
    certificadoTitular: c.titular,
    certificadoDocumento: c.documento,
    certificadoTipo: c.tipo,
    certificadoValidoAte: c.validoAte,
    certificadoEnviadoEm: new Date(),
    updatedAt: new Date(),
  };

  await db.insert(fiscalConfig).values({ userId, ...valores })
    .onConflictDoUpdate({ target: fiscalConfig.userId, set: valores });

  revalidatePath("/dashboard/settings");
  return {
    ok: true,
    aviso: c.diasParaVencer < 0 ? "Atenção: este certificado já venceu." : undefined,
  };
}

/** Apaga o certificado guardado. Os dados fiscais ficam. */
export async function removerCertificado(): Promise<RespostaFiscal> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, erro: "Não autorizado." };

  await db.update(fiscalConfig).set({
    certificadoEnc: null,
    certificadoNomeArquivo: null,
    certificadoTitular: null,
    certificadoDocumento: null,
    certificadoTipo: null,
    certificadoValidoAte: null,
    certificadoEnviadoEm: null,
    updatedAt: new Date(),
  }).where(eq(fiscalConfig.userId, session.user.id));

  revalidatePath("/dashboard/settings");
  return { ok: true };
}
