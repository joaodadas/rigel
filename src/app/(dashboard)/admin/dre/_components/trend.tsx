import { cn } from "@/lib/utils";
import { pctNum } from "@/lib/dre/format";
import { MES_ABREV } from "@/lib/dre/meses";
import type { DreSnapshot } from "@/lib/dre/computacoes";
import styles from "../theme.module.css";

interface Props {
  // Snapshot por mês (1..12) já agregado pra empresa atual.
  // Mês sem dados → null.
  porMes: Record<number, DreSnapshot | null>;
  semInvest: boolean;
  snapAtual: DreSnapshot;
}

export function Trend({ porMes, semInvest, snapAtual }: Props) {
  const meses = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  const fats = meses.map((m) => porMes[m]?.fat ?? 0);
  const maxFat = Math.max(...fats, 1);

  const lucros = meses.map((m) => {
    const s = porMes[m];
    if (!s) return 0;
    return semInvest ? s.lucroSemInv : s.lucroComInv;
  });
  const maxLucro = Math.max(...lucros.map(Math.abs), 1);

  const lucroAtual = semInvest ? snapAtual.lucroSemInv : snapAtual.lucroComInv;
  const margemOp = snapAtual.fat && snapAtual.resOp !== null
    ? `${(snapAtual.resOp / snapAtual.fat * 100).toFixed(1).replace(".", ",")}%`
    : "—";
  const margemCtb = `${pctNum(snapAtual.margemCtb, snapAtual.fat).toFixed(1).replace(".", ",")}%`;
  const margemLiq = `${pctNum(lucroAtual, snapAtual.fat).toFixed(1).replace(".", ",")}%`;

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <div
            style={{
              fontSize: 10,
              color: "var(--text-muted)",
              marginBottom: 8,
              letterSpacing: 1,
              fontFamily: "var(--font-mono), JetBrains Mono",
            }}
          >
            FATURAMENTO (R$ M)
          </div>
          <div className={styles.barChart}>
            {meses.map((m, i) => {
              const v = fats[i];
              const isReal = v > 0;
              const hPct = isReal ? (v / maxFat) * 100 : 3;
              return (
                <div key={m} className={styles.barCol}>
                  <div className={styles.barColInner}>
                    <div
                      className={cn(styles.barShape, !isReal && styles.barMuted)}
                      style={{ height: `${hPct}%` }}
                    >
                      {isReal && (
                        <span className={styles.barValue}>{(v / 1e6).toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                  <span className={cn(styles.barLabel, !isReal && styles.barMuted)}>
                    {MES_ABREV[m]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <div
            style={{
              fontSize: 10,
              color: "var(--text-muted)",
              marginBottom: 8,
              letterSpacing: 1,
              fontFamily: "var(--font-mono), JetBrains Mono",
            }}
          >
            LUCRO LÍQUIDO (R$ M)
          </div>
          <div className={styles.barChart}>
            {meses.map((m, i) => {
              const v = lucros[i];
              const isReal = porMes[m] !== null && porMes[m] !== undefined;
              const hPct = isReal ? (Math.abs(v) / maxLucro) * 100 : 3;
              const isNeg = v < 0;
              return (
                <div key={m} className={styles.barCol}>
                  <div className={styles.barColInner}>
                    <div
                      className={cn(
                        styles.barShape,
                        !isReal && styles.barMuted,
                        isReal && isNeg && styles.barNeg,
                      )}
                      style={{ height: `${hPct}%` }}
                    >
                      {isReal && (
                        <span className={cn(styles.barValue, isNeg && styles.barNeg)}>
                          {(v / 1e6).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={cn(styles.barLabel, !isReal && styles.barMuted)}>
                    {MES_ABREV[m]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className={styles.marginsRow}>
        <div>
          <div className={styles.label}>MARGEM OPERACIONAL</div>
          <div
            className={styles.value}
            style={{
              color: snapAtual.resOp !== null && snapAtual.resOp < 0 ? "var(--neg)" : "var(--highlight)",
            }}
          >
            {margemOp}
          </div>
        </div>
        <div>
          <div className={styles.label}>MARGEM CONTRIB.</div>
          <div
            className={styles.value}
            style={{
              color: snapAtual.margemCtb < 0 ? "var(--neg)" : "var(--gold)",
            }}
          >
            {margemCtb}
          </div>
        </div>
        <div>
          <div className={styles.label}>MARGEM LÍQUIDA</div>
          <div
            className={styles.value}
            style={{ color: lucroAtual < 0 ? "var(--neg)" : "var(--highlight)" }}
          >
            {margemLiq}
          </div>
        </div>
      </div>
    </>
  );
}
