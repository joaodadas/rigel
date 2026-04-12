# Render Optimization — Design Spec

**Data:** 2026-04-12
**Objetivo:** Reduzir tempo de navegação entre páginas de ~3s para <500ms (cache hit) e ~800ms (cache miss no BI).

---

## Problema

1. **Listagens sem cache** — cada navegação refaz query ao Supabase (~3s de latência de rede)
2. **BI busca tabelas inteiras** — `getClientesInativos` busca 2700 clientes + 5000 pedidos e processa em JS via `supabaseFetchAll` (~20 round-trips)
3. **Nenhum prefetch** — navegação não antecipa a próxima página
4. **Tudo-ou-nada no BI** — espera todas as 6 queries pra mostrar algo

---

## Solução: Abordagem Híbrida

### 1. Cache Redis para tudo

**Infraestrutura:** Upstash Redis já configurado (`cacheGetOrFetch` existente).

**Chaves e TTLs:**

| Chave | TTL | Conteúdo |
|-------|-----|----------|
| `bi:kpis:{mesInicio}:{mesFim}:{ano}` | 5min | KPIs comerciais (8 valores) |
| `bi:vendedor:{mesInicio}:{mesFim}:{ano}` | 5min | Pedidos agrupados por vendedor |
| `bi:regiao:{mesInicio}:{mesFim}:{ano}` | 5min | Pedidos agrupados por UF |
| `bi:clientes-status` | 5min | Ativos/inativos por vendedor |
| `bi:clientes-inativos` | 5min | Lista de clientes inativos |
| `bi:evolucao:{meses}` | 5min | Evolução faturamento mensal |
| `kpi:admin` | 5min | KPIs do dashboard admin |
| `list:{entidade}:p{page}:s{size}:{search}` | 60s | Listagens paginadas |

**Invalidação:** Webhook VHSys e sync incremental chamam `invalidateAllCaches()` que deleta chaves conhecidas de uma lista fixa (não usa SCAN por pattern, que é caro no Redis). A lista é mantida em `CACHE_KEYS` no `redis/client.ts`.

**Stale-while-revalidate:** Criar `cacheGetOrFetchSWR` que:
- Armazena `{ data, fetchedAt }` no Redis com TTL longo (1h)
- Na leitura, compara `fetchedAt` com TTL curto (staleTTL: 5min ou 60s)
- Se fresco: retorna direto
- Se stale: retorna o dado velho imediatamente, mas NÃO dispara refresh async (serverless não suporta background tasks de forma confiável). O dado será atualizado no próximo request que encontrar cache vazio (após TTL longo expirar) ou quando o sync invalidar.
- Na prática, o dado fica sempre disponível por até 1h. O sync (webhook/incremental) invalida antes disso na maioria dos casos.
- Resultado: usuário nunca espera cache miss exceto na primeiríssima visita

### 2. RPCs Postgres para BI

Criar 3 funções SQL no Supabase para as queries mais pesadas:

**`rpc_comercial_kpis(p_mes_inicio int, p_mes_fim int, p_ano int)`**
- Retorna: 1 row com faturamento, total_pedidos, clientes_ativos, base_total
- O JS calcula ticket_medio, meta, pct_atingimento (dependem de config local `metas-2026.ts`)
- Substitui: `getComercialKPIs` (que hoje faz 3 queries paginadas)
- Impacto: ~5 round-trips → 1

**`rpc_clientes_status_vendedor()`**
- Retorna: ~25 rows (1 por vendedor) com total, ativos, inativos, pct_ativacao
- Substitui: `getClientesAtivosVendedor` (que busca ALL clientes + ALL pedidos)
- Impacto: ~6 round-trips → 1

**`rpc_clientes_inativos(p_vendedor text DEFAULT NULL)`**
- Retorna: lista de inativos com nome, vendedor, ultimo_pedido, valor, dias_sem_compra
- Usa subquery `LATERAL` para pegar último pedido por cliente
- Substitui: `getClientesInativos` (que busca ALL pedidos ordered desc)
- Impacto: ~8 round-trips → 1

