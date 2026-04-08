import { VHSYS_BASE_URL, MAX_PAGE_SIZE } from "./endpoints";
import type { VHSysResponse } from "./types";

function getHeaders(): HeadersInit {
  return {
    "access-token": process.env.VHSYS_ACCESS_TOKEN!,
    "secret-access-token": process.env.VHSYS_SECRET_ACCESS_TOKEN!,
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
  endpoint: string,
  params?: Record<string, string>
): Promise<VHSysResponse<T>> {
  const res = await fetch(buildUrl(endpoint, params), {
    method: "GET",
    headers: getHeaders(),
  });

  if (!res.ok) {
    throw new Error(`VHSys GET ${endpoint} failed: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<VHSysResponse<T>>;
}

export async function vhsysPost<T>(
  endpoint: string,
  body: Record<string, unknown>
): Promise<VHSysResponse<T>> {
  const res = await fetch(buildUrl(endpoint), {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`VHSys POST ${endpoint} failed: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<VHSysResponse<T>>;
}

export async function vhsysPut<T>(
  endpoint: string,
  body: Record<string, unknown>
): Promise<VHSysResponse<T>> {
  const res = await fetch(buildUrl(endpoint), {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`VHSys PUT ${endpoint} failed: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<VHSysResponse<T>>;
}

export async function vhsysDelete<T>(
  endpoint: string
): Promise<VHSysResponse<T>> {
  const res = await fetch(buildUrl(endpoint), {
    method: "DELETE",
    headers: getHeaders(),
  });

  if (!res.ok) {
    throw new Error(`VHSys DELETE ${endpoint} failed: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<VHSysResponse<T>>;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function vhsysFetchAll<T>(
  endpoint: string,
  extraParams?: Record<string, string>
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

    const response = await vhsysGet<T>(endpoint, params);
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
