# Clientes

Base path: `/clientes`

---

## Cadastrar Cliente

`POST /clientes`

### Body Parameters (application/json)

| Campo | Tipo | Obrigatorio | Descricao | Limite |
|-------|------|-------------|-----------|--------|
| `razao_cliente` | string | Sim | Razao social | <= 255 chars |
| `tipo_pessoa` | enum | Nao | `PJ` ou `PF` (padrao: `PJ`) | - |
| `tipo_cadastro` | enum | Nao | `Cliente`, `Fornecedor` ou `Ambos` (padrao: `Cliente`) | - |
| `cnpj_cliente` | string | Nao | CNPJ / CPF | <= 18 chars |
| `fantasia_cliente` | string | Nao | Nome Fantasia | <= 255 chars |
| `endereco_cliente` | string | Nao | Endereco | <= 255 chars |
| `numero_cliente` | string | Nao | Numero | <= 7 chars |
| `bairro_cliente` | string | Nao | Bairro | <= 45 chars |
| `complemento_cliente` | string | Nao | Complemento | <= 45 chars |
| `cep_cliente` | string | Nao | CEP | <= 10 chars |
| `cidade_cliente` | string | Nao | Cidade | <= 255 chars |
| `uf_cliente` | string | Nao | Estado (UF) | <= 2 chars |
| `contato_cliente` | string | Nao | Nome do contato | <= 255 chars |
| `fone_cliente` | string | Nao | Telefone | <= 20 chars |
| `celular_cliente` | string | Nao | Celular | <= 20 chars |
| `email_cliente` | string | Nao | Email | <= 255 chars |
| `insc_estadual_cliente` | string | Nao | Inscricao Estadual | <= 45 chars |
| `insc_municipal_cliente` | string | Nao | Inscricao Municipal | <= 45 chars |
| `insc_produtor_cliente` | string | Nao | Inscricao de produtor rural | <= 20 chars |
| `insc_suframa_cliente` | string | Nao | Inscricao SUFRAMA | <= 20 chars |
| `situacao_cliente` | enum | Nao | `Ativo` ou `Inativo` (padrao: `Ativo`) | - |
| `vendedor_cliente` | string | Nao | Nome do vendedor vinculado | <= 255 chars |
| `vendedor_cliente_id` | integer | Nao | ID do vendedor vinculado | - |
| `data_nasc_cliente` | date | Nao | Data de nascimento (YYYY-MM-DD) | - |
| `observacoes_cliente` | string | Nao | Observacoes | - |

### Exemplo cURL

```bash
curl --location --request POST '/clientes' \
--header 'access-token: {{ACCESS_TOKEN}}' \
--header 'secret-access-token: {{SECRET_ACCESS_TOKEN}}' \
--header 'Content-Type: application/json' \
--header 'User-Agent: Rigel/1.0' \
--data-raw '{
    "razao_cliente": "Razao Social",
    "tipo_pessoa": "PJ",
    "tipo_cadastro": "Cliente",
    "cnpj_cliente": "00.000.000/0000-00",
    "fantasia_cliente": "Nome Fantasia",
    "endereco_cliente": "Endereco do cliente",
    "numero_cliente": "0000",
    "bairro_cliente": "Bairro do cliente",
    "complemento_cliente": "Casa",
    "cep_cliente": "00.000-000",
    "cidade_cliente": "Cidade do cliente",
    "uf_cliente": "PR",
    "contato_cliente": "Nome do contato",
    "fone_cliente": "(00) 00000-0000",
    "celular_cliente": "(00) 00000-0000",
    "email_cliente": "email@contato.com.br",
    "insc_estadual_cliente": "0123456789",
    "insc_municipal_cliente": "0123456789",
    "insc_produtor_cliente": "0123456789",
    "insc_suframa_cliente": "0123456789",
    "situacao_cliente": "Ativo",
    "vendedor_cliente": "Nome do vendedor",
    "vendedor_cliente_id": "123",
    "data_nasc_cliente": "1992-12-12",
    "observacoes_cliente": "Observacoes do cadastro"
}'
```

