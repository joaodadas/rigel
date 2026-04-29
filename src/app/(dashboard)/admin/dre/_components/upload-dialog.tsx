"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import styles from "../theme.module.css";

type Status =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "ok"; meses: number[]; total: number; warnings: number }
  | { kind: "err"; msg: string };

const MAX_BYTES = 50 * 1024 * 1024;

export function UploadDialog() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();

  const close = useCallback(() => {
    if (status.kind === "uploading") return;
    setOpen(false);
    setTimeout(() => {
      setStatus({ kind: "idle" });
      setFileName(null);
    }, 200);
  }, [status.kind]);

  const submitFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith(".xlsx")) {
        setStatus({ kind: "err", msg: "Apenas .xlsx é aceito." });
        return;
      }
      if (file.size > MAX_BYTES) {
        setStatus({ kind: "err", msg: `Arquivo excede ${MAX_BYTES / 1024 / 1024}MB.` });
        return;
      }

      setFileName(file.name);
      setStatus({ kind: "uploading" });

      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/dre/upload", { method: "POST", body: fd });
        const json = await res.json();

        if (!res.ok) {
          setStatus({ kind: "err", msg: json?.error ?? `HTTP ${res.status}` });
          return;
        }

        setStatus({
          kind: "ok",
          meses: json.meses_processados ?? [],
          total: json.total_lancamentos ?? 0,
          warnings: (json.warnings ?? []).length,
        });
        // Atualiza o Server Component sem full reload
        router.refresh();
      } catch (e) {
        setStatus({ kind: "err", msg: (e as Error).message });
      }
    },
    [router],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) submitFile(file);
    },
    [submitFile],
  );

  const onPick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) submitFile(file);
    },
    [submitFile],
  );

  return (
    <>
      <button type="button" className={styles.uploadBtn} onClick={() => setOpen(true)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        Upload DRE Mensal
      </button>

      {open && (
        <div
          className={styles.dialogOverlay}
          onClick={close}
          onKeyDown={(e) => e.key === "Escape" && close()}
        >
          <div
            className={styles.dialogPanel}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className={styles.dialogTitle}>Atualizar planilha DRE</div>
            <div className={styles.dialogSubtitle}>FORMATO .XLSX · MAX 50MB</div>

            <div
              className={cn(styles.uploadZone, dragOver && styles.dragOver)}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <div className={styles.uploadZoneTitle}>
                {fileName
                  ? fileName
                  : "Arraste o arquivo DRE_Rigel.xlsx ou clique para selecionar"}
              </div>
              <div className={styles.uploadZoneHint}>
                FORMATO .XLSX · SOBRESCREVE OS MESES DETECTADOS
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx"
                style={{ display: "none" }}
                onChange={onPick}
              />
            </div>

            {status.kind === "uploading" && (
              <div className={styles.dialogStatus}>Processando upload…</div>
            )}
            {status.kind === "err" && (
              <div className={cn(styles.dialogStatus, styles.dialogStatusErr)}>
                ERRO · {status.msg}
              </div>
            )}
            {status.kind === "ok" && (
              <div className={cn(styles.dialogStatus, styles.dialogStatusOk)}>
                OK · {status.total} lançamentos em {status.meses.length} meses
                {status.warnings > 0 ? ` · ${status.warnings} avisos` : ""}
              </div>
            )}

            <div className={styles.dialogActions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={close}
                disabled={status.kind === "uploading"}
              >
                {status.kind === "ok" ? "Fechar" : "Cancelar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
