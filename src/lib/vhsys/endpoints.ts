export const VHSYS_BASE_URL = "https://api.vhsys.com.br/v2";

export const ENDPOINTS = {
  clientes: "/clientes",
  pedidos: "/pedidos",
  produtos: "/produtos",
  contasPagar: "/contas-pagar",
  contasReceber: "/contas-receber",
  notasFiscais: "/notas-fiscais",
  orcamentos: "/orcamentos",
  extratos: "/extratos",
  vendedores: "/vendedores",
  contasBancarias: "/contas-bancarias",
  centrosCusto: "/centros-custo",
  categoriasFinanceiras: "/categorias-financeiras",
  webhooks: "/webhooks",
} as const;

export const MAX_PAGE_SIZE = 250;
