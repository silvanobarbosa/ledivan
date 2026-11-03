/**
 * O CERTIFICADO DIGITAL A1 DA TERAPEUTA (doc 76).
 *
 * Para emitir NFS-e pelo caminho nacional o certificado faz DUAS coisas: assina a DPS e autentica
 * a conexão mTLS com o ambiente nacional. Medido em 03/11/2026: `adn.nfse.gov.br` recusa a
 * conexão no próprio handshake TLS sem ele — não se lê nem a documentação.
 *
 * Este arquivo só LÊ o arquivo `.pfx` e conta o que há dentro. Ele não assina, não transmite e
 * não guarda nada.
 *
 * **Por que o que está aqui importa tanto.** Um certificado A1 é a identidade jurídica da pessoa:
 * com ele se assina qualquer coisa em nome dela. O dono decidiu (03/11/2026) que o certificado é
 * responsabilidade da terapeuta — ela usa, ela aplica. O desenho segue essa decisão ao pé da
 * letra:
 *
 * - O arquivo é guardado **cifrado** (AES-256-GCM, `lib/crypto`, a mesma do SMTP e da chave de IA).
 * - **A SENHA NÃO É GUARDADA.** Ela é pedida na hora de emitir e descartada depois. É o que
 *   separa "vazou o banco" de "vazou a identidade jurídica dela": sem a senha, o `.pfx` cifrado
 *   não assina nada. Toda ferramenta fiscal séria funciona assim, e o A3 pede PIN a cada uso por
 *   construção.
 *
 * **O vencimento é o defeito silencioso número um** de integração fiscal: o certificado expira,
 * a emissão começa a falhar, e a mensagem do provedor não diz isso. Por isso a leitura devolve a
 * data e os dias restantes, e a tela avisa antes.
 */

import forge from "node-forge";

export type TipoDeCertificado = "e-CPF" | "e-CNPJ" | "desconhecido";

export type LeituraDoCertificado = {
  /** Nome como está no certificado (o CN do titular). */
  titular: string;
  /** CPF ou CNPJ extraído, só dígitos. `null` quando o certificado não declara. */
  documento: string | null;
  tipo: TipoDeCertificado;
  validoDe: Date;
  validoAte: Date;
  /** Dias até vencer. Negativo = já venceu. */
  diasParaVencer: number;
  /** O emissor (a Autoridade Certificadora). */
  autoridade: string;
};

export type ResultadoDaLeitura =
  | { ok: true; dados: LeituraDoCertificado }
  | { ok: false; erro: string; motivo?: string };

/**
 * Os OIDs em que a ICP-Brasil guarda CPF e CNPJ, dentro do `otherName` do subjectAltName.
 *
 * Não estão no CN. O CN traz "NOME DA PESSOA:12345678901" em muitos emissores, mas nem em todos
 * e nem no mesmo formato — por isso o OID vem primeiro e o CN é só reserva.
 */
const OID_PESSOA_FISICA = "2.16.76.1.3.1";
const OID_PESSOA_JURIDICA = "2.16.76.1.3.3";

const soDigitos = (s: string) => (s ?? "").replace(/\D/g, "");

/**
 * DECODIFICA O `otherName` À MÃO — o node-forge não faz isso.
 *
 * Medido em 03/11/2026 lendo o `x509.js` dele: ao parsear o subjectAltName, o forge só preenche
 * `altName.oid` para `type 8` (registeredID). Para `type 0`, que é justamente onde a ICP-Brasil
 * guarda CPF e CNPJ, ele deixa o ASN.1 cru em `altName.value` e não decodifica nada. Quem
 * confiar no `.oid` aí nunca acha o documento — e falha CALADO, devolvendo "desconhecido" para
 * todo certificado brasileiro.
 *
 * A estrutura é `otherName ::= SEQUENCE { type-id OID, value [0] EXPLICIT ANY }`, então o
 * primeiro filho é o OID e o segundo embrulha a string (OCTET STRING, UTF8String ou
 * PrintableString, conforme a certificadora).
 */
type NoAsn1 = { type: number; value: string | NoAsn1[] };

function leOtherName(valor: unknown): { oid: string; texto: string } | null {
  if (!Array.isArray(valor) || valor.length < 2) return null;
  const nos = valor as NoAsn1[];
  const noOid = nos.find((n) => n.type === 6 && typeof n.value === "string");
  if (!noOid) return null;
  let oid: string;
  try { oid = forge.asn1.derToOid(noOid.value as string); } catch { return null; }

  // O conteúdo pode vir um ou dois níveis abaixo, dependendo de como a AC montou.
  const achaTexto = (n: NoAsn1 | undefined, fundo = 0): string | null => {
    if (!n || fundo > 3) return null;
    if (typeof n.value === "string") return n.value;
    for (const filho of n.value) {
      const t = achaTexto(filho, fundo + 1);
      if (t) return t;
    }
    return null;
  };
  const texto = achaTexto(nos.find((n) => n !== noOid));
  return texto ? { oid, texto } : null;
}

/**
 * Dentro do otherName da ICP-Brasil, os dados vêm concatenados em posição fixa. Para pessoa
 * física o bloco começa com a data de nascimento (8) e o CPF vem logo depois (11).
 */
