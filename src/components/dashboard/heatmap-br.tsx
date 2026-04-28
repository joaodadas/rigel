"use client"

import { useEffect, useMemo, useState } from "react"
import { geoMercator, geoPath } from "d3-geo"
import type { Feature, FeatureCollection, Geometry, Polygon, MultiPolygon, Position } from "geojson"
import type { PedidoRegiao } from "@/lib/queries/comercial-analytics"

const GEO_URL = "/maps/br-states.json"
const WIDTH = 600
const HEIGHT = 520

interface StateProps {
  sigla: string
  name?: string
}

// O GeoJSON dos estados BR vem com rings em sentido horário (convenção antiga).
// d3-geo segue RFC 7946 (anti-horário) — rings horários são interpretados como
// "complemento do mundo", o que faz fitSize calcular escala errada por ordem de
// magnitude. Aqui invertemos cada ring uma vez no carregamento.
function rewindRing(ring: Position[]): Position[] {
  return ring.slice().reverse()
}
function rewindGeometry(geom: Geometry): Geometry {
  if (geom.type === "Polygon") {
    return { ...geom, coordinates: (geom as Polygon).coordinates.map(rewindRing) }
  }
  if (geom.type === "MultiPolygon") {
    return {
      ...geom,
      coordinates: (geom as MultiPolygon).coordinates.map((poly) => poly.map(rewindRing)),
    }
  }
  return geom
}

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
  const [features, setFeatures] = useState<Feature<Geometry, StateProps>[]>([])
  const [hovered, setHovered] = useState<{ uf: string; x: number; y: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(GEO_URL)
      .then((r) => r.json() as Promise<FeatureCollection<Geometry, StateProps>>)
      .then((fc) => {
        if (cancelled) return
        const rewound = (fc.features ?? []).map((f) => ({
          ...f,
          geometry: rewindGeometry(f.geometry),
        }))
        setFeatures(rewound)
      })
      .catch((e) => console.error("[HeatmapBR] failed to load geo:", e))
    return () => {
      cancelled = true
    }
  }, [])

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

  // Projeção Mercator auto-ajustada à bbox dos features.
  const pathFor = useMemo(() => {
    if (features.length === 0) return null
    const projection = geoMercator().fitSize([WIDTH, HEIGHT], {
      type: "FeatureCollection",
      features,
    } as FeatureCollection<Geometry, StateProps>)
    return geoPath(projection)
  }, [features])

  const hoveredRow = hovered ? byUf.get(hovered.uf) : null

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-auto w-full"
      >
        {pathFor &&
          features.map((f) => {
            const uf = String(f.properties.sigla ?? "")
            const row = byUf.get(uf)
            const value = row ? (metric === "valor" ? row.valorTotal : row.qtdPedidos) : 0
            const intensity = value > 0 ? Math.max(0.08, Math.min(1, value / max)) : 0
            const fill =
              value > 0
                ? `color-mix(in oklch, var(--color-foreground) ${Math.round(intensity * 80)}%, var(--color-muted))`
                : "var(--color-muted)"
            const d = pathFor(f as Feature<Geometry>) ?? ""
            const isHovered = hovered?.uf === uf
            return (
              <path
                key={uf}
                d={d}
                fill={isHovered ? "var(--color-foreground)" : fill}
                stroke="var(--color-background)"
                strokeWidth={0.6}
                style={{ cursor: "pointer", transition: "fill 120ms" }}
                onMouseMove={(e) => setHovered({ uf, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setHovered(null)}
              />
            )
          })}
      </svg>

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
        <span className="ml-2 tabular-nums">
          máx: {metric === "valor" ? formatBRL(max) : formatNumber(max)}
        </span>
      </div>
    </div>
  )
}
