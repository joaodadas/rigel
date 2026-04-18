# BI Comercial V2 — Design Spec

**Data:** 2026-04-18
**Projeto:** Rigel Medical — Dashboard de Gestao Empresarial
**Escopo:** Correcao de bugs + evolucao do BI Comercial (rota `/comercial/bi`)

---

## 1. Contexto

O BI Comercial V1 esta em producao mas apresenta problemas criticos: mistura dados B2B com e-commerce (marketplaces), nomes de vendedores nao normalizados, e indicadores 2-6 incompletos ou ausentes. Este spec define as correcoes e evolucoes necessarias.

### Diagnostico Real (dados verificados em 2026-04-18)

**Os dados estao completos no Supabase** (188K clientes, 265K pedidos, 49 vendedores sincronizados via VHSys). O problema NAO e paginacao da API — o sync layer (`vhsysFetchAll`) ja pagina corretamente. Os problemas reais sao:

1. **Mistura B2B com e-commerce**: dos 47.457 pedidos Jan-Abr 2026, ~96% sao marketplace (MercadoFull, Shopee, MercadoLivre, Shein). Isso arrasta ticket medio de ~R$1.900 (B2B) para R$167 (geral).
2. **Nomes de vendedores nao normalizados**: "VENDAS INTERNAS" aparece em 5 variantes (caixa, espacos, typos).
3. **Indicadores 2-6 parciais ou ausentes**: regiao so tem tabela (sem mapa), base ativa sem barras visuais, evolucao de produtos sem dados por produto, demonstrativo por cliente e top 20 inexistentes.

### Dados de Referencia

- **188.667 clientes** (lixeira=Nao)
- **57.618 clientes ativos** (pedido nos ultimos 6 meses)
- **25 vendedores ativos** no cadastro
- **R$ 7.920.779** faturamento total Jan-Abr 2026
- **R$ ~3.232K** faturamento B2B estimado (excluindo e-commerce)
- **47.457 pedidos** atendidos Jan-Abr 2026 (~1.691 B2B)

---

## 2. Classificacao de Canais

### Vendedores B2B (com meta)

| Nome na API (vendedor_pedido) | Nome Normalizado | Tipo | Meta 2026 |
|------|------|------|------|
| VENDAS INTERNAS / vendas internas / vendas internas(espaco) / vendas internos / vendas onternas | Vendas Internas | vendas_internas | R$ 3.646.425 (Aline + Fatima combinadas) |
| CLAUDIO | Claudio | representante | R$ 2.365.313 |
| EDWILSON | Edwilson | representante | R$ 3.119.621 |
| JOSE ROBERTO | Jose Roberto | representante | R$ 2.824.673 |
| JESSICA | Jessica | representante | R$ 690.579 |
| SANTOS MAIA | Santos Maia | representante | R$ 587.121 |
| RAQUEL | Raquel | representante | R$ 361.280 |
| DEANY | Deany | representante | R$ 317.782 |
| ANA PAULA RAMOS / ANA PAULA RAMOS(espaco) | Ana Paula Ramos | representante | R$ 202.787 |
| FRANCISCO MOREIRA | Francisco Moreira | representante | R$ 129.641 |
| FRANCISCO/SANDY | Francisco/Sandy | representante | R$ 119.041 |
| DJAVAN | Djavan | representante | R$ 115.534 |
| CGQ | CGQ | representante | R$ 105.155 |
| LURDINHA | Lurdinha | representante | R$ 86.379 |
| FRANCISCO | Francisco | representante | R$ 71.034 |
| SERGIO | Sergio | representante | R$ 69.335 |
| RODRIGO | Rodrigo | representante | R$ 20.033 |
| KELLY | Kelly | representante | R$ 9.607 |
| SANTOS MAIA - CARLA | Santos Maia - Carla | representante | R$ 51.606 |

**Vendedores nas metas sem pedidos em 2026 (ate Abril):** Leticia, Pedro Sergio, Francisco CWB, Diego

### Canais E-commerce (excluidos do BI B2B)

