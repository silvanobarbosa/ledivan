import { describe, it, expect } from "vitest";
import { deveAbrirTour } from "@/lib/onboarding";

describe("deveAbrirTour", () => {
  it("abre sozinho na home do dashboard para quem nunca viu", () => {
    expect(deveAbrirTour({ pathname: "/dashboard", jaViu: false })).toBe(true);
  });

  it("não abre na home para quem já dispensou", () => {
    expect(deveAbrirTour({ pathname: "/dashboard", jaViu: true })).toBe(false);
  });

  // O bug: o tour cobria o formulário e engolia o clique do "Cadastrar paciente".
  it("NÃO abre sozinho sobre o formulário de novo paciente", () => {
    expect(deveAbrirTour({ pathname: "/dashboard/patients/new", jaViu: false })).toBe(false);
  });

  it("NÃO abre sozinho em nenhuma outra página do dashboard", () => {
    for (const p of [
      "/dashboard/agenda",
      "/dashboard/pagamentos",
      "/dashboard/patients",
      "/dashboard/patients/abc/edit",
      "/dashboard/settings",
    ]) {
      expect(deveAbrirTour({ pathname: p, jaViu: false })).toBe(false);
    }
  });

  it("abre em qualquer tela quando pedido explicitamente com ?tour=1", () => {
    expect(deveAbrirTour({ pathname: "/dashboard/patients/new", tourParam: "1", jaViu: true })).toBe(true);
  });

  it("ignora valor diferente de 1 no parâmetro", () => {
    expect(deveAbrirTour({ pathname: "/dashboard/agenda", tourParam: "0", jaViu: false })).toBe(false);
  });
});
