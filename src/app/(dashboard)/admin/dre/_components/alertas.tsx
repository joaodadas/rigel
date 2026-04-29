import { cn } from "@/lib/utils";
import type { Alerta } from "@/lib/dre/alertas";
import styles from "../theme.module.css";

const TIPO_CLASS: Record<Alerta["tipo"], string> = {
  pos: "alertPos",
  neg: "alertNeg",
  info: "alertInfo",
};

interface Props {
  alertas: Alerta[];
}

export function Alertas({ alertas }: Props) {
  return (
    <div className={styles.alerts}>
      {alertas.map((a, i) => (
        <div key={i} className={cn(styles.alert, styles[TIPO_CLASS[a.tipo]])}>
          <div className={styles.alertIcon}>{a.icon}</div>
          <div
            className={styles.alertText}
            dangerouslySetInnerHTML={{ __html: a.html }}
          />
        </div>
      ))}
    </div>
  );
}
