"use client";

import { useMemo, useState } from "react";
import { formatBRL } from "./formatters";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BrazilMapProps {
  data: Record<string, number>; // UF code -> value
}

// ---------------------------------------------------------------------------
// Grid layout (cartogram) — each UF is a square arranged to roughly match
// Brazil's geography. null = empty cell.
// ---------------------------------------------------------------------------

const GRID: (string | null)[][] = [
  [null, null, "RR", "AP", null, null],
  ["AM", "PA", "MA", "PI", "CE", null],
  ["AC", "TO", "BA", "RN", "PB", null],
  ["RO", "MT", "GO", "PE", "AL", "SE"],
  [null, "MS", "MG", "ES", null, null],
  [null, "PR", "SP", "RJ", null, null],
  [null, "SC", "DF", null, null, null],
  [null, "RS", null, null, null, null],
];

// ---------------------------------------------------------------------------
// Color helper — green scale based on value intensity
// ---------------------------------------------------------------------------

function getColor(value: number, max: number): string {
  if (!max || !value) return "var(--color-muted)";
  const intensity = Math.min(value / max, 1);
  const lightness = 90 - intensity * 50; // 90% (light) -> 40% (dark)
  return `hsl(142, 60%, ${lightness}%)`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BrazilMap({ data }: BrazilMapProps) {
  const [hoveredUf, setHoveredUf] = useState<string | null>(null);

  const maxValue = useMemo(() => {
    const values = Object.values(data);
    return values.length > 0 ? Math.max(...values) : 0;
  }, [data]);

  return (
    <div className="flex flex-col items-center gap-1">
      {GRID.map((row, rowIdx) => (
        <div key={rowIdx} className="flex gap-1">
          {row.map((uf, colIdx) => {
            if (!uf) {
              return (
                <div
                  key={`empty-${rowIdx}-${colIdx}`}
                  className="size-12"
                  aria-hidden
                />
              );
            }

            const value = data[uf] ?? 0;
            const bgColor = getColor(value, maxValue);
            const isHovered = hoveredUf === uf;

            return (
              <div
                key={uf}
                className="relative flex size-12 items-center justify-center rounded-md text-[10px] font-bold transition-transform select-none"
                style={{
                  backgroundColor: bgColor,
                  color: value > 0 ? "white" : "var(--color-muted-foreground)",
                  transform: isHovered ? "scale(1.15)" : "scale(1)",
                  zIndex: isHovered ? 10 : 1,
                  textShadow:
                    value > 0
                      ? "0 1px 2px rgba(0,0,0,0.3)"
                      : "none",
                }}
                onMouseEnter={() => setHoveredUf(uf)}
                onMouseLeave={() => setHoveredUf(null)}
              >
                {uf}

                {/* Tooltip */}
                {isHovered && (
                  <div className="pointer-events-none absolute -top-10 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md border bg-card px-2 py-1 text-[11px] font-normal text-card-foreground shadow-md">
                    {uf}: {value > 0 ? formatBRL(value) : "Sem dados"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