MERCADOFULL, MERCADOLIVRE, SHOPEE, SHOPEEFULL, SHEIN, SITE RIGEL, SITE OPTA SAUDE, EVENTO, FABRICA, LOJA SAO PAULO, PRIME MED

### Vendedores Nao Mapeados

Nomes avulsos com poucos pedidos (Danniel Jansen, KATLLYN, LAIS, Fast-martelinho, MARIA DE LOURDES...) — tratados como "Outros" no BI, sem meta.

---

## 3. Arquitetura de Mudancas

### 3.1 Config — Normalizacao e Filtro B2B

**Arquivo:** `src/lib/config/vendedores-map.ts`

**Estrategia: INCLUSAO, nao exclusao.** Em vez de manter uma lista negra de canais e-commerce (fragil — novos canais escapam), derivar a lista de vendedores B2B a partir de `METAS_VENDEDORES`. Se um vendedor normalizado nao tem correspondencia nas metas, nao e B2B.

Preencher `VENDEDOR_MAP` com todos os mapeamentos encontrados. Adicionar funcao `normalizeVendedor(nome)` que: trim, trata variantes conhecidas, retorna nome canonico.

Adicionar funcao `isB2B(vendedorNormalizado): boolean` que retorna true se o nome normalizado tem correspondencia em METAS_VENDEDORES (por lista de inclusao).

Exportar `B2B_VENDEDORES_NORMALIZED: string[]` — lista derivada de METAS_VENDEDORES com nomes normalizados em UPPER. Usada pelas RPCs como parametro.

Para "VENDAS INTERNAS" como grupo: calcular meta combinada dinamicamente somando Aline + Fatima do METAS_VENDEDORES (nao duplicar dados).

### 3.2 Normalizacao: duas camadas

**Camada SQL (RPCs):** Normalizar com `UPPER(TRIM(vendedor_pedido))` e `UPPER(TRIM(vendedor_cliente))` nas clausulas WHERE e GROUP BY. Receber `p_b2b_vendedores text[]` como parametro para filtrar apenas vendedores B2B. A lista e passada pelo app como UPPER dos nomes normalizados.

**Camada JS (app-side):** `normalizeVendedor()` para display bonito (transformar "CLAUDIO" → "Claudio", "VENDAS INTERNAS" → "Vendas Internas"). Aplicada pos-fetch apenas para exibicao e mapeamento de metas.

Isso garante que RPCs e queries app-side usam a mesma logica de filtragem sem duplicacao de normalizacao.

### 3.3 RPCs — Reescrita

As 3 RPCs precisam ser reescritas para aceitar lista de vendedores B2B:

**rpc_comercial_kpis(p_start_date, p_end_date, p_b2b_vendedores text[]):**
- faturamento: SUM de pedidos onde UPPER(TRIM(vendedor_pedido)) = ANY(p_b2b_vendedores)
- total_pedidos: COUNT idem
- clientes_ativos: COUNT DISTINCT id_cliente de pedidos B2B nos ultimos 6 meses
- base_total: COUNT de clientes onde UPPER(TRIM(vendedor_cliente)) = ANY(p_b2b_vendedores)

**rpc_clientes_status_vendedor(p_b2b_vendedores text[]):**
- Filtrar clientes WHERE UPPER(TRIM(vendedor_cliente)) = ANY(p_b2b_vendedores)
- GROUP BY UPPER(TRIM(vendedor_cliente))

**rpc_clientes_inativos(p_vendedor, p_b2b_vendedores text[], p_limit):**
- Filtrar clientes WHERE UPPER(TRIM(vendedor_cliente)) = ANY(p_b2b_vendedores)
- Filtro adicional por vendedor especifico se p_vendedor nao nulo

### 3.4 Queries app-side — Filtro B2B

**Arquivo:** `src/lib/queries/comercial-analytics.ts`

