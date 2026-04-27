-- Pedido itens: produtos vendidos em cada pedido (sincronizados via /pedidos/{id}/produtos)
CREATE TABLE IF NOT EXISTS pedido_itens (
  id_pedido_produto bigint PRIMARY KEY,
  id_pedido bigint NOT NULL,
  id_produto bigint,
  desc_produto text,
  cod_produto text,
  quantidade numeric(15, 4),
  valor_unitario numeric(15, 2),
  valor_total numeric(15, 2),
  desconto numeric(15, 2),
  synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pedido_itens_id_pedido  ON pedido_itens (id_pedido);
CREATE INDEX IF NOT EXISTS idx_pedido_itens_id_produto ON pedido_itens (id_produto);

-- Marcador de pedidos cujos itens já foram sincronizados (NULL = pendente)
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS itens_sincronizados_em timestamptz;

-- Índice parcial para varrer rapidamente os pedidos pendentes de sync
CREATE INDEX IF NOT EXISTS idx_pedidos_itens_pendentes
  ON pedidos (data_pedido DESC)
  WHERE itens_sincronizados_em IS NULL;
