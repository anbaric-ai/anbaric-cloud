import './Annotation.css'
import { type CSSProperties, type ReactNode } from 'react'

export type AnnotationTone = 'neutral' | 'primary' | 'warning' | 'danger'

export interface DiagramAnnotation {
  id: string
  /** Target point, in the diagram's own coordinate space. */
  x: number
  y: number
  title?: ReactNode
  detail?: ReactNode
  tone?: AnnotationTone
  /**
   * Emit a pulsing wave that ripples out from the target point — for problems
   * that need attention. Reads in the tone's colour (amber for `warning`, red
   * for `danger`). Ignored by `prefers-reduced-motion`.
   */
  pulse?: boolean
  /** Force which gutter the callout sits in. Defaults to the nearer side. */
  side?: 'left' | 'right'
}

export interface AnnotatedDiagramProps {
  /** The diagram's intrinsic coordinate size (its own viewBox is 0 0 w h). */
  width: number
  height: number
  annotations: DiagramAnnotation[]
  /** SVG diagram content, authored in [0..width] × [0..height]. */
  children?: ReactNode
  /** Width of each label gutter. */
  gutter?: number
  /** Minimum vertical spacing between stacked labels. */
  labelGap?: number
  className?: string
  style?: CSSProperties
}

const LABEL_H = 44
const CARD_PAD = 10

/** Greedy top-down declutter: keep each label ≥ gap below the previous one. */
function stack(targets: number[], gap: number, min: number, max: number): number[] {
  const order = targets.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y)
  let prev = -Infinity
  const out = new Array(targets.length)
  for (const { y, i } of order) {
    const slot = Math.min(Math.max(y, prev + gap, min), max)
    out[i] = slot
    prev = slot
  }
  return out
}

/**
 * 45°-elbow leader from a target point out to a label anchored at the gutter
 * boundary. Legible technical-drawing style: straight runs joined by a single
 * 45° bend — never a curve.
 */
function leaderPoints(
  tx: number,
  ty: number,
  boundaryX: number,
  labelY: number,
  dir: 1 | -1,
): string {
  const v = labelY - ty
  const av = Math.abs(v)
  const room = dir * (boundaryX - tx)
  const pts: [number, number][] = [[tx, ty]]
  if (room >= av) {
    // horizontal run, then a 45° diagonal into the boundary
    pts.push([boundaryX - dir * av, ty])
    pts.push([boundaryX, labelY])
  } else {
    // tight: 45° diagonal off the target, then a vertical drop to the label
    pts.push([boundaryX, ty + Math.sign(v) * room])
    pts.push([boundaryX, labelY])
  }
  return 'M' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L ')
}

/**
 * AnnotatedDiagram — overlays leader lines and labels onto an SVG diagram.
 * Labels are collected into left/right gutters and vertically decluttered so
 * they never overlap; leaders use 45° elbows for a clean, legible read.
 *
 * For the clearest result, where the diagram allows: keep every callout on the
 * same side (pass the same `side`) so the labels align into one column, and
 * keep that gutter outside the diagram's outline rather than over it, so a
 * label never obscures the part it points to.
 */
export function AnnotatedDiagram({
  width,
  height,
  annotations,
  children,
  gutter = 168,
  labelGap = 52,
  className,
  style,
}: AnnotatedDiagramProps) {
  const withSide = annotations.map((a) => ({
    ...a,
    resolvedSide: a.side ?? (a.x < width / 2 ? 'left' : 'right'),
  }))
  const left = withSide.filter((a) => a.resolvedSide === 'left')
  const right = withSide.filter((a) => a.resolvedSide === 'right')

  const leftG = left.length ? gutter : 0
  const rightG = right.length ? gutter : 0
  const vbW = leftG + width + rightG
  const vbH = height

  const leftY = stack(left.map((a) => a.y), labelGap, LABEL_H / 2, vbH - LABEL_H / 2)
  const rightY = stack(right.map((a) => a.y), labelGap, LABEL_H / 2, vbH - LABEL_H / 2)

  const renderSide = (
    items: typeof withSide,
    slots: number[],
    dir: 1 | -1,
  ) =>
    items.map((a, i) => {
      const tx = leftG + a.x
      const ty = a.y
      const boundaryX = dir === 1 ? leftG + width : leftG
      const labelY = slots[i]
      const labelX = dir === 1 ? boundaryX + CARD_PAD : boundaryX - CARD_PAD - (gutter - CARD_PAD * 2)
      return (
        <g key={a.id} className={`ds-annot__item ds-annot__item--${a.tone ?? 'neutral'}`}>
          <path className="ds-annot__leader" d={leaderPoints(tx, ty, boundaryX, labelY, dir)} />
          <circle className="ds-annot__anchor" cx={boundaryX} cy={labelY} r={2.5} />
          <foreignObject
            x={labelX}
            y={labelY - LABEL_H / 2}
            width={gutter - CARD_PAD * 2}
            height={LABEL_H}
          >
            <div className={`ds-annot__callout ds-annot__callout--${dir === 1 ? 'right' : 'left'}`}>
              {a.title ? <span className="ds-annot__title">{a.title}</span> : null}
              {a.detail ? <span className="ds-annot__detail">{a.detail}</span> : null}
            </div>
          </foreignObject>
        </g>
      )
    })

  return (
    <svg
      className={['ds-annot', className].filter(Boolean).join(' ')}
      viewBox={`0 0 ${vbW} ${vbH}`}
      style={style}
      role="img"
    >
      <g transform={`translate(${leftG} 0)`}>{children}</g>

      {withSide.map((a) => {
        const cx = leftG + a.x
        return (
          <g
            key={`m-${a.id}`}
            className={`ds-annot__marker ds-annot__marker--${a.tone ?? 'neutral'}${a.pulse ? ' is-pulsing' : ''}`}
          >
            {a.pulse
              ? [0, 1, 2].map((k) => (
                  <circle
                    key={k}
                    className="ds-annot__ripple"
                    cx={cx}
                    cy={a.y}
                    r={7}
                    style={{ animationDelay: `${k * 0.9}s` }}
                  />
                ))
              : null}
            <circle className="ds-annot__halo" cx={cx} cy={a.y} r={11} />
            <circle className="ds-annot__dot" cx={cx} cy={a.y} r={5} />
          </g>
        )
      })}

      {renderSide(left, leftY, -1)}
      {renderSide(right, rightY, 1)}
    </svg>
  )
}
