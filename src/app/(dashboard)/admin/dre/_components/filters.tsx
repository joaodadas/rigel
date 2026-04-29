"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition, useCallback } from "react";
import { cn } from "@/lib/utils";
import { EMPRESAS, type EmpresaCode } from "@/lib/dre/empresas";
import { MES_ABREV } from "@/lib/dre/meses";
import styles from "../theme.module.css";

interface Props {
  mesAtual: number | "acum";
  empresaAtual: EmpresaCode;
  semInvest: boolean;
  mesesDisponiveis: number[]; // 1..12
}

export function Filters({ mesAtual, empresaAtual, semInvest, mesesDisponiveis }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [, startTransition] = useTransition();

  const navigate = useCallback(
    (patch: Record<string, string>) => {
      const params = new URLSearchParams(search.toString());
      for (const [k, v] of Object.entries(patch)) params.set(k, v);
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [router, pathname, search],
  );

  const disponiveisSet = new Set(mesesDisponiveis);

  return (
    <div className={styles.filters}>
      <div className={styles.filterGroup}>
        <span className={styles.filterLabel}>Período</span>
        <div className={styles.filterPills}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
            const enabled = disponiveisSet.has(m);
            return (
              <button
                key={m}
                type="button"
                disabled={!enabled}
                onClick={() => enabled && navigate({ mes: String(m).padStart(2, "0") })}
                className={cn(styles.pill, mesAtual === m && styles.active)}
              >
                {MES_ABREV[m]}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => navigate({ mes: "acum" })}
            className={cn(styles.pill, mesAtual === "acum" && styles.active)}
          >
            ACUMULADO
          </button>
        </div>
      </div>

      <div className={styles.filterGroup}>
        <span className={styles.filterLabel}>Empresa</span>
        <div className={cn(styles.filterPills, styles.companyPills)}>
          {EMPRESAS.map((e) => (
            <button
              key={e.code}
              type="button"
              onClick={() => navigate({ empresa: e.code })}
              className={cn(styles.pill, empresaAtual === e.code && styles.active)}
            >
              {e.label.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.filterGroup} style={{ marginLeft: "auto" }}>
        <span className={styles.filterLabel}>Visão</span>
        <div className={styles.toggleWrap}>
          <button
            type="button"
            aria-pressed={semInvest}
            className={cn(styles.toggleSwitch, semInvest && styles.on)}
            onClick={() => navigate({ inv: semInvest ? "com" : "sem" })}
          />
          <span className={styles.toggleText}>
            {semInvest ? "Sem investimentos" : "Com investimentos"}
          </span>
        </div>
      </div>
    </div>
  );
}
