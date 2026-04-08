# Vendedores

Base path: `/vendedores`

---

## Cadastrar Vendedor

`POST /vendedores`

### Body Parameters (application/json)

| Campo | Tipo | Obrigatorio | Descricao | Limite |
|-------|------|-------------|-----------|--------|
| `tipo_pessoa` | enum | Nao | `PF` ou `PJ` (padrao: `PF`) | - |
| `cnpj_vendedor` | string | Nao | CNPJ / CPF | <= 18 chars |
| `razao_vendedor` | string | Sim | Razao social ou nome | 1-255 chars |
| `fantasia_vendedor` | string | Nao | Nome Fantasia | <= 255 chars |
| `endereco_vendedor` | string | Nao | Endereco | <= 255 chars |
| `numero_vendedor` | string | Nao | Numero endereco | <= 7 chars |
| `bairro_vendedor` | string | Nao | Bairro | <= 45 chars |
| `complemento_vendedor` | string | Nao | Complemento | <= 45 chars |
| `cep_vendedor` | string | Nao | CEP | <= 10 chars |
| `cidade_vendedor` | string | Nao | Cidade | <= 255 chars |
| `uf_vendedor` | string | Nao | Estado (UF) | <= 2 chars |
| `contato_vendedor` | string | Nao | Nome do contato | <= 255 chars |
| `fone_vendedor` | string | Nao | Telefone | <= 20 chars |
| `fone_ramal_vendedor` | string | Nao | Ramal | <= 20 chars |
| `celular_vendedor` | string | Nao | Celular | <= 20 chars |
| `email_vendedor` | string | Nao | Email | <= 255 chars |
| `website_vendedor` | string | Nao | Website | <= 50 chars |
| `banco_vendedor` | string | Nao | Nome do banco | <= 50 chars |
| `banco_agencia` | string | Nao | Numero da agencia | <= 15 chars |
| `banco_conta` | string | Nao | Numero da conta | <= 20 chars |
| `banco_salario` | float | Nao | Salario | - |

### Exemplo cURL

```bash
curl --location --request POST '/vendedores' \
--header 'access-token: {{ACCESS_TOKEN}}' \
--header 'secret-access-token: {{SECRET_ACCESS_TOKEN}}' \
--header 'Content-Type: application/json' \
--header 'User-Agent: Rigel/1.0' \
--data-raw '{
    "razao_vendedor": "Joao Silva",
    "tipo_pessoa": "PF",
    "email_vendedor": "joao@empresa.com",
    "fone_vendedor": "(41) 99999-0000",
    "cidade_vendedor": "Curitiba",
    "uf_vendedor": "PR"
}'
```

---

## Atualizar Vendedor

`PUT /vendedores/{id_vendedor}`

Mesmos parametros do cadastro.

---

## Excluir Vendedor

`DELETE /vendedores/{id_vendedor}`

---

## Consultar Vendedor

`GET /vendedores/{id_vendedor}`

---

## Listar Vendedores

`GET /vendedores`
