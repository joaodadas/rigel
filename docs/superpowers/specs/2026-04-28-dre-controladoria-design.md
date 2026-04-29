# DRE Executivo — Aba Controladoria

**Data:** 2026-04-28
**Status:** Spec aprovada (aguarda revisão final do usuário)
**Owner:** misael@clynea.ai
**Fonte:** `files/PROMPT_DRE_CLAUDE_CODE.md` + `files/prototipo_dre_rigel_v2.html` + `files/DRE 2026 Rigel.xlsx`

## 1. Contexto e objetivo

Construir o primeiro componente da aba Controladoria do BI estratégico Rigel: um **DRE Executivo** que consome uma planilha Excel (única fonte de verdade) produzida pela controladoria, parseia os dados das abas mensais, persiste em Supabase, e renderiza dashboard com filtros reativos por mês/empresa/visão.

Diferente da aba Comercial, **não consome a API VHSys**. A entrada é manual via upload de arquivo `.xlsx`.

## 2. Decisões de design

| # | Decisão | Justificativa |
|---|---|---|
| D1 | **Tema híbrido** — shadcn primitives por baixo + tokens próprios (gold/Fraunces serif/JetBrains Mono, dark fixo) só na rota `/admin/dre` | Cliente aprovou visual editorial do protótipo; usar shadcn 100% perde a "alma" e duplicar todo CSS cria dívida |
| D2 | **3 fases de entrega** com validação ao fim de cada (Backbone → Dashboard → Polish) | Equilibra agilidade com checkpoints; permite validar parser com dados reais antes de UI |
| D3 | **Upload do arquivo inteiro** (todas as 12 abas DRE) com DELETE+INSERT por mês detectado | Controladoria gera 1 planilha por ano e edita ao longo do tempo; idempotente |
| D4 | **Apenas role `admin`** acessa `/admin/dre` no MVP | Prompt foi silente; default conservador. Abrir para `financeiro` depois é trivial |
| D5 | **Salvar `.xlsx` original no Supabase Storage** (bucket privado `dre-uploads`) | Auditoria + permite re-parsear se a lógica mudar |
| D6 | **Toggle "com/sem investimentos"** afeta KPIs/gráficos/narrativa, mas tabela DRE detalhada mostra ambas as linhas (L82 e L83) sempre | Tabela é "ground truth contábil"; resumo é "lente executiva" |
| D7 | **Sem Redis cache** para o DRE | ~2.700 registros/ano; Supabase com índice entrega <100ms; cache só complica invalidação |
| D8 | **Sem endpoint de leitura** (`/api/dre/query`) | Páginas são Server Components; fetch direto via `lib/queries/dre.ts` |
| D9 | **Sem hash do arquivo** | UPSERT é idempotente; re-upload do mesmo arquivo é inofensivo |

## 3. Arquitetura

```
Browser ─► /admin/dre (Server Component)
                  │
                  ├─► Filtros (client) → querystring → re-render do SC
                  │
                  └─► src/lib/queries/dre.ts ─► Supabase
                                                  ├─ dre_lancamentos
                                                  └─ dre_uploads

POST /api/dre/upload (multipart, ~2s síncrono)
  ├─► Permission check (role=admin)
  ├─► Validação (.xlsx, ≤50MB)
  ├─► INSERT dre_uploads (status=processando)        # cria primeiro pra ter ID e poder marcar erro
  ├─► Upload xlsx → Supabase Storage: dre-uploads/{ano}/{upload_id}.xlsx
  │     ↳ falha aqui: UPDATE dre_uploads SET status=erro, erros={fatal: "..."}; abort
  ├─► parseDRE(buffer) → { meses_processados, lancamentos, warnings }
  │     ↳ falha aqui: UPDATE status=erro, erros={fatal: "..."}; abort
  ├─► Transação:
  │     DELETE dre_lancamentos WHERE periodo IN meses_detectados
  │     INSERT batch dos novos lancamentos
  │     UPDATE dre_uploads SET status=sucesso, meses_processados, erros={warnings:[...]}
  └─► Retorna { upload_id, meses_processados, warnings, errors }
```

