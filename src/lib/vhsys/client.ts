// src/lib/vhsys/client.ts
import { VHSYS_BASE_URL, MAX_PAGE_SIZE } from "./endpoints";
import type { VHSysResponse } from "./types";
import { getEmpresa, type EmpresaSlug } from "@/lib/empresas";

function getHeaders(empresa: EmpresaSlug): HeadersInit {
  const prefix = getEmpresa(empresa).envPrefix;
  const access = process.env[`${prefix}_ACCESS_TOKEN`];
  const secret = process.env[`${prefix}_SECRET_ACCESS_TOKEN`];
  if (!access || !secret) {
    throw new Error(
      `VHSys: tokens da empresa "${empresa}" não configurados ` +
      `(esperado ${prefix}_ACCESS_TOKEN e ${prefix}_SECRET_ACCESS_TOKEN).`,
    );
  }
  return {
    "access-token": access,
    "secret-access-token": secret,
    "Content-Type": "application/json",
    "User-Agent": "Rigel/1.0",
    "Cache-Control": "no-cache",
  };
}

/** A VHSys retorna HTTP 200 mesmo para erros — auth inválida, por exemplo, vem
 *  como 200 com {"code":401,"status":"error","data":"..."}. Sem esta checagem o
 *  corpo de erro passaria adiante como resposta válida (e `data`, que vira
 *  string, seria espalhada caractere a caractere pelo vhsysFetchAll). */
function assertBodyOk<T>(
  empresa: EmpresaSlug,
  method: string,
  endpoint: string,
  body: VHSysResponse<T>,
): VHSysResponse<T> {
  if (body.status === "error") {
    const detail = typeof body.data === "string" ? body.data : JSON.stringify(body.data).slice(0, 200);
    throw new Error(`VHSys [${empresa}] ${method} ${endpoint} failed: code ${body.code} — ${detail}`);
  }
  return body;
}

function buildUrl(endpoint: string, params?: Record<string, string>): string {
  const url = new URL(`${VHSYS_BASE_URL}${endpoint}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

export async function vhsysGet<T>(
  empresa: EmpresaSlug,
  endpoint: string,
  params?: Record<string, string>,
): Promise<VHSysResponse<T>> {
  const res = await fetch(buildUrl(endpoint, params), {
    method: "GET",
    headers: getHeaders(empresa),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // A VHSys usa HTTP 403 com {"status":"error","data":"Nenhum X encontrado!"}
    // quando a consulta não encontra registros — é lista vazia, não erro de
    // permissão (auth inválida volta como HTTP 200 com code 401 no corpo).
    if (res.status === 403 && /nenhum[a]?\s.*encontrad[oa]/i.test(body)) {
      return { code: 200, status: "success", data: [], paging: { total: 0, page: 1, limit: 0, offset: 0 } };
    }
    throw new Error(
      `VHSys [${empresa}] GET ${endpoint} failed: ${res.status} ${res.statusText}` +
      (body ? ` — ${body.slice(0, 200)}` : ""),
    );
  }
  return assertBodyOk(empresa, "GET", endpoint, (await res.json()) as VHSysResponse<T>);
}

export async function vhsysPost<T>(
  empresa: EmpresaSlug,
  endpoint: string,
  body: Record<string, unknown>,
): Promise<VHSysResponse<T>> {
  const res = await fetch(buildUrl(endpoint), {
    method: "POST",
    headers: getHeaders(empresa),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`VHSys [${empresa}] POST ${endpoint} failed: ${res.status} ${res.statusText}`);
  }
  return assertBodyOk(empresa, "POST", endpoint, (await res.json()) as VHSysResponse<T>);
}

export async function vhsysPut<T>(
  empresa: EmpresaSlug,
  endpoint: string,
  body: Record<string, unknown>,
): Promise<VHSysResponse<T>> {
  const res = await fetch(buildUrl(endpoint), {
    method: "PUT",
    headers: getHeaders(empresa),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`VHSys [${empresa}] PUT ${endpoint} failed: ${res.status} ${res.statusText}`);
  }
  return assertBodyOk(empresa, "PUT", endpoint, (await res.json()) as VHSysResponse<T>);
}

export async function vhsysDelete<T>(
  empresa: EmpresaSlug,
  endpoint: string,
): Promise<VHSysResponse<T>> {
  const res = await fetch(buildUrl(endpoint), {
    method: "DELETE",
    headers: getHeaders(empresa),
  });
  if (!res.ok) {
    throw new Error(`VHSys [${empresa}] DELETE ${endpoint} failed: ${res.status} ${res.statusText}`);
  }
  return assertBodyOk(empresa, "DELETE", endpoint, (await res.json()) as VHSysResponse<T>);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function vhsysFetchAll<T>(
  empresa: EmpresaSlug,
  endpoint: string,
  extraParams?: Record<string, string>,
): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const params: Record<string, string> = {
      ...extraParams,
      limit: String(MAX_PAGE_SIZE),
      offset: String(offset),
    };

    const response = await vhsysGet<T>(empresa, endpoint, params);
    const items = response.data ?? [];
    all.push(...items);

    if (items.length < MAX_PAGE_SIZE) {
      hasMore = false;
    } else {
      offset += MAX_PAGE_SIZE;
      await delay(200);
    }
  }

  return all;
}
