# Transportadoras

Base path: `/transportadoras`

---

## Cadastrar Transportadora

`POST /transportadoras`

### Body Parameters (application/json)

| Campo | Tipo | Obrigatorio | Descricao | Limite |
|-------|------|-------------|-----------|--------|
| `desc_transportadora` | string | Sim | Nome da transportadora | <= 255 chars |
| `tipo_pessoa` | enum | Nao | `PF` ou `PJ` (padrao: `PJ`) | - |
| `cnpj_transportadora` | string | Nao | CNPJ/CPF | <= 18 chars |
| `ie_transportadora` | string | Nao | Inscricao Estadual | <= 45 chars |
| `endereco_transportadora` | string | Nao | Endereco | <= 255 chars |
| `numero_transportadora` | string | Nao | Numero | <= 5 chars |
| `cep_transportadora` | string | Nao | CEP | <= 10 chars |
| `bairro_transportadora` | string | Nao | Bairro | <= 45 chars |
| `complemento_transportadora` | string | Nao | Complemento | <= 45 chars |
| `cidade_transportadora` | string | Nao | Cidade | <= 255 chars |
| `estado_transportadora` | string | Nao | Estado (UF) | <= 2 chars |
| `fone_transportadora` | string | Nao | Telefone | <= 15 chars |
| `email_transportadora` | string | Nao | Email | <= 255 chars |
| `observacoes_transportadora` | string | Nao | Observacoes | - |

### Exemplo cURL

```bash
curl --location --request POST '/transportadoras' \
--header 'access-token: {{ACCESS_TOKEN}}' \
--header 'secret-access-token: {{SECRET_ACCESS_TOKEN}}' \
--header 'Content-Type: application/json' \
--header 'User-Agent: Rigel/1.0' \
--data-raw '{
    "desc_transportadora": "Transportadora Rapida",
    "tipo_pessoa": "PJ",
    "cnpj_transportadora": "00.000.000/0001-00",
    "cidade_transportadora": "Curitiba",
    "estado_transportadora": "PR"
}'
```

---

## Atualizar Transportadora
`PUT /transportadoras/{id_transportadora}`

## Excluir Transportadora
`DELETE /transportadoras/{id_transportadora}`

## Consultar Transportadora
`GET /transportadoras/{id_transportadora}`

## Listar Transportadoras
`GET /transportadoras`
