import { describe, it, expect } from "vitest";
import { resolveFeature, resolveAll, parseOverrides, FEATURES } from "@/lib/features";

describe("resolveFeature", () => {
  it("modo 'all' liga para todos, ignorando override", () => {
    expect(resolveFeature("all", undefined)).toBe(true);
    expect(resolveFeature("all", false)).toBe(true);
  });

  it("modo 'off' ou indefinido nunca liga", () => {
    expect(resolveFeature("off", true)).toBe(false);
    expect(resolveFeature(undefined, true)).toBe(false);
  });

  it("modo 'per-patient' só liga com override === true", () => {
    expect(resolveFeature("per-patient", true)).toBe(true);
    expect(resolveFeature("per-patient", false)).toBe(false);
    expect(resolveFeature("per-patient", undefined)).toBe(false);
  });
});

describe("parseOverrides", () => {
  it("retorna {} para nulo/vazio/JSON inválido", () => {
    expect(parseOverrides(null)).toEqual({});
    expect(parseOverrides(undefined)).toEqual({});
    expect(parseOverrides("")).toEqual({});
    expect(parseOverrides("{isso não é json")).toEqual({});
  });

  it("faz parse de um objeto de overrides", () => {
    expect(parseOverrides('{"diary":true,"payment":false}')).toEqual({ diary: true, payment: false });
  });

  it("ignora JSON que não é objeto", () => {
    expect(parseOverrides("42")).toEqual({});
    expect(parseOverrides('"texto"')).toEqual({});
  });
});

describe("resolveAll", () => {
  it("resolve cada recurso do catálogo combinando modo + override", () => {
    const modes = { diary: "all", payment: "per-patient", scales: "off" } as const;
    const overrides = { payment: true };
    const out = resolveAll(modes, overrides);
    expect(out.diary).toBe(true);
    expect(out.payment).toBe(true);
    expect(out.scales).toBe(false);
    // Não configurado → desligado.
    expect(out.timer).toBe(false);
  });

  it("cobre todas as chaves do catálogo", () => {
    const out = resolveAll(undefined, {});
    for (const f of FEATURES) expect(out[f.key]).toBe(false);
    expect(Object.keys(out).length).toBe(FEATURES.length);
  });
});
