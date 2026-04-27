"use client"

import { useState, useMemo } from "react"
// react-simple-maps does not ship its own types; declared in src/types/react-simple-maps.d.ts
import { ComposableMap, Geographies, Geography } from "react-simple-maps"
import type { PedidoRegiao } from "@/lib/queries/comercial-analytics"

const GEO_URL = "/maps/br-states.json"

interface HeatmapBRProps {
  data: PedidoRegiao[]
  /** Métrica do heatmap: valor (R$) ou quantidade de pedidos. */
  metric?: "valor" | "qtd"
}

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v)

const formatNumber = (v: number) => new Intl.NumberFormat("pt-BR").format(v)

/**
 * Heatmap do Brasil colorindo cada UF proporcionalmente ao valor.
 * Usa escala linear sobre `metric` (valor ou qtd). Tom = oklch da accent.
 */
export function HeatmapBR({ data, metric = "valor" }: HeatmapBRProps) {
  const [hovered, setHovered] = useState<{ uf: string; x: number; y: number } | null>(null)

  const byUf = useMemo(() => {
    const map = new Map<string, PedidoRegiao>()
    for (const r of data) map.set(r.uf, r)
    return map
  }, [data])

  const max = useMemo(() => {
    let m = 0
    for (const r of data) {
      const v = metric === "valor" ? r.valorTotal : r.qtdPedidos
      if (v > m) m = v
    }
    return m || 1
  }, [data, metric])

  const hoveredRow = hovered ? byUf.get(hovered.uf) : null

  return (
    <div className="relative">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 700, center: [-54, -15] }}
        width={600}
        height={520}
        style={{ width: "100%", height: "auto" }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }: { geographies: Array<{ rsmKey: string; properties: Record<string, unknown> }> }) =>
            geographies.map((geo) => {
              const uf = String(geo.properties.sigla ?? "")
              const row = byUf.get(uf)
              const value = row ? (metric === "valor" ? row.valorTotal : row.qtdPedidos) : 0
              const intensity = value > 0 ? Math.max(0.08, Math.min(1, value / max)) : 0
              const fill = value > 0
                ? `color-mix(in oklch, var(--color-foreground) ${Math.round(intensity * 80)}%, var(--color-muted))`
                : "var(--color-muted)"
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={fill}
                  stroke="var(--color-background)"
                  strokeWidth={0.6}
                  style={{
                    default: { outline: "none" },
                    hover: { outline: "none", fill: "var(--color-foreground)", cursor: "pointer" },
                    pressed: { outline: "none" },
                  }}
                  onMouseEnter={(e: React.MouseEvent) => {
                    setHovered({ uf, x: e.clientX, y: e.clientY })
                  }}
                  onMouseMove={(e: React.MouseEvent) => {
                    setHovered({ uf, x: e.clientX, y: e.clientY })
                  }}
                  onMouseLeave={() => setHovered(null)}
                />
              )
            })
          }
        </Geographies>
      </ComposableMap>

      {/* Tooltip flutuante */}
      {hovered && (
        <div
          className="pointer-events-none fixed z-50 rounded-lg border bg-card px-3 py-2 text-xs shadow-md"
          style={{ left: hovered.x + 12, top: hovered.y + 12 }}
        >
          <p className="font-medium text-card-foreground">{hovered.uf}</p>
          {hoveredRow ? (
            <>
              <p className="text-muted-foreground">Valor: {formatBRL(hoveredRow.valorTotal)}</p>
              <p className="text-muted-foreground">Pedidos: {formatNumber(hoveredRow.qtdPedidos)}</p>
            </>
          ) : (
            <p className="text-muted-foreground">Sem pedidos no período</p>
          )}
        </div>
      )}

      {/* Legenda */}
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <span>Menor</span>
        <div
          className="h-2 flex-1 rounded-full"
          style={{
            background:
              "linear-gradient(to right, var(--color-muted), color-mix(in oklch, var(--color-foreground) 80%, var(--color-muted)))",
          }}
        />
        <span>Maior</span>
        <span className="ml-2 tabular-nums">máx: {metric === "valor" ? formatBRL(max) : formatNumber(max)}</span>
      </div>
    </div>
  )
}
