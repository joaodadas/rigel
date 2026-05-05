-- Marcador de pedidos cujos itens já foram sincronizados (NULL = pendente).
-- A coluna fazia parte da migration original do pedido_itens (commit 2295ba0,
-- depois removida em 01b8c8a sob a premissa de "schema já aplicado") mas
-- nunca chegou a ser criada no banco — o cron sync-pedido-itens crashava
-- com `column p.itens_sincronizados_em does not exist` (42703) a cada 5min.

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS itens_sincronizados_em timestamptz;

-- Índice parcial para varrer rapidamente os pedidos pendentes de sync.
CREATE INDEX IF NOT EXISTS idx_pedidos_itens_pendentes
  ON pedidos (data_pedido DESC)
  WHERE itens_sincronizados_em IS NULL;