## 4. Schema do banco

```sql
CREATE TABLE dre_lancamentos (
  id BIGSERIAL PRIMARY KEY,
  periodo DATE NOT NULL,                 -- 2026-01-01 = janeiro/2026
  empresa TEXT NOT NULL,                 -- matriz | filial | hdslim | medical | consolidado
  regime_tributario TEXT NOT NULL,       -- lucro_presumido | simples_nacional
  categoria TEXT NOT NULL,               -- faturamento | imposto | variavel | cpv | despesa_fixa | nao_operacional | resultado
  sub_categoria TEXT NOT NULL,           -- mercado_interno, icms, mao_de_obra_direta, etc.
  descricao TEXT NOT NULL,               -- label original da planilha
  valor NUMERIC(14,2) NOT NULL,
  pct_sobre_faturamento NUMERIC(7,4),    -- valor / faturamento_bruto da empresa no periodo (NULL se faturamento=0)
  upload_id UUID NOT NULL REFERENCES dre_uploads(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (periodo, empresa, sub_categoria)
);

CREATE INDEX idx_dre_periodo_empresa ON dre_lancamentos(periodo, empresa);
CREATE INDEX idx_dre_categoria ON dre_lancamentos(categoria);

CREATE TABLE dre_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_arquivo TEXT NOT NULL,
  storage_path TEXT NOT NULL,            -- caminho no bucket dre-uploads
  tamanho_bytes BIGINT NOT NULL,
  ano_referencia INT NOT NULL,           -- 2026
  meses_processados INT[] NOT NULL,      -- [1,2] = janeiro e fevereiro
  usuario_id TEXT NOT NULL,              -- better-auth user.id
  status TEXT NOT NULL,                  -- processando | sucesso | erro
  erros JSONB,                           -- { fatal: "...", warnings: [...] }
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dre_uploads_ano ON dre_uploads(ano_referencia);
```

**Migrations:** `supabase/migrations/0001_dre_init.sql` — rodar manualmente no SQL Editor (padrão da app, sem CLI Supabase).

**Storage bucket:** `dre-uploads` (privado, sem signed URLs por enquanto).

## 5. Parser

**Biblioteca:** `xlsx` (SheetJS), backend.

**Detecção de aba:** regex `/^DRE\s+(Janeiro|Fevereiro|Março|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro)\s+(\d{2,4})$/i`. Tolera "DRE Janeiro 26", "DRE Março 2026", etc.

**Mapa de empresas (colunas):**

| Code | Colunas Valor/% | Regime |
|---|---|---|
| matriz | B/C | lucro_presumido |
| filial | D/E | lucro_presumido |
| hdslim | F/G | lucro_presumido |
| medical | H/I | simples_nacional |
| consolidado | J/K | (não aplica) |

**Mapa de linhas:** conforme seção "Pseudocódigo do parser" do prompt original (linhas 10-12 faturamento, 14-18 impostos, 20 receita líquida, 22-25 variáveis, 27-33 CPV, 35 margem contribuição, 37-57 despesas fixas, 59 resultado operacional, 61/71 não-operacional, 82/83 lucro líquido, 85 investimentos).

**Parsing de números:**
- `cell.v` numérico → usa direto
- String "1.234,56" → normaliza (remove pontos, troca vírgula por ponto)
- `null`/`undefined`/`""` → pula (não cria registro)
- `0` numérico → cria registro com valor=0 (vazio ≠ zero)

**Cálculo de `pct_sobre_faturamento`:**
- Para cada (periodo, empresa), pega L10+L11 (faturamento bruto interno + externo) como base
- `pct = valor / faturamento_bruto`
- Se faturamento=0 → NULL

