import { describe, it, expect } from "vitest";
import forge from "node-forge";
import { avisoDeVencimento, lerCertificado, TETO_DO_CERTIFICADO } from "@/lib/certificadoDigital";

/**
 * Os certificados aqui são GERADOS no teste, não fixtures.
 *
 * Commitar um `.pfx` de verdade seria commitar a identidade jurídica de alguém; e um fixture
 * gerado uma vez vence e quebra a suíte sozinho daqui a um ano. Gerar na hora resolve os dois e
 * ainda deixa escrever o caso do certificado JÁ VENCIDO, que é o defeito silencioso que mais
 * aparece em integração fiscal.
 */

const OID_PESSOA_FISICA = "2.16.76.1.3.1";
const OID_PESSOA_JURIDICA = "2.16.76.1.3.3";

function fazCertificado(opts: {
  cn: string;
  senha: string;
  diasDeValidade: number;
  oid?: string;
  otherName?: string;
  comoCA?: boolean;
}): Buffer {
  const chaves = forge.pki.rsa.generateKeyPair(1024); // pequeno de propósito: o teste roda rápido
  const cert = forge.pki.createCertificate();
  cert.publicKey = chaves.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date(Date.now() - 86_400_000);
  cert.validity.notAfter = new Date(Date.now() + opts.diasDeValidade * 86_400_000);
  const sujeito = [{ name: "commonName", value: opts.cn }];
  cert.setSubject(sujeito);
  cert.setIssuer([{ name: "commonName", value: "AC TESTE RFB" }]);

  const extensoes: forge.pki.CertificateExtension[] = [
    { name: "basicConstraints", cA: !!opts.comoCA },
  ];
  if (opts.oid && opts.otherName) {
    /**
     * O otherName tem de ser montado em ASN.1 na mão.
     *
     * O escritor de alto nível do node-forge NÃO grava o OID de um `type 0` — conferido em
     * 03/11/2026: o DER sai sem ele, e o teste passaria a validar um certificado que não se
     * parece com os reais. Aqui a estrutura é a mesma da ICP-Brasil:
     * `SEQUENCE { type-id OID, value [0] EXPLICIT ANY }`.
     */
    const { asn1 } = forge;
    const otherName = asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, asn1.oidToDer(opts.oid).getBytes()),
      asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, opts.otherName),
      ]),
    ]);
    const san = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [otherName]);
    extensoes.push({ id: "2.5.29.17", critical: false, value: asn1.toDer(san).getBytes() });
  }
  cert.setExtensions(extensoes);
  cert.sign(chaves.privateKey);

  const p12 = forge.pkcs12.toPkcs12Asn1(chaves.privateKey, [cert], opts.senha, { generateLocalKeyId: true });
  return Buffer.from(forge.asn1.toDer(p12).getBytes(), "binary");
}

