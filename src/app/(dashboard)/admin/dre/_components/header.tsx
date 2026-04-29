import styles from "../theme.module.css";

interface Props {
  ano: number;
  subtitle: string;
  ultimaAtualizacao?: string | null; // DD/MM/YYYY
}

export function Header({ ano, subtitle, ultimaAtualizacao }: Props) {
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
        <button type="button" className={styles.uploadBtn} disabled>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Upload DRE Mensal
        </button>
        <div className={styles.uploadHint}>
          {ultimaAtualizacao ? `ÚLTIMO UPLOAD · ${ultimaAtualizacao}` : "ACEITO: .XLSX"}
        </div>
      </div>
    </header>
  );
}