**Validações (warnings, não bloqueiam):**
1. `Faturamento − Impostos − Devoluções ≈ Receita Líquida` (tolerância 0.01)
2. `Consolidado ≈ Soma das 4 empresas` (tolerância 0.01)
3. Se aba do mês não existe → erro amigável
4. Se mudança de descrição em linha esperada → warning, processa pelo número da linha
5. Mês com todos valores zero/vazios é aceito (mês futuro), mas não entra em `meses_processados`

**Persistência:**
- DELETE+INSERT em batch por mês (não UPSERT row-by-row)
- 2.700 rows ÷ batches por mês = ~225 rows/mês × 12 = trivial

## 6. UI / estrutura de arquivos

```
src/app/(dashboard)/admin/dre/
├── page.tsx                    # SC shell — fetch + render
├── layout.tsx                  # Aplica tema gold/Fraunces (CSS module) — escopo nessa rota
├── loading.tsx                 # Skeleton
└── _components/
    ├── header.tsx              # Mark, título, indicador, botão upload
    ├── filters.tsx             # Client — pills mes/empresa + toggle (router.push querystring)
    ├── exec-summary.tsx        # SC — narrativa derivada
    ├── kpi-grid.tsx            # SC — 6 cards
    ├── waterfall.tsx           # SC — SVG inline
    ├── trend.tsx               # SC — barras mensais + 3 margens
    ├── despesas-donut.tsx      # SC — donut SVG dos centros de custo
    ├── ranking-empresas.tsx    # SC — barras horizontais por empresa
    ├── alertas.tsx             # SC — sinais financeiros
    ├── tabela-dre.tsx          # Client — colapsável com Δ vs mês anterior
    ├── upload-dialog.tsx       # Client — drag-drop + status
    └── uploads-grid.tsx        # SC — grid mensal de status

src/lib/dre/
├── parser.ts                   # parseDRE(buffer, ano) → { meses, lancamentos, warnings }
├── empresas.ts                 # constantes: codes, regimes, labels
├── linhas.ts                   # mapa de linhas da planilha
├── computacoes.ts              # KPIs derivados, agregações
├── alertas.ts                  # 7 regras de sinais financeiros
├── resumo-executivo.ts         # gerador de narrativa (4 templates)
└── svg.ts                      # waterfallSegments, donutArcs, barScale

src/lib/queries/dre.ts          # SC fetchers (sem endpoints REST)

src/app/api/dre/upload/route.ts # Único endpoint REST (multipart)
```

## 7. Filtros e estado

- URL: `/admin/dre?mes=02&empresa=consolidado&inv=sem`
- Defaults: último mês com dados, `consolidado`, `sem` investimentos
- Pill "ACUMULADO" → SUM dos meses com dados do ano
- Pills de mês desabilitam quando o mês não tem dados (consultado em `dre_uploads.meses_processados` agregado por ano)
- Estado de colapso da tabela DRE: `localStorage` por sessão (default todas abertas)

## 8. Resumo executivo

Função pura `gerarResumo({ empresa, periodo, atual, anterior, comInvestimentos })` que:
1. Detecta cenário aplicável (período individual, comparativo, acumulado, medical-sem-faturamento)
2. Aplica template do prompt
3. Retorna JSX com `<strong>`, `<span class="pos">`, `<span class="neg">`

## 9. Sinais financeiros (7 regras)

1. Salto >30% em despesas fixas MoM
2. Resultado operacional virou negativo
3. Medical sem faturamento próprio + custos
4. Margem de contribuição saudável (>58%)
5. Concentração em canal único (>40% das despesas em Mercado Livre)
6. Carga tributária elevada (>3,5%)
7. Empresa com margem operacional alta (>15%)

Renderização contextual: cada alerta vira um card com tipo (`pos`/`neg`/`info`).

## 10. Benchmarks de semaforização (KPIs)

| Indicador | ▲ Saudável | ◆ Atenção | ▼ Crítico |
|---|---|---|---|
| Margem Contribuição | ≥ 50% | 30–50% | < 30% ou negativa |
| Margem Operacional | ≥ 10% | 0–10% | Negativa |
| Carga Tributária | ≤ 4% | 4–6% | > 6% |

