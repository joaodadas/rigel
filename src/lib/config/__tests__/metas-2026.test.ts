import { describe, it, expect } from "vitest";
import {
  getMetaMensal,
  getMetaAcumulada,
  SAZONALIDADE_POR_MES,
  METAS_VENDEDORES,
  TOTAL_B2B,
} from "../metas-2026";

describe("getMetaMensal", () => {
  it("calculates monthly meta using seasonality", () => {
    const janMeta = getMetaMensal(3000000, 1);
    expect(janMeta).toBe(225000);
  });

  it("returns 0 for invalid month", () => {
    expect(getMetaMensal(1000000, 13)).toBe(0);
    expect(getMetaMensal(1000000, 0)).toBe(0);
  });
});

describe("getMetaAcumulada", () => {
  it("sums metas from Jan to given month", () => {
    const acum4 = getMetaAcumulada(1000000, 4);
    expect(acum4).toBeCloseTo(261000, 0);
  });
});

describe("SAZONALIDADE_POR_MES", () => {
  it("sums to ~100%", () => {
    const total = Object.values(SAZONALIDADE_POR_MES).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(100, 0);
  });
});

describe("METAS_VENDEDORES", () => {
  it("has vendas_internas entries for Aline and Fatima", () => {
    const vi = METAS_VENDEDORES.filter((v) => v.tipo === "vendas_internas");
    expect(vi).toHaveLength(2);
    expect(vi.map((v) => v.nome)).toContain("Aline (VI-01)");
  });

  it("total meta_2026 is close to TOTAL_B2B (rounding tolerance)", () => {
    const sum = METAS_VENDEDORES.reduce((s, v) => s + v.meta_2026, 0);
    expect(sum).toBeCloseTo(TOTAL_B2B.meta_2026, -1);
  });
});
