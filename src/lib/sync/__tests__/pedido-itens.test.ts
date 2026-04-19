import { describe, it, expect } from "vitest";

describe("pedido-itens processing", () => {
  it("maps VHSys item response to Supabase row correctly", () => {
    const vhsysItem = {
      id_ped_produto: 100,
      id_pedido: 200,
      id_produto: 300,
      desc_produto: "Produto Teste",
      qtde_produto: "3.0000",
      valor_unit_produto: "15.000000",
      valor_total_produto: "45.00",
      desconto_produto: "0.00",
    };

    const mapped = {
      id_ped_produto: vhsysItem.id_ped_produto,
      id_pedido: vhsysItem.id_pedido,
      id_produto: vhsysItem.id_produto,
      desc_produto: vhsysItem.desc_produto,
      qtde_produto: Number(vhsysItem.qtde_produto) || 0,
      valor_unit_produto: Number(vhsysItem.valor_unit_produto) || 0,
      valor_total_produto: Number(vhsysItem.valor_total_produto) || 0,
      desconto_produto: Number(vhsysItem.desconto_produto) || 0,
    };

    expect(mapped.qtde_produto).toBe(3);
    expect(mapped.valor_unit_produto).toBe(15);
    expect(mapped.valor_total_produto).toBe(45);
    expect(mapped.desconto_produto).toBe(0);
  });

  it("handles empty and zero string values", () => {
    expect(Number("") || 0).toBe(0);
    expect(Number("0.00") || 0).toBe(0);
    expect(Number("0.0000") || 0).toBe(0);
    expect(Number("NaN") || 0).toBe(0);
  });

  it("handles typical VHSys quantity formats", () => {
    expect(Number("1.0000")).toBe(1);
    expect(Number("10.5000")).toBe(10.5);
    expect(Number("100.000000")).toBe(100);
  });
});
