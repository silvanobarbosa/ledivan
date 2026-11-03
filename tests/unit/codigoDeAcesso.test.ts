import { describe, it, expect } from "vitest";
import {
  conferirCodigo, digitosDoCodigo, gerarCodigo, hashConfere, hashDoCodigo,
  MAX_TENTATIVAS, mensagemDoCodigo, RECADO, VALIDADE_MS,
} from "@/lib/codigoDeAcesso";

const SEGREDO = "segredo-de-teste-do-servidor";
const agora = new Date(2026, 10, 3, 10, 0, 0);
const daqui = (ms: number) => new Date(agora.getTime() + ms);

const gravado = (codigo: string, extra: Partial<{ expiraEm: Date; tentativas: number; usadoEm: Date | null }> = {}) => ({
  codigoHash: hashDoCodigo(codigo, SEGREDO),
  expiraEm: extra.expiraEm ?? daqui(VALIDADE_MS),
  tentativas: extra.tentativas ?? 0,
  usadoEm: extra.usadoEm ?? null,
});

describe("código de acesso — o que é gerado", () => {
  it("tem 6 dígitos, sempre, inclusive quando começa com zero", () => {
    for (let i = 0; i < 200; i++) {
      const c = gerarCodigo();
      expect(c).toMatch(/^\d{6}$/);
    }
  });

  it("não se repete a cada chamada — seria uma senha fixa", () => {
    const vistos = new Set(Array.from({ length: 200 }, () => gerarCodigo()));
    expect(vistos.size).toBeGreaterThan(150);
  });
});

describe("código de acesso — o que vai para o banco", () => {
  it("o código NÃO aparece no que é guardado", () => {
    // O fluxo do paciente guarda o código puro; quem lê o banco entra na conta. Aqui não.
    const h = hashDoCodigo("123456", SEGREDO);
    expect(h).not.toContain("123456");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("o mesmo código com segredo diferente dá hash diferente", () => {
    // Sem isso, uma tabela de 1 milhão de hashes resolveria todos os códigos possíveis.
    expect(hashDoCodigo("123456", SEGREDO)).not.toBe(hashDoCodigo("123456", "outro-segredo"));
  });

  it("sem segredo, recusa em vez de gerar um hash fraco", () => {
    expect(() => hashDoCodigo("123456", "")).toThrow();
  });

  it("a comparação aceita o igual e recusa tamanhos diferentes sem estourar", () => {
    expect(hashConfere("abc", "abc")).toBe(true);
    expect(hashConfere("abc", "abcd")).toBe(false);
    expect(hashConfere("", "x")).toBe(false);
  });
});

describe("código de acesso — quando vale e quando não vale", () => {
  it("código certo, dentro do prazo, vale", () => {
    expect(conferirCodigo(gravado("123456"), "123456", SEGREDO, agora)).toEqual({ ok: true });
  });

  it("aceita como a pessoa digita: com espaço, traço, ou colado de uma frase", () => {
    for (const jeito of ["123 456", "123-456", " 123456 ", "codigo 123456"]) {
      expect(conferirCodigo(gravado("123456"), jeito, SEGREDO, agora)).toEqual({ ok: true });
    }
  });

  it("código errado não vale", () => {
    expect(conferirCodigo(gravado("123456"), "654321", SEGREDO, agora)).toEqual({ ok: false, motivo: "incorreto" });
  });

  it("EXPIRADO vem antes de incorreto — senão ela confere dígitos que estavam certos", () => {
    const velho = gravado("123456", { expiraEm: daqui(-1) });
    expect(conferirCodigo(velho, "123456", SEGREDO, agora)).toEqual({ ok: false, motivo: "expirado" });
    // E mesmo com o código errado, o motivo que manda é o vencimento.
    expect(conferirCodigo(velho, "000000", SEGREDO, agora)).toEqual({ ok: false, motivo: "expirado" });
  });

  it("código já usado não serve de novo", () => {
    const usado = gravado("123456", { usadoEm: agora });
    expect(conferirCodigo(usado, "123456", SEGREDO, agora)).toEqual({ ok: false, motivo: "usado" });
  });

  it("estourou as tentativas, o código morre mesmo estando certo", () => {
    const queimado = gravado("123456", { tentativas: MAX_TENTATIVAS });
    expect(conferirCodigo(queimado, "123456", SEGREDO, agora)).toEqual({ ok: false, motivo: "tentativas" });
  });

  it("sem código gravado, responde 'incorreto' — nunca revela que não há conta", () => {
    expect(conferirCodigo(null, "123456", SEGREDO, agora)).toEqual({ ok: false, motivo: "incorreto" });
  });

  it("código de tamanho errado não chega a ser comparado", () => {
    expect(conferirCodigo(gravado("123456"), "12345", SEGREDO, agora)).toEqual({ ok: false, motivo: "incorreto" });
    expect(conferirCodigo(gravado("123456"), "", SEGREDO, agora)).toEqual({ ok: false, motivo: "incorreto" });
  });

  it("o segredo errado não abre o código certo", () => {
    expect(conferirCodigo(gravado("123456"), "123456", "segredo-errado", agora)).toEqual({ ok: false, motivo: "incorreto" });
  });
});

describe("código de acesso — o que a pessoa lê", () => {
  it("todo motivo tem recado, e nenhum revela se a conta existe", () => {
    for (const motivo of ["expirado", "usado", "tentativas", "incorreto"] as const) {
      expect(RECADO[motivo].length).toBeGreaterThan(5);
      expect(RECADO[motivo]).not.toMatch(/conta|cadastr|usuári|e-mail não/i);
    }
  });

  it("a mensagem enviada traz o código, o prazo e o aviso de uso único", () => {
    const m = mensagemDoCodigo("123456");
    expect(m).toContain("123456");
    expect(m).toMatch(/10 minutos/);
    expect(m).toMatch(/uma vez/);
    expect(m).toMatch(/ignore/i);
  });

  it("digitosDoCodigo corta no sexto dígito", () => {
    expect(digitosDoCodigo("1234567890")).toBe("123456");
  });
});