### Resposta (200)

```json
{
    "code": 200,
    "status": "success",
    "data": {
        "razao_cliente": "Razao Social",
        "tipo_pessoa": "PJ",
        "tipo_cadastro": "Cliente",
        "cnpj_cliente": "00.000.000/0000-01",
        "fantasia_cliente": "Nome Fantasia",
        "endereco_cliente": "Endereco do cliente",
        "numero_cliente": "0000",
        "bairro_cliente": "Bairro do cliente",
        "complemento_cliente": "Casa",
        "cep_cliente": "00.000-000",
        "cidade_cliente": "Cidade do cliente",
        "uf_cliente": "PR",
        "contato_cliente": "Nome do contato",
        "fone_cliente": "(00) 00000-0000",
        "celular_cliente": "(00) 00000-0000",
        "email_cliente": "email@contato.com.br",
        "insc_estadual_cliente": "0123456789",
        "insc_municipal_cliente": "0123456789",
        "insc_produtor_cliente": "0123456789",
        "insc_suframa_cliente": "0123456789",
        "situacao_cliente": "Ativo",
        "vendedor_cliente": null,
        "vendedor_cliente_id": 0,
        "data_nasc_cliente": "1992-12-12",
        "observacoes_cliente": "Observacoes do cadastro",
        "id_registro": false,
        "data_cad_cliente": "2025-05-12 15:41:15",
        "id_empresa": 850486,
        "cidade_cliente_cod": "0",
        "lixeira": "Nao",
        "id_categoria": 0,
        "id_cliente": 1000021056,
        "categoria": []
    }
}
```

### Campos da Resposta

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `id_cliente` | integer | ID unico do cliente |
| `id_empresa` | integer | ID da empresa |
| `id_categoria` | integer | ID da categoria |
| `id_registro` | boolean | ID registro |
| `data_cad_cliente` | string | Data de cadastro |
| `cidade_cliente_cod` | string | Codigo da cidade |
| `lixeira` | string | Situacao no sistema (`Nao` / `Sim`) |
| `categoria` | array | Categorias vinculadas |

---

## Atualizar Cliente

`PUT /clientes/{id_cliente}`

Mesmos parametros do cadastro. Envie apenas os campos que deseja atualizar.

---

## Excluir Cliente

`DELETE /clientes/{id_cliente}`

Move o cliente para a lixeira. Para encontrar excluidos use `lixeira=Sim` no GET.

---

## Consultar Cliente

`GET /clientes/{id_cliente}`

Retorna os dados completos de um cliente pelo ID, incluindo `categoria[]` e `veiculos[]`.

---

## Listar Clientes

`GET /clientes`

### Query Parameters

| Param | Tipo | Descricao |
|-------|------|-----------|
| `order` | string | Campo para ordenacao (ex: `data_mod_cliente`) |
| `sort` | enum | `Asc` ou `Desc` (padrao: `Asc`) |
| `limit` | integer | Limite de registros (max 250) |
| `offset` | integer | Registro inicial |
| `tipo_pessoa` | enum | `PJ` ou `PF` |
| `cnpj_cliente` | string | CNPJ/CPF |
| `razao_cliente` | string | Razao social |
| `fantasia_cliente` | string | Nome Fantasia |
| `lixeira` | enum | `Sim` ou `Nao` |
| `data_modificacao` | datetime | Registros modificados apos data |
| `data_cadastro` | date | Registros criados apos data |

---

## Categorias de Cliente

### Cadastrar Categoria

`POST /clientes/categorias`

### Atualizar Categoria

`PUT /clientes/categorias/{id}`

### Excluir Categoria

`DELETE /clientes/categorias/{id}`

### Consultar Categoria

`GET /clientes/categorias/{id}`

### Listar Categorias

`GET /clientes/categorias`
