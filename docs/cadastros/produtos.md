# Produtos

Base path: `/produtos`

---

## Cadastrar Produto

`POST /produtos`

### Body Parameters (application/json)

| Campo | Tipo | Obrigatorio | Descricao | Limite |
|-------|------|-------------|-----------|--------|
| `id_categoria` | integer | Sim | ID da categoria | <= 9 |
| `cod_produto` | integer | Sim | Codigo do produto | <= 60 |
| `marca_produto` | string | Sim | Marca | <= 45 chars |
| `desc_produto` | string | Sim | Nome/descricao do produto | - |
| `fornecedor_produto` | string | Sim | Nome do fornecedor | - |
| `fornecedor_produto_id` | integer | Sim | ID do fornecedor | - |
| `minimo_produto` | string | Sim | Estoque minimo | - |
| `maximo_produto` | string | Sim | Estoque maximo | - |
| `estoque_produto` | string | Sim | Estoque atual | <= 14 chars |
| `unidade_produto` | string | Sim | Unidade (UN, KG, etc) | - |
| `valor_produto` | string | Sim | Valor de venda | - |
| `valor_custo_produto` | string | Sim | Valor de custo | - |
| `peso_produto` | string | Sim | Peso bruto (KG) | - |
| `peso_liq_produto` | string | Sim | Peso liquido (KG) | - |
| `icms_produto` | string | Sim | ICMS (%) | - |
| `ipi_produto` | string | Sim | IPI (%) | - |
| `pis_produto` | string | Sim | PIS (%) | - |
| `cofins_produto` | string | Sim | COFINS (%) | - |
| `cest_produto` | string | Sim | CEST | - |
| `ncm_produto` | string | Sim | NCM | - |
| `codigo_barra_produto` | string | Sim | Codigo de barras | - |
| `obs_produto` | string | Sim | Observacoes | - |
| `tipo_produto` | string | Sim | Tipo do produto | - |
| `kit_produto` | string | Sim | Se e kit | - |

### Exemplo cURL

```bash
curl --location --request POST '/produtos' \
--header 'access-token: {{ACCESS_TOKEN}}' \
--header 'secret-access-token: {{SECRET_ACCESS_TOKEN}}' \
--header 'Content-Type: application/json' \
--header 'User-Agent: Rigel/1.0' \
--data-raw '{
    "id_categoria": 1,
    "cod_produto": 123,
    "marca_produto": "Marca X",
    "desc_produto": "Produto Exemplo",
    "fornecedor_produto": "Fornecedor Y",
    "fornecedor_produto_id": 1,
    "minimo_produto": "10",
    "maximo_produto": "100",
    "estoque_produto": "50",
    "unidade_produto": "UN",
    "valor_produto": "99.90",
    "valor_custo_produto": "50.00",
    "peso_produto": "0.500",
    "peso_liq_produto": "0.450",
    "icms_produto": "18",
    "ipi_produto": "0",
    "pis_produto": "1.65",
    "cofins_produto": "7.60",
    "cest_produto": "",
    "ncm_produto": "00000000",
    "codigo_barra_produto": "7891234567890",
    "obs_produto": "",
    "tipo_produto": "Simples",
    "kit_produto": "Nao"
}'
```

---

## Atualizar Produto

`PUT /produtos/{id_produto}`

Mesmos parametros do cadastro.

---

## Excluir Produto

`DELETE /produtos/{id_produto}`

---

## Consultar Produto

`GET /produtos/{id_produto}`

---

## Listar Produtos

`GET /produtos`

---

## Estoque

### Lancar Estoque

`POST /produtos/{id_produto}/estoque`

Adiciona ou remove quantidade do estoque.

### Consultar Estoque

`GET /produtos/{id_produto}/estoque`

Retorna saldo atual de estoque.
