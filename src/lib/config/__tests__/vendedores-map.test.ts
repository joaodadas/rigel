import { describe, it, expect } from "vitest";
import {
  normalizeVendedor,
  isB2B,
  B2B_VENDEDORES_NORMALIZED,
  getVendasInternasMetaCombinada,
} from "../vendedores-map";

describe("normalizeVendedor", () => {
  it("trims whitespace", () => {
    expect(normalizeVendedor("CLAUDIO ")).toBe("Claudio");
    expect(normalizeVendedor(" EDWILSON ")).toBe("Edwilson");
  });

  it("normalizes VENDAS INTERNAS variants", () => {
    expect(normalizeVendedor("VENDAS INTERNAS")).toBe("Vendas Internas");
    expect(normalizeVendedor("vendas internas")).toBe("Vendas Internas");
    expect(normalizeVendedor("vendas internas ")).toBe("Vendas Internas");
    expect(normalizeVendedor("vendas internos ")).toBe("Vendas Internas");
    expect(normalizeVendedor("vendas onternas")).toBe("Vendas Internas");
    expect(normalizeVendedor("VENDAS INTERNAS ")).toBe("Vendas Internas");
  });

  it("normalizes ANA PAULA RAMOS variants", () => {
    expect(normalizeVendedor("ANA PAULA RAMOS")).toBe("Ana Paula Ramos");
    expect(normalizeVendedor("ANA PAULA RAMOS ")).toBe("Ana Paula Ramos");
  });

  it("normalizes known representantes to title case", () => {
    expect(normalizeVendedor("JOSE ROBERTO")).toBe("Jose Roberto");
    expect(normalizeVendedor("FRANCISCO MOREIRA")).toBe("Francisco Moreira");
    expect(normalizeVendedor("SANTOS MAIA - CARLA")).toBe("Santos Maia - Carla");
    expect(normalizeVendedor("FRANCISCO/SANDY")).toBe("Francisco/Sandy");
    expect(normalizeVendedor("PEDRO SERGIO")).toBe("Pedro Sergio");
    expect(normalizeVendedor("FRANCISCO CWB")).toBe("Francisco CWB");
  });

  it("preserves CGQ as uppercase", () => {
    expect(normalizeVendedor("CGQ")).toBe("CGQ");
  });

  it("returns original trimmed name for unknown vendedores", () => {
    expect(normalizeVendedor("MERCADOFULL")).toBe("MERCADOFULL");
    expect(normalizeVendedor("SHOPEE")).toBe("SHOPEE");
    expect(normalizeVendedor("Fast-martelinho")).toBe("Fast-martelinho");
  });

  it("handles null/empty", () => {
    expect(normalizeVendedor(null)).toBe("Sem vendedor");
    expect(normalizeVendedor("")).toBe("Sem vendedor");
    expect(normalizeVendedor("   ")).toBe("Sem vendedor");
  });
});

describe("isB2B", () => {
  it("returns true for known B2B vendedores", () => {
    expect(isB2B("Vendas Internas")).toBe(true);
    expect(isB2B("Claudio")).toBe(true);
    expect(isB2B("Edwilson")).toBe(true);
    expect(isB2B("Jose Roberto")).toBe(true);
    expect(isB2B("Jessica")).toBe(true);
    expect(isB2B("Kelly")).toBe(true);
  });

  it("returns false for e-commerce channels", () => {
    expect(isB2B("MERCADOFULL")).toBe(false);
    expect(isB2B("SHOPEE")).toBe(false);
    expect(isB2B("MERCADOLIVRE")).toBe(false);
    expect(isB2B("SHEIN")).toBe(false);
    expect(isB2B("SITE RIGEL")).toBe(false);
  });

  it("returns false for unknown vendedores", () => {
    expect(isB2B("Fast-martelinho")).toBe(false);
    expect(isB2B("KATLLYN")).toBe(false);
    expect(isB2B("Sem vendedor")).toBe(false);
  });
});

describe("B2B_VENDEDORES_NORMALIZED", () => {
  it("contains UPPER of all metas vendedores + Vendas Internas", () => {
    expect(B2B_VENDEDORES_NORMALIZED).toContain("VENDAS INTERNAS");
    expect(B2B_VENDEDORES_NORMALIZED).toContain("CLAUDIO");
    expect(B2B_VENDEDORES_NORMALIZED).toContain("EDWILSON");
    expect(B2B_VENDEDORES_NORMALIZED).toContain("JOSE ROBERTO");
    expect(B2B_VENDEDORES_NORMALIZED).toContain("JESSICA");
    expect(B2B_VENDEDORES_NORMALIZED).toContain("FRANCISCO/SANDY");
    expect(B2B_VENDEDORES_NORMALIZED).toContain("SANTOS MAIA - CARLA");
  });

  it("does not contain Aline or Fatima individually (they are Vendas Internas)", () => {
    const hasAline = B2B_VENDEDORES_NORMALIZED.some((v) => v.includes("ALINE"));
    expect(hasAline).toBe(false);
  });
});

describe("getVendasInternasMetaCombinada", () => {
  it("returns sum of Aline + Fatima metas", () => {
    expect(getVendasInternasMetaCombinada()).toBe(3646425);
  });
});
