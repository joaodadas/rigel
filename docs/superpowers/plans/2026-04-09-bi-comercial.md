# BI Comercial - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development

**Goal:** Build the Comercial BI tab with 6 indicators, KPI cards, charts, filters, and CSV export.

**Architecture:** Server-side queries from Supabase + client-side charts (recharts) + filtros globais. Modular por indicador.

**Tech Stack:** Next.js 15, Supabase, Recharts, shadcn/ui, TanStack Table

---

## Tasks

### Task 1: Install Recharts + Create Config Files
- Install recharts
- Metas 2026 config (DONE)
- Vendedores mapping config (DONE)
- CSV export utility

### Task 2: Comercial Analytics Queries
- Server queries for all 6 indicators from Supabase
- KPI calculations

### Task 3: KPI Cards (topo do dashboard)
- Faturamento B2B acumulado
- Meta B2B acumulada
- % Atingimento
- Ticket medio geral
- Clientes ativos/inativos
- Base total

### Task 4: Indicador 1 - Pedidos por Vendedor
- Tabela ranqueada + grafico de barras
- Realizado vs Meta
- Filtros: periodo, vendedor

### Task 5: Indicador 2 - Pedidos por Regiao
- Tabela por UF + mapa de calor
- Filtros: periodo, vendedor

### Task 6: Indicadores 3+4 - Clientes Ativos/Inativos
- Cards por vendedor + gauge ativacao
- Lista exportavel de inativos

### Task 7: Indicadores 5+6 - Produtos + Demo Cliente
- Evolucao faturamento por produto
- Tabela pivot por cliente

### Task 8: Filtros Globais + Integracao
- Filtro de periodo (mes/trimestre/ano)
- Filtro de vendedor
- Conectar tudo
