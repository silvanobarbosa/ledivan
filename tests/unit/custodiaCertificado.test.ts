import { describe, it, expect, beforeAll } from "vitest";
import forge from "node-forge";
import crypto from "node:crypto";
import { lerCertificado } from "@/lib/certificadoDigital";

/**
 * A CUSTÓDIA: o `.pfx` vai cifrado para o banco e volta íntegro — e a SENHA não vai junto.
 *
 * Este é o teste que vale a pena existir sobre a guarda do certificado. Ele não toca no banco:
 * exercita a mesma cifra (`lib/crypto`, AES-256-GCM) sobre o mesmo conteúdo, porque é aí que
 * mora o risco. Se o blob gravado contiver a senha, ou se o arquivo não voltar idêntico, a
 * assinatura da terapeuta quebra — e quebra só no dia da emissão.
 */

let encryptSecret: (s: string) => string;
let decryptSecret: (s: string) => string;

beforeAll(async () => {
  // `lib/crypto` exige a chave no ambiente; aqui ela é de teste e vive só neste processo.
  process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");
  const mod = await import("@/lib/crypto");
  encryptSecret = mod.encryptSecret;
  decryptSecret = mod.decryptSecret;
});

const SENHA = "senha-do-certificado-9281";

function certificadoDeTeste(): Buffer {
  const chaves = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate();
  cert.publicKey = chaves.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date(Date.now() - 86_400_000);
  cert.validity.notAfter = new Date(Date.now() + 200 * 86_400_000);
  cert.setSubject([{ name: "commonName", value: "GISELE BARBOSA:12345678901" }]);
  cert.setIssuer([{ name: "commonName", value: "AC TESTE RFB" }]);
  cert.setExtensions([{ name: "basicConstraints", cA: false }]);
  cert.sign(chaves.privateKey);
  const p12 = forge.pkcs12.toPkcs12Asn1(chaves.privateKey, [cert], SENHA, { generateLocalKeyId: true });
  return Buffer.from(forge.asn1.toDer(p12).getBytes(), "binary");
}

describe("custódia do certificado A1", () => {
  it("o arquivo volta BYTE A BYTE igual depois de cifrar e decifrar", () => {
    // Um bit trocado num .pfx não dá erro de leitura: dá assinatura inválida, no dia da emissão.
    const pfx = certificadoDeTeste();
    const guardado = encryptSecret(pfx.toString("base64"));
    const voltou = Buffer.from(decryptSecret(guardado), "base64");
    expect(voltou.equals(pfx)).toBe(true);
  });

  it("o certificado que volta ainda abre com a senha e diz o mesmo titular", () => {
    const pfx = certificadoDeTeste();
    const voltou = Buffer.from(decryptSecret(encryptSecret(pfx.toString("base64"))), "base64");
    const r = lerCertificado(voltou, SENHA);
    expect(r.ok).toBe(true);
    expect(r.ok && r.dados.titular).toBe("GISELE BARBOSA");
  });

  it("A SENHA NÃO APARECE no que é guardado — nem em claro, nem em base64", () => {
    const pfx = certificadoDeTeste();
    const guardado = encryptSecret(pfx.toString("base64"));
    expect(guardado).not.toContain(SENHA);
    expect(guardado).not.toContain(Buffer.from(SENHA).toString("base64"));
    // E o blob cifrado também não deixa o conteúdo do arquivo aparecer em claro.
    expect(guardado).not.toContain(pfx.toString("base64").slice(0, 40));
  });

  it("blob adulterado não decifra — o GCM recusa em vez de devolver lixo", () => {
    const guardado = encryptSecret(certificadoDeTeste().toString("base64"));
    const [iv, tag, enc] = guardado.split(":");
    const mexido = [iv, tag, Buffer.from(Buffer.from(enc, "base64").map((b, i) => (i === 10 ? b ^ 1 : b))).toString("base64")].join(":");
    expect(() => decryptSecret(mexido)).toThrow();
  });

  it("sem a senha, o arquivo guardado não serve para nada", () => {
    // É esta a propriedade que separa "vazou o banco" de "vazou a identidade jurídica dela".
    const pfx = certificadoDeTeste();
    const voltou = Buffer.from(decryptSecret(encryptSecret(pfx.toString("base64"))), "base64");
    const semSenha = lerCertificado(voltou, "chute-errado");
    expect(semSenha.ok).toBe(false);
  });
});
