import { useId, type HTMLAttributes } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { cmax, seriesColor, useSeriesColors, type PkSeries } from '../pk'

export interface ConcentrationCurveProps extends HTMLAttributes<HTMLDivElement> {
  /** One entry per drug; all plotted on the same axes for comparison. */
  series: PkSeries[]
  /** Shade the area under each curve (the AUC). Defaults to true. */
  showAuc?: boolean
  /** Mark each curve's peak (Cmax / Vmax). Defaults to true. */
  showPeak?: boolean
  height?: number
  timeLabel?: string
  concentrationLabel?: string
}

/**
 * ConcentrationCurve — overlays drug concentration–time profiles on one set of
 * axes so they can be compared. The shaded area under each curve is its AUC
 * (total exposure); the marked point is its peak concentration (Cmax / Vmax).
 */
export function ConcentrationCurve({
  series,
  showAuc = true,
  showPeak = true,
  height = 280,
  timeLabel = 'Time (h)',
  concentrationLabel = 'Concentration (mg/L)',
  className,
  style,
  ...rest
}: ConcentrationCurveProps) {
  const palette = useSeriesColors()
  const baseId = `pk-${useId().replace(/:/g, '')}`
  const maxTime = Math.max(
    0,
    ...series.flatMap((s) => s.data.map((p) => p.time)),
  )

  return (
    <div
      className={['ds-pk', 'ds-pk-curve', className].filter(Boolean).join(' ')}
      style={{ ...style, height }}
      role="img"
      {...rest}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart margin={{ top: 8, right: 16, bottom: 28, left: 12 }}>
          <defs>
            {series.map((s, i) => {
              const color = seriesColor(s, i, palette)
              return (
                <linearGradient
                  key={s.name}
                  id={`${baseId}-${i}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={color} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              )
            })}
          </defs>

          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="time"
            allowDuplicatedCategory={false}
            domain={[0, maxTime]}
            tickCount={7}
            label={{ value: timeLabel, position: 'insideBottom', offset: -16 }}
          />
          <YAxis
            label={{
              value: concentrationLabel,
              angle: -90,
              position: 'insideLeft',
              style: { textAnchor: 'middle' },
            }}
          />
          <Tooltip
            labelFormatter={(t) => `t = ${t} h`}
            formatter={(value: number, name) => [`${value} mg/L`, name]}
          />
          <Legend
            verticalAlign="top"
            align="left"
            wrapperStyle={{ paddingBottom: 'var(--space-sm)' }}
          />

          {series.map((s, i) => {
            const color = seriesColor(s, i, palette)
            return (
              <Area
                key={s.name}
                data={s.data}
                dataKey="concentration"
                name={s.name}
                type="monotone"
                stroke={color}
                strokeWidth={2}
                fill={showAuc ? `url(#${baseId}-${i})` : 'none'}
                dot={false}
                activeDot={{ r: 3 }}
                isAnimationActive={false}
              />
            )
          })}

          {showPeak
            ? series.map((s, i) => {
                const peak = cmax(s.data)
                return (
                  <ReferenceDot
                    key={s.name}
                    x={peak.time}
                    y={peak.concentration}
                    r={4}
                    fill={seriesColor(s, i, palette)}
                    stroke="var(--color-background)"
                    strokeWidth={2}
                    ifOverflow="extendDomain"
                  />
                )
              })
            : null}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