**Nota:** o threshold do KPI (4% = saudável) difere do threshold do alerta da seção 9 (>3,5% = "elevada"). Ambos vêm do prompt original — intencional: alerta dispara mais cedo do que o semáforo do KPI. Manter como está.

## 11. Tratamento de erros

| Cenário | Resposta |
|---|---|
| Arquivo não-xlsx ou >50MB | 400 antes de processar |
| Sem auth ou role ≠ admin | 403 |
| Falha no Storage | 500, marca upload como `erro`, não toca em `dre_lancamentos` |
| Parse fatal | 500, `erros = { fatal: "..." }` |
| Nenhuma aba DRE detectada | 400 amigável |
| Validações matemáticas falharam | upload completa com `sucesso` + `warnings` (UI mostra) |
| Mês sem dados (futuro) | aba ignorada — não entra em `meses_processados` |
| Mudança de label da linha | warning — processa pelo número da linha |
| Sem dados no período da query | tela vazia com CTA "Fazer upload" |
| Mês solicitado sem dados | redireciona pra último mês com dados |

## 12. Testes

Sem framework configurado (CLAUDE.md confirma).

- **Parser:** script `scripts/test-dre-parser.ts` (rodável com `npx tsx`) carrega a planilha real local e cuspe JSON. Validação manual contra a planilha. Não vai pra CI.
- **Frontend:** validação visual no portless dev. Cobertura: filtros mudam tela, toggle alterna, upload funciona, tabela colapsa, estados vazios.

## 13. Plano de entrega — 3 fases (PRs independentes)

### Fase 1 — Backbone
- `supabase/migrations/0001_dre_init.sql` (manual no Supabase SQL Editor)
- Bucket Storage `dre-uploads` (privado, criar via Supabase UI)
- Item "DRE Executivo" no `app-sidebar.tsx` (navByRole.admin, entre BI Comercial e Clientes)
- `src/app/(dashboard)/admin/dre/page.tsx` mínima (placeholder "DRE em construção")
- `src/lib/dre/{parser,empresas,linhas}.ts`
- `src/lib/queries/dre.ts` esqueleto
- `POST /api/dre/upload` funcional
- `scripts/test-dre-parser.ts` validado contra a planilha real
- **Validação:** subir planilha real, conferir registros no Supabase, totais batem

### Fase 2 — Dashboard
- Tema híbrido (`_theme.module.css` + `layout.tsx`)
- Header + filtros + toggle
- KPI grid + resumo executivo dinâmico
- Tabela DRE colapsável com Δ vs mês anterior
- Waterfall + tendência mensal + donut + ranking empresas
- **Validação:** navegação por meses/empresas, valores conferem com a planilha

### Fase 3 — Polish
- Sinais financeiros (7 regras)
- Dialog de upload com drag-drop + grid mensal de status
- Estados de loading/erro refinados
- Empty states
- Responsividade desktop/tablet
- **Validação final:** tela executiva pronta para o cliente

## 14. Premissas explícitas

- Storage bucket é privado; download via signed URL se necessário no futuro
- `usuario_id` é TEXT (better-auth usa string IDs — confirmar no schema atual durante Fase 1)
- Locale forçado `pt-BR` para formatação monetária (`Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`)
- Datas em formato brasileiro DD/MM/AAAA
- Sem referências a marcas externas — interface é Rigel apenas
- Próximas abas da Controladoria (Fluxo de Caixa, Aging, Inadimplência) reaproveitarão o padrão de upload + parser

## 15. O que ficou fora do escopo

- Comparativo orçado vs realizado (coluna na tabela DRE) — reservada para iteração futura
- RBAC para `financeiro` ler — postergado (D4)
- Cache Redis — não justifica para o volume
- Detecção de re-upload via hash — UPSERT é idempotente
- View materializada de acumulado — SUM on-the-fly basta
- Versionamento de arquivos por mês (histórico de versões) — pode ser feito futuramente consultando `dre_uploads` ordenado por `created_at`