function documentoDoOtherName(oid: string, valor: string): string | null {
  const d = soDigitos(valor);
  if (oid === OID_PESSOA_FISICA) return d.length >= 19 ? d.slice(8, 19) : null;
  if (oid === OID_PESSOA_JURIDICA) return d.length >= 22 ? d.slice(8, 22) : null;
  return null;
}

/** O CN costuma trazer "FULANO DE TAL:12345678901" — o documento depois dos dois pontos. */
function separaNomeEDocumento(cn: string): { nome: string; documento: string | null } {
  const partes = (cn ?? "").split(":");
  if (partes.length >= 2) {
    const doc = soDigitos(partes[partes.length - 1]);
    if (doc.length === 11 || doc.length === 14) {
      return { nome: partes.slice(0, -1).join(":").trim(), documento: doc };
    }
  }
  return { nome: (cn ?? "").trim(), documento: null };
}

function diasEntre(de: Date, ate: Date): number {
  return Math.floor((ate.getTime() - de.getTime()) / 86_400_000);
}

/**
 * Abre o `.pfx` com a senha e conta o que há dentro.
 *
 * Senha errada e arquivo inválido são erros DIFERENTES na tela: o primeiro ela resolve sozinha,
 * o segundo significa que o arquivo não é o que ela pensa que é. A biblioteca devolve a mesma
 * exceção para os dois, então a distinção sai da mensagem.
 */
export function lerCertificado(pfx: Buffer, senha: string, agora = new Date()): ResultadoDaLeitura {
  if (!pfx?.length) return { ok: false, erro: "O arquivo do certificado chegou vazio." };
  if (!senha) return { ok: false, erro: "Informe a senha do certificado." };

  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    const asn1 = forge.asn1.fromDer(forge.util.createBuffer(pfx.toString("binary")));
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, senha);
  } catch (e) {
    const texto = e instanceof Error ? e.message : String(e);
    if (/mac|password|invalid password/i.test(texto)) {
      return { ok: false, erro: "Senha do certificado incorreta." };
    }
    return {
      ok: false,
      erro: "Não consegui ler este arquivo como certificado A1 (.pfx ou .p12).",
      motivo: texto.slice(0, 180),
    };
  }

  const sacos = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [];
  const certificados = sacos.map((s) => s.cert).filter(Boolean) as forge.pki.Certificate[];
  if (!certificados.length) return { ok: false, erro: "O arquivo não contém nenhum certificado." };

  /**
   * O `.pfx` traz a cadeia inteira: o certificado DELA e as autoridades que o assinaram. O dela é
   * o único que não é CA. Pegar o primeiro da lista traria a raiz da AC em muitos arquivos — e aí
   * a tela mostraria o nome da certificadora no lugar do nome da terapeuta.
   */
  const ehCA = (c: forge.pki.Certificate) => {
    const bc = c.getExtension("basicConstraints") as { cA?: boolean } | null;
    return !!bc?.cA;
  };
  const cert = certificados.find((c) => !ehCA(c)) ?? certificados[0];

  const cn = (cert.subject.getField("CN")?.value as string) ?? "";
  const { nome, documento: doDoCn } = separaNomeEDocumento(cn);

  let documento: string | null = null;
  let tipo: TipoDeCertificado = "desconhecido";
  const san = cert.getExtension("subjectAltName") as { altNames?: { type: number; value?: unknown }[] } | null;
  for (const alt of san?.altNames ?? []) {
    // type 0 = otherName, que é onde a ICP-Brasil guarda CPF e CNPJ.
    if (alt.type !== 0) continue;
    const lido = leOtherName(alt.value);
    if (!lido) continue;
    const achado = documentoDoOtherName(lido.oid, lido.texto);
    if (!achado) continue;
    documento = achado;
    tipo = lido.oid === OID_PESSOA_FISICA ? "e-CPF" : "e-CNPJ";
    break;
  }
  if (!documento && doDoCn) {
    documento = doDoCn;
    tipo = doDoCn.length === 11 ? "e-CPF" : "e-CNPJ";
  }

  const validoDe = cert.validity.notBefore;
  const validoAte = cert.validity.notAfter;

  return {
    ok: true,
    dados: {
      titular: nome || cn || "(sem nome no certificado)",
      documento,
      tipo,
      validoDe,
      validoAte,
      diasParaVencer: diasEntre(agora, validoAte),
      autoridade: (cert.issuer.getField("CN")?.value as string) ?? "(emissor não identificado)",
    },
  };
}

/** O recado sobre o vencimento — ou `null` quando ainda está longe. */
export function avisoDeVencimento(dias: number): { nivel: "vencido" | "urgente" | "atencao"; texto: string } | null {
  if (dias < 0) {
    return { nivel: "vencido", texto: `Este certificado venceu há ${Math.abs(dias)} dia(s). Nenhuma nota será emitida até você enviar um novo.` };
  }
  if (dias <= 15) {
    return { nivel: "urgente", texto: `Vence em ${dias} dia(s). Renove agora — quando vencer, a emissão para sem aviso do sistema fiscal.` };
  }
  if (dias <= 45) {
    return { nivel: "atencao", texto: `Vence em ${dias} dias. Vale já combinar a renovação com a sua contadora.` };
  }
  return null;
}

/** O teto do arquivo. Um A1 tem alguns KB; o que passa muito disso não é certificado. */
export const TETO_DO_CERTIFICADO = 512 * 1024;
