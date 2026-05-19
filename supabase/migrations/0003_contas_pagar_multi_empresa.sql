-- supabase/migrations/0003_contas_pagar_multi_empresa.sql
-- Adiciona coluna `empresa` em contas_pagar e sync_log para suportar
-- sincronização de múltiplas instâncias VHSys (Rigel Fabricante + Rigel Medical + HD Slim).
-- Backfill via DEFAULT garante que registros existentes virem 'rigel_fabricante'.

BEGIN;

-- contas_pagar: ganha empresa + CHECK
ALTER TABLE contas_pagar
  ADD COLUMN empresa text NOT NULL DEFAULT 'rigel_fabricante'
    CHECK (empresa IN ('rigel_fabricante', 'rigel_medical', 'hdslim'));

-- Remove DEFAULT para forçar inserts explícitos daqui pra frente
ALTER TABLE contas_pagar ALTER COLUMN empresa DROP DEFAULT;

-- Troca PK simples → composta (empresa, id_conta_pag)
ALTER TABLE contas_pagar DROP CONSTRAINT contas_pagar_pkey;
ALTER TABLE contas_pagar ADD PRIMARY KEY (empresa, id_conta_pag);

-- Índices para queries comuns (listagem por empresa ordenada por vencimento)
CREATE INDEX IF NOT EXISTS idx_contas_pagar_empresa_venc
  ON contas_pagar (empresa, vencimento_pag DESC);

CREATE INDEX IF NOT EXISTS idx_contas_pagar_empresa_lixeira_venc
  ON contas_pagar (empresa, lixeira, vencimento_pag DESC)
  WHERE lixeira = 'Nao';

-- sync_log: ganha empresa para watermarks por tenant
ALTER TABLE sync_log
  ADD COLUMN empresa text NOT NULL DEFAULT 'rigel_fabricante'
    CHECK (empresa IN ('rigel_fabricante', 'rigel_medical', 'hdslim'));

ALTER TABLE sync_log ALTER COLUMN empresa DROP DEFAULT;

CREATE INDEX IF NOT EXISTS idx_sync_log_entity_empresa_time
  ON sync_log (entity, empresa, last_sync_at DESC);

COMMIT;
