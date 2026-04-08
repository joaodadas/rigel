# Vendas Balcao (PDV)

Base path: `/vendas-balcao`

---

## Cadastrar Venda Balcao

`POST /vendas-balcao`

### Body Parameters (application/json)

| Campo | Tipo | Obrigatorio | Descricao | Limite |
|-------|------|-------------|-----------|--------|
| `id_cliente` | integer | Sim | ID do cliente | <= 9 |
| `nome_cliente` | string | Sim | Nome do cliente | <= 255 chars |
| `vendedor_pedido` | string | Sim | Nome do vendedor | <= 255 chars |
| `vendedor_pedido_id` | integer | Sim | ID do vendedor | <= 9 |
| `desconto_pedido` | string | Nao | Valor total do desconto | <= 13 chars |
| `acrescimo_pedido` | string | Nao | Valor total do acrescimo | <= 13 chars |
| `forma_pagamento` | string | Nao | Forma de pagamento | - |
| `valor_recebido` | string | Nao | Valor recebido | <= 13 chars |
| `troco_pedido` | string | Nao | Valor do troco | <= 13 chars |
| `id_banco` | integer | Nao | ID do banco | <= 9 |
| `obs_pedido` | string | Nao | Observacoes | - |
| `status_pedido` | enum | Nao | `Em Aberto`, `Em Andamento`, `Atendido`, `Cancelado` | - |

### Exemplo cURL

```bash
curl --location --request POST '/vendas-balcao' \
--header 'access-token: {{ACCESS_TOKEN}}' \
--header 'secret-access-token: {{SECRET_ACCESS_TOKEN}}' \
--header 'Content-Type: application/json' \
--header 'User-Agent: Rigel/1.0' \
--data-raw '{
    "id_cliente": 123456,
    "nome_cliente": "Cliente Exemplo",
    "vendedor_pedido": "Vendedor",
    "vendedor_pedido_id": 1,
    "forma_pagamento": "Dinheiro",
    "valor_recebido": "100.00",
    "troco_pedido": "10.00",
    "status_pedido": "Em Aberto"
}'
```

---

## Atualizar Venda Balcao
`PUT /vendas-balcao/{id_frente}`

## Excluir Venda Balcao
`DELETE /vendas-balcao/{id_frente}`

## Consultar Venda Balcao
`GET /vendas-balcao/{id_frente}`

## Listar Vendas Balcao

`GET /vendas-balcao`

### Query Parameters

| Param | Tipo | Descricao |
|-------|------|-----------|
| `order` | string | Campo para ordenacao |
| `sort` | enum | `Asc` ou `Desc` |
| `limit` | integer | Max 250 |
| `offset` | integer | Registro inicial |
| `nome_cliente` | string | Filtrar por nome |
| `vendedor` | string | Filtrar por vendedor |
| `valor_produtos` | string | Valor total (range: `10.00,20.00`) |
| `valor_total` | string | Valor total da nota |
| `status` | string | Filtrar por status |
| `lixeira` | enum | `Sim` ou `Nao` |
| `data_modificacao` | datetime | Registros modificados apos data |

---

## Produtos da Venda Balcao

### Cadastrar Produtos
`POST /vendas-balcao/{id}/produtos`

### Atualizar Produto
`PUT /vendas-balcao/{id}/produtos/{id_produto}`

### Excluir Produto
`DELETE /vendas-balcao/{id}/produtos/{id_produto}`

### Consultar Produtos
`GET /vendas-balcao/{id}/produtos`

---

## Parcelas da Venda Balcao

### Cadastrar Parcela
`POST /vendas-balcao/{id}/parcelas`

### Consultar Parcelas
`GET /vendas-balcao/{id}/parcelas`

---

## Status da Venda Balcao

### Cadastrar Status
`POST /vendas-balcao/{id}/status`

### Consultar Status
`GET /vendas-balcao/{id}/status`
