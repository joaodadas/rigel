import type { ReactNode } from "react";
import styles from "../theme.module.css";

interface Props {
  ano: number;
  subtitle: string;
  ultimaAtualizacao?: string | null; // DD/MM/YYYY
  actions?: ReactNode;               // slot pra <UploadDialog /> ou botão custom
}

export function Header({ ano, subtitle, ultimaAtualizacao, actions }: Props) {
  return (
    <header>
      <div>
        <div className={styles.mark}>RIGEL · EXECUTIVE DASHBOARD</div>
        <h1>
          DRE <em>Gerencial</em>
        </h1>
        <div className={styles.subtitle}>{subtitle}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ marginBottom: 10 }}>
          <span className={styles.liveIndicator}>DADOS {ano}</span>
        </div>
        {actions}
        <div className={styles.uploadHint}>
          {ultimaAtualizacao ? `ÚLTIMO UPLOAD · ${ultimaAtualizacao}` : "ACEITO: .XLSX"}
        </div>
      </div>
    </header>
  );
}
