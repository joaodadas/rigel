# VHSys API V2 — Referencia

Base URL: `https://api.vhsys.com.br/v2`
Docs: https://developers.vhsys.com.br/api/

## Autenticacao

Todos os requests precisam dos headers:
```
access-token: {VHSYS_ACCESS_TOKEN}
secret-access-token: {VHSYS_SECRET_ACCESS_TOKEN}
Content-Type: application/json
User-Agent: Rigel/1.0
```

## Paginacao

Todas as listagens aceitam parametros `limit` (max 250) e `offset`.
Resposta inclui `paging: { total, page, limit, offset }`.

## Formato de Resposta

```json
{
  "code": 200,
  "status": "success",
  "data": [...],
  "paging": { "total": 100, "page": 1, "limit": 250, "offset": 0 }
}
```

---

## Endpoints Usados no Rigel

### Cadastros

| Recurso | Metodo | Endpoint | Sincronizado? | Tabela Supabase |
|---------|--------|----------|---------------|-----------------|
| Listar clientes | GET | `/clientes` | Sim | `clientes` |
| Consultar cliente | GET | `/clientes/{id}` | - | - |
| Listar vendedores | GET | `/vendedores` | Sim | `vendedores` |
| Consultar vendedor | GET | `/vendedores/{id}` | - | - |
| Listar produtos | GET | `/produtos` | Sim | `produtos` |
| Consultar produto | GET | `/produtos/{id}` | - | - |

### Vendas

| Recurso | Metodo | Endpoint | Sincronizado? | Tabela Supabase |
|---------|--------|----------|---------------|-----------------|
| Listar pedidos | GET | `/pedidos` | Sim | `pedidos` |
| Consultar pedido | GET | `/pedidos/{id_ped}` | - | - |
| **Listar itens do pedido** | GET | `/pedidos/{id_ped}/produtos` | **NAO** | **pendente: `pedido_itens`** |
| Listar parcelas do pedido | GET | `/pedidos/{id_ped}/parcelas` | Nao | - |
| Listar status do pedido | GET | `/pedidos/{id_ped}/status` | Nao | - |

### Financeiro

| Recurso | Metodo | Endpoint | Sincronizado? | Tabela Supabase |
|---------|--------|----------|---------------|-----------------|
| Listar contas a pagar | GET | `/contas-pagar` | Sim | `contas_pagar` |
| Listar contas a receber | GET | `/contas-receber` | Sim | `contas_receber` |
| Listar extratos | GET | `/extratos` | Parcial | - |
| Listar categorias financeiras | GET | `/categorias-financeiras` | Nao | - |
| Listar centro de custos | GET | `/centros-custo` | Nao | - |
| Listar contas bancarias | GET | `/contas-bancarias` | Nao | - |
| Liquidar despesa | PUT | `/contas-pagar/{id}/liquidar` | Nao | - |
| Liquidar receita | PUT | `/contas-receber/{id}/liquidar` | Nao | - |

### Notas Fiscais

| Recurso | Metodo | Endpoint | Sincronizado? | Tabela Supabase |
|---------|--------|----------|---------------|-----------------|
| Listar NF-e | GET | `/notas-fiscais` | Sim | `notas_fiscais` |
| Consultar NF-e | GET | `/notas-fiscais/{id}` | - | - |
| Emitir NF-e | POST | `/notas-fiscais/{id}/emitir` | - | - |
| Listar NFC-e | GET | `/nfc-e` | Nao | - |

### Orcamentos

| Recurso | Metodo | Endpoint | Sincronizado? | Tabela Supabase |
|---------|--------|----------|---------------|-----------------|
| Listar orcamentos | GET | `/orcamentos` | Sim | `orcamentos` |
| Consultar orcamento | GET | `/orcamentos/{id}` | - | - |
| Listar produtos do orcamento | GET | `/orcamentos/{id}/produtos` | Nao | - |

### Webhooks

| Recurso | Metodo | Endpoint |
|---------|--------|----------|
| Listar webhooks | GET | `/webhooks` |
| Cadastrar webhook | POST | `/webhooks` |
| Atualizar webhook | PUT | `/webhooks/{id}` |
| Excluir webhook | DELETE | `/webhooks/{id}` |

---

## Endpoint Critico Pendente: Itens do Pedido

**`GET /pedidos/{id_ped}/produtos`** — retorna os produtos/itens de um pedido especifico.

### Request
```
GET https://api.vhsys.com.br/v2/pedidos/{id_ped}/produtos
Headers: access-token, secret-access-token, User-Agent
```

