# Receitas (Contas a Receber)

Base path: `/contas-receber`

---

## Cadastrar Receita

`POST /contas-receber`

### Body Parameters (application/json)

| Campo | Tipo | Obrigatorio | Descricao | Limite |
|-------|------|-------------|-----------|--------|
| `nome_conta` | string | Sim | Nome da receita | 1-45 chars |
| `id_banco` | integer | Sim | ID do banco | 1-20 |
| `vencimento_rec` | date | Sim | Data de vencimento (YYYY-MM-DD) | - |
| `valor_rec` | string | Sim | Valor da receita | - |
| `data_emissao` | date | Sim | Data de emissao (YYYY-MM-DD) | - |
| `id_cliente` | integer | Nao | ID do cliente | 1-20 |
| `nome_cliente` | string | Nao | Nome do cliente | 0-255 chars |
| `id_categoria` | integer | Nao | ID da categoria | 1-9 |
| `categoria_rec` | string | Nao | Nome da categoria | 0-50 chars |
| `valor_pago` | string | Nao | Valor pago | 0-10 chars |
| `n_documento_rec` | string | Nao | Numero do documento | 0-45 chars |
| `observacoes_rec` | string | Nao | Observacoes | - |
| `id_centro_custos` | integer | Nao | ID do centro de custo | 0-20 |
| `centro_custos_rec` | string | Nao | Nome do centro de custo | 0-255 chars |
| `liquidado_rec` | enum | Nao | Liquidada? `Sim` ou `Nao` | - |
| `data_pagamento` | date | Nao | Data do pagamento | - |
| `obs_pagamento` | string | Nao | Obs do pagamento | 0-255 chars |
| `forma_pagamento` | enum | Nao | Forma de pagamento (mesmas da despesa) | 0-255 chars |
| `tipo_conta` | enum | Nao | `Boleto`, `Conta`, `Duplicata`, `PIX` | - |
| `valor_juros` | float | Nao | Valor dos juros | <= 10 |
| `valor_desconto` | float | Nao | Valor do desconto | <= 10 |
| `valor_acrescimo` | float | Nao | Valor do acrescimo | - |

### Exemplo cURL

```bash
curl --location --request POST '/contas-receber' \
--header 'access-token: {{ACCESS_TOKEN}}' \
--header 'secret-access-token: {{SECRET_ACCESS_TOKEN}}' \
--header 'Content-Type: application/json' \
--header 'User-Agent: Rigel/1.0' \
--data-raw '{
    "nome_conta": "Venda #1234",
    "id_banco": 1,
    "vencimento_rec": "2025-04-10",
    "valor_rec": "500.00",
    "data_emissao": "2025-03-01",
    "id_cliente": 123,
    "forma_pagamento": "PIX"
}'
```

---

## Atualizar Receita

`PUT /contas-receber/{id}`

---

## Excluir Receita

`DELETE /contas-receber/{id}`

---

## Consultar Receita

`GET /contas-receber/{id}`

---

## Listar Receitas

`GET /contas-receber`

---

## Operacoes Financeiras

### Liquidar Receita
`POST /contas-receber/{id}/liquidar`

### Desliquidar Receita
`POST /contas-receber/{id}/desliquidar`
