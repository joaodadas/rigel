# Rigel Dashboard - Design Spec

**Data:** 2026-04-08
**Status:** Aprovado

---

## Visao Geral

Dashboard multiusuario para gestao de uma empresa de tecidos/estofados, consumindo dados da API VHSys v2. Interface polida com shadcn/ui, dark/light mode, dados em tempo real via Supabase Realtime.

## Stack

- **Framework:** Next.js 15 (App Router)
- **Auth:** Better Auth (email + senha, 4 roles)
- **UI:** shadcn/ui + Tailwind CSS (dark/light mode toggle)
- **Banco principal:** Supabase (Postgres + Realtime)
- **Cache:** Upstash Redis (dados que mudam pouco + KPIs)
- **API externa:** VHSys API v2
- **Deploy:** Vercel (.vercel.app)
- **Design:** Usar skill make-interfaces-feel-better na implementacao

## Autenticacao e Roles

### Login
- Tela unica: email + senha
- Redirect por role apos login

### Roles (4 iniciais, expansivel)

| Role | Acesso |
|------|--------|
| **Admin** | Tudo + gerenciar usuarios e permissoes |
| **Comercial** | Clientes, pedidos, orcamentos, NF-e, produtos |
| **Financeiro** | Contas a pagar/receber, extratos, contas bancarias, centro de custos |
| **RH** | Vendedores (cadastro, comissoes, desempenho) |

## Telas por Role

### Admin (acesso total)
- **Dashboard geral** - KPIs: faturamento, pedidos, clientes ativos/inativos, contas a pagar/receber
- **Usuarios** - CRUD de usuarios do sistema, atribuir roles
- Acesso a todos os modulos de todas as roles

### Comercial
- **Dashboard vendas** - KPIs: pedidos do mes, orcamentos pendentes, top clientes
- **Clientes** - lista, busca, filtros, detalhe com historico de pedidos, badge inativo (6m+)
- **Pedidos** - lista, criar, editar, status, produtos do pedido, parcelas
- **Orcamentos** - lista, criar, editar, converter em pedido
- **NF-e** - lista, criar, emitir, consultar status, carta de correcao
- **Produtos** - lista, busca, estoque atual

### Financeiro
- **Dashboard financeiro** - KPIs: fluxo de caixa, vencimentos proximos, inadimplencia
- **Contas a Pagar** - lista, criar, liquidar/desliquidar, filtros por vencimento
- **Contas a Receber** - lista, criar, liquidar/desliquidar, filtros
- **Extratos** - lista, cadastrar lancamentos
- **Contas Bancarias** - lista, saldos
- **Centro de Custos** - lista, CRUD

### RH
- **Dashboard RH** - KPIs: vendedores ativos, ranking comissoes
- **Vendedores** - lista, cadastro, comissoes, desempenho (pedidos por vendedor)

## Arquitetura de Dados - Hibrido Supabase + Redis

### Fluxo geral

```
[VHSys API v2]
     |
     ├── Webhooks (dados frequentes) ──→ [Supabase Postgres] ──→ [Realtime] ──→ [Browser]
     |
     └── Sync diario (dados estaticos) ──→ [Upstash Redis TTL 24h]

[Browser]
     ├── Dados pesados (clientes, pedidos, financeiro) ← Supabase Postgres
     ├── Dados leves (categorias, vendedores, config) ← Redis (fallback: VHSys)
     └── KPIs dashboards ← Redis (invalidado por webhook)
```

### O que vai no Supabase Postgres (persistente, queries complexas)

Dados com alto volume, que precisam de busca, filtro, paginacao e relacoes:

- **Clientes** (~190k registros) - busca, filtros, historico, relacao com pedidos
- **Pedidos** (~264k) - queries complexas (por vendedor, por periodo, por status)
- **Contas a pagar** (~28k) - soma, agrupamento por data, vencimentos
- **Contas a receber** (~15k) - idem
- **NF-e** - historico completo, status de emissao
- **Orcamentos** - historico, conversao em pedido
- **Extratos** - lancamentos financeiros
- **Usuarios do sistema** - Better Auth tables

### O que vai no Upstash Redis (cache quente, TTL 24h)

Dados lidos muitas vezes, que mudam raramente:

- Categorias de produto
- Subcategorias de produto
- Categorias financeiras
- Centro de custos
- Contas bancarias (lista)
- Vendedores ativos (lista)
- Transportadoras
- **KPIs pre-calculados** dos dashboards (invalidados quando webhook chega)

### Sync Strategy

1. **Sync inicial** - Job unico que puxa todos os dados da VHSys e popula Supabase + Redis
2. **Webhooks VHSys** → API Route Next.js → atualiza Supabase + invalida Redis KPIs → Realtime propaga
3. **Cron safety net** (30min) - pega mudancas que o webhook pode ter perdido (via `data_modificacao`)
4. **Redis TTL 24h** - dados estaticos expiram e sao re-fetched da VHSys automaticamente

