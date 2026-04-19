# Sync de Pedido Itens + Indicadores 5 e 6 — Design Spec

**Data:** 2026-04-19
**Projeto:** Rigel Medical — BI Comercial Fase 2
**Escopo:** Criar tabela `pedido_itens`, sincronizar itens de pedidos B2B do VHSys, implementar Indicador 5 (evolucao de produtos) e Indicador 6 (demonstrativo por cliente)

---

## 1. Contexto

Os indicadores 5 (evolucao de faturamento por produto) e 6 (demonstrativo de compras por cliente) foram adiados na fase 1 por falta de dados de itens de pedido. O endpoint VHSys `GET /pedidos/{id_ped}/produtos` retorna os itens de um pedido individual — nao existe bulk endpoint.

### Numeros

- 265K pedidos totais no Supabase
- ~5K pedidos B2B nos ultimos 12 meses
- ~1.700 pedidos B2B em Jan-Abr 2026
- Sync de 5K pedidos com concurrency 10 + 200ms delay: ~100 segundos

### Decisao de Arquitetura

Sincronizar itens **apenas de pedidos B2B** (vendedor na lista de inclusao `B2B_VENDEDORES_NORMALIZED`). Pedidos de marketplace/e-commerce sao ignorados — nao aparecem no BI Comercial.

### Mapeamento de IDs (CRITICO)

O VHSys usa dois campos no pedido: `id_ped` (ID interno unico) e `id_pedido` (numero do pedido — pode ser 0). Na tabela Supabase `pedidos`, o PK `id_pedido` corresponde ao `id_ped` do VHSys.

O endpoint `GET /pedidos/{id_ped}/produtos` retorna itens com campo `id_pedido` que referencia o `id_ped` pai. Portanto: `pedido_itens.id_pedido` faz JOIN com `pedidos.id_pedido` no Supabase.

**IMPORTANTE:** Antes de rodar o backfill, validar empiricamente chamando o endpoint para 1 pedido real e verificando que `item.id_pedido` == `id_ped` da URL.

---

## 2. Tabela `pedido_itens`

### Schema

```sql
CREATE TABLE pedido_itens (
  id_ped_produto  integer PRIMARY KEY,
  id_pedido       integer NOT NULL,
  id_produto      integer,
  desc_produto    text,
  qtde_produto    numeric DEFAULT 0,
  valor_unit_produto numeric DEFAULT 0,
  valor_total_produto numeric DEFAULT 0,
  desconto_produto numeric DEFAULT 0,
  synced_at       timestamptz DEFAULT now()
);

CREATE INDEX idx_pedido_itens_pedido ON pedido_itens (id_pedido);
CREATE INDEX idx_pedido_itens_produto ON pedido_itens (id_produto);
```

Campos extras da API (`ipi_produto`, `icms_produto`, `peso_produto`, etc.) nao sao necessarios para o BI — nao sincronizar.

---

## 3. Sync Layer

### 3.1 Backfill Inicial (pedidos B2B 12 meses)

**Novo endpoint:** `POST /api/sync/pedido-itens`

**Protecao:** Verificar `CRON_SECRET` no header (mesmo padrao dos outros endpoints de sync).

Fluxo:
1. Buscar do Supabase: todos os `id_ped` de pedidos onde `UPPER(TRIM(vendedor_pedido)) = ANY(B2B_VENDEDORES)` e `data_pedido >= 12 meses atras` e `status_pedido = 'Atendido'` e `lixeira = 'Nao'`
2. Filtrar: remover `id_ped` que ja existem na tabela `pedido_itens` (evitar re-fetch)
3. Para cada `id_ped`, chamar `GET /pedidos/{id_ped}/produtos` no VHSys
4. Concurrency: 5 requests simultaneos, 200ms delay entre batches
5. Upsert no Supabase: `ON CONFLICT (id_ped_produto) DO UPDATE`
6. Logar no `sync_log`: entidade "pedido_itens", registros sincronizados, duracao

### 3.2 Sync Incremental

