# Entrada de Mercadoria

Base path: `/entradas`

---

## Entrada (CRUD)

### Cadastrar Entrada
`POST /entradas`

### Atualizar Entrada
`PUT /entradas/{id}`

### Excluir Entrada
`DELETE /entradas/{id}`

### Consultar Entrada
`GET /entradas/{id}`

### Listar Entradas
`GET /entradas`

---

## Produtos da Entrada

### Cadastrar Produto
`POST /entradas/{id}/produtos`

### Atualizar Produto
`PUT /entradas/{id}/produtos/{id_produto}`

### Excluir Produto
`DELETE /entradas/{id}/produtos/{id_produto}`

### Listar Produtos
`GET /entradas/{id}/produtos`

---

## Parcelas da Entrada

### Cadastrar Parcelas
`POST /entradas/{id}/parcelas`

### Listar Parcelas
`GET /entradas/{id}/parcelas`

---

## Status da Entrada

### Cadastrar Status
`POST /entradas/{id}/status`

### Listar Status
`GET /entradas/{id}/status`
