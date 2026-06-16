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

/** Erro transitório da VHSys (glitch de servidor): a API responde
 *  intermitentemente com "Erro ao comunicar com a API" ou 5xx/429 em uma página
 *  no meio da paginação. Leituras são idempotentes, então vhsysGet retenta. */
class VHSysTransientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VHSysTransientError";
  }
}

/** Decide se uma resposta de erro da VHSys é transitória (vale retentar). O erro
 *  genérico "Erro ao comunicar com a API" e códigos 5xx/429 são glitches do
 *  servidor; 401 (auth) e demais são permanentes. */
function isTransientDetail(code: number, detail: string): boolean {
  return /erro ao comunicar com a api/i.test(detail) || code >= 500 || code === 429;
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
    const message = `VHSys [${empresa}] ${method} ${endpoint} failed: code ${body.code} — ${detail}`;
    if (isTransientDetail(body.code, detail)) throw new VHSysTransientError(message);
    throw new Error(message);
  }
  return body;
}

/** Retenta `fn` quando ela lança VHSysTransientError, com backoff. Usado só em
 *  leituras (GET), que são idempotentes — POST/PUT/DELETE não são retentados.
 *
 *  10 tentativas: em produção (Vercel) o gateway da VHSys no /pedidos devolve o
 *  erro intermitente "Erro ao comunicar com a API" que persiste >14s — retry-6
 *  (janela ~14s) esgotava e abortava. 10 tentativas dão uma janela de ~27s para
 *  o erro passar. Cabe no orçamento de 300s (ver route.ts / SOFT_DEADLINE_MS). */
async function withRetry<T>(fn: () => Promise<T>, attempts = 10): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      if (!(error instanceof VHSysTransientError)) throw error;
      lastError = error;
      // Instrumentação: torna visível nos logs (Vercel) quantas retentativas cada
      // página precisa — o /pedidos da VHSys é lento e o gateway deles falha de
      // forma intermitente ("Erro ao comunicar com a API").
      console.warn(`[vhsys-retry] tentativa ${i + 1}/${attempts} falhou: ${error.message}`);
      if (i < attempts - 1) await delay(Math.min(500 * 2 ** i, 4000));
    }
  }
  throw lastError;
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

async function vhsysGetOnce<T>(
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
    const message =
      `VHSys [${empresa}] GET ${endpoint} failed: ${res.status} ${res.statusText}` +
      (body ? ` — ${body.slice(0, 200)}` : "");
    if (res.status >= 500 || res.status === 429) throw new VHSysTransientError(message);
    throw new Error(message);
  }
  return assertBodyOk(empresa, "GET", endpoint, (await res.json()) as VHSysResponse<T>);
}

export async function vhsysGet<T>(
  empresa: EmpresaSlug,
  endpoint: string,
  params?: Record<string, string>,
): Promise<VHSysResponse<T>> {
  return withRetry(() => vhsysGetOnce<T>(empresa, endpoint, params));
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