### Acoes do usuario (escrita)

Criar pedido, cadastrar cliente, emitir NF-e, etc:
1. Browser → API Route Next.js → VHSys API v2
2. VHSys processa → dispara webhook de volta
3. Webhook → atualiza Supabase → Realtime propaga pro browser

## Regras de Negocio

### Cliente Inativo
- Cliente sem atividade (pedido, orcamento, NF-e) ha 6+ meses → status `Inativo`
- Calculado automaticamente via cron ou na leitura
- Badge visual na listagem e detalhe do cliente

## Tabelas Supabase (principais)

```sql
-- Usuarios do sistema (Better Auth)
users (id, email, password_hash, name, role, created_at, updated_at)

-- Cache VHSys
clientes (id_cliente PK, razao_cliente, cnpj_cliente, cidade_cliente, uf_cliente, situacao_cliente, ultima_atividade, data_mod_cliente, ...)
pedidos (id_pedido PK, id_cliente FK, nome_cliente, valor_total_nota, status_pedido, data_pedido, data_mod_pedido, ...)
produtos (id_produto PK, desc_produto, valor_produto, estoque_produto, id_categoria, data_mod_produto, ...)
contas_pagar (id_conta_pag PK, nome_conta, valor_pag, vencimento_pag, liquidado_pag, ...)
contas_receber (id_conta_rec PK, nome_conta, valor_rec, vencimento_rec, liquidado_rec, ...)
orcamentos (id_orcamento PK, id_cliente FK, nome_cliente, valor_total_nota, status_pedido, ...)
notas_fiscais (id_venda PK, id_cliente FK, nome_cliente, status_pedido, nota_emitida, nota_chave, ...)
extratos (id PK, id_banco, tipo_fluxo, valor_fluxo, data_fluxo, ...)
vendedores (id_vendedor PK, razao_vendedor, situacao_vendedor, comissao_usuario, ...)

-- Controle de sync
sync_log (id, entity, last_sync_at, last_modified_at, status)
```

## API VHSys - Endpoints Utilizados

### Leitura (GET)
- `/clientes` - listar/consultar clientes
- `/pedidos` - listar/consultar pedidos
- `/produtos` - listar/consultar produtos
- `/contas-pagar` - listar despesas
- `/contas-receber` - listar receitas
- `/notas-fiscais` - listar NF-e
- `/orcamentos` - listar orcamentos
- `/extratos` - listar extratos
- `/vendedores` - listar vendedores
- `/contas-bancarias` - listar contas
- `/centros-custo` - listar centros
- `/categorias-financeiras` - listar categorias

### Escrita (POST/PUT/DELETE)
- `/clientes` - CRUD clientes
- `/pedidos` - CRUD pedidos + produtos + parcelas + status
- `/orcamentos` - CRUD orcamentos
- `/notas-fiscais` - CRUD + emitir NF-e
- `/contas-pagar` - CRUD + liquidar/desliquidar
- `/contas-receber` - CRUD + liquidar/desliquidar
- `/vendedores` - CRUD vendedores

### Webhooks
- `/webhooks` - cadastrar endpoints pra receber eventos

## UI/UX

- **shadcn/ui** como base de componentes
- **Dark/Light mode** com toggle, preferencia salva por usuario
- **Skill make-interfaces-feel-better** aplicado em toda implementacao
- Tabelas com paginacao, busca, filtros
- Cards de KPI nos dashboards
- Badges de status (ativo/inativo, liquidado/pendente, etc)
- Responsivo (desktop first, mobile funcional)

## Estrutura de Pastas (prevista)

```
rigel/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx          # sidebar + header por role
│   │   │   ├── page.tsx            # redirect por role
│   │   │   ├── admin/
│   │   │   ├── comercial/
│   │   │   ├── financeiro/
│   │   │   └── rh/
│   │   └── api/
│   │       ├── auth/               # Better Auth routes
│   │       ├── webhooks/vhsys/     # recebe webhooks VHSys
│   │       └── sync/               # endpoints de sync manual
│   ├── components/
│   │   ├── ui/                     # shadcn/ui
│   │   ├── dashboard/              # cards, charts, KPIs
│   │   ├── tables/                 # data tables reutilizaveis
│   │   └── layout/                 # sidebar, header, theme toggle
│   ├── lib/
│   │   ├── vhsys/                  # client VHSys API
│   │   ├── supabase/               # client Supabase
│   │   ├── redis/                  # client Upstash
│   │   ├── auth/                   # Better Auth config
│   │   └── sync/                   # logica de sync
│   └── types/                      # tipos TypeScript
├── docs/                           # documentacao API VHSys
├── supabase/
│   └── migrations/                 # SQL migrations
├── .env
└── .gitignore
```
