# Despesas (Contas a Pagar)

Base path: `/contas-pagar`

---

## Cadastrar Despesa

`POST /contas-pagar`

### Body Parameters (application/json)

| Campo | Tipo | Obrigatorio | Descricao | Limite |
|-------|------|-------------|-----------|--------|
| `nome_conta` | string | Sim | Nome da despesa | <= 45 chars |
| `id_banco` | integer | Sim | ID do banco | 1-20 |
| `valor_pag` | string | Sim | Valor da despesa | <= 10 chars |
| `vencimento_pag` | date | Sim | Data de vencimento (YYYY-MM-DD) | - |
| `data_emissao` | date | Sim | Data de emissao (YYYY-MM-DD) | - |
| `id_categoria` | integer | Nao | ID da categoria | <= 9 |
| `categoria_pag` | string | Nao | Nome da categoria | - |
| `id_fornecedor` | integer | Nao | ID do fornecedor | 1-20 |
| `nome_fornecedor` | string | Nao | Nome do fornecedor | <= 255 chars |
| `valor_pago` | string | Nao | Valor pago | <= 10 chars |
| `n_documento_pag` | string | Nao | Numero do documento | <= 45 chars |
| `observacoes_pag` | string | Nao | Observacoes | - |
| `id_centro_custos` | integer | Nao | ID do centro de custo | <= 20 |
| `centro_custos_pag` | string | Nao | Nome do centro de custo | <= 255 chars |
| `liquidado_pag` | enum | Nao | Liquidada? `Sim` ou `Nao` | - |
| `data_pagamento` | string | Nao | Data do pagamento | - |
| `obs_pagamento` | string | Nao | Obs do pagamento | - |
| `forma_pagamento` | enum | Nao | Forma de pagamento (ver lista abaixo) | <= 255 chars |
| `valor_juros` | string | Nao | Valor dos juros | <= 12 chars |
| `valor_desconto` | string | Nao | Valor do desconto | <= 12 chars |
| `valor_acrescimo` | string | Nao | Valor do acrescimo | - |

### Formas de Pagamento

`Dinheiro`, `PIX`, `Cheque`, `Permuta`, `Cartao de Credito`, `Cartao de Debito`, `Boleto`, `Transferencia`, `Ted`, `Deposito Identificado`, `Deposito em C/C`, `Duplicata Mercantil`, `Faturado`, `Faturar`, `Debito Automatico`, `Loterica`, `Banco`, `DDA`, `Pagamento online`, `BNDES`, `Outros`, `DP Descontada`, `CH Descontado`, `Vale Alimentacao`, `Vale Refeicao`, `Vale Presente`, `Vale Combustivel`

### Exemplo cURL

```bash
curl --location --request POST '/contas-pagar' \
--header 'access-token: {{ACCESS_TOKEN}}' \
--header 'secret-access-token: {{SECRET_ACCESS_TOKEN}}' \
--header 'Content-Type: application/json' \
--header 'User-Agent: Rigel/1.0' \
--data-raw '{
    "nome_conta": "Aluguel",
    "id_banco": 1,
    "valor_pag": "1500.00",
    "vencimento_pag": "2025-03-10",
    "data_emissao": "2025-02-24",
    "id_categoria": 1,
    "forma_pagamento": "Boleto"
}'
```

---

## Atualizar Despesa

`PUT /contas-pagar/{id}`

---

## Excluir Despesa

`DELETE /contas-pagar/{id}`

---

## Consultar Despesa

`GET /contas-pagar/{id}`

---

## Listar Despesas

`GET /contas-pagar`

---

## Operacoes Financeiras

### Liquidar Despesa

`POST /contas-pagar/{id}/liquidar`

Marca a despesa como paga.

### Desliquidar Despesa

`POST /contas-pagar/{id}/desliquidar`

Reverte a liquidacao.
