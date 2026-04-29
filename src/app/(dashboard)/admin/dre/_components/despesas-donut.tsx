import { fmt } from "@/lib/dre/format";
import type { DreSnapshot } from "@/lib/dre/computacoes";
import styles from "../theme.module.css";

interface Props {
  snap: DreSnapshot;
}

const COLORS = [
  "#D4AF6A", "#8A7547", "#60A5FA", "#4ADE80", "#FBBF24",
  "#F87171", "#C084FC", "#2DD4BF", "#FB923C", "#A78BFA",
  "#34D399", "#FDE047", "#F472B6", "#22D3EE", "#EAB308",
  "#94A3B8", "#38BDF8", "#F9A8D4", "#FACC15", "#FB7185",
];

const ORDEM = [
  { name: "Mercado Livre",       key: "ccML" },
  { name: "Shoppe",              key: "ccShoppe" },
  { name: "Seamless",            key: "ccSeamless" },
  { name: "Administrativo",      key: "ccAdmin" },
  { name: "Construção Galpão",   key: "ccGalpao" },
  { name: "Marketing",           key: "ccMkt" },
  { name: "Comercial",           key: "ccCom" },
  { name: "Placas",              key: "ccPlacas" },
  { name: "Rigel Sense",         key: "ccSense" },
  { name: "Estoque/Exped.",      key: "ccEstoque" },
  { name: "Corte / Laser",       key: "ccCorte" },
  { name: "Costura",             key: "ccCost" },
  { name: "E-Commerce",          key: "ccEcom" },
  { name: "Qualidade",           key: "ccQual" },
  { name: "Tecidos",             key: "ccTec" },
  { name: "Despesas Diversas",   key: "ccDiv" },
  { name: "CIS",                 key: "ccCIS" },
  { name: "Personalização",      key: "ccPers" },
  { name: "Amazon",              key: "ccAmazon" },
  { name: "Shein",               key: "ccShein" },
] as const;

export function DespesasDonut({ snap }: Props) {
  const items = ORDEM
    .map((o, i) => ({ name: o.name, val: (snap as unknown as Record<string, number>)[o.key] || 0, color: COLORS[i] }))
    .filter((c) => c.val > 0)
    .sort((a, b) => b.val - a.val);

  const total = items.reduce((s, c) => s + c.val, 0);

  if (total === 0) {
    return (
      <div className={styles.donutWrap} style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Sem despesas no período.</div>
      </div>
    );
  }

  const cx = 50, cy = 50, r = 35, inner = 22;
  let cum = 0;

  const paths = items.map((c, i) => {
    const pct = c.val / total;
    const startAngle = cum * 2 * Math.PI - Math.PI / 2;
    cum += pct;
    const endAngle = cum * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const xi1 = cx + inner * Math.cos(startAngle);
    const yi1 = cy + inner * Math.sin(startAngle);
    const xi2 = cx + inner * Math.cos(endAngle);
    const yi2 = cy + inner * Math.sin(endAngle);
    const large = pct > 0.5 ? 1 : 0;
    const d = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${inner} ${inner} 0 ${large} 0 ${xi1} ${yi1} Z`;
    return <path key={i} d={d} fill={c.color} opacity={0.9} />;
  });

  return (
    <div className={styles.donutWrap}>
      <svg className={styles.donutSvg} viewBox="0 0 100 100">
        {paths}
        <text
          x={cx}
          y={cy - 2}
          textAnchor="middle"
          fontFamily="var(--font-fraunces), Fraunces"
          fontSize={5}
          fill="var(--text-muted)"
          letterSpacing={0.5}
        >
          TOTAL
        </text>
        <text
          x={cx}
          y={cy + 5}
          textAnchor="middle"
          fontFamily="var(--font-fraunces), Fraunces"
          fontSize={6}
          fill="var(--highlight)"
          fontWeight={500}
        >
          {fmt(total)}
        </text>
      </svg>
      <div className={styles.donutLegend}>
        {items.slice(0, 12).map((c) => (
          <div key={c.name} className={styles.legItem}>
            <div className={styles.legDot} style={{ background: c.color }} />
            <div className={styles.legName}>{c.name}</div>
            <div className={styles.legValue}>{fmt(c.val)}</div>
            <div className={styles.legPct}>
              {((c.val / total) * 100).toFixed(1).replace(".", ",")}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
