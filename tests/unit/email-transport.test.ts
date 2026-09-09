import { describe, it, expect, beforeAll } from "vitest";
import nodemailer from "nodemailer";

// Cobre o contrato que o app usa do nodemailer. Existe porque o salto 9 → 10 é de versão
// MAIOR e o envio de e-mail não tinha teste nenhum: a quebra só apareceria quando um
// terapeuta tentasse mandar mensagem para o paciente, em produção.
//
// Não abre conexão SMTP: usa o jsonTransport do próprio nodemailer, que monta a mensagem
// de verdade (cabeçalhos, envelope, corpo) sem rede.

// lib/email importa o módulo de banco no topo, que exige DATABASE_URL. A URL abaixo é
// sintaticamente válida e nunca conecta (o driver é lazy) — só permite carregar o módulo.
beforeAll(() => {
  process.env.DATABASE_URL ||= "postgresql://teste:teste@localhost:5432/teste";
});

describe("nodemailer — contrato usado pelo app", () => {
  it("createTransport devolve transporter com sendMail e verify", async () => {
    const { makeTransport } = await import("@/lib/email");
    const t = makeTransport({ host: "smtp.exemplo.com", port: 587, secure: false, user: "u", pass: "p" });
    expect(typeof t.sendMail).toBe("function");
    expect(typeof t.verify).toBe("function");
  });

  it("monta a mensagem com remetente, destinatário, assunto e HTML", async () => {
    const t = nodemailer.createTransport({ jsonTransport: true });
    const r = await t.sendMail({
      from: "Consultório <terapeuta@exemplo.com>",
      to: "paciente@exemplo.com",
      subject: "Confirmação de sessão",
      html: "<p>Sua sessão é amanhã às 14h.</p>",
    });
    const msg = JSON.parse(String(r.message));
    expect(msg.subject).toBe("Confirmação de sessão");
    expect(msg.html).toContain("14h");
    expect(msg.to?.[0]?.address).toBe("paciente@exemplo.com");
    expect(r.envelope?.to).toContain("paciente@exemplo.com");
  });

  it("preserva acento no assunto (codificação do cabeçalho)", async () => {
    const t = nodemailer.createTransport({ jsonTransport: true });
    const r = await t.sendMail({
      from: "a@exemplo.com",
      to: "b@exemplo.com",
      subject: "Sessão de terapia — confirmação",
      text: "corpo",
    });
    expect(JSON.parse(String(r.message)).subject).toBe("Sessão de terapia — confirmação");
  });
});
