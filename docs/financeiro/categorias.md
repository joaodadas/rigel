# Categorias Financeiras

Base path: `/categorias-financeiras`

---

## Cadastrar Categoria

`POST /categorias-financeiras`

### Body Parameters (application/json)

| Campo | Tipo | Obrigatorio | Descricao | Limite |
|-------|------|-------------|-----------|--------|
| `tipo_categoria` | enum | Sim | `Receita` ou `Despesa` | - |
| `desc_categoria` | string | Sim | Descricao da categoria | 1-50 chars |

### Exemplo cURL

```bash
curl --location --request POST '/categorias-financeiras' \
--header 'access-token: {{ACCESS_TOKEN}}' \
--header 'secret-access-token: {{SECRET_ACCESS_TOKEN}}' \
--header 'Content-Type: application/json' \
--header 'User-Agent: Rigel/1.0' \
--data-raw '{
    "tipo_categoria": "Receita",
    "desc_categoria": "Vendas Online"
}'
```

### Resposta (200)

```json
{
    "code": 200,
    "status": "success",
    "data": {
        "id_categoria": 123,
        "tipo_categoria": "Receita",
        "desc_categoria": "Vendas Online"
    }
}
```

---

## Atualizar Categoria
`PUT /categorias-financeiras/{id_categoria}`

## Excluir Categoria
`DELETE /categorias-financeiras/{id_categoria}`

## Consultar Categoria
`GET /categorias-financeiras/{id_categoria}`

## Listar Categorias
`GET /categorias-financeiras`
