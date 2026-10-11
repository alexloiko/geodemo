import { splitLabel } from '../scene/labels'

/** Textbook-style point label: italic serif with a real subscript (A₁). */
export function Label({ x, y, text, suffix, opacity = 1 }: { x: number; y: number; text: string; suffix?: string; opacity?: number }) {
  const { base, sub } = splitLabel(text)
  return (
    <text x={x} y={y} className="point-label" opacity={opacity} textAnchor="middle" dominantBaseline="central">
      {base}
      {sub && (
        <tspan className="point-label-sub" dy="0.35em">
          {sub}
        </tspan>
      )}
      {suffix && (
        <tspan className="point-label-coords" dy={sub ? '-0.35em' : undefined}>
          {suffix}
        </tspan>
      )}
    </text>
  )
}
