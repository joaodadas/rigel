import { createAccessControl } from "better-auth/plugins/access";
import {
  defaultStatements,
  adminAc,
} from "better-auth/plugins/admin/access";

const statement = {
  ...defaultStatements,
  clientes: ["read", "create", "update", "delete"],
  pedidos: ["read", "create", "update", "delete"],
  orcamentos: ["read", "create", "update", "delete"],
  nfe: ["read", "create", "update", "emit"],
  produtos: ["read", "create", "update", "delete"],
  financeiro: ["read", "create", "update", "delete", "liquidar"],
  vendedores: ["read", "create", "update", "delete"],
  usuarios: ["read", "create", "update", "delete"],
} as const;

export const ac = createAccessControl(statement);

export const adminRole = ac.newRole({
  clientes: ["read", "create", "update", "delete"],
  pedidos: ["read", "create", "update", "delete"],
  orcamentos: ["read", "create", "update", "delete"],
  nfe: ["read", "create", "update", "emit"],
  produtos: ["read", "create", "update", "delete"],
  financeiro: ["read", "create", "update", "delete", "liquidar"],
  vendedores: ["read", "create", "update", "delete"],
  usuarios: ["read", "create", "update", "delete"],
  ...adminAc.statements,
});

export const comercialRole = ac.newRole({
  clientes: ["read", "create", "update"],
  pedidos: ["read", "create", "update", "delete"],
  orcamentos: ["read", "create", "update", "delete"],
  nfe: ["read", "create", "update", "emit"],
  produtos: ["read"],
});

export const financeiroRole = ac.newRole({
  financeiro: ["read", "create", "update", "delete", "liquidar"],
  clientes: ["read"],
});

export const rhRole = ac.newRole({
  vendedores: ["read", "create", "update", "delete"],
});
