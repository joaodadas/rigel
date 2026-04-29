import { cn } from "@/lib/utils";
import { MES_NOME } from "@/lib/dre/meses";
import type { UploadDoMes } from "@/lib/queries/dre";
import styles from "../theme.module.css";

interface Props {
  ano: number;
  porMes: Record<number, UploadDoMes>;
}

function formatBR(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

export function UploadsGrid({ ano, porMes }: Props) {
  const meses = Array.from({ length: 12 }, (_, i) => i + 1);
  return (
    <div className={styles.historyList}>
      {meses.map((m) => {
        const u = porMes[m];
        const uploaded = u && u.status === "sucesso";
        return (
          <div
            key={m}
            className={cn(
              styles.historyItem,
              uploaded ? styles.uploaded : styles.pending,
            )}
          >
            <div className={styles.historyMonth}>
              {MES_NOME[m]} {String(ano).slice(-2)}
            </div>
            <div className={styles.historyDate}>
              {uploaded ? formatBR(u.uploadedAt) : "pendente"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
