import { splitLabel } from '../scene/labels'

/** Textbook-style point label: italic serif with a real subscript (A₁). */
export function Label({ x, y, text, opacity = 1 }: { x: number; y: number; text: string; opacity?: number }) {
  const { base, sub } = splitLabel(text)
  return (
    <text x={x} y={y} className="point-label" opacity={opacity} textAnchor="middle" dominantBaseline="central">
      {base}
      {sub && (
        <tspan className="point-label-sub" dy="0.35em">
          {sub}
        </tspan>
      )}
    </text>
  )
}
