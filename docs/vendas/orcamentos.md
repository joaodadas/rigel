# Orcamentos

Base path: `/orcamentos`

---

## Orcamento (CRUD)

### Cadastrar Orcamento
`POST /orcamentos`

### Atualizar Orcamento
`PUT /orcamentos/{id}`

### Excluir Orcamento
`DELETE /orcamentos/{id}`

### Consultar Orcamento
`GET /orcamentos/{id}`

### Listar Orcamentos
`GET /orcamentos`

---

## Produtos do Orcamento

### Cadastrar Produto
`POST /orcamentos/{id}/produtos`

### Alterar Produto
`PUT /orcamentos/{id}/produtos/{id_produto}`

### Excluir Produto
`DELETE /orcamentos/{id}/produtos/{id_produto}`

### Listar Produtos
`GET /orcamentos/{id}/produtos`

---

## Status do Orcamento

### Cadastrar Status
`POST /orcamentos/{id}/status`

### Listar Status
`GET /orcamentos/{id}/status`

---

## Parcelas do Orcamento

### Cadastrar Parcelas
`POST /orcamentos/{id}/parcelas`

### Listar Parcelas
`GET /orcamentos/{id}/parcelas`