### Response
```json
{
  "code": 200,
  "status": "success",
  "data": [
    {
      "id_ped_produto": 123456,
      "id_pedido": 123456,
      "id_produto": 123456,
      "id_almoxarifado": 0,
      "id_lote": 0,
      "desc_produto": "Descricao produto",
      "qtde_produto": "3.0000",
      "desconto_produto": "0.00",
      "ipi_produto": "0.00",
      "icms_produto": "0.00",
      "valor_unit_produto": "15.000000",
      "valor_custo_produto": "0.000000",
      "valor_total_produto": "45.00",
      "valor_desconto": "0.00",
      "peso_produto": "0.00",
      "peso_liq_produto": "0.00",
      "info_adicional": "",
      "xPed_produto": "",
      "nItem_produto": "",
      "json_localizacoes": ""
    }
  ]
}
```

### Campos Relevantes para o BI

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `id_ped_produto` | int | ID unico do vinculo produto/pedido |
| `id_pedido` | int | ID do pedido pai |
| `id_produto` | int | ID do produto (FK para tabela produtos) |
| `desc_produto` | string | Descricao do produto |
| `qtde_produto` | string (numeric) | Quantidade vendida |
| `valor_unit_produto` | string (numeric) | Preco unitario |
| `valor_total_produto` | string (numeric) | Valor total (qtd x preco - desconto) |
| `desconto_produto` | string (numeric) | Valor do desconto |

### Limitacao

Este endpoint requer o `id_ped` de cada pedido individualmente — NAO existe endpoint bulk para buscar itens de multiplos pedidos de uma vez. Para sincronizar, e necessario iterar pedido por pedido.

**Estrategia de sync recomendada:**
1. Sync incremental: buscar itens apenas dos pedidos modificados desde o ultimo sync
2. Paralelizar com concurrency limitada (5-10 requests simultaneos)
3. Delay entre batches para nao exceder rate limit

---

## Outros Endpoints Disponiveis (nao usados)

### Cadastros
- Categorias de clientes: CRUD em `/clientes/categorias`
- Categorias de produtos: CRUD em `/produtos/categorias`
- Subcategorias de produtos: CRUD em `/produtos/subcategorias`
- Transportadoras: CRUD em `/transportadoras`

### Vendas
- Vendas balcao (PDV): CRUD em `/vendas-balcao` + produtos/parcelas/status
- Produtos do orcamento: CRUD em `/orcamentos/{id}/produtos`
- Parcelas do orcamento: CRUD em `/orcamentos/{id}/parcelas`

### Servicos
- Notas de servico (NFS-e): CRUD em `/notas-servico`
- Ordens de servico: CRUD em `/ordens-servico` + produtos/servicos/parcelas/status
- Lista de servicos: CRUD em `/servicos`

### Compras
- Ordens de compra: CRUD em `/ordens-compra` + produtos/parcelas/status
- Entrada de mercadoria: CRUD em `/entradas` + produtos/parcelas/status

### Fiscal
- Impostos (ICMS, IPI, PIS, COFINS, ST, ISSQN, etc.) em sub-endpoints de NF-e e NFC-e
- Inutilizacao de notas
- Carta de correcao

---

## Filtros Comuns de Listagem

Todos os endpoints de listagem aceitam:
- `limit`: registros por pagina (max 250)
- `offset`: deslocamento para paginacao
- `data_modificacao`: filtro por data de modificacao (YYYY-MM-DD) — usado no sync incremental

Pedidos aceitam filtros adicionais:
- `data_pedido_ini` / `data_pedido_fim`: intervalo de datas
- `status_pedido`: filtro por status (Em Aberto, Atendido, etc.)
- `vendedor_pedido_id`: filtro por vendedor

Clientes aceitam:
- `situacao_cliente`: Ativo/Inativo
- `tipo_cadastro`: Cliente/Fornecedor

---

## Implementacao no Rigel

### Client (`src/lib/vhsys/client.ts`)
- `vhsysGet<T>(endpoint, params?)` — GET com auth headers
- `vhsysFetchAll<T>(endpoint, extraParams?)` — Pagina automaticamente (limit=250, offset)

### Endpoints (`src/lib/vhsys/endpoints.ts`)
- Mapeamento de nomes logicos para paths da API
- `MAX_PAGE_SIZE = 250`

### Sync (`src/lib/sync/`)
- `initial.ts` — Sync completo de todas as entidades
- `incremental.ts` — Sync incremental via `data_modificacao` (cron a cada 30min)
- `webhook-handler.ts` — Handler para webhooks VHSys