**Adicionar ao `runIncrementalSync()` existente em `src/lib/sync/incremental.ts`:**

Apos sincronizar pedidos (que ja acontece), buscar itens dos pedidos B2B recentes que ainda nao foram sincronizados.

Fluxo:
1. O incremental sync ja roda e sincroniza pedidos modificados
2. **Apos** a sync de pedidos, fazer query separada: `SELECT id_pedido FROM pedidos WHERE data_mod_pedido >= lastSync AND UPPER(TRIM(vendedor_pedido)) = ANY(B2B) AND id_pedido NOT IN (SELECT DISTINCT id_pedido FROM pedido_itens)`
3. Para cada ID resultante, buscar itens via `GET /pedidos/{id_ped}/produtos`
4. Upsert no `pedido_itens`

Essa abordagem nao modifica o fluxo de sync existente — e um passo adicional no final.

### 3.3 VHSys Client

**Novo helper em `src/lib/vhsys/client.ts`:**

```typescript
async function vhsysFetchPedidoItens(idPed: number): Promise<PedidoItem[]>
```

Chama `GET /pedidos/{idPed}/produtos` e retorna os itens tipados.

**Novo tipo em `src/lib/vhsys/types.ts`:**

```typescript
interface VHSysPedidoItem {
  id_ped_produto: number;
  id_pedido: number;
  id_produto: number;
  desc_produto: string;
  qtde_produto: string;
  valor_unit_produto: string;
  valor_total_produto: string;
  desconto_produto: string;
  // demais campos ignorados
}
```

---

## 4. Queries

### 4.1 getProdutosEvolucao (reescrita)

**Arquivo:** `src/lib/queries/comercial-analytics.ts`

Reescrever `_fetchProdutosEvolucao` para usar `pedido_itens`:

1. Buscar pedidos B2B no periodo (mesma query que ja existe)
2. Buscar `pedido_itens` com JOIN em pedidos para pegar `data_pedido`
3. Agrupar por `id_produto` + `desc_produto` + mes (YYYY-MM)
4. Retornar: produto, mes, faturamento (sum valor_total_produto), quantidade (sum qtde_produto)

Quando filtro de produto selecionado: filtrar por `id_produto`.

Default: top 20 produtos por faturamento total no periodo.

### 4.2 getDemonstrativoCliente (nova)

**Nova query** em `src/lib/queries/comercial-analytics.ts`:

1. Recebe `idCliente: number`, `mesInicio`, `mesFim`, `ano`
2. Buscar pedidos B2B do cliente no periodo
3. JOIN com `pedido_itens` para pegar itens
4. Agrupar por `desc_produto` + mes (YYYY-MM)
5. Retornar tabela pivot: produto x mes, com totais por linha e coluna

**Interface:**
```typescript
interface DemonstrativoCliente {
  produtos: {
    idProduto: number;
    descProduto: string;
    meses: Record<string, number>; // "2026-01" → valor
    total: number;
  }[];
  totaisMes: Record<string, number>; // "2026-01" → valor total
  totalGeral: number;
}
```

### 4.3 Cache Keys

Adicionar ao `CACHE_KEYS`:
```
biProdutosEvolucao: (mi, mf, a, prodId?) => `bi:prod-evo:${mi}:${mf}:${a}:${prodId || 'all'}`
biDemoCliente: (clienteId, mi, mf, a) => `bi:demo:${clienteId}:${mi}:${mf}:${a}`
biClientesB2BList: "bi:clientes-b2b-list"
```

### 4.4 Invalidacao de Cache

Adicionar ao `invalidateAllCaches()` em `src/lib/redis/client.ts`:
- Deletar keys `bi:prod-evo:*` para o ano/meses correntes (mesma logica dos biKpis)
- Deletar `bi:clientes-b2b-list`
- Keys `bi:demo:*` nao precisam de invalidacao proativa (TTL de 1h e suficiente, dados mudam lentamente)

---

## 5. UI Components

