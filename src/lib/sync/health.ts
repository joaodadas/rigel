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

const SYNC_LOG_COLS = "entity, empresa, status, error_message, last_sync_at";

/** Lê o sync_log e avalia staleness. Busca por alvo a última linha e o último
 *  sucesso (cada `.limit(1)`, via índice (entity, empresa, last_sync_at)). Isso
 *  evita o teto default de linhas do PostgREST — uma única query de janela seria
 *  truncada (o sync_log acumula milhares de linhas) e perderia sucessos antigos,
 *  reportando falsamente "nunca sincronizou". */
export async function checkStaleness(supabase: SupabaseClient, now: Date = new Date()): Promise<StaleEntity[]> {
  const targets = syncTargets();
  const rows: SyncLogRow[] = [];

  for (const t of targets) {
    const { data: latest } = await supabase
      .from("sync_log")
      .select(SYNC_LOG_COLS)
      .eq("entity", t.entity)
      .eq("empresa", t.empresa)
      .order("last_sync_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest) rows.push(latest as SyncLogRow);

    // Se a última linha já é um sucesso, ela basta; senão busca o último sucesso.
    if (!latest || (latest as SyncLogRow).status !== "success") {
      const { data: success } = await supabase
        .from("sync_log")
        .select(SYNC_LOG_COLS)
        .eq("entity", t.entity)
        .eq("empresa", t.empresa)
        .eq("status", "success")
        .order("last_sync_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (success) rows.push(success as SyncLogRow);
    }
  }

  return evaluateStaleness(targets, rows, now);
}

/** Decide se a contagem do Supabase divergiu da VHSys na direção perigosa
 *  (temos MENOS que a origem, acima da tolerância). Puro. Retorna null quando
 *  não há divergência relevante. */
export function evaluateDivergence(
  vhsysTotal: number,
  supabaseCount: number,
): { vhsysTotal: number; supabaseCount: number; deltaPct: number } | null {
  if (vhsysTotal < DIVERGENCE_MIN_TOTAL) return null;
  if (supabaseCount >= vhsysTotal * (1 - DIVERGENCE_TOLERANCE)) return null;
  return { vhsysTotal, supabaseCount, deltaPct: (supabaseCount - vhsysTotal) / vhsysTotal };
}

/** Para cada entidade de listagem, compara paging.total da VHSys (1 request)
 *  com a contagem no Supabase. Falha de VHSys numa entidade = não verificável
 *  (pulada, não conta como divergência). */
export async function checkDivergence(supabase: SupabaseClient): Promise<DivergedEntity[]> {
  const out: DivergedEntity[] = [];
  for (const t of syncTargets()) {
    if (!t.endpoint) continue;
    try {
      const resp = await vhsysGet(t.empresa, t.endpoint, { limit: "1" });
      const vhsysTotal = resp.paging?.total ?? 0;

      let q = supabase.from(t.entity).select("*", { count: "exact", head: true });
      if (TABLES_WITH_EMPRESA_PK.has(t.entity)) q = q.eq("empresa", t.empresa);
      const { count } = await q;
      const supabaseCount = count ?? 0;

      const verdict = evaluateDivergence(vhsysTotal, supabaseCount);
      if (verdict) out.push({ empresa: t.empresa, entity: t.entity, ...verdict });
    } catch (e) {
      console.warn(`[sync-health] divergência não verificável para ${t.empresa}/${t.entity}:`, e);
    }
  }
  return out;
}

function formatStaleFor(ms: number): string {
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `há ${h}h${String(m).padStart(2, "0")}` : `há ${m}min`;
}

/** Monta o resumo consolidado (PT) ou null quando não há nada a reportar. */
export function formatHealthReport(
  stale: StaleEntity[],
  diverged: DivergedEntity[],
  monitorErrors: string[],
  now: Date,
): string | null {
  if (stale.length === 0 && diverged.length === 0 && monitorErrors.length === 0) return null;

  const lines: string[] = ["🔴 Rigel — Saúde do sync", ""];

  if (stale.length) {
    lines.push("Travadas:");
    for (const e of stale) {
      const when = Number.isFinite(e.staleForMs)
        ? `sem sucesso ${formatStaleFor(e.staleForMs)}`
        : "sem sucesso registrado";
      lines.push(`• [${e.empresa}] ${e.entity} — ${when}`);
      if (e.lastError) lines.push(`  último erro: ${e.lastError}`);
    }
    lines.push("");
  }

  if (diverged.length) {
    lines.push("Suspeita de divergência (diário):");
    for (const d of diverged) {
      const pct = (d.deltaPct * 100).toLocaleString("pt-BR", {
        maximumFractionDigits: 1,
        signDisplay: "always",
      });
      lines.push(
        `• ${d.entity} — Supabase ${d.supabaseCount.toLocaleString("pt-BR")} vs VHSys ${d.vhsysTotal.toLocaleString("pt-BR")} (${pct}%)`,
      );
    }
    lines.push("");
  }

  if (monitorErrors.length) {
    lines.push("Falhas no monitor:");
    for (const m of monitorErrors) lines.push(`• ${m}`);
    lines.push("");
  }

  const hh = String(now.getUTCHours()).padStart(2, "0");
  lines.push(`Verificado às ${hh}:00 UTC`);
  return lines.join("\n");
}
