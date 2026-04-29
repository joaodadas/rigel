"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { fmtFull, pct, delta } from "@/lib/dre/format";
import type { DreSnapshot } from "@/lib/dre/computacoes";
import styles from "../theme.module.css";

interface Props {
  snap: DreSnapshot;
  prev?: DreSnapshot | null;
  semInvest: boolean;
  compareLabel: string; // "VS JAN" | "VS FEV" | "—"
}

type Group = "imposto" | "var" | "cpv" | "fixas";

interface RowDef {
  label: string;
  key: keyof DreSnapshot;
  level: 0 | 1;
  variant?: "result" | "final" | "collapsible";
  group?: Group;
  parentGroup?: Group;
}

// Estrutura linear da tabela. Mantém a ordem que o usuário espera ver
// (faturamento → impostos → receita líquida → variáveis → CPV → margem ctb →
// fixas → resultado op → não-op → lucro líquido).
const ROWS: RowDef[] = [
  { label: "(=) Faturamento Bruto",          key: "fat",       level: 0 },
  { label: "Faturamento Mercado Interno",    key: "fatMI",     level: 1 },
  { label: "Faturamento Mercado Externo",    key: "fatME",     level: 1 },
  { label: "(−) Devoluções",                 key: "devol",     level: 1 },

  { label: "(−) Impostos",                   key: "imp",       level: 0, variant: "collapsible", group: "imposto" },
  { label: "ICMS Normal + DIFAL",            key: "icms",      level: 1, parentGroup: "imposto" },
  { label: "PIS/COFINS",                     key: "pisCofins", level: 1, parentGroup: "imposto" },
  { label: "Simples Nacional",               key: "simples",   level: 1, parentGroup: "imposto" },
  { label: "Previsão IRPJ/CSLL",             key: "irpjCsll",  level: 1, parentGroup: "imposto" },

  { label: "(=) Receita Líquida",            key: "rcLiq",     level: 0, variant: "result" },

  { label: "(−) Variáveis de Venda",         key: "variaveis", level: 0, variant: "collapsible", group: "var" },
  { label: "Comissão",                       key: "comissao",  level: 1, parentGroup: "var" },
  { label: "Frete (s/ vendas)",              key: "frete",     level: 1, parentGroup: "var" },
  { label: "Provisão Dev. Duvidosos",        key: "pdd",       level: 1, parentGroup: "var" },

  { label: "(−) Custo do Produto Vendido",   key: "cpv",       level: 0, variant: "collapsible", group: "cpv" },
  { label: "Matéria Prima",                  key: "mp",        level: 1, parentGroup: "cpv" },
  { label: "Mão de Obra Direta",             key: "mod",       level: 1, parentGroup: "cpv" },
  { label: "Serviço de Terceiros",           key: "terc",      level: 1, parentGroup: "cpv" },
  { label: "Facção",                         key: "faccao",    level: 1, parentGroup: "cpv" },
  { label: "Embalagens",                     key: "embal",     level: 1, parentGroup: "cpv" },
  { label: "Energia Elétrica",               key: "energia",   level: 1, parentGroup: "cpv" },

  { label: "(=) Margem de Contribuição",     key: "margemCtb", level: 0, variant: "result" },

  { label: "(−) Custos / Despesas Fixas",    key: "fixas",     level: 0, variant: "collapsible", group: "fixas" },
  { label: "Administrativo",                 key: "ccAdmin",   level: 1, parentGroup: "fixas" },
  { label: "Marketing",                      key: "ccMkt",     level: 1, parentGroup: "fixas" },
  { label: "Mercado Livre",                  key: "ccML",      level: 1, parentGroup: "fixas" },
  { label: "Shoppe",                         key: "ccShoppe",  level: 1, parentGroup: "fixas" },
  { label: "Seamless",                       key: "ccSeamless", level: 1, parentGroup: "fixas" },
  { label: "Construção Galpão 2026",         key: "ccGalpao",  level: 1, parentGroup: "fixas" },
  { label: "Comercial",                      key: "ccCom",     level: 1, parentGroup: "fixas" },
  { label: "Estoque / Expedição",            key: "ccEstoque", level: 1, parentGroup: "fixas" },
  { label: "Rigel Sense",                    key: "ccSense",   level: 1, parentGroup: "fixas" },
  { label: "Placas",                         key: "ccPlacas",  level: 1, parentGroup: "fixas" },
  { label: "Corte / Laser",                  key: "ccCorte",   level: 1, parentGroup: "fixas" },
  { label: "Costura",                        key: "ccCost",    level: 1, parentGroup: "fixas" },
  { label: "E-Commerce",                     key: "ccEcom",    level: 1, parentGroup: "fixas" },
  { label: "Qualidade",                      key: "ccQual",    level: 1, parentGroup: "fixas" },
  { label: "Tecidos",                        key: "ccTec",     level: 1, parentGroup: "fixas" },
  { label: "CIS",                            key: "ccCIS",     level: 1, parentGroup: "fixas" },
  { label: "Personalização",                 key: "ccPers",    level: 1, parentGroup: "fixas" },
  { label: "Amazon",                         key: "ccAmazon",  level: 1, parentGroup: "fixas" },
  { label: "Shein",                          key: "ccShein",   level: 1, parentGroup: "fixas" },
  { label: "Despesas Diversas",              key: "ccDiv",     level: 1, parentGroup: "fixas" },
];

