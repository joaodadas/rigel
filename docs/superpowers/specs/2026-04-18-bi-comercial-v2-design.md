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

Preencher `VENDEDOR_MAP` com todos os mapeamentos encontrados. Adicionar funcao `normalizeVendedor(nome)` que: trim, trata variantes conhecidas, retorna nome canonico.

Adicionar constante `CANAIS_ECOMMERCE: string[]` com a lista de canais a excluir.

Adicionar funcao `isB2B(vendedorNormalizado): boolean` que retorna true se nao esta em CANAIS_ECOMMERCE.

Para "VENDAS INTERNAS" como grupo, adicionar entrada no `METAS_VENDEDORES` com meta combinada, ou calcular dinamicamente somando Aline + Fatima.

### 3.2 Queries — Filtro B2B

**Arquivo:** `src/lib/queries/comercial-analytics.ts`

Todas as queries de pedidos adicionam filtro: `vendedor_pedido NOT IN (canais_ecommerce)` no nivel Supabase (clausula `.not('vendedor_pedido', 'in', ...)`).

A normalizacao de nomes e aplicada APOS o fetch, no JS, antes de agrupar.

### 3.3 RPCs — Ajustes

**rpc_comercial_kpis:** Adicionar parametro `p_excluded_vendedores text[]` para filtrar pedidos de e-commerce. Ou: mover logica para app-side (mais flexivel, evita migracoes SQL frequentes).

**Decisao:** Manter RPCs para queries pesadas (clientes_inativos, clientes_status_vendedor) pois envolvem JOINs grandes. Para KPIs e pedidos por vendedor, usar queries Supabase + JS (ja e o padrao atual).

### 3.4 Dashboard — Decomposicao

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

Cada sub-componente recebe dados via props e e auto-contido.

---

## 4. Blocos de Implementacao (ordem de execucao)

### Bloco 1: Normalizacao de Nomes + Filtro B2B

- Preencher `VENDEDOR_MAP` com mapeamentos reais
- Criar `CANAIS_ECOMMERCE`, `normalizeVendedor()`, `isB2B()`
- Aplicar filtro em todas as queries de `comercial-analytics.ts`
- Adicionar entrada "Vendas Internas" combinada em metas (ou calcular dinamicamente)

**Testes:**
- Unit: `normalizeVendedor()` mapeia todas as variantes corretamente
- Unit: `isB2B()` classifica canais corretamente
- Unit: meta combinada de Vendas Internas = 3.646.425

### Bloco 2: Corrigir KPIs

- Faturamento B2B: soma apenas pedidos com vendedor B2B
- Ticket medio: faturamento B2B / pedidos B2B
- Clientes ativos: COUNT DISTINCT id_cliente de pedidos B2B nos ultimos 6 meses
- Clientes inativos: base B2B - ativos B2B
- Base total: clientes com vendedor_cliente normalizado que seja B2B (mesma normalizacao aplicada ao campo vendedor_cliente da tabela clientes)

**Testes:**
- Integration: KPIs retornam valores coerentes (faturamento > 0, ticket medio > 500, base total > 0)
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
- Tabela: adicionar coluna "Delta vs Mes Anterior"
- Meta mensal (nao acumulada) quando mes especifico selecionado
- Manter grafico de barras e exportacao CSV

**Testes:**
- Unit: calculo de delta vs mes anterior
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
2. **Performance com 188K clientes**: queries de inativos e base ativa podem ser lentas sem indices adequados. Mitigacao: manter RPCs para essas queries, adicionar indices se necessario.
3. **Nomes nao mapeados**: novos vendedores podem aparecer com nomes fora do mapa. Mitigacao: tratar como "Outros" e logar warnings.
