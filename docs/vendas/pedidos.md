# Pedidos

Base path: `/pedidos`

---

## Cadastrar Pedido

`POST /pedidos`

### Body Parameters (application/json)

| Campo | Tipo | Obrigatorio | Descricao | Limite |
|-------|------|-------------|-----------|--------|
| `id_cliente` | integer | Nao | ID do cliente | <= 9 |
| `nome_cliente` | string | Sim | Nome do cliente | <= 255 chars |
| `vendedor_pedido` | string | Nao | Nome do vendedor | <= 255 chars |
| `vendedor_pedido_id` | integer | Nao | ID do vendedor | <= 9 |
| `desconto_pedido` | float | Nao | Valor total do desconto | - |
| `peso_total_nota` | float | Nao | Peso total | - |
| `peso_total_nota_liq` | float | Nao | Peso liquido total | - |
| `frete_pedido` | float | Nao | Valor do frete | - |
| `valor_baseICMS` | float | Nao | Base de ICMS | - |
| `valor_ICMS` | float | Nao | Valor do ICMS | - |
| `valor_baseST` | float | Nao | Base de ST | - |
| `valor_ST` | float | Nao | Valor do ST | - |
| `valor_IPI` | float | Nao | Valor do IPI | - |
| `transportadora_pedido` | string | Nao | Nome da transportadora | <= 255 chars |
| `id_transportadora` | integer | Nao | ID da transportadora | <= 9 |
| `data_pedido` | date | Nao | Data do pedido (YYYY-MM-DD) | - |
| `prazo_entrega` | string | Nao | Prazo de entrega (dias) | <= 20 chars |
| `referencia_pedido` | string | Nao | Referencia do pedido | <= 100 chars |
| `obs_pedido` | string | Nao | Observacoes | - |
| `obs_interno_pedido` | string | Nao | Observacao interna | - |
| `status_pedido` | enum | Nao | `Em Aberto`, `Em Andamento`, `Atendido`, `Cancelado` | - |
| `estoque_pedido` | enum<int> | Nao | Estoque lancado: `1` (Sim) ou `0` (Nao, padrao) | - |
| `contas_pedido` | enum<int> | Nao | Contas lancada: `1` (Sim) ou `0` (Nao, padrao) | - |

### Exemplo cURL

```bash
curl --location --request POST '/pedidos' \
--header 'access-token: {{ACCESS_TOKEN}}' \
--header 'secret-access-token: {{SECRET_ACCESS_TOKEN}}' \
--header 'Content-Type: application/json' \
--header 'User-Agent: Rigel/1.0' \
--data-raw '{
    "nome_cliente": "Cliente Exemplo",
    "id_cliente": 123,
    "vendedor_pedido_id": 1,
    "data_pedido": "2025-03-01",
    "status_pedido": "Em Aberto",
    "obs_pedido": "Pedido via API"
}'
```

---

## Atualizar Pedido

`PUT /pedidos/{id_pedido}`

---

## Excluir Pedido

`DELETE /pedidos/{id_pedido}`

---

## Consultar Pedido

`GET /pedidos/{id_pedido}`

---

## Listar Pedidos

`GET /pedidos`

---

## Produtos do Pedido

### Cadastrar Produto
`POST /pedidos/{id_pedido}/produtos`

### Atualizar Produto
`PUT /pedidos/{id_pedido}/produtos/{id}`

### Excluir Produto
`DELETE /pedidos/{id_pedido}/produtos/{id}`

### Listar Produtos
`GET /pedidos/{id_pedido}/produtos`

---

## Parcelas do Pedido

### Cadastrar Parcelas
`POST /pedidos/{id_pedido}/parcelas`

### Listar Parcelas
`GET /pedidos/{id_pedido}/parcelas`

---

## Status do Pedido

### Cadastrar Status
`POST /pedidos/{id_pedido}/status`

### Listar Status
`GET /pedidos/{id_pedido}/status`
