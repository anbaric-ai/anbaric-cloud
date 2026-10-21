import './ColumnChart.css'
import { type HTMLAttributes } from 'react'

export interface ColumnChartProps extends HTMLAttributes<HTMLDivElement> {
  /** One value per column, left to right; columns are scaled to the largest. */
  data: number[]
  /** What each column is, shown when it is hovered. */
  labels?: string[]
  /** Paint the columns in the primary colour, or quietly. Defaults to primary. */
  tone?: 'primary' | 'muted'
  /** Height in pixels. Defaults to 96. */
  height?: number
}

/**
 * ColumnChart — a series of columns over a baseline, such as a count per
 * hour. Plain CSS with no charting library, so it is light enough for the
 * dashboard and for plugins. Pass an aria-label describing the series.
 */
export function ColumnChart({
  data,
  labels,
  tone = 'primary',
  height = 96,
  className,
  style,
  ...rest
}: ColumnChartProps) {
  const largest = Math.max(0, ...data)

  return (
    <div
      className={['ds-column-chart', `ds-column-chart--${tone}`, className].filter(Boolean).join(' ')}
      style={{ ...style, height }}
      role="img"
      {...rest}
    >
      {data.map((value, index) => (
        <span
          key={index}
          className="ds-column-chart__column"
          title={labels?.[index] ?? String(value)}
          style={{ height: largest > 0 ? `${(value / largest) * 100}%` : 0 }}
        />
      ))}
    </div>
  )
}
