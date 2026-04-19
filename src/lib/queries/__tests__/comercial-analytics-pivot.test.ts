import { describe, it, expect } from "vitest";

describe("demonstrativo pivot logic", () => {
  it("builds product x month pivot correctly", () => {
    const items = [
      { id_produto: 1, desc_produto: "Prod A", valor_total_produto: "100", id_pedido: 10 },
      { id_produto: 1, desc_produto: "Prod A", valor_total_produto: "200", id_pedido: 11 },
      { id_produto: 2, desc_produto: "Prod B", valor_total_produto: "50", id_pedido: 10 },
    ];
    const dateMap = new Map<number, string>([[10, "2026-01-15"], [11, "2026-02-10"]]);

    const prodMap: Record<number, { descProduto: string; meses: Record<string, number>; total: number }> = {};
    const totaisMes: Record<string, number> = {};
    let totalGeral = 0;

    for (const item of items) {
      const date = dateMap.get(item.id_pedido);
      if (!date) continue;
      const mes = date.slice(0, 7);
      const valor = Number(item.valor_total_produto);
      const pid = item.id_produto;

      if (!prodMap[pid]) prodMap[pid] = { descProduto: item.desc_produto, meses: {}, total: 0 };
      prodMap[pid].meses[mes] = (prodMap[pid].meses[mes] || 0) + valor;
      prodMap[pid].total += valor;
      totaisMes[mes] = (totaisMes[mes] || 0) + valor;
      totalGeral += valor;
    }

    expect(prodMap[1].total).toBe(300);
    expect(prodMap[1].meses["2026-01"]).toBe(100);
    expect(prodMap[1].meses["2026-02"]).toBe(200);
    expect(prodMap[2].total).toBe(50);
    expect(prodMap[2].meses["2026-01"]).toBe(50);
    expect(totaisMes["2026-01"]).toBe(150);
    expect(totaisMes["2026-02"]).toBe(200);
    expect(totalGeral).toBe(350);
  });

  it("handles products appearing in multiple months", () => {
    const items = [
      { id_produto: 1, desc_produto: "X", valor_total_produto: "10", id_pedido: 1 },
      { id_produto: 1, desc_produto: "X", valor_total_produto: "20", id_pedido: 2 },
      { id_produto: 1, desc_produto: "X", valor_total_produto: "30", id_pedido: 3 },
    ];
    const dateMap = new Map<number, string>([[1, "2026-01-01"], [2, "2026-01-15"], [3, "2026-02-01"]]);

    const prodMap: Record<number, { meses: Record<string, number>; total: number }> = {};

    for (const item of items) {
      const date = dateMap.get(item.id_pedido);
      if (!date) continue;
      const mes = date.slice(0, 7);
      const valor = Number(item.valor_total_produto);
      const pid = item.id_produto;

      if (!prodMap[pid]) prodMap[pid] = { meses: {}, total: 0 };
      prodMap[pid].meses[mes] = (prodMap[pid].meses[mes] || 0) + valor;
      prodMap[pid].total += valor;
    }

    expect(prodMap[1].meses["2026-01"]).toBe(30); // 10 + 20
    expect(prodMap[1].meses["2026-02"]).toBe(30);
    expect(prodMap[1].total).toBe(60);
  });

  it("returns empty pivot for no items", () => {
    const prodMap: Record<number, { meses: Record<string, number>; total: number }> = {};
    expect(Object.keys(prodMap)).toHaveLength(0);
  });
});
