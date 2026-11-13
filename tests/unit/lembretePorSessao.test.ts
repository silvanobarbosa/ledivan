import { describe, expect, it } from "vitest";
import { agoraEmParede, horaDeDisparar, sessoesParaLembrarAgora } from "@/lib/lembretePorSessao";

/**
 * O LEMBRETE COM A ANTECEDÊNCIA DE CADA SESSÃO (dono, 13/11/2026).
 *
 * Até aqui o envio era por TURNO: 6h da manhã para as sessões do dia, 15h para as de amanhã, e a
 * escolha valia para todos os pacientes. O campo "quantas horas antes" existia no agendamento, era
 * gravado — e nunca lido por envio nenhum.
 *
 * Agora cada sessão manda na hora dela. O cron passa a rodar de hora em hora e esta função decide
 * QUEM entra em cada passada. Pura, porque errar aqui é mandar mensagem a paciente na madrugada —
 * e isso não se testa esperando dar meia-noite.
 */

const SESSAO = new Date(2026, 10, 20, 15, 0, 0); // sexta, 20/11, 15h

const s = (extra: Partial<Parameters<typeof sessoesParaLembrarAgora>[1][number]> = {}) => ({
  id: "s1",
  date: SESSAO,
  confirmChannel: "whatsapp",
  confirmLeadHours: 24,
  reminderSentAt: null,
  ...extra,
});

const em = (dia: number, hora: number) => new Date(2026, 10, dia, hora, 0, 0);

describe("a janela de disparo", () => {
  it("manda quando a antecedência chega", () => {
    // 24h antes = 19/11 às 15h.
    expect(horaDeDisparar(em(19, 15), s())).toBe(true);
    expect(horaDeDisparar(em(19, 16), s())).toBe(true);
    expect(horaDeDisparar(em(20, 14), s())).toBe(true);
  });

  it("não manda antes da hora", () => {
    expect(horaDeDisparar(em(19, 14), s())).toBe(false);
    expect(horaDeDisparar(em(18, 23), s())).toBe(false);
  });

  /**
   * Passada a sessão, o lembrete não serve para nada e vira constrangimento: "não esqueça da sua
   * sessão de ontem". Se o cron falhou a tarde inteira, perder o lembrete é melhor do que mandá-lo
   * errado.
   */
  it("não manda depois que a sessão começou", () => {
    expect(horaDeDisparar(em(20, 15), s())).toBe(false);
    expect(horaDeDisparar(em(20, 16), s())).toBe(false);
  });

  it("já enviado não repete", () => {
    expect(horaDeDisparar(em(20, 14), s({ reminderSentAt: new Date() }))).toBe(false);
  });
});

describe("quem NÃO entra neste caminho", () => {
  it("sessão sem canal escolhido", () => {
    expect(horaDeDisparar(em(20, 14), s({ confirmChannel: "nenhum" }))).toBe(false);
    expect(horaDeDisparar(em(20, 14), s({ confirmChannel: null }))).toBe(false);
  });

  /** Sem a antecedência não há o que calcular — a sessão segue no turno antigo. */
  it("sessão sem horas definidas", () => {
    expect(horaDeDisparar(em(20, 14), s({ confirmLeadHours: null }))).toBe(false);
    expect(horaDeDisparar(em(20, 14), s({ confirmLeadHours: 0 }))).toBe(false);
  });

  /**
   * E-MAIL ficou no banco de agendamentos antigos (o canal saiu da oferta em 13/11). O envio é por
   * WhatsApp; mandar e-mail aqui seria ressuscitar um canal que o dono desligou.
   */
  it("canal antigo de e-mail não dispara", () => {
    expect(horaDeDisparar(em(20, 14), s({ confirmChannel: "email" }))).toBe(false);
  });
});

describe("a peneira da passada do cron", () => {
  it("separa só as que estão na hora", () => {
    const lista = [
      s({ id: "agora", date: em(20, 15), confirmLeadHours: 24 }),
      s({ id: "cedo", date: em(25, 15), confirmLeadHours: 24 }),
      s({ id: "passou", date: em(19, 10), confirmLeadHours: 24 }),
      s({ id: "sem-canal", date: em(20, 15), confirmChannel: "nenhum" }),
    ];
    expect(sessoesParaLembrarAgora(em(19, 16), lista).map((x) => x.id)).toEqual(["agora"]);
  });

  it("lista vazia não quebra", () => {
    expect(sessoesParaLembrarAgora(em(19, 16), [])).toEqual([]);
  });
});

/**
 * O FUSO — a armadilha que faria o lembrete chegar três horas errado, sem nada quebrar.
 *
 * A coluna guarda hora de parede e o driver a monta como se fosse UTC; o processo na Vercel roda
 * em UTC. Comparar o `new Date()` do servidor com essas datas desloca tudo em 3h.
 */
describe("o agora no mesmo relógio das sessões", () => {
  // Sessão de 20/11 às 15:00 de PAREDE: o driver a monta como 15:00Z (ver `horaLocal.ts`).
  const sessaoDeParede = { ...s(), date: new Date(Date.UTC(2026, 10, 20, 15, 0, 0)) };

  it("traz o relógio do servidor para a hora de parede", () => {
    // 18:00 UTC = 15:00 em Brasília.
    expect(agoraEmParede(new Date(Date.UTC(2026, 10, 19, 18, 0, 0))).toISOString()).toBe("2026-11-19T15:00:00.000Z");
  });

  it("com 24h de antecedência, dispara quando o servidor marca 18:00Z da véspera", () => {
    const noPonto = new Date(Date.UTC(2026, 10, 19, 18, 0, 0)); // 15:00 em Brasília
    expect(horaDeDisparar(agoraEmParede(noPonto), sessaoDeParede)).toBe(true);
  });

  /**
   * Uma hora ANTES do ponto, não dispara. E é aqui que o relógio cru do servidor erraria: para
   * ele a janela já teria aberto — o lembrete sairia TRÊS HORAS adiantado, todos os dias, sem
   * nada quebrar em lugar nenhum.
   */
  it("uma hora antes não dispara — e o relógio cru dispararia", () => {
    const cedo = new Date(Date.UTC(2026, 10, 19, 17, 0, 0)); // 14:00 em Brasília
    expect(horaDeDisparar(agoraEmParede(cedo), sessaoDeParede)).toBe(false);
    expect(horaDeDisparar(cedo, sessaoDeParede)).toBe(true);
  });
});
