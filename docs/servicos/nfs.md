# Notas Fiscais de Servico (NFS-e)

Base path: `/notas-servico`

---

## Cadastrar Nota Fiscal de Servico

`POST /notas-servico`

### Body Parameters (application/json)

| Campo | Tipo | Obrigatorio | Descricao | Limite |
|-------|------|-------------|-----------|--------|
| `serie_nota` | integer | Sim | Serie da nota fiscal | 1-9 |
| `id_cliente` | integer | Sim | ID do cliente | - |
| `nome_cliente` | string | Sim | Nome do cliente | 1-255 chars |
| `vendedor_pedido_id` | integer | Sim | ID do vendedor | - |
| `vendedor_pedido` | string | Sim | Nome do vendedor | 1-255 chars |
| `desc_servicos` | string | Sim | Descricao do servico | 1-255 chars |
| `valor_total_servicos` | string | Sim | Valor dos servicos | <= 12 chars |
| `ambiente` | enum<int> | Sim | `1` (Producao) ou `2` (Homologacao) | - |
| `natureza_pedido` | enum<int> | Sim | Ver tabela abaixo | - |
| `valor_deducoes` | string | Nao | Valor deducoes | <= 12 chars |
| `valor_base_calculo` | string | Nao | Base de calculo | <= 12 chars |
| `valor_aliquota` | string | Nao | Aliquota ISS | <= 12 chars |
| `valor_imposto` | string | Nao | Valor dos impostos | <= 12 chars |
| `reter_iss` | enum<int> | Nao | `0` (Nao) ou `1` (Sim) | - |
| `aliq_cofins` | string | Nao | Aliquota COFINS | - |
| `valor_cofins` | string | Nao | Valor COFINS | - |
| `reter_cofins` | enum<int> | Nao | `0` ou `1` | - |
| `aliq_pis` | string | Nao | Aliquota PIS | - |
| `valor_pis` | string | Nao | Valor PIS | - |
| `reter_pis` | enum<int> | Nao | `0` ou `1` | - |
| `aliq_contribuicao` | string | Nao | Aliquota CSLL | - |
| `valor_contribuicao` | string | Nao | Valor CSLL | - |
| `reter_csll` | enum<int> | Nao | `0` ou `1` | - |
| `aliq_ir` | string | Nao | Aliquota IR | - |
| `valor_ir` | string | Nao | Valor IR | - |
| `reter_ir` | enum<int> | Nao | `0` ou `1` | - |
| `aliq_inss` | string | Nao | Aliquota INSS | - |
| `valor_inss` | string | Nao | Valor INSS | - |
| `reter_inss` | enum<int> | Nao | `0` ou `1` | - |
| `valor_total_nota` | string | Nao | Valor total da nota | - |
| `regime_pedido` | enum<int> | Nao | `1` (Simples Nacional) ou `2` (Tributacao normal) | - |
| `local_prestacao` | enum<int> | Nao | `0` (Emitente), `1` (Destinatario), `2` (Terceiro), `9` (Outro) | - |
| `local_prestacao_cidade` | string | Nao | Cidade da prestacao | <= 60 chars |
| `local_prestacao_cidade_cod` | string | Nao | Codigo IBGE da cidade | 1-9 chars |
| `obs_pedido` | string | Nao | Observacoes | - |
| `obs_interno_pedido` | string | Nao | Observacao interna | - |
| `status_pedido` | enum | Nao | `Em Aberto`, `Em Andamento`, `Atendido`, `Cancelado` | - |

### Natureza da Operacao (`natureza_pedido`)

| Valor | Descricao |
|-------|-----------|
| `1` | Tributacao no municipio |
| `2` | Tributacao fora do municipio |
| `3` | Isencao |
| `4` | Imune |
| `5` | Processo judicial |

---

## Atualizar Nota Fiscal de Servico
`PUT /notas-servico/{id}`

## Excluir Nota Fiscal de Servico
`DELETE /notas-servico/{id}`

## Consultar Nota Fiscal de Servico
`GET /notas-servico/{id}`

## Listar Notas Fiscais de Servico
`GET /notas-servico`
