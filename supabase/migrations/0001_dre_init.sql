-- DRE Controladoria — schema inicial
-- Roda manualmente no Supabase SQL Editor (sem CLI configurada).

CREATE TABLE IF NOT EXISTS dre_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_arquivo TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  tamanho_bytes BIGINT NOT NULL,
  ano_referencia INT NOT NULL,
  meses_processados INT[] NOT NULL DEFAULT '{}',
  usuario_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('processando', 'sucesso', 'erro')),
  erros JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dre_uploads_ano ON dre_uploads(ano_referencia);
CREATE INDEX IF NOT EXISTS idx_dre_uploads_created ON dre_uploads(created_at DESC);

CREATE TABLE IF NOT EXISTS dre_lancamentos (
  id BIGSERIAL PRIMARY KEY,
  periodo DATE NOT NULL,
  empresa TEXT NOT NULL CHECK (empresa IN ('matriz', 'filial', 'hdslim', 'medical', 'consolidado')),
  regime_tributario TEXT NOT NULL CHECK (regime_tributario IN ('lucro_presumido', 'simples_nacional', 'na')),
  categoria TEXT NOT NULL CHECK (categoria IN ('faturamento', 'imposto', 'variavel', 'cpv', 'despesa_fixa', 'nao_operacional', 'resultado')),
  sub_categoria TEXT NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC(14,2) NOT NULL,
  pct_sobre_faturamento NUMERIC(7,4),
  upload_id UUID NOT NULL REFERENCES dre_uploads(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- (categoria, sub_categoria) é a chave porque sub_categoria "total" se repete
  -- entre categorias (imposto.total, variavel.total, cpv.total, despesa_fixa.total).
  UNIQUE (periodo, empresa, categoria, sub_categoria)
);

CREATE INDEX IF NOT EXISTS idx_dre_periodo_empresa ON dre_lancamentos(periodo, empresa);
CREATE INDEX IF NOT EXISTS idx_dre_categoria ON dre_lancamentos(categoria);
