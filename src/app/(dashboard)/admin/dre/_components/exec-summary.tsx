import styles from "../theme.module.css";

interface Props {
  html: string; // gerado por gerarResumo() — controlado por nós
}

export function ExecSummary({ html }: Props) {
  return (
    <div className={styles.execSummary}>
      <div className={styles.execLabel}>Resumo Executivo · Análise Automatizada</div>
      <div
        className={styles.execText}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
