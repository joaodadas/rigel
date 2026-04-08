# Ordens de Compra

Base path: `/ordens-compra`

---

## Cadastrar Ordem de Compra

`POST /ordens-compra`

### Body Parameters (application/json)

| Campo | Tipo | Obrigatorio | Descricao | Limite |
|-------|------|-------------|-----------|--------|
| `nome_cliente` | string | Sim | Nome do fornecedor/cliente | <= 255 chars |
| `id_cliente` | integer | Nao | ID do cliente | <= 9 |
| `vendedor_pedido` | string | Nao | Nome do vendedor | <= 255 chars |
| `desconto_pedido` | float | Nao | Valor do desconto | - |
| `peso_total_nota` | float | Nao | Peso total | - |
| `peso_total_nota_liq` | float | Nao | Peso liquido | - |
| `frete_pedido` | float | Nao | Valor do frete | - |
| `valor_baseICMS` | float | Nao | Base de ICMS | - |
| `valor_ICMS` | float | Nao | Valor do ICMS | - |
| `valor_baseST` | float | Nao | Base de ST | - |
| `valor_ST` | float | Nao | Valor do ST | - |
| `valor_IPI` | float | Nao | Valor do IPI | - |
| `transportadora_pedido` | string | Nao | Nome da transportadora | <= 255 chars |
| `id_transportadora` | integer | Nao | ID da transportadora | <= 9 |
| `data_pedido` | date | Nao | Data da ordem | - |
| `obs_pedido` | string | Nao | Observacoes | - |
| `obs_interno_pedido` | string | Nao | Observacao interna | - |
| `status_pedido` | enum | Nao | `Em Aberto`, `Em Andamento`, `Atendido`, `Cancelado` | - |

---

## Atualizar Ordem de Compra
`PUT /ordens-compra/{id_ordem}`

## Excluir Ordem de Compra
`DELETE /ordens-compra/{id_ordem}`

## Consultar Ordem de Compra
`GET /ordens-compra/{id_ordem}`

## Listar Ordens de Compra

`GET /ordens-compra`

### Query Parameters

| Param | Tipo | Descricao |
|-------|------|-----------|
| `order` | string | Campo para ordenacao |
| `sort` | enum | `Asc` ou `Desc` |
| `limit` | integer | Max 250 |
| `offset` | integer | Registro inicial |
| `nome_cliente` | string | Filtrar por nome |
| `vendedor` | string | Filtrar por vendedor |
| `status` | string | Filtrar por status |
| `lixeira` | enum | `Sim` ou `Nao` |
| `data_modificacao` | string | Registros modificados apos data |

---

## Produtos da OC

### Cadastrar Produto
`POST /ordens-compra/{id}/produtos`

### Alterar Produto
`PUT /ordens-compra/{id}/produtos/{id_produto}`

### Excluir Produto
`DELETE /ordens-compra/{id}/produtos/{id_produto}`

### Consultar Produtos
`GET /ordens-compra/{id}/produtos`

---

## Status da OC

### Cadastrar Status
`POST /ordens-compra/{id}/status`

### Consultar Status
`GET /ordens-compra/{id}/status`

---

## Parcelas da OC

### Cadastrar Parcelas
`POST /ordens-compra/{id}/parcelas`

### Consultar Parcelas
`GET /ordens-compra/{id}/parcelas`
