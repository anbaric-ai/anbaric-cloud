import { type HTMLAttributes } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import { auc, cmax, seriesColor, useSeriesColors, type PkSeries } from '../pk'

export interface ExposureBarsProps extends HTMLAttributes<HTMLDivElement> {
  /** One entry per drug. */
  series: PkSeries[]
  /** Which derived metric to compare. Defaults to AUC. */
  metric?: 'auc' | 'cmax'
  /** Override the unit shown on labels. */
  unit?: string
  height?: number
}

const DEFAULT_UNIT: Record<'auc' | 'cmax', string> = {
  auc: 'mg·h/L',
  cmax: 'mg/L',
}

const round = (value: number) => Math.round(value * 10) / 10

/**
 * ExposureBars — a horizontal bar chart comparing one derived PK metric across
 * drugs. AUC is total exposure (area under the curve); Cmax is peak
 * concentration (Vmax).
 */
export function ExposureBars({
  series,
  metric = 'auc',
  unit,
  height = 220,
  className,
  style,
  ...rest
}: ExposureBarsProps) {
  const palette = useSeriesColors()
  const resolvedUnit = unit ?? DEFAULT_UNIT[metric]
  const data = series.map((s, i) => ({
    name: s.name,
    value: round(metric === 'auc' ? auc(s.data) : cmax(s.data).concentration),
    fill: seriesColor(s, i, palette),
  }))

  return (
    <div
      className={['ds-pk', 'ds-pk-bars', className].filter(Boolean).join(' ')}
      style={{ ...style, height }}
      role="img"
      {...rest}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 56, bottom: 4, left: 8 }}
        >
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={92} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              formatter={(value: number) => `${value} ${resolvedUnit}`}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
