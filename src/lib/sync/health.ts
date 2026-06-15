// src/lib/sync/health.ts
// Monitor de saúde do sync VHSys: detecta entidades travadas e divergência de
// contagem. A lógica de decisão é pura (testável sem DB); os wrappers checkX
// fazem as leituras. Ver docs/superpowers/specs/2026-06-15-sync-health-monitoring-design.md
import type { SupabaseClient } from "@supabase/supabase-js";
import { vhsysGet } from "@/lib/vhsys/client";
import { EMPRESAS, type EmpresaSlug } from "@/lib/empresas";
import { entitiesForEmpresa } from "@/lib/sync/incremental";
import { TABLES_WITH_EMPRESA_PK } from "@/lib/sync/multi-empresa";

// Intervalos esperados por source, em minutos (espelham o vercel.json).
const EXPECTED_INTERVAL_MIN: Record<SyncSource, number> = { incremental: 30, pedido_itens: 5 };
const STALE_FACTOR = 3;
const DIVERGENCE_TOLERANCE = 0.02;
const DIVERGENCE_MIN_TOTAL = 50;

export type SyncSource = "incremental" | "pedido_itens";

export interface SyncTarget {
  empresa: EmpresaSlug;
  entity: string;
  source: SyncSource;
  endpoint?: string; // endpoint de listagem VHSys; presente nas entidades incrementais
}

interface SyncLogRow {
  entity: string;
  empresa: string;
  status: string;
  error_message: string | null;
  last_sync_at: string;
}

export interface StaleEntity {
  empresa: string;
  entity: string;
  source: SyncSource;
  lastSuccessAt: string | null;
  staleForMs: number;
  lastError: string | null;
}

export interface DivergedEntity {
  empresa: string;
  entity: string;
  vhsysTotal: number;
  supabaseCount: number;
  deltaPct: number;
}

/** Lista (empresa, entidade) que de fato sincronizamos — derivada do mesmo
 *  entitiesForEmpresa do incremental para nunca divergir do que roda — mais
 *  o pedido_itens da Rigel Fabricante. */
export function syncTargets(): SyncTarget[] {
  const targets: SyncTarget[] = [];
  for (const e of EMPRESAS) {
    for (const ent of entitiesForEmpresa(e.slug)) {
      targets.push({ empresa: e.slug, entity: ent.name, source: "incremental", endpoint: ent.endpoint });
    }
  }
  targets.push({ empresa: "rigel_fabricante", entity: "pedido_itens", source: "pedido_itens" });
  return targets;
}

/** Decide quais alvos estão travados (sem sucesso há mais que 3× o intervalo
 *  esperado). Puro: recebe as linhas do sync_log já carregadas. */
export function evaluateStaleness(targets: SyncTarget[], rows: SyncLogRow[], now: Date): StaleEntity[] {
  const stale: StaleEntity[] = [];
  for (const t of targets) {
    const forTarget = rows
      .filter((r) => r.entity === t.entity && r.empresa === t.empresa)
      .sort((a, b) => b.last_sync_at.localeCompare(a.last_sync_at)); // desc; ISO ordena cronologicamente
    const lastSuccess = forTarget.find((r) => r.status === "success") ?? null;
    const latest = forTarget[0] ?? null;
    const thresholdMs = EXPECTED_INTERVAL_MIN[t.source] * STALE_FACTOR * 60_000;
    const staleForMs = lastSuccess
      ? now.getTime() - new Date(lastSuccess.last_sync_at).getTime()
      : Infinity;
    if (staleForMs > thresholdMs) {
      stale.push({
        empresa: t.empresa,
        entity: t.entity,
        source: t.source,
        lastSuccessAt: lastSuccess?.last_sync_at ?? null,
        staleForMs,
        lastError: latest && latest.status === "error" ? latest.error_message : null,
      });
    }
  }
  return stale;
}

/** Lê o sync_log (últimos 7 dias) e avalia staleness. */
export async function checkStaleness(supabase: SupabaseClient, now: Date = new Date()): Promise<StaleEntity[]> {
  const sinceISO = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("sync_log")
    .select("entity, empresa, status, error_message, last_sync_at")
    .gte("last_sync_at", sinceISO)
    .order("last_sync_at", { ascending: false });
  if (error) throw error;
  return evaluateStaleness(syncTargets(), (data ?? []) as SyncLogRow[], now);
}
