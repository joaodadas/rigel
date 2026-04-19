// ── VHSys API Response Types ──

export interface VHSysResponse<T> {
  code: number;
  status: string;
  data: T[];
  paging: {
    total: number;
    page: number;
    limit: number;
    offset: number;
  };
}

export interface VHSysCliente {
  id_cliente: string;
  id_registro: string;
  tipo_pessoa: string;
  tipo_cadastro: string;
  cnpj_cliente: string;
  razao_cliente: string;
  fantasia_cliente: string;
  endereco_cliente: string;
  numero_cliente: string;
  bairro_cliente: string;
  cep_cliente: string;
  cidade_cliente: string;
  cidade_cliente_cod: string;
  uf_cliente: string;
  contato_cliente: string;
  fone_cliente: string;
  celular_cliente: string;
  email_cliente: string;
  insc_estadual_cliente: string;
  situacao_cliente: string;
  vendedor_cliente: string;
  vendedor_cliente_id: string;
  observacoes_cliente: string | null;
  data_nasc_cliente: string | null;
  data_cad_cliente: string;
  data_mod_cliente: string;
  lixeira: string;
}

export interface VHSysPedido {
  id_pedido: string;
  id_ped: string;
  id_cliente: string;
  nome_cliente: string;
  vendedor_pedido: string;
  vendedor_pedido_id: string;
  valor_total_produtos: string;
  desconto_pedido: string;
  frete_pedido: string;
  valor_total_nota: string;
  status_pedido: string;
  data_pedido: string;
  obs_pedido: string | null;
  contas_pedido: string;
  estoque_pedido: string;
  data_cad_pedido: string;
  data_mod_pedido: string;
  lixeira: string;
}

export interface VHSysProduto {
  id_produto: string;
  id_categoria: string;
  cod_produto: string;
  marca_produto: string;
  desc_produto: string;
  estoque_produto: string;
  unidade_produto: string;
  valor_produto: string;
  valor_custo_produto: string;
  ncm_produto: string;
  codigo_barra_produto: string;
  status_produto: string;
  data_cad_produto: string;
  data_mod_produto: string;
  lixeira: string;
}

export interface VHSysContaPagar {
  id_conta_pag: string;
  nome_conta: string;
  id_categoria: string;
  categoria_pag: string;
  id_banco: string;
  id_fornecedor: string;
  nome_fornecedor: string;
  vencimento_pag: string;
  valor_pag: string;
  valor_pago: string;
  liquidado_pag: string;
  data_pagamento: string | null;
  forma_pagamento: string;
  data_emissao: string;
  n_documento_pag: string;
  observacoes_pag: string | null;
  id_centro_custos: string;
  centro_custos_pag: string;
  data_cad_pag: string;
  data_mod_pag: string;
  lixeira: string;
}

export interface VHSysContaReceber {
  id_conta_rec: string;
  nome_conta: string;
  id_categoria: string;
  categoria_rec: string;
  id_banco: string;
  id_cliente: string;
  nome_cliente: string;
  vencimento_rec: string;
  valor_rec: string;
  valor_pago: string;
  liquidado_rec: string;
  data_pagamento: string | null;
  forma_pagamento: string;
  tipo_conta: string;
  data_emissao: string;
  n_documento_rec: string;
  observacoes_rec: string | null;
  id_centro_custos: string;
  centro_custos_rec: string;
  data_cad_rec: string;
  data_mod_rec: string;
  lixeira: string;
}

export interface VHSysVendedor {
  id_vendedor: string;
  razao_vendedor: string;
  tipo_pessoa: string;
  cnpj_vendedor: string;
  fantasia_vendedor: string;
  cidade_vendedor: string;
  uf_vendedor: string;
  fone_vendedor: string;
  email_vendedor: string;
  situacao_vendedor: string;
  comissao_usuario: string;
  data_cad_vendedor: string;
  data_mod_vendedor: string;
  lixeira: string;
}

export interface VHSysPedidoItem {
  id_ped_produto: number;
  id_pedido: number;
  id_produto: number;
  id_almoxarifado: number;
  id_lote: number;
  desc_produto: string;
  qtde_produto: string;
  desconto_produto: string;
  ipi_produto: string;
  icms_produto: string;
  valor_unit_produto: string;
  valor_custo_produto: string;
  valor_total_produto: string;
  valor_desconto: string;
  peso_produto: string;
  peso_liq_produto: string;
  info_adicional: string;
  xPed_produto: string;
  nItem_produto: string;
  json_localizacoes: string;
}