As outras 3 funções (`getPedidosPorVendedor`, `getPedidosPorRegiao`, `getProdutosEvolucao`) continuam em JS por enquanto — são menos pesadas e o cache Redis resolve.

### 3. Streaming com Suspense no BI

Dividir a página do BI em blocos independentes com `<Suspense>`:

```
<Suspense fallback={<KPISkeleton />}>
  <KPICards />           ← query rápida, aparece primeiro
</Suspense>

<Suspense fallback={<ChartSkeleton />}>
  <PedidosVendedor />    ← aparece em seguida
</Suspense>

<Suspense fallback={<TableSkeleton />}>
  <ClientesInativos />   ← query mais pesada, aparece por último
</Suspense>
```

Cada bloco é um server component async independente que faz sua própria query. O usuário vê progresso incremental.

### 4. Prefetch na sidebar

Garantir que os `<Link>` da sidebar usem prefetch (default do Next.js). Ao passar o mouse, a página destino já carrega em background.

### 5. Prefetch da próxima página nas listagens

Após carregar a página N, disparar em background:
```typescript
// No server component, após retornar dados da página atual
void cacheGetOrFetch(
  `list:clientes:p${page + 1}:s${pageSize}:${search}`,
  () => getClientes(page + 1, pageSize, search),
  60
);
```

Quando o usuário clica "próxima", o Redis já tem o resultado.

---

## Remover `unstable_cache`

Com Redis como cache único, remover todos os wrappers `unstable_cache` das queries em:
- `src/lib/queries/comercial-analytics.ts` (6 funções)
- `src/lib/queries/admin-kpis.ts` (1 função)

Substituir por `cacheGetOrFetch` com as chaves Redis definidas acima.

---

## Impacto esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Navegação listagem (cache hit) | ~3s | ~50ms |
| Navegação listagem (cache miss) | ~3s | ~1.5s (stale serve velho) |
| BI primeira visita (cache miss) | ~5s+ | ~800ms (RPC) |
| BI visita repetida (cache hit) | ~50ms (unstable_cache) | ~50ms (Redis, persiste entre deploys) |
| Troca de página no paginador | ~3s | ~50ms (prefetch) |

---

## Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/lib/redis/client.ts` | Adicionar stale-while-revalidate, `invalidateAllCaches()`, prefixo de chaves |
| `src/lib/queries/comercial-analytics.ts` | Trocar `unstable_cache` por `cacheGetOrFetch`, usar RPCs para 3 funções |
| `src/lib/queries/admin-kpis.ts` | Trocar `unstable_cache` por `cacheGetOrFetch` |
| `src/lib/queries/clientes.ts` | Adicionar `cacheGetOrFetch` |
| `src/lib/queries/pedidos.ts` | Adicionar `cacheGetOrFetch` |
| `src/lib/queries/produtos.ts` | Adicionar `cacheGetOrFetch` |
| `src/lib/queries/vendedores.ts` | Adicionar `cacheGetOrFetch` |
| `src/lib/queries/contas-*.ts` | Adicionar `cacheGetOrFetch` |
| `src/app/(dashboard)/comercial/bi/page.tsx` | Dividir em Suspense boundaries |
| `src/app/(dashboard)/admin/bi/page.tsx` | Dividir em Suspense boundaries |
| `src/lib/sync/webhook-handler.ts` | Chamar `invalidateAllCaches()` |
| `src/lib/sync/incremental.ts` | Chamar `invalidateAllCaches()` |
| Supabase | Criar 3 funções RPC via migration/dashboard |

---

## Fora de escopo

- Trocar pra infinite scroll (mantém paginação tradicional)
- TanStack Query (dados vêm do server, não do client)
- Mudar região do Supabase (infra)
- Otimizar middleware de auth (já deduplicado com React.cache)
