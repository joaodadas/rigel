# VHSys API v2 - Overview

**Base URL:** `https://api.vhsys.com.br/v2`

**Documentacao original:** https://developers.vhsys.com.br/api/

## Autenticacao

Todas as requisicoes exigem os seguintes headers:

| Header | Tipo | Obrigatorio | Descricao |
|--------|------|-------------|-----------|
| `access-token` | string | Sim | Token de acesso da conta |
| `secret-access-token` | string | Sim | Token secreto da conta |
| `partner-token` | string | Nao | Token do parceiro (se aplicavel) |
| `Cache-Control` | string | Nao | Recomendado: `no-cache` |
| `Content-Type` | string | Nao | `application/json` |
| `User-Agent` | string | Sim | Identifica a aplicacao (ex: `MinhaAplicacao/1.0`) |

### Exemplo de Headers

```
access-token: {{ACCESS_TOKEN}}
secret-access-token: {{SECRET_ACCESS_TOKEN}}
Content-Type: application/json
User-Agent: Rigel/1.0
```

## Formato de Resposta

Todas as respostas seguem o padrao:

```json
{
  "code": 200,
  "status": "success",
  "data": { ... }
}
```

### Codigos de Resposta

| Codigo | Descricao |
|--------|-----------|
| 200 | Sucesso |
| 403 | Proibido (token invalido ou sem permissao) |

---

## Modulos da API

### Cadastros
- [Clientes](cadastros/clientes.md) - CRUD + Categorias de cliente
- [Vendedores](cadastros/vendedores.md) - CRUD vendedores
- [Produtos](cadastros/produtos.md) - CRUD + Estoque
- [Categorias](cadastros/categorias.md) - Categorias de produto
- [Subcategorias](cadastros/subcategorias.md) - Subcategorias de produto
- [Transportadoras](cadastros/transportadoras.md) - CRUD transportadoras

### Financeiro
- [Contas Bancarias](financeiro/contas-bancarias.md) - CRUD contas
- [Despesas (Contas a Pagar)](financeiro/despesas.md) - CRUD + Liquidar/Desliquidar
- [Receitas (Contas a Receber)](financeiro/receitas.md) - CRUD + Liquidar/Desliquidar
- [Extratos](financeiro/extratos.md) - Cadastrar, Excluir, Consultar, Listar
- [Categorias Financeiras](financeiro/categorias.md) - CRUD categorias
- [Centro de Custos](financeiro/centro-custos.md) - CRUD centros

### Vendas
- [Pedidos](vendas/pedidos.md) - CRUD + Produtos + Parcelas + Status
- [NFC-e (Notas de Consumidor)](vendas/nfce.md) - CRUD + Emitir + Inutilizar + Impostos
- [NF-e (Notas Fiscais)](vendas/nfe.md) - CRUD + Emitir + Inutilizar + Impostos + Carta de Correcao
- [Orcamentos](vendas/orcamentos.md) - CRUD + Produtos + Parcelas + Status
- [Vendas Balcao (PDV)](vendas/vendas-balcao.md) - CRUD + Produtos + Parcelas + Status

### Servicos
- [Notas Fiscais de Servico](servicos/nfs.md) - CRUD notas de servico
- [Ordens de Servico](servicos/ordens-servico.md) - CRUD + Produtos + Servicos + Parcelas + Status

### Compras
- [Ordens de Compra](compras/ordens-compra.md) - CRUD + Produtos + Status + Parcelas
- [Entrada de Mercadoria](compras/entrada-mercadoria.md) - CRUD + Produtos + Parcelas + Status

### Outros
- [Webhooks](webhooks.md) - Cadastrar, Atualizar, Listar, Excluir

---

## Paths Reais Confirmados

| Modulo | Path Base |
|--------|-----------|
| Clientes | `/clientes` |
| Vendedores | `/vendedores` |
| Produtos | `/produtos` |
| Transportadoras | `/transportadoras` |
| Contas Bancarias | `/contas-bancarias` |
| Despesas (Contas a Pagar) | `/contas-pagar` |
| Receitas (Contas a Receber) | `/contas-receber` |
| Extratos | `/extratos` |
| Categorias Financeiras | `/categorias-financeiras` |
| Centro de Custos | `/centros-custo` |
| Pedidos | `/pedidos` |
| NF-e | `/notas-fiscais` |
| NFC-e | `/notas-consumidor` |
| Orcamentos | `/orcamentos` |
| Vendas Balcao | `/vendas-balcao` |
| Notas de Servico | `/notas-servico` |
| Ordens de Servico | `/ordens-servico` |
| Ordens de Compra | `/ordens-compra` |
| Webhooks | `/webhooks` |

## Padroes Comuns

- **Paginacao:** Endpoints de listagem suportam `limit` (max 250), `offset`, `order`, `sort`. Resposta inclui objeto `paging` com `total_count`, `total`, `offset`, `limit`, `limit_max`
- **Soft Delete:** DELETE move itens para lixeira. Use `lixeira=Sim` no GET para encontrar excluidos
- **Status padrao:** `Em Aberto`, `Em Andamento`, `Atendido`, `Cancelado`
- **Liquidacao:** `Sim`/`Nao` para marcar contas como pagas/recebidas
- **Ambiente NF:** `1` = Producao, `2` = Homologacao
