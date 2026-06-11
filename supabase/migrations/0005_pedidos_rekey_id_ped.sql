-- A VHSys migrou o ID canônico de pedidos para id_ped (~20/05/2026): a listagem
-- passou a devolver id_pedido=0 e /pedidos/{id} e /pedidos/{id}/produtos só
-- aceitam id_ped. Esta migração re-chaveia pedidos e pedido_itens para id_ped.
--
-- Roda inteira em uma transação: falha em qualquer passo (inclusive queda de
-- conexão) reverte tudo. Requer a 0004 (backup) aplicada antes.

BEGIN;

-- Pré-condições.
DO $$
DECLARE
  n_map bigint;
  n_pedidos bigint;
  n_null bigint;
  n_dup bigint;
  n_orfaos bigint;
BEGIN
  SELECT count(*) INTO n_map FROM pedidos_id_map_20260611;
  SELECT count(*) INTO n_pedidos FROM pedidos WHERE id_pedido <> 0;
  IF n_map = 0 OR n_map <> n_pedidos THEN
    RAISE EXCEPTION 'backup pedidos_id_map_20260611 (% linhas) difere de pedidos (% linhas) — rode a 0004 novamente', n_map, n_pedidos;
  END IF;

  SELECT count(*) INTO n_null FROM pedidos WHERE id_ped IS NULL;
  IF n_null > 0 THEN
    RAISE EXCEPTION 'pedidos com id_ped nulo: %', n_null;
  END IF;

  SELECT count(*) - count(DISTINCT id_ped) INTO n_dup FROM pedidos;
  IF n_dup > 0 THEN
    RAISE EXCEPTION 'id_ped duplicado em pedidos: % colisões', n_dup;
  END IF;

  SELECT count(*) INTO n_orfaos
  FROM pedido_itens pi
  LEFT JOIN pedidos p ON p.id_pedido = pi.id_pedido
  WHERE p.id_pedido IS NULL;
  IF n_orfaos > 0 THEN
    RAISE EXCEPTION 'pedido_itens órfãos antes do remap: %', n_orfaos;
  END IF;
END $$;

-- Remapeia os itens ANTES de mexer em pedidos (o join precisa do id antigo).
UPDATE pedido_itens pi
SET id_pedido = p.id_ped
FROM pedidos p
WHERE p.id_pedido = pi.id_pedido
  AND p.id_pedido <> 0;

-- Linha-lixo: sink de todos os upserts com id_pedido=0 desde ~20/05.
DELETE FROM pedidos WHERE id_pedido = 0;

-- As faixas antiga e nova se sobrepõem (min id_ped 7559 < max id antigo 293050),
-- então o UPDATE em massa da PK colidiria transitoriamente. Sem FKs apontando
-- para pedidos, é seguro soltar e recriar a constraint dentro da transação.
-- REPLICA IDENTITY FULL temporário: pedidos está em publication (realtime) e o
-- Postgres bloqueia UPDATE em tabela publicada sem PK/replica identity.
ALTER TABLE pedidos REPLICA IDENTITY FULL;
ALTER TABLE pedidos DROP CONSTRAINT pedidos_pkey;
UPDATE pedidos SET id_pedido = id_ped;
ALTER TABLE pedidos ADD CONSTRAINT pedidos_pkey PRIMARY KEY (id_pedido);
ALTER TABLE pedidos REPLICA IDENTITY DEFAULT;

-- Pós-condições.
DO $$
DECLARE
  n_map bigint;
  n_pedidos bigint;
  n_zero bigint;
  n_diff bigint;
  n_orfaos bigint;
BEGIN
  SELECT count(*) INTO n_map FROM pedidos_id_map_20260611;
  SELECT count(*) INTO n_pedidos FROM pedidos;
  IF n_pedidos <> n_map THEN
    RAISE EXCEPTION 'pedidos após migração (%) difere do backup (%)', n_pedidos, n_map;
  END IF;

  SELECT count(*) INTO n_zero FROM pedidos WHERE id_pedido = 0;
  IF n_zero > 0 THEN
    RAISE EXCEPTION 'ainda existe linha id_pedido=0';
  END IF;

  SELECT count(*) INTO n_diff FROM pedidos WHERE id_pedido <> id_ped;
  IF n_diff > 0 THEN
    RAISE EXCEPTION 'pedidos com id_pedido <> id_ped: %', n_diff;
  END IF;

  SELECT count(*) INTO n_orfaos
  FROM pedido_itens pi
  LEFT JOIN pedidos p ON p.id_pedido = pi.id_pedido
  WHERE p.id_pedido IS NULL;
  IF n_orfaos > 0 THEN
    RAISE EXCEPTION 'pedido_itens órfãos após remap: %', n_orfaos;
  END IF;
END $$;

COMMIT;
