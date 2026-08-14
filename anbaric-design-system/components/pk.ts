import './pk.css'
import { useEffect, useState } from 'react'

/** A single concentration measurement at a point in time. */
export interface PkPoint {
  /** Time since dose. */
  time: number
  /** Blood/plasma concentration. */
  concentration: number
}

/** A drug's concentration–time profile. */
export interface PkSeries {
  name: string
  data: PkPoint[]
  /** Override the series colour; defaults to the palette. */
  color?: string
}

/** Peak concentration point (Cmax / Vmax, at Tmax). */
export function cmax(data: PkPoint[]): PkPoint {
  return data.reduce(
    (peak, point) => (point.concentration > peak.concentration ? point : peak),
    data[0] ?? { time: 0, concentration: 0 },
  )
}

/** Total exposure (AUC) by the linear trapezoidal rule. */
export function auc(data: PkPoint[]): number {
  const sorted = [...data].sort((a, b) => a.time - b.time)
  let total = 0
  for (let i = 1; i < sorted.length; i += 1) {
    const dt = sorted[i].time - sorted[i - 1].time
    total += (dt * (sorted[i].concentration + sorted[i - 1].concentration)) / 2
  }
  return total
}

// Series colours mirror the palette tokens. Resolved from CSS at runtime so
// theme overrides win, with the token values as the initial (no-flash) default.
const SERIES_TOKENS = [
  '--color-primary',
  '--color-accent-2',
  '--color-success',
  '--color-failure',
  '--color-accent',
]
const FALLBACKS = ['#6b5bf2', '#f28cea', '#61f29d', '#f27f7a', '#f2e592']

export function useSeriesColors(): string[] {
  const [colors, setColors] = useState<string[]>(FALLBACKS)
  useEffect(() => {
    const styles = getComputedStyle(document.documentElement)
    setColors(
      SERIES_TOKENS.map((token, i) => styles.getPropertyValue(token).trim() || FALLBACKS[i]),
    )
  }, [])
  return colors
}

export function seriesColor(series: PkSeries, index: number, palette: string[]): string {
  return series.color ?? palette[index % palette.length]
}
