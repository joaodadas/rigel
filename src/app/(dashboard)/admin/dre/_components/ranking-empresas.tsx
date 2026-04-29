import { cn } from "@/lib/utils";
import { fmt } from "@/lib/dre/format";
import { EMPRESAS_OPERACIONAIS, EMPRESA_BY_CODE, type EmpresaCode } from "@/lib/dre/empresas";
import type { DreSnapshot } from "@/lib/dre/computacoes";
import styles from "../theme.module.css";

interface Props {
  porEmpresa: Record<EmpresaCode, DreSnapshot>;
  semInvest: boolean;
}

export function RankingEmpresas({ porEmpresa, semInvest }: Props) {
  const data = EMPRESAS_OPERACIONAIS.map((c) => {
    const s = porEmpresa[c];
    const lucro = semInvest ? s.lucroSemInv : s.lucroComInv;
    const margem = s.fat ? (lucro / s.fat) * 100 : null;
    return { code: c, name: EMPRESA_BY_CODE[c].label.replace("Rigel ", ""), lucro, margem };
  });
  const maxAbs = Math.max(...data.map((x) => Math.abs(x.lucro)), 1);

  return (
    <div className={styles.companyCompare}>
      {data.map((x) => {
        const fillW = (Math.abs(x.lucro) / maxAbs) * 100;
        const isNeg = x.lucro < 0;
        return (
          <div key={x.code} className={styles.companyRow}>
            <div className={styles.companyName}>{x.name}</div>
            <div className={styles.companyBarWrap}>
              <div
                className={cn(styles.companyBarFill, isNeg && styles.barNeg)}
                style={{ width: `${fillW}%` }}
              />
            </div>
            <div className={cn(styles.companyValue, isNeg && styles.barNeg)}>{fmt(x.lucro)}</div>
            <div
              className={cn(
                styles.companyMargin,
                x.margem !== null && x.margem < 0 && styles.barNeg,
              )}
            >
              {x.margem !== null ? `${x.margem.toFixed(1).replace(".", ",")}%` : "N/A"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
