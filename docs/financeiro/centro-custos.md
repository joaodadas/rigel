# Centro de Custos

Base path: `/centros-custo`

---

## Cadastrar Centro de Custos

`POST /centros-custo`

### Body Parameters (application/json)

| Campo | Tipo | Obrigatorio | Descricao |
|-------|------|-------------|-----------|
| `desc_centro_custos` | string | Sim | Nome/descricao do centro de custo |
| `status_centro_custos` | string | Sim | `Ativo` ou `Inativo` |

### Exemplo cURL

```bash
curl --location --request POST '/centros-custo' \
--header 'access-token: {{ACCESS_TOKEN}}' \
--header 'secret-access-token: {{SECRET_ACCESS_TOKEN}}' \
--header 'Content-Type: application/json' \
--header 'User-Agent: Rigel/1.0' \
--data-raw '{
    "desc_centro_custos": "Marketing",
    "status_centro_custos": "Ativo"
}'
```

### Resposta (200)

```json
{
    "code": 200,
    "status": "success",
    "data": {
        "id_centro_custos": 123,
        "desc_centro_custos": "Marketing",
        "status_centro_custos": "Ativo",
        "data_cad_centro": "2025-03-01 10:00:00"
    }
}
```

---

## Atualizar Centro de Custos
`PUT /centros-custo/{id_centro_custos}`

## Excluir Centro de Custos
`DELETE /centros-custo/{id_centro_custos}`

## Consultar Centro de Custos
`GET /centros-custo/{id_centro_custos}`

## Listar Centros de Custo
`GET /centros-custo`