### 5.1 Indicador 5 — Evolucao de Produtos

**Arquivo:** `src/app/(dashboard)/comercial/bi/components/produtos-evolucao-section.tsx`

Substituir a secao "Evolucao do Faturamento" atual (que mostra apenas totais mensais) por:

- **Seletor de produto** (dropdown com busca): lista top 20 produtos + busca por nome
- **Grafico de linha**: eixo X = meses, eixo Y = faturamento. Quando produto selecionado, mostra so esse produto. Quando "Todos", mostra total.
- **Tabela pivot**: Produto | Jan | Fev | Mar | ... | Total | Var. %
  - Top 20 por faturamento como default
  - Var. % = variacao do ultimo mes vs penultimo
- **CSV export**

### 5.2 Indicador 6 — Demonstrativo por Cliente

**Arquivo:** `src/app/(dashboard)/comercial/bi/components/demo-cliente-section.tsx`

- **Seletor de cliente** (dropdown com busca por nome): lista clientes B2B
- **Tabela pivot**: Produto | Jan | Fev | Mar | ... | Total Periodo
  - Cada celula = valor comprado naquele mes
  - Ultima linha = total por mes
  - Ultima coluna = total por produto
- **CSV export**

O seletor de cliente precisa de uma query leve para buscar nomes:
- Nova query `getClientesB2BList()` que retorna `{id: number, nome: string}[]` dos ~1.100 clientes B2B
- Cacheada com key `bi:clientes-b2b-list` (TTL 1h)
- Buscada no server component e passada como prop

---

## 6. Data Flow

```
VHSys API                    Supabase                    App
                                                          
/pedidos/{id}/produtos  →   pedido_itens table    →    getProdutosEvolucao()
                                                    →    getDemonstrativoCliente()
                                                          ↓
                                                    produtos-evolucao-section.tsx
                                                    demo-cliente-section.tsx
```

### Server Component (page.tsx)

Adicionar fetches:
- `getProdutosEvolucao(mesInicio, mesFim, ano)` — ja existe, sera reescrita
- Lista de clientes B2B (para o seletor do indicador 6)

O `getDemonstrativoCliente` sera chamado client-side (via API route ou server action) quando o usuario selecionar um cliente — nao pre-carregado, pois depende da selecao.

### API Route para Demonstrativo

**Novo:** `src/app/api/bi/demo-cliente/route.ts`

```
GET /api/bi/demo-cliente?clienteId=123&mesInicio=1&mesFim=4&ano=2026
```

Retorna JSON do `DemonstrativoCliente`. Protegido por auth.

---

## 7. Testes

- **Unit:** sync de pedido_itens processa resposta VHSys corretamente
- **Unit:** getProdutosEvolucao agrupa por produto + mes corretamente
- **Unit:** getDemonstrativoCliente monta pivot corretamente
- **Integration:** API route /api/bi/demo-cliente retorna dados validos
- **E2E:** indicador 5 mostra grafico com dados, seletor de produto funciona

---

## 8. Ordem de Execucao

1. Criar tabela `pedido_itens` (migracao Supabase)
2. Implementar `vhsysFetchPedidoItens` + tipo
3. Criar endpoint `/api/sync/pedido-itens` (backfill)
4. Rodar backfill (12 meses de pedidos B2B)
5. Adicionar sync de itens ao incremental sync
6. Reescrever `getProdutosEvolucao` com dados reais por produto
7. Criar `getDemonstrativoCliente` + API route
8. Implementar UI do indicador 5
9. Implementar UI do indicador 6
10. Adicionar cache keys + testes

---

## 9. Riscos

1. **Rate limit VHSys**: 5K requests em ~100s pode atingir rate limit. Mitigacao: concurrency 5 (nao 10), retry com backoff.
2. **Pedidos sem itens**: alguns pedidos podem ter 0 itens na API. Tratar como normal (array vazio).
3. **Produtos descontinuados**: `id_produto` pode nao existir na tabela `produtos`. Usar `desc_produto` do item como fallback.
