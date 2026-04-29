import { cn } from "@/lib/utils";
import { fmt, pct, pctNum } from "@/lib/dre/format";
import type { DreSnapshot } from "@/lib/dre/computacoes";
import styles from "../theme.module.css";

interface Props {
  snap: DreSnapshot;
  prev?: DreSnapshot | null;        // mês anterior (para deltas)
  semInvest: boolean;
  modo: "mes" | "acumulado";
}

function deltaCard(curr: number, prev: number | null | undefined, label: string) {
  if (prev === null || prev === undefined || prev === 0) {
    return <div className={cn(styles.kpiDelta, styles.flat)}>◆ {label}</div>;
  }
  const v = ((curr - prev) / Math.abs(prev)) * 100;
  const up = v >= 0;
  return (
    <div className={cn(styles.kpiDelta, up ? styles.up : styles.down)}>
      {up ? "▲" : "▼"} {Math.abs(v).toFixed(1).replace(".", ",")}% vs anterior
    </div>
  );
}

export function KpiGrid({ snap, prev, semInvest, modo }: Props) {
  const lucro = semInvest ? snap.lucroSemInv : snap.lucroComInv;
  const lucroPrev = prev ? (semInvest ? prev.lucroSemInv : prev.lucroComInv) : null;

  const cargaTrib = pctNum(snap.imp, snap.fat);
  const margemLiqPct = pctNum(lucro, snap.fat);

  const margemCtbPctNum = pctNum(snap.margemCtb, snap.fat);
  const margemOpPctNum = snap.fat && snap.resOp !== null ? (snap.resOp / snap.fat) * 100 : null;

  const labelEstatico = modo === "acumulado" ? "Acumulado" : "mês de abertura";

  return (
    <div className={styles.kpiGrid}>
      {/* 1. Faturamento */}
      <div className={cn(styles.kpi, styles.primary)}>
        <div className={styles.kpiLabel}>Faturamento Bruto</div>
        <div className={styles.kpiValue}>{fmt(snap.fat)}</div>
        <div className={styles.kpiPct}>Mercado Interno</div>
        {modo === "mes"
          ? deltaCard(snap.fat, prev?.fat ?? null, labelEstatico)
          : <div className={cn(styles.kpiDelta, styles.flat)}>◆ {labelEstatico}</div>}
      </div>

      {/* 2. Receita Líquida */}
      <div className={styles.kpi}>
        <div className={styles.kpiLabel}>Receita Líquida</div>
        <div className={cn(styles.kpiValue, snap.rcLiq < 0 && styles.negative)}>
          {fmt(snap.rcLiq)}
        </div>
        <div className={styles.kpiPct}>{pct(snap.rcLiq, snap.fat)} / faturamento</div>
      </div>

      {/* 3. Margem de Contribuição */}
      <div className={styles.kpi}>
        <div className={styles.kpiLabel}>M. Contribuição</div>
        <div className={cn(styles.kpiValue, snap.margemCtb < 0 && styles.negative)}>
          {fmt(snap.margemCtb)}
        </div>
        <div className={styles.kpiPct}>{pct(snap.margemCtb, snap.fat)} / faturamento</div>
        <div
          className={cn(
            styles.kpiDelta,
            margemCtbPctNum >= 50 ? styles.up : margemCtbPctNum >= 30 ? styles.flat : styles.down,
          )}
        >
          {margemCtbPctNum >= 50 ? "▲ saudável" : margemCtbPctNum >= 30 ? "◆ atenção" : "▼ crítica"}
        </div>
      </div>

      {/* 4. Resultado Operacional */}
      <div className={styles.kpi}>
        <div className={styles.kpiLabel}>Result. Operacional</div>
        <div
          className={cn(
            styles.kpiValue,
            snap.resOp !== null && snap.resOp < 0 && styles.negative,
          )}
        >
          {snap.resOp !== null ? fmt(snap.resOp) : "—"}
        </div>
        <div className={styles.kpiPct}>
          {margemOpPctNum !== null ? `${margemOpPctNum.toFixed(1).replace(".", ",")}% / fat.` : "—"}
        </div>
        {margemOpPctNum !== null && (
          <div
            className={cn(
              styles.kpiDelta,
              margemOpPctNum >= 10 ? styles.up : margemOpPctNum >= 0 ? styles.flat : styles.down,
            )}
          >
            {margemOpPctNum >= 10 ? "▲ saudável" : margemOpPctNum >= 0 ? "◆ atenção" : "▼ negativa"}
          </div>
        )}
      </div>

      {/* 5. Lucro Líquido */}
      <div className={cn(styles.kpi, lucro < 0 ? styles.kpiNeg : styles.primary)}>
        <div className={styles.kpiLabel}>Lucro Líquido</div>
        <div className={cn(styles.kpiValue, lucro < 0 && styles.negative)}>{fmt(lucro)}</div>
        <div className={styles.kpiPct}>
          {`${margemLiqPct.toFixed(1).replace(".", ",")}% / fat. · ${semInvest ? "s/" : "c/"} invest.`}
        </div>
        {modo === "mes"
          ? deltaCard(lucro, lucroPrev, labelEstatico)
          : <div className={cn(styles.kpiDelta, styles.flat)}>◆ {labelEstatico}</div>}
      </div>

      {/* 6. Carga Tributária */}
      <div className={styles.kpi}>
        <div className={styles.kpiLabel}>Carga Tributária</div>
        <div className={cn(styles.kpiValue, styles.small)}>
          {cargaTrib.toFixed(2).replace(".", ",")}%
        </div>
        <div className={styles.kpiPct}>{fmt(snap.imp)}</div>
        <div
          className={cn(
            styles.kpiDelta,
            cargaTrib <= 4 ? styles.up : cargaTrib <= 6 ? styles.flat : styles.down,
          )}
        >
          {cargaTrib <= 4 ? "▲ ótima" : cargaTrib <= 6 ? "◆ normal" : "▼ elevada"}
        </div>
      </div>
    </div>
  );
}
