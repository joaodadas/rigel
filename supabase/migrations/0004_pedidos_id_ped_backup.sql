-- Backup pré-migração 0005 (re-key de pedidos para id_ped).
-- Só cria tabelas novas — não altera nada existente. Idempotente.
-- pedidos_id_map_20260611 preserva o mapeamento id antigo ↔ id_ped, que é a
-- única informação não-recuperável pela API caso a 0005 dê errado.
-- Manter até a 0005 ser validada em produção.

CREATE TABLE IF NOT EXISTS pedidos_id_map_20260611 AS
  SELECT id_pedido AS id_pedido_antigo, id_ped
  FROM pedidos
  WHERE id_pedido <> 0;

CREATE TABLE IF NOT EXISTS pedido_itens_backup_20260611 AS
  SELECT * FROM pedido_itens;