Queries que usam `supabaseFetchAll` (pedidosPorVendedor, pedidosPorRegiao, produtosEvolucao): adicionar helper `b2bFilter(query)` que aplica `.in('vendedor_pedido', B2B_VENDEDORES_VARIATIONS)` onde VARIATIONS inclui todas as formas conhecidas (UPPER, lower, com espaco). Alternativa mais robusta: usar `.or()` com `vendedor_pedido.ilike.NOME` para cada vendedor B2B.

Normalizacao de nomes para display aplicada pos-fetch com `normalizeVendedor()`.

### 3.5 Delta vs Mes Anterior

Para mostrar "Delta vs Mes Anterior" no Indicador 1:
- No server component, fazer 2 fetches em paralelo: periodo atual + periodo anterior (mes-1)
- Passar ambos como props ao sub-componente
- Sub-componente cruza por vendedor normalizado e calcula delta
- Quando "Acumulado" selecionado, delta nao se aplica (esconder coluna)

### 3.6 Cache Keys

Adicionar ao `CACHE_KEYS`:
```
biTop20: (mi, mf, a) => `bi:top20:${mi}:${mf}:${a}`
biTop20VI: (mi, mf, a) => `bi:top20vi:${mi}:${mf}:${a}`
biVendedorPrev: (mi, mf, a) => `bi:vendedor-prev:${mi}:${mf}:${a}`
```

### 3.7 Dashboard — Decomposicao

O arquivo `comercial-dashboard.tsx` (950 linhas) sera decomposto em sub-componentes:

```
src/app/(dashboard)/comercial/bi/
  comercial-dashboard.tsx          — container principal + filtros + KPI cards
  components/
    bi-filters.tsx                 — filtros globais (mes, ano, vendedor)
    kpi-cards-section.tsx          — 7 KPI cards
    pedidos-vendedor-section.tsx   — indicador 1
    pedidos-regiao-section.tsx     — indicador 2 (tabela + mapa)
    base-ativa-section.tsx         — indicador 3
    clientes-inativos-section.tsx  — indicador 4
    produtos-evolucao-section.tsx  — indicador 5
    demo-cliente-section.tsx       — indicador 6
    top-clientes-section.tsx       — top 20 clientes
```

Cada sub-componente recebe dados via props. Estado de filtros (mes, ano, vendedor) gerenciado via URL params no container (padrao atual mantido).

**Volume de dados apos filtro B2B e pequeno** (~1.100 clientes B2B, ~1.700 pedidos B2B por quadrimestre), entao fetch-all + props e adequado. Nao precisa de lazy loading.

---

## 4. Blocos de Implementacao (ordem de execucao)

### Bloco 1: Normalizacao de Nomes + Filtro B2B

- Preencher `VENDEDOR_MAP` com mapeamentos reais encontrados nos dados
- Criar `normalizeVendedor()`, `isB2B()` (por inclusao via METAS_VENDEDORES)
- Exportar `B2B_VENDEDORES_NORMALIZED` para uso nas RPCs
- Aplicar filtro B2B em todas as queries de `comercial-analytics.ts`
- Meta "Vendas Internas" = soma dinamica de Aline + Fatima

**Testes:**
- Unit: `normalizeVendedor()` mapeia todas as variantes encontradas (VENDAS INTERNAS, vendas internas, vendas internas(espaco), vendas internos, vendas onternas → "Vendas Internas")
- Unit: `normalizeVendedor()` mapeia ANA PAULA RAMOS(espaco) → "Ana Paula Ramos"
- Unit: `isB2B("Vendas Internas")` → true, `isB2B("MERCADOFULL")` → false
- Unit: B2B_VENDEDORES_NORMALIZED contem UPPER de todos os nomes das metas

### Bloco 2: Reescrever RPCs + Corrigir KPIs

- Reescrever `rpc_comercial_kpis` para aceitar `p_b2b_vendedores text[]` — filtrar pedidos e clientes por lista de inclusao
- Reescrever `rpc_clientes_status_vendedor` para aceitar `p_b2b_vendedores text[]` — agrupar por UPPER(TRIM(vendedor_cliente)) filtrado
- Reescrever `rpc_clientes_inativos` para aceitar `p_b2b_vendedores text[]` — filtrar apenas clientes B2B
- Atualizar chamadas em `comercial-analytics.ts` para passar B2B_VENDEDORES_NORMALIZED
- Faturamento B2B: soma apenas pedidos com vendedor B2B
- Ticket medio: faturamento B2B / pedidos B2B (esperado ~R$1.900, nao R$167)
- Base total B2B: ~1.100 clientes (nao 188K)