describe("certificado A1 — ler o que há dentro", () => {
  it("lê titular, autoridade e validade de um e-CPF", () => {
    const pfx = fazCertificado({
      cn: "GISELE BARBOSA:12345678901",
      senha: "segredo",
      diasDeValidade: 300,
    });
    const r = lerCertificado(pfx, "segredo");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.dados.titular).toBe("GISELE BARBOSA");
    expect(r.dados.documento).toBe("12345678901");
    expect(r.dados.tipo).toBe("e-CPF");
    expect(r.dados.autoridade).toBe("AC TESTE RFB");
    expect(r.dados.diasParaVencer).toBeGreaterThan(290);
  });

  it("o CPF sai do OID da ICP-Brasil, não do nome", () => {
    // O OID manda: é onde o documento realmente mora, e o formato do CN varia por certificadora.
    const pfx = fazCertificado({
      cn: "GISELE BARBOSA",
      senha: "x",
      diasDeValidade: 100,
      oid: OID_PESSOA_FISICA,
      otherName: "1203198012345678901SSP",
    });
    const r = lerCertificado(pfx, "x");
    expect(r.ok && r.dados.documento).toBe("12345678901");
    expect(r.ok && r.dados.tipo).toBe("e-CPF");
  });

  it("reconhece e-CNPJ pelo OID de pessoa jurídica", () => {
    const pfx = fazCertificado({
      cn: "CLINICA EXEMPLO LTDA",
      senha: "x",
      diasDeValidade: 100,
      oid: OID_PESSOA_JURIDICA,
      otherName: "1203198012345678000199",
    });
    const r = lerCertificado(pfx, "x");
    expect(r.ok && r.dados.tipo).toBe("e-CNPJ");
    expect(r.ok && r.dados.documento).toBe("12345678000199");
  });

  it("certificado sem documento declarado não inventa um", () => {
    const pfx = fazCertificado({ cn: "SEM DOCUMENTO", senha: "x", diasDeValidade: 10 });
    const r = lerCertificado(pfx, "x");
    expect(r.ok && r.dados.documento).toBeNull();
    expect(r.ok && r.dados.tipo).toBe("desconhecido");
  });
});

describe("certificado A1 — os erros que a terapeuta vê", () => {
  it("senha errada é um erro PRÓPRIO, não 'arquivo inválido'", () => {
    // Ela resolve senha sozinha; 'arquivo inválido' a faria procurar outro arquivo à toa.
    const pfx = fazCertificado({ cn: "X", senha: "certa", diasDeValidade: 10 });
    const r = lerCertificado(pfx, "errada");
    expect(r.ok).toBe(false);
    expect(!r.ok && r.erro).toMatch(/[Ss]enha/);
  });

  it("arquivo que não é certificado diz isso", () => {
    const r = lerCertificado(Buffer.from("isto aqui é um pdf qualquer"), "x");
    expect(r.ok).toBe(false);
    expect(!r.ok && r.erro).toMatch(/certificado A1/);
  });

  it("arquivo vazio e senha vazia têm mensagem própria", () => {
    expect(lerCertificado(Buffer.alloc(0), "x").ok).toBe(false);
    const semSenha = lerCertificado(fazCertificado({ cn: "X", senha: "s", diasDeValidade: 1 }), "");
    expect(!semSenha.ok && semSenha.erro).toMatch(/senha/i);
  });
});

describe("certificado A1 — o vencimento, que é o defeito silencioso", () => {
  it("certificado JÁ VENCIDO é lido e denunciado, não recusado", () => {
    // Recusar esconderia o motivo. Ela precisa ver "venceu" para saber o que fazer.
    const pfx = fazCertificado({ cn: "VENCIDO", senha: "x", diasDeValidade: -30 });
    const r = lerCertificado(pfx, "x");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.dados.diasParaVencer).toBeLessThan(0);
    expect(avisoDeVencimento(r.dados.diasParaVencer)?.nivel).toBe("vencido");
  });

  it("os três níveis de aviso, e o silêncio quando falta muito", () => {
    expect(avisoDeVencimento(-1)?.nivel).toBe("vencido");
    expect(avisoDeVencimento(10)?.nivel).toBe("urgente");
    expect(avisoDeVencimento(30)?.nivel).toBe("atencao");
    expect(avisoDeVencimento(200)).toBeNull();
  });

  it("o aviso de vencido diz que a emissão PARA — o sistema fiscal não avisa", () => {
    expect(avisoDeVencimento(-5)?.texto).toMatch(/Nenhuma nota será emitida/);
  });
});

describe("certificado A1 — o teto do arquivo", () => {
  it("meio mega é muito mais do que um A1 precisa", () => {
    expect(TETO_DO_CERTIFICADO).toBe(512 * 1024);
    expect(fazCertificado({ cn: "X", senha: "x", diasDeValidade: 1 }).length).toBeLessThan(TETO_DO_CERTIFICADO);
  });
});
