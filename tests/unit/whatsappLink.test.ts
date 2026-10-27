import { describe, it, expect } from "vitest";
import { urlDoAplicativo } from "@/lib/whatsappLink";

describe("doc 63: abrir a conversa no aplicativo do computador", () => {
  it("converte o wa.me com mensagem em whatsapp://send", () => {
    expect(urlDoAplicativo("https://wa.me/5511999990000?text=Ol%C3%A1%21"))
      .toBe("whatsapp://send?phone=5511999990000&text=Ol%C3%A1%21");
  });

  it("converte o wa.me sem mensagem", () => {
    expect(urlDoAplicativo("https://wa.me/5511999990000")).toBe("whatsapp://send?phone=5511999990000");
  });

  it("preserva a mensagem codificada como está — recodificar quebraria o texto", () => {
    const texto = encodeURIComponent("Olá! Sessão de 09/11/26 — R$ 240,00");
    expect(urlDoAplicativo(`https://wa.me/5511999990000?text=${texto}`)).toContain(`&text=${texto}`);
  });

  it("endereço que não é wa.me não vira link de aplicativo", () => {
    expect(urlDoAplicativo("https://web.whatsapp.com/send?phone=55")).toBeNull();
    expect(urlDoAplicativo("https://wa.me/abc")).toBeNull();
    expect(urlDoAplicativo(null)).toBeNull();
    expect(urlDoAplicativo("")).toBeNull();
  });
});