**Testes:**
- Integration: KPIs retornam valores coerentes (faturamento > 0, ticket medio > 500, base total entre 500 e 5000)
- Integration: base_total nao retorna 188K (valida que filtro B2B funciona)
- Unit: calculo de pctAtingimento

### Bloco 3: Filtros Globais

- Adicionar opcao "Acumulado" no seletor de mes
- Agrupar vendedores no dropdown: "Vendas Internas" / "Representantes"
- Manter seletor de ano (2025, 2026)
- Filtros afetam todos os indicadores via props

**Testes:**
- Component: selecionar "Acumulado" muda as props de mesInicio/mesFim
- Component: filtro de vendedor filtra dados corretamente

### Bloco 4: Indicador 1 — Pedidos por Vendedor (evoluir)

- Separar secoes: Vendas Internas / Top 10 Representantes / Outros (accordion colapsavel)
- Tabela: adicionar coluna "Delta vs Mes Anterior" (dados do mes anterior buscados em paralelo no server component, conforme secao 3.5)
- Quando "Acumulado" selecionado, esconder coluna delta (nao faz sentido)
- Meta mensal (nao acumulada) quando mes especifico selecionado; meta acumulada quando "Acumulado"
- Manter grafico de barras e exportacao CSV

**Testes:**
- Unit: calculo de delta vs mes anterior (positivo e negativo)
- Unit: delta nao calculado quando modo "Acumulado"
- Component: accordion "Outros" inicia colapsado, expande ao clicar

### Bloco 5: Indicador 4 — Lista de Inativos (prioridade Raquel)

- Remover limite de 50 rows — paginar client-side ou virtual scroll
- Adicionar: filtro por faixa de inatividade (6-9m, 9-12m, 12+m)
- Adicionar: busca por nome do cliente
- Adicionar: coluna Cidade/UF
- CSV exporta TODOS os registros (nao so os visiveis)

**Testes:**
- Component: filtro de faixa de inatividade filtra corretamente
- Component: busca por nome funciona
- E2E: exportar CSV gera arquivo valido

### Bloco 6: Indicador 3 — Base Ativa por Vendedor

- Cards individuais por vendedor com barra de progresso (verde/vermelho)
- Ordenar por % ativacao (pior primeiro)
- Dados ja vem do RPC `rpc_clientes_status_vendedor`

**Testes:**
- Component: cards ordenados por pior ativacao primeiro
- Component: barra de progresso reflete % correto

### Bloco 7: Top 20 Clientes

- Nova query: agregar pedidos B2B por id_cliente, JOIN com clientes para nome/UF/vendedor
- Tabela: Posicao, Cliente, Vendedor, Valor Total, N Pedidos, Ticket Medio, UF
- Duas views: tab "Geral" e tab "Vendas Internas"
- Filtro por mes/acumulado

**Testes:**
- Integration: top 20 retorna ate 20 registros ordenados por valor DESC
- Component: tabs alternam entre geral e vendas internas

### Bloco 8: Indicador 2 — Regiao (mapa)

- Adicionar mapa SVG do Brasil com calor por UF (inline SVG, sem dependencia externa)
- Tabela: adicionar coluna "% do Total"
- Query `getPedidosPorRegiao` ja funciona, aplicar filtro B2B

**Testes:**
- Component: mapa renderiza com dados
- Unit: calculo de % do total

### Bloco 9: Indicador 5 — Evolucao de Produtos

- **Dependencia:** tabela `pedido_itens` precisa ser criada e populada via sync do VHSys
- Adicionar endpoint `/pedidos/{id}/itens` ao sync layer
- Criar tabela `pedido_itens` no Supabase (id_pedido, id_produto, desc_produto, quantidade, valor_unitario, valor_total)
- Grafico de linha por produto, tabela pivot mensal, top 20 default

