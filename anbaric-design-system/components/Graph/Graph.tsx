import './Graph.css'
import { useId, type HTMLAttributes } from 'react'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'

export interface GraphProps extends HTMLAttributes<HTMLDivElement> {
  /** The series to plot, left to right. */
  data: number[]
  /** Fill the area under the line. Defaults to true. */
  area?: boolean
  /** Height in pixels. Defaults to 120. */
  height?: number
}

/**
 * Graph — a line/area chart built on Recharts. Colours come from the design
 * tokens via `currentColor` (set to the primary colour in Graph.css), so the
 * chart stays on-palette. Pass a series of numbers.
 */
export function Graph({
  data,
  area = true,
  className,
  height = 120,
  style,
  ...rest
}: GraphProps) {
  const fillId = `graph-${useId().replace(/:/g, '')}`
  const series = data.map((value, index) => ({ index, value }))

  return (
    <div
      className={['ds-graph', className].filter(Boolean).join(' ')}
      style={{ ...style, height }}
      role="img"
      {...rest}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 4, right: 2, bottom: 0, left: 2 }}>
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity={0.25} />
              <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke="currentColor"
            strokeWidth={2}
            fill={area ? `url(#${fillId})` : 'none'}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
