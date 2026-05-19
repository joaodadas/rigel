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
    throw new Error(`VHSys [${empresa}] GET ${endpoint} failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<VHSysResponse<T>>;
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
  return res.json() as Promise<VHSysResponse<T>>;
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
  return res.json() as Promise<VHSysResponse<T>>;
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
  return res.json() as Promise<VHSysResponse<T>>;
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
