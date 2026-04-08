# NFC-e (Notas Fiscais de Consumidor)

Base path: `/notas-consumidor`

---

## NFC-e (CRUD)

### Cadastrar NFC-e
`POST /notas-consumidor`

### Atualizar NFC-e
`PUT /notas-consumidor/{id}`

### Excluir NFC-e
`DELETE /notas-consumidor/{id}`

### Consultar NFC-e
`GET /notas-consumidor/{id}`

### Listar NFC-e
`GET /notas-consumidor`

### Emitir NFC-e
`POST /notas-consumidor/{id}/emitir`

### Inutilizar
`POST /notas-consumidor/inutilizar`

### Listar NFC-e Inutilizadas
`GET /notas-consumidor/inutilizadas`

---

## Produtos da NFC-e

### Cadastrar Produtos
`POST /notas-consumidor/{id}/produtos`

### Alterar Produto
`PUT /notas-consumidor/{id}/produtos/{id_produto}`

### Excluir Produto
`DELETE /notas-consumidor/{id}/produtos/{id_produto}`

### Consultar Produtos
`GET /notas-consumidor/{id}/produtos`

---

## Impostos da NFC-e

Tipos disponiveis:
- **COFINS**
- **Combustivel**
- **ICMS**
- **ISSQN**
- **PIS**
- **IBSCBS** (Reforma Tributaria)
- **Imposto Monofasico**
- **Imposto Seletivo**

---

## Status da NFC-e

### Cadastrar Status
`POST /notas-consumidor/{id}/status`

### Consultar Status
`GET /notas-consumidor/{id}/status`

---

## Parcelas da NFC-e

### Cadastrar Parcelas
`POST /notas-consumidor/{id}/parcelas`

### Consultar Parcelas
`GET /notas-consumidor/{id}/parcelas`
