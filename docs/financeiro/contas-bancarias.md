# Contas Bancarias

Base path: `/contas-bancarias`

---

## Cadastrar Conta Bancaria

`POST /contas-bancarias`

### Body Parameters (application/json)

| Campo | Tipo | Obrigatorio | Descricao | Limite |
|-------|------|-------------|-----------|--------|
| `nome_banco_cad` | string | Sim | Nome do banco | 1-50 chars |
| `numero_banco` | string | Sim | Numero do banco (tabela auxiliar) | 3 chars |
| `conta_banco` | string | Sim | Numero da conta | 0-15 chars |
| `saldo_inicial` | float | Nao | Saldo inicial | - |
| `saldo_inicial_data` | date | Nao | Data do saldo inicial | - |
| `multa_atraso` | float | Nao | Multa por atraso | - |
| `gerar_boletos` | boolean | Nao | Se gera boletos | - |
| `id_carteira` | integer | Nao | ID da carteira (0-4) | - |
| `carteira_banco` | string | Nao | Numero da carteira | 0-25 chars |
| `convenio_banco` | string | Nao | Numero do convenio | 0-30 chars |
| `cedente_banco` | string | Nao | Numero do cedente | 0-255 chars |
| `agencia_banco` | string | Nao | Numero da agencia | 0-10 chars |
| `agencia_dv_banco` | string | Nao | DV da agencia | 0-10 chars |
| `conta_dv_banco` | string | Nao | DV da conta | 0-10 chars |
| `codigo_cedente` | string | Nao | Codigo do cedente | 0-30 chars |
| `instrucoes_boleto` | string | Nao | Instrucoes do boleto | - |
| `correcao_dia` | number | Nao | Valor correcao ao dia | - |
| `status_banco` | enum | Nao | `Ativo` ou `Inativo` (padrao: `Inativo`) | - |
| `cobrar_juros` | enum | Nao | `0` (nao) ou `1` (sim) | - |
| `taxa_boleto` | number | Nao | Valor taxa do boleto | - |
| `padrao_receita` | enum | Nao | `0` ou `1` | - |
| `padrao_despesa` | enum | Nao | `0` ou `1` | - |
| `sequencia` | integer | Nao | Numero inicial do boleto | 0-99999999999 |

### Exemplo cURL

```bash
curl --location --request POST '/contas-bancarias' \
--header 'access-token: {{ACCESS_TOKEN}}' \
--header 'secret-access-token: {{SECRET_ACCESS_TOKEN}}' \
--header 'Content-Type: application/json' \
--header 'User-Agent: Rigel/1.0' \
--data-raw '{
    "numero_banco": "001",
    "nome_banco_cad": "Banco do Brasil",
    "conta_banco": "12345-6",
    "agencia_banco": "1234",
    "saldo_inicial": 0.00,
    "status_banco": "Ativo"
}'
```

---

## Atualizar Conta Bancaria
`PUT /contas-bancarias/{id_banco_cad}`

## Excluir Conta Bancaria
`DELETE /contas-bancarias/{id_banco_cad}`

## Consultar Conta Bancaria
`GET /contas-bancarias/{id_banco_cad}`

## Listar Contas Bancarias
`GET /contas-bancarias`
