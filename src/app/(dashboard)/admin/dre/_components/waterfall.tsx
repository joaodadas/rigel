import { fmt } from "@/lib/dre/format";
import type { DreSnapshot } from "@/lib/dre/computacoes";
import styles from "../theme.module.css";

interface Props {
  snap: DreSnapshot;
  semInvest: boolean;
}

interface Step {
  label: string;
  value: number;
  type: "start" | "sub" | "subtotal" | "end";
}

export function Waterfall({ snap, semInvest }: Props) {
  const lucro = semInvest ? snap.lucroSemInv : snap.lucroComInv;
  const steps: Step[] = [
    { label: "Faturamento Bruto",  value: snap.fat,         type: "start" },
    { label: "(−) Impostos",       value: -snap.imp,        type: "sub" },
    { label: "(=) Receita Líquida", value: snap.rcLiq,       type: "subtotal" },
    { label: "(−) Var. Venda",     value: -snap.variaveis,  type: "sub" },
    { label: "(−) CPV",            value: -snap.cpv,        type: "sub" },
    { label: "(=) M. Contrib.",    value: snap.margemCtb,   type: "subtotal" },
    { label: "(−) Desp. Fixas",    value: -snap.fixas,      type: "sub" },
    { label: "(=) Lucro Líquido",  value: lucro,            type: "end" },
  ];

  const w = 700;
  const h = 280;
  const padTop = 30;
  const padBottom = 70;
  const padX = 10;
  const gap = 8;
  const barW = (w - padX * 2 - (steps.length - 1) * gap) / steps.length;
  const maxVal = Math.max(Math.abs(snap.fat), Math.abs(lucro), 1);
  const scale = (h - padTop - padBottom) / maxVal;
  const baseY = h - padBottom;

  let cumulative = 0;
  const rects = steps.map((s, i) => {
    const x = padX + i * (barW + gap);
    let barY: number;
    let barH: number;
    let color: string;

    if (s.type === "start" || s.type === "end" || s.type === "subtotal") {
      cumulative = s.value;
      barH = Math.abs(s.value) * scale;
      barY = s.value >= 0 ? baseY - barH : baseY;
      color = s.type === "end"
        ? (s.value >= 0 ? "var(--gold)" : "var(--neg)")
        : (s.type === "subtotal" ? "var(--gold-soft)" : "var(--text-dim)");
    } else {
      barH = Math.abs(s.value) * scale;
      const prevVal = cumulative;
      cumulative += s.value;
      barY = s.value >= 0 ? baseY - cumulative * scale : baseY - prevVal * scale;
      color = s.value >= 0 ? "var(--pos-soft)" : "var(--neg-soft)";
    }

    if (!Number.isFinite(barY) || !Number.isFinite(barH)) {
      barY = baseY;
      barH = 0;
    }
    if (barH < 1) barH = 1;

    const labelColor =
      s.type === "end" || s.type === "subtotal" ? "var(--highlight)" : "var(--text-dim)";
    const labelTop = s.label.split(" ").slice(0, 2).join(" ");
    const labelBot = s.label.split(" ").slice(2).join(" ");

    return (
      <g key={i}>
        <rect x={x} y={barY} width={barW} height={barH} fill={color} opacity={0.9} />
        <text
          x={x + barW / 2}
          y={Math.max(20, barY - 6)}
          textAnchor="middle"
          fontFamily="var(--font-mono), JetBrains Mono"
          fontSize={10}
          fill={labelColor}
          fontWeight={500}
        >
          {fmt(s.value)}
        </text>
        <text
          x={x + barW / 2}
          y={h - 45}
          textAnchor="middle"
          fontFamily="var(--font-mono), JetBrains Mono"
          fontSize={9}
          fill="var(--text-muted)"
          letterSpacing={0.5}
        >
          {labelTop}
        </text>
        <text
          x={x + barW / 2}
          y={h - 32}
          textAnchor="middle"
          fontFamily="var(--font-mono), JetBrains Mono"
          fontSize={9}
          fill="var(--text-muted)"
          letterSpacing={0.5}
        >
          {labelBot}
        </text>
      </g>
    );
  });

  return (
    <div className={styles.waterfall}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
      >
        {rects}
        <line x1={padX} y1={baseY} x2={w - padX} y2={baseY} stroke="var(--border)" strokeWidth={1} />
      </svg>
    </div>
  );
}