export function TabelaDRE({ snap, prev, semInvest, compareLabel }: Props) {
  const [collapsed, setCollapsed] = useState<Record<Group, boolean>>({
    imposto: false,
    var: false,
    cpv: false,
    fixas: false,
  });

  const toggle = (g: Group) =>
    setCollapsed((c) => ({ ...c, [g]: !c[g] }));

  const valorOf = (key: keyof DreSnapshot, src: DreSnapshot): number => {
    const v = src[key];
    if (typeof v === "number") return v;
    return 0;
  };

  const renderRow = (def: RowDef) => {
    if (def.parentGroup && collapsed[def.parentGroup]) return null;

    const v = valorOf(def.key, snap);
    const pVal = prev ? valorOf(def.key, prev) : null;
    const dStr = pVal !== null ? delta(v, pVal) : "—";
    const dCls =
      dStr === "—" ? "" : dStr.startsWith("+") ? styles.positive : styles.negative;

    const variantClass =
      def.variant === "result"
        ? styles.dreResult
        : def.variant === "final"
          ? styles.dreFinal
          : "";

    const isCollapsible = def.variant === "collapsible";
    const isCollapsed = def.group ? collapsed[def.group] : false;

    return (
      <div
        key={def.label}
        onClick={isCollapsible && def.group ? () => toggle(def.group!) : undefined}
        className={cn(
          styles.dreRow,
          def.level === 0 ? styles.level0 : styles.level1,
          variantClass,
          isCollapsible && styles.collapsible,
        )}
      >
        <div className={styles.label}>
          {isCollapsible && (
            <span className={styles.expandIcon}>{isCollapsed ? "+" : "−"}</span>
          )}
          {def.label}
        </div>
        <div className={cn(styles.value, v < 0 && styles.negative)}>{fmtFull(v)}</div>
        <div className={cn(styles.value, styles.pctVal)}>{pct(v, snap.fat)}</div>
        <div className={cn(styles.value, dCls)}>{dStr}</div>
      </div>
    );
  };

  const lucro = semInvest ? snap.lucroSemInv : snap.lucroComInv;
  const lucroPrev = prev ? (semInvest ? prev.lucroSemInv : prev.lucroComInv) : null;
  const lucroAlt = semInvest ? snap.lucroComInv : snap.lucroSemInv;

  return (
    <div className={styles.dreTable}>
      <div className={styles.dreHeaderRow}>
        <div>Descrição</div>
        <div>Valor (R$)</div>
        <div>% Fat.</div>
        <div>{compareLabel}</div>
      </div>

      {ROWS.map(renderRow)}

      {/* Resultado Operacional */}
      <div className={cn(styles.dreRow, styles.dreResult)}>
        <div className={styles.label}>(=) Resultado Operacional</div>
        <div
          className={cn(
            styles.value,
            snap.resOp !== null && snap.resOp < 0 && styles.negative,
          )}
        >
          {snap.resOp !== null ? fmtFull(snap.resOp) : "—"}
        </div>
        <div className={cn(styles.value, styles.pctVal)}>
          {snap.resOp !== null ? pct(snap.resOp, snap.fat) : "—"}
        </div>
        <div className={styles.value}>
          {prev?.resOp !== null && prev?.resOp !== undefined && snap.resOp !== null
            ? delta(snap.resOp, prev.resOp)
            : "—"}
        </div>
      </div>

      {/* Não Operacional */}
      <div className={cn(styles.dreRow, styles.level0)}>
        <div className={styles.label}>(+/−) Resultado Não Operacional</div>
        <div className={cn(styles.value, snap.nonOp < 0 && styles.negative)}>
          {fmtFull(snap.nonOp)}
        </div>
        <div className={cn(styles.value, styles.pctVal)}>{pct(snap.nonOp, snap.fat)}</div>
        <div className={styles.value}>
          {prev ? delta(snap.nonOp, prev.nonOp) : "—"}
        </div>
      </div>

      {/* Lucro Líquido (final) */}
      <div className={cn(styles.dreRow, styles.dreFinal)}>
        <div className={styles.label}>
          (=) Lucro Líquido · {semInvest ? "s/" : "c/"} Investimentos
        </div>
        <div className={cn(styles.value, lucro < 0 && styles.negative)}>
          {fmtFull(lucro)}
        </div>
        <div className={cn(styles.value, styles.pctVal)}>{pct(lucro, snap.fat)}</div>
        <div
          className={cn(
            styles.value,
            lucroPrev !== null
              ? lucro >= lucroPrev
                ? styles.positive
                : styles.negative
              : "",
          )}
        >
          {lucroPrev !== null ? delta(lucro, lucroPrev) : "—"}
        </div>
      </div>

      {/* Visão alternativa */}
      <div
        className={cn(styles.dreRow, styles.level1)}
        style={{ paddingTop: 14, paddingBottom: 14, color: "var(--text-muted)" }}
      >
        <div className={styles.label}>
          Lucro Líquido · {semInvest ? "c/" : "s/"} Investimentos (visão alternativa)
        </div>
        <div className={cn(styles.value, lucroAlt < 0 && styles.negative)}>{fmtFull(lucroAlt)}</div>
        <div className={cn(styles.value, styles.pctVal)}>{pct(lucroAlt, snap.fat)}</div>
        <div className={styles.value}>—</div>
      </div>
    </div>
  );
}
