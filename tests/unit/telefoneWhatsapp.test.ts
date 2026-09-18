import { describe, expect, it } from "vitest";
import { numeroDoWhatsapp } from "@/lib/telefoneWhatsapp";

/**
 * O NÚMERO QUE VAI PARA O WHATSAPP (documento de 18/09).
 *
 * A terapeuta pediu que "Cobrar" abra o WhatsApp na conversa do paciente. Ele já abria — mas o
 * número era montado colando `55` na frente de qualquer coisa:
 *
 *     `https://wa.me/55${telefone.replace(/\D/g, "")}`
 *
 * Quem cadastrou com o DDI (`+55 11 98888-7777`) virava `5555119888877 77` e o WhatsApp abria
 * dizendo "número inválido" — indistinguível de "o botão não funciona".
 *
 * A regra certa já existia no envio pelo servidor (`whatsappEvolution.ts`); faltava ser uma só.
 */

describe("o número que abre a conversa", () => {
  it("número brasileiro com DDD ganha o 55", () => {
    expect(numeroDoWhatsapp("(11) 98888-7777")).toBe("5511988887777");
    expect(numeroDoWhatsapp("11988887777")).toBe("5511988887777");
  });

  it("número que JÁ tem o 55 não ganha outro", () => {
    expect(numeroDoWhatsapp("+55 11 98888-7777")).toBe("5511988887777");
    expect(numeroDoWhatsapp("5511988887777")).toBe("5511988887777");
  });

  it("fixo de oito dígitos com DDD também vale", () => {
    expect(numeroDoWhatsapp("(11) 3333-4444")).toBe("551133334444");
  });

  it("telefone vazio ou sem dígitos não vira número nenhum", () => {
    expect(numeroDoWhatsapp("")).toBeNull();
    expect(numeroDoWhatsapp(null)).toBeNull();
    expect(numeroDoWhatsapp("sem telefone")).toBeNull();
  });

  it("número curto demais não vira conversa — abrir errado é pior que não abrir", () => {
    // Sem DDD não há como adivinhar a cidade; abrir a conversa de um desconhecido é pior do que
    // avisar que falta o telefone.
    expect(numeroDoWhatsapp("98888-7777")).toBeNull();
    expect(numeroDoWhatsapp("3333-4444")).toBeNull();
  });

  it("anotação junto do número não atrapalha o que é telefone", () => {
    expect(numeroDoWhatsapp("(11) 98888-7777 (mãe)")).toBe("5511988887777");
  });
});
