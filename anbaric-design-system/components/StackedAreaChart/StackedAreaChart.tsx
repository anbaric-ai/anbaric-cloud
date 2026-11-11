import './StackedAreaChart.css'
import { useState, type HTMLAttributes, type MouseEvent } from 'react'

export interface StackedAreaSeries {
  /** What the layer is, shown in the legend and the tooltip. */
  label: string
  /** One value per point, left to right, the same length as every other series. */
  values: number[]
  /** The layer's colour. Defaults to the sequence tokens, lightest first. */
  color?: string
}

export interface StackedAreaThreshold {
  /** Where the line sits, in the same units as the values. */
  value: number
  /** What the line is, printed at its right-hand end. */
  label: string
}

export interface StackedAreaChartProps extends HTMLAttributes<HTMLDivElement> {
  /** The layers, bottom first. */
  series: StackedAreaSeries[]
  /** What each point is, such as its date, shown as the tooltip's heading. */
  labels?: string[]
  /** A level to draw across the chart as a dashed line, such as an allowance. */
  threshold?: StackedAreaThreshold
  /** How values are written in the tooltip. Defaults to locale grouping. */
  formatValue?: (value: number) => string
  /** Height of the plot in pixels. Defaults to 120. */
  height?: number
}

const SEQUENCE = ['var(--color-sequence-1)', 'var(--color-sequence-2)', 'var(--color-sequence-3)']

const HEADROOM = 1.15

/**
 * StackedAreaChart — layers stacked one on another over time, so their sum
 * reads as the outline and each layer as its band, with an optional dashed
 * threshold. Inline SVG with no charting library. The legend is always
 * shown, and hovering shows every layer's value at that point. Pass an
 * aria-label describing what is stacked.
 */
export function StackedAreaChart({
  series,
  labels,
  threshold,
  formatValue = (value) => value.toLocaleString(),
  height = 120,
  className,
  ...rest
}: StackedAreaChartProps) {
  const [hovered, setHovered] = useState<number | undefined>(undefined)

  const points = Math.max(0, ...series.map((each) => each.values.length))
  const totals = Array.from({ length: points }, (_, index) => series.reduce((sum, each) => sum + (each.values[index] ?? 0), 0))
  const top = Math.max(0, ...totals, threshold?.value ?? 0) * HEADROOM
  const width = Math.max(1, points - 1)

  const xOf = (index: number) => (points > 1 ? index : 0.5)
  const yOf = (value: number) => (top > 0 ? 100 - (value / top) * 100 : 100)

  const layers = series.map((each, layer) => {
    const below = (index: number) => series.slice(0, layer).reduce((sum, under) => sum + (under.values[index] ?? 0), 0)
    const upper = Array.from({ length: points }, (_, index) => `${xOf(index)},${yOf(below(index) + (each.values[index] ?? 0))}`)
    const lower = Array.from({ length: points }, (_, index) => `${xOf(index)},${yOf(below(index))}`).reverse()
    return { ...each, color: each.color ?? SEQUENCE[layer % SEQUENCE.length], path: `M${upper.join('L')}L${lower.join('L')}Z` }
  })

  const hover = (event: MouseEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const fraction = box.width > 0 ? (event.clientX - box.left) / box.width : 0
    setHovered(points > 0 ? Math.min(points - 1, Math.max(0, Math.round(fraction * (points - 1)))) : undefined)
  }

  const at = hovered === undefined ? undefined : (hovered / width) * 100

  return (
    <div className={['ds-stacked-area', className].filter(Boolean).join(' ')} {...rest}>
      <div
        className="ds-stacked-area__plot"
        style={{ height }}
        role="img"
        onMouseMove={hover}
        onMouseLeave={() => setHovered(undefined)}
      >
        <svg viewBox={`0 0 ${width} 100`} preserveAspectRatio="none" aria-hidden="true">
          {layers.map((layer) => (
            <path key={layer.label} className="ds-stacked-area__layer" d={layer.path} fill={layer.color} />
          ))}
        </svg>

        {threshold && top > 0 && (
          <div className="ds-stacked-area__threshold" style={{ bottom: `${(threshold.value / top) * 100}%` }}>
            <span>{threshold.label}</span>
          </div>
        )}

        {hovered !== undefined && at !== undefined && (
          <>
            <div className="ds-stacked-area__crosshair" style={{ left: `${at}%` }} />
            <div
              className={['ds-stacked-area__tooltip', at > 50 ? 'ds-stacked-area__tooltip--left' : ''].filter(Boolean).join(' ')}
              style={{ left: `${at}%` }}
            >
              {labels?.[hovered] && <p className="ds-stacked-area__tooltip-heading">{labels[hovered]}</p>}
              {[...layers].reverse().map((layer) => (
                <p key={layer.label} className="ds-stacked-area__tooltip-row">
                  <span className="ds-stacked-area__swatch" style={{ background: layer.color }} />
                  <span>{layer.label}</span>
                  <strong>{formatValue(layer.values[hovered] ?? 0)}</strong>
                </p>
              ))}
              {layers.length > 1 && (
                <p className="ds-stacked-area__tooltip-row ds-stacked-area__tooltip-total">
                  <span />
                  <span>Total</span>
                  <strong>{formatValue(totals[hovered])}</strong>
                </p>
              )}
            </div>
          </>
        )}
      </div>

      <ul className="ds-stacked-area__legend">
        {layers.map((layer) => (
          <li key={layer.label}>
            <span className="ds-stacked-area__swatch" style={{ background: layer.color }} />
            {layer.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
