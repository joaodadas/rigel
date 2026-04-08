# NF-e (Notas Fiscais Eletronicas)

Base path: `/notas-fiscais`

---

## Cadastrar NF-e

`POST /notas-fiscais`

### Body Parameters (application/json)

| Campo | Tipo | Obrigatorio | Descricao | Limite |
|-------|------|-------------|-----------|--------|
| `serie_nota` | integer | Nao | Serie da nota fiscal | <= 999 |
| `id_cliente` | integer | Nao | ID do cliente | - |
| `nome_cliente` | string | Sim | Nome do cliente | <= 255 chars |
| `vendedor_pedido` | string | Nao | Nome do vendedor | <= 30 chars |
| `vendedor_pedido_id` | integer | Nao | ID do vendedor | - |
| `desconto_pedido` | number | Nao | Valor do desconto | - |
| `peso_total_nota` | number | Nao | Peso bruto total | - |
| `peso_total_nota_liq` | number | Nao | Peso liquido total | - |
| `frete_pedido` | number | Nao | Valor do frete | - |
| `valor_baseICMS` | number | Nao | Base de calculo ICMS | - |
| `valor_ICMS` | number | Nao | Valor do ICMS | - |
| `valor_baseST` | number | Nao | Base de calculo ST | - |
| `valor_ST` | number | Nao | Valor da ST | - |
| `valor_IPI` | number | Nao | Valor do IPI | - |
| `valor_despesas` | number | Nao | Despesas acessorias | - |
| `transportadora_pedido` | string | Nao | Nome da transportadora | <= 255 chars |
| `id_transportadora` | integer | Nao | ID da transportadora | <= 999999999 |
| `frete_por_pedido` | enum<int> | Nao | Modalidade do frete | - |
| `volumes_transporta` | integer | Nao | Qtd volumes | <= 999 |
| `especie_transporta` | string | Nao | Especie dos volumes | <= 25 chars |
| `marca_transporta` | string | Nao | Marca dos volumes | <= 60 chars |
| `numeracao_transporta` | string | Nao | Numeracao dos volumes | <= 60 chars |
| `placa_transporta` | string | Nao | Placa do veiculo | <= 25 chars |
| `uf_embarque` | string | Nao | UF de embarque | <= 2 chars |
| `local_embarque` | string | Nao | Local de embarque | <= 60 chars |
| `data_pedido` | date | Nao | Data do pedido | - |

### Modalidade do Frete (`frete_por_pedido`)

| Valor | Descricao |
|-------|-----------|
| `0` | Por conta do emitente |
| `1` | Por conta do destinatario |
| `2` | Por conta de terceiros |
| `9` | Sem frete |

### Exemplo cURL

```bash
curl --location --request POST '/notas-fiscais' \
--header 'access-token: {{ACCESS_TOKEN}}' \
--header 'secret-access-token: {{SECRET_ACCESS_TOKEN}}' \
--header 'Content-Type: application/json' \
--header 'User-Agent: Rigel/1.0' \
--data-raw '{
    "nome_cliente": "Cliente Exemplo LTDA",
    "id_cliente": 123,
    "serie_nota": 1,
    "frete_por_pedido": 9,
    "data_pedido": "2025-03-01"
}'
```

---

## Atualizar NF-e
`PUT /notas-fiscais/{id}`

## Excluir NF-e
`DELETE /notas-fiscais/{id}`

## Consultar NF-e
`GET /notas-fiscais/{id}`

## Listar NF-e
`GET /notas-fiscais`

## Emitir NF-e
`POST /notas-fiscais/{id}/emitir`

## Inutilizar
`POST /notas-fiscais/inutilizar`

## Listar Notas Inutilizadas
`GET /notas-fiscais/inutilizadas`

---

## Produtos da NF-e

### Cadastrar Produto
`POST /notas-fiscais/{id}/produtos`

### Atualizar Produto
`PUT /notas-fiscais/{id}/produtos/{id_produto}`

### Excluir Produto
`DELETE /notas-fiscais/{id}/produtos/{id_produto}`

### Consultar Produtos
`GET /notas-fiscais/{id}/produtos`

---

## Impostos da NF-e

### Cadastrar Impostos
`POST /notas-fiscais/{id}/produtos/{id_produto}/impostos`

Tipos disponiveis:
- **ICMS**, **IPI**, **PIS**, **COFINS**
- **Armas**, **Combustivel**
- **Declaracao de Importacao (DI)**, **Adicao (DI)**
- **Exportacao**, **ISSQN**, **Medicamentos**
- **Substituicao Tributaria**, **Importacao**
- **IBSCBS** (Reforma Tributaria)
- **Imposto Monofasico**, **Imposto Seletivo**

---

## Status da NF-e

### Cadastrar Status
`POST /notas-fiscais/{id}/status`

### Consultar Status
`GET /notas-fiscais/{id}/status`

---

## Parcelas da NF-e

### Cadastrar Parcelas
`POST /notas-fiscais/{id}/parcelas`

### Consultar Parcelas
`GET /notas-fiscais/{id}/parcelas`

---

## Carta de Correcao

### Cadastrar Carta de Correcao
`POST /notas-fiscais/{id}/carta-correcao`

### Consulta XML
`GET /notas-fiscais/{id}/carta-correcao/xml`

### Listar Cartas
`GET /notas-fiscais/{id}/carta-correcao`
