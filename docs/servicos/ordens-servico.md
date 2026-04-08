# Ordens de Servico

Base path: `/ordens-servico`

---

## Cadastrar Ordem de Servico

`POST /ordens-servico`

### Body Parameters (application/json)

| Campo | Tipo | Obrigatorio | Descricao |
|-------|------|-------------|-----------|
| `id_cliente` | integer | Sim | ID do cliente |
| `nome_cliente` | string | Sim | Nome do cliente |
| `vendedor_pedido` | string | Nao | Nome do vendedor |
| `vendedor_pedido_id` | integer | Nao | ID do vendedor |
| `valor_total_despesas` | string | Nao | Valor total das despesas |
| `valor_total_desconto` | string | Nao | Valor total dos descontos |
| `data_pedido` | date | Nao | Data da OS |
| `data_entrega` | date | Nao | Data de entrega |
| `data_realizacao` | date | Nao | Data de realizacao |
| `data_realizacao_hora` | string | Nao | Hora (HH:MM:SS) |
| `garantia_ordem` | string | Nao | Detalhes da garantia |
| `equipamento_ordem` | string | Nao | Equipamentos usados |
| `problema_ordem` | string | Nao | Problemas encontrados |
| `recebimento_ordem` | string | Nao | Detalhes do recebimento |
| `referencia_ordem` | string | Nao | Referencia |
| `obs_pedido` | string | Nao | Observacao |
| `obs_interno_pedido` | string | Nao | Observacao interna |
| `laudo_ordem` | string | Nao | Laudo sobre servico/produto |
| `status_pedido` | enum | Nao | `Em Aberto`, `Em Andamento`, `Atendido`, `Cancelado` |

### Resposta (200)

Retorna dados da OS incluindo: `id_ordem`, `id_pedido`, `valor_total_servicos`, `condicao_pagamento_id`, `condicao_pagamento`

---

## Atualizar Ordem de Servico
`PUT /ordens-servico/{id_ordem}`

## Excluir Ordem de Servico
`DELETE /ordens-servico/{id_ordem}`

## Consultar Ordem de Servico
`GET /ordens-servico/{id_ordem}`

## Listar Ordens de Servico

`GET /ordens-servico`

### Query Parameters

| Param | Tipo | Descricao |
|-------|------|-----------|
| `order` | string | Campo para ordenacao (ex: `data_mod_pedido`) |
| `sort` | enum | `Asc` ou `Desc` |
| `limit` | integer | Max 250 |
| `offset` | integer | Registro inicial |
| `nome_cliente` | string | Filtrar por nome |
| `vendedor` | string | Filtrar por vendedor |
| `status` | string | Filtrar por status |
| `lixeira` | enum | `Sim` ou `Nao` |
| `data_modificacao` | datetime | Registros modificados apos data |

---

## Produtos da OS

### Cadastrar Produto
`POST /ordens-servico/{id}/produtos`

### Atualizar Produto
`PUT /ordens-servico/{id}/produtos/{id_produto}`

### Excluir Produto
`DELETE /ordens-servico/{id}/produtos/{id_produto}`

### Listar Produtos
`GET /ordens-servico/{id}/produtos`

---

## Servicos da OS

### Cadastrar Servico
`POST /ordens-servico/{id}/servicos`

### Atualizar Servico
`PUT /ordens-servico/{id}/servicos/{id_servico}`

### Excluir Servico
`DELETE /ordens-servico/{id}/servicos/{id_servico}`

### Listar Servicos
`GET /ordens-servico/{id}/servicos`

---

## Parcelas da OS

### Cadastrar Parcelas
`POST /ordens-servico/{id}/parcelas`

### Listar Parcelas
`GET /ordens-servico/{id}/parcelas`

---

## Status da OS

### Cadastrar Status
`POST /ordens-servico/{id}/status`

### Listar Status
`GET /ordens-servico/{id}/status`
