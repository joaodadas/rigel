# Extratos

Base path: `/extratos`

---

## Cadastrar Extrato

`POST /extratos`

### Body Parameters (application/json)

| Campo | Tipo | Obrigatorio | Descricao | Limite |
|-------|------|-------------|-----------|--------|
| `id_banco` | integer | Sim | ID do banco | <= 9 |
| `nome_conta` | string | Sim | Nome da conta | <= 255 chars |
| `data_emissao` | date | Sim | Data emissao (YYYY-MM-DD) | - |
| `data_fluxo` | date | Sim | Data do extrato (YYYY-MM-DD) | - |
| `valor_fluxo` | string | Sim | Valor do extrato | <= 12 chars |
| `tipo_fluxo` | enum | Sim | `Entrada` ou `Saida` | - |
| `id_cliente` | integer | Nao | ID do cliente | <= 9 |
| `nome_cliente` | string | Nao | Nome do cliente | <= 255 chars |
| `observacoes_fluxo` | string | Nao | Observacoes | - |
| `id_centro_custos` | integer | Nao | ID do centro de custo | <= 9 |
| `centro_custos_fluxo` | string | Nao | Nome do centro de custo | <= 50 chars |
| `id_categoria` | integer | Nao | ID da categoria | <= 9 |
| `categoria_fluxo` | string | Nao | Nome da categoria | <= 50 chars |
| `forma_pagamento` | string | Nao | Forma de pagamento | <= 255 chars |
| `lixeira` | enum | Nao | `Sim` ou `Nao` | - |

---

## Excluir Extrato
`DELETE /extratos/{id}`

## Consultar Extrato
`GET /extratos/{id}`

## Listar Extratos
`GET /extratos`