**Testes:**
- Integration: sync de itens cria registros em pedido_itens
- Component: seletor de produto filtra grafico

### Bloco 10: Indicador 6 — Demonstrativo por Cliente

- **Dependencia:** mesma tabela `pedido_itens` do Bloco 9
- Seletor de cliente com busca
- Tabela pivot: Produto x Mes
- Exportacao CSV

**Testes:**
- Component: seletor de cliente carrega e filtra
- Component: tabela pivot calcula totais corretamente

### Bloco 11: Layout

- Remover heights fixos no grafico de barras (usar min-height + auto)
- Responsividade: testar em tablet (768px) e desktop (1280px)

**Testes:**
- E2E: pagina carrega sem erros em viewport 768px e 1280px

---

## 5. Stack de Testes

### Framework

| Tipo | Ferramenta | Config |
|------|-----------|--------|
| Unit + Integration | **Vitest** | `vitest.config.ts` na raiz |
| Component | **Vitest + @testing-library/react** | Mesmo config, environment: jsdom |
| E2E / Smoke | **Playwright** (ja instalado) | `playwright.config.ts` na raiz |

### Estrutura de Arquivos

```
src/
  lib/
    config/
      __tests__/
        vendedores-map.test.ts      — normalizacao de nomes
        metas-2026.test.ts          — calculo de metas
    queries/
      __tests__/
        comercial-analytics.test.ts — queries com mock Supabase
  app/(dashboard)/comercial/bi/
    __tests__/
      comercial-dashboard.test.tsx  — renderizacao + filtros
tests/
  e2e/
    bi-comercial.spec.ts            — smoke test completo
```

### Dependencias a Instalar

```
vitest @vitest/ui
@testing-library/react @testing-library/jest-dom @testing-library/user-event
jsdom
@playwright/test (upgrade do playwright existente)
```

### Scripts package.json

```json
"test": "vitest run",
"test:watch": "vitest",
"test:ui": "vitest --ui",
"test:e2e": "playwright test"
```

---

## 6. Fora do Escopo

- BI Financeiro, BI RH (abas futuras)
- Sync de pedido_itens do VHSys: sera implementado como parte dos Blocos 9-10, mas se o endpoint VHSys nao suportar bulk fetch, esses blocos serao adiados para uma fase posterior
- Separacao Aline vs Fatima dentro de Vendas Internas (dados nao permitem)
- Webhook VHSys para atualizacao real-time (ja existe, manter como esta)
- Refactoring do sync layer ou do admin dashboard

---

## 7. Riscos

1. **Sync de pedido_itens**: o endpoint VHSys `/pedidos/{id}/itens` pode nao suportar bulk fetch. Pode ser necessario iterar pedido por pedido (lento para 265K pedidos). Mitigacao: sync incremental apenas de pedidos recentes.
2. **Performance das RPCs reescritas**: usar `= ANY(p_b2b_vendedores)` com UPPER(TRIM()) impede uso de indices simples. Mitigacao: criar indice funcional `CREATE INDEX idx_pedidos_vendedor_norm ON pedidos (UPPER(TRIM(vendedor_pedido)))` e equivalente para clientes. Com ~1.100 clientes B2B e ~1.700 pedidos por periodo, a performance deve ser aceitavel mesmo sem indice.
3. **Nomes nao mapeados**: novos vendedores B2B podem aparecer com nomes fora do mapa. Mitigacao: `isB2B()` retorna false, vendedor nao aparece no BI. Detectar via log: no fetcher, logar vendedores unicos que nao sao B2B para identificar mapeamentos faltantes.
4. **Variantes novas de nomes existentes**: alguem pode digitar "vendas intenas" (nova variante de typo). Mitigacao: VENDEDOR_MAP cobre as variantes conhecidas. Novas variantes precisam ser adicionadas manualmente ao perceber discrepancia nos dados.
