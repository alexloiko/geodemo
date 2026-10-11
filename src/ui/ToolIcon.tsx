import type { ToolId } from '../scene/tools'

const dot = (x: number, y: number, hollow = false) => (
  <circle cx={x} cy={y} r={2.2} fill={hollow ? '#fff' : 'currentColor'} strokeWidth={hollow ? 1.6 : 0} />
)

/** Small line-art icons for the tool buttons. */
export function ToolIcon({ tool }: { tool: ToolId }) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {ICONS[tool]}
    </svg>
  )
}

const ICONS: Record<ToolId, React.ReactNode> = {
  select: <path d="M5 3l14 8-6 2-2 6z" />,
  point: (
    <>
      <path d="M3 18L21 6" opacity={0.5} />
      {dot(12, 12, true)}
    </>
  ),
  segment: (
    <>
      <path d="M5 19L19 5" />
      {dot(5, 19)}
      {dot(19, 5)}
    </>
  ),
  line: (
    <>
      <path d="M2 22L22 2" />
      {dot(9, 15)}
      {dot(15, 9)}
    </>
  ),
  ray: (
    <>
      <path d="M5 19L22 2" />
      {dot(5, 19)}
      {dot(13, 11)}
    </>
  ),
  polygon: <path d="M4 18L8 5l11 3 1 9z" fill="currentColor" fillOpacity={0.15} />,
  midpoint: (
    <>
      <path d="M3 19L21 5" />
      {dot(3, 19)}
      {dot(21, 5)}
      {dot(12, 12, true)}
    </>
  ),
  perpendicular: (
    <>
      <path d="M2 19h20M11 19V3" />
      <path d="M11 15h4v4" strokeWidth={1.3} />
    </>
  ),
  parallel: <path d="M2 17L18 3M6 21L22 7" />,
  perpBisector: (
    <>
      <path d="M3 16h18M12 3v18" />
      {dot(3, 16)}
      {dot(21, 16)}
      <path d="M7 14v4M17 14v4" strokeWidth={1.3} />
    </>
  ),
  angleBisector: (
    <>
      <path d="M3 20L21 20M3 20L15 4" />
      <path d="M3 20L22 11" strokeDasharray="2 2.5" />
    </>
  ),
  intersect: (
    <>
      <path d="M3 20L21 4M3 6l18 12" />
      {dot(12, 12, true)}
    </>
  ),
  circleCP: (
    <>
      <circle cx={12} cy={12} r={8} />
      {dot(12, 12)}
      {dot(20, 12)}
    </>
  ),
  circle3: (
    <>
      <circle cx={12} cy={12} r={8} />
      {dot(4.5, 9)}
      {dot(17, 18.3)}
      {dot(15.5, 4.8)}
    </>
  ),
  circleCR: (
    <>
      <circle cx={12} cy={12} r={8} />
      <path d="M12 12l5.6 5.6" />
      {dot(12, 12)}
    </>
  ),
  tangent: (
    <>
      <circle cx={10} cy={13} r={6} />
      <path d="M2 4.5l20 2.5" />
      {dot(22, 7)}
    </>
  ),
  angle: (
    <>
      <path d="M3 20h18M3 20L16 5" />
      <path d="M10 20a7 7 0 0 0-2.3-5.2" />
    </>
  ),
  ratio: (
    <>
      <path d="M3 18h18" />
      <path d="M3 15q6-7 12 0" />
    </>
  ),
  ticks: (
    <>
      <path d="M3 12h18" />
      <path d="M10 8v8M14 8v8" />
    </>
  ),
  plane: <path d="M3 16l6-9h12l-6 9z" fill="currentColor" fillOpacity={0.2} />,
  face: <path d="M5 8l7-4 7 4v8l-7 4-7-4z M5 8l7 4 7-4 M12 12v8" fill="currentColor" fillOpacity={0.1} />,
  trace: (
    <>
      <path d="M2 17l6-7h14l-6 7z" fill="currentColor" fillOpacity={0.15} />
      <path d="M8 2l6 18" />
      {dot(12.3, 14.6, true)}
    </>
  ),
  planesMeet: (
    <>
      <path d="M2 16l6-7h14l-6 7z" fill="currentColor" fillOpacity={0.12} />
      <path d="M10 3v15l4-4V2z" fill="currentColor" fillOpacity={0.25} />
      <path d="M7 12.5h11" strokeWidth={2.2} />
    </>
  ),
  parallelPlane: (
    <>
      <path d="M2 20l5-5h15l-5 5z" fill="currentColor" fillOpacity={0.12} />
      <path d="M2 10l5-5h15l-5 5z" fill="currentColor" fillOpacity={0.25} />
    </>
  ),
  perpPlane: (
    <>
      <path d="M2 19l6-6h14l-6 6z" fill="currentColor" fillOpacity={0.15} />
      <path d="M12 3v13" />
      {dot(12, 3)}
      <path d="M12 13h3l-1 2" strokeWidth={1.2} />
    </>
  ),
  lineAngle: (
    <>
      <path d="M2 19l6-6h14l-6 6z" fill="currentColor" fillOpacity={0.15} />
      <path d="M6 17L19 3" />
      <path d="M11 16a5 5 0 0 0-1.5-3.5" strokeWidth={1.3} />
    </>
  ),
  planePerpLine: (
    <>
      <path d="M3 7l5 13M8 4v14l8-4V0z" fill="currentColor" fillOpacity={0.2} />
      <path d="M2 11h20" />
    </>
  ),
  median: (
    <>
      <path d="M3 20L10 4l11 16z" />
      <path d="M10 4l5.5 16" />
      <path d="M12 18v4M19 18v4" strokeWidth={1.2} />
    </>
  ),
  altitude: (
    <>
      <path d="M3 20L9 4l12 16z" />
      <path d="M9 4v16" />
      <path d="M9 17h3v3" strokeWidth={1.2} />
    </>
  ),
  triBisector: (
    <>
      <path d="M3 20L9 4l12 16z" />
      <path d="M9 4l5 16" />
      <path d="M7.8 8a3 3 0 0 0 2.6.3" strokeWidth={1.2} />
    </>
  ),
  midline: (
    <>
      <path d="M3 20L12 4l9 16z" />
      <path d="M7.5 12h9" strokeWidth={2.2} />
    </>
  ),
  incircle: (
    <>
      <path d="M2 21L12 3l10 18z" />
      <circle cx={12} cy={15} r={5} />
    </>
  ),
  centroid: (
    <>
      <path d="M3 20L12 4l9 16z" />
      <path d="M12 4v16M3 20l13.5-8M21 20L7.5 12" strokeWidth={1} strokeDasharray="2 2" />
      {dot(12, 14.7)}
    </>
  ),
  orthocenter: (
    <>
      <path d="M3 20L10 4l11 16z" />
      <path d="M10 4v16M3 20l15-7.5" strokeWidth={1} strokeDasharray="2 2" />
      {dot(10, 16.5)}
    </>
  ),
  center: (
    <>
      <circle cx={12} cy={12} r={8} />
      {dot(12, 12, true)}
    </>
  ),
  reflectPoint: (
    <>
      <path d="M3 8l5-4 2 6z" />
      <path d="M21 16l-5 4-2-6z" opacity={0.6} />
      {dot(12, 12)}
    </>
  ),
  reflectLine: (
    <>
      <path d="M12 2v20" strokeDasharray="2.5 2" />
      <path d="M9 6L3 9l6 6z" />
      <path d="M15 6l6 3-6 6z" opacity={0.6} />
    </>
  ),
  rotate: (
    <>
      <path d="M5 13l4-7 3 6z" />
      <path d="M19 11a7 7 0 0 1-9 7" />
      <path d="M10 18l2-2.5M10 18l3 1" />
      {dot(14, 12)}
    </>
  ),
  translate: (
    <>
      <path d="M3 10l4-6 3 6z" />
      <path d="M14 20l4-6 3 6z" opacity={0.6} />
      <path d="M8 13l8 3" />
      <path d="M16 16l-3.2.4M16 16l-2-2.5" />
    </>
  ),
  dilate: (
    <>
      {dot(3, 20)}
      <path d="M3 20L21 4M3 20l16 0" strokeDasharray="2 2" strokeWidth={1} />
      <path d="M8 16l3-3 1 4z" />
      <path d="M13 12l6-6 2 8z" opacity={0.6} />
    </>
  ),
  vector: (
    <>
      <path d="M4 19L19 5" />
      <path d="M19 5l-6 1.5M19 5l-1.5 6" />
      {dot(4, 19)}
    </>
  ),
  vectorSum: (
    <>
      <path d="M3 19l9-10M12 9l9 4" />
      <path d="M3 19l18-6" strokeWidth={2.2} />
      <path d="M21 13l-5.5-.3M21 13l-4 3.5" />
    </>
  ),
  length: (
    <>
      <path d="M3 15h18" />
      <path d="M3 12v6M21 12v6" />
      <path d="M8 9h8" strokeWidth={1.3} />
      <text x={12} y={8} fontSize={7} textAnchor="middle" stroke="none" fill="currentColor">
        5
      </text>
    </>
  ),
  area: (
    <>
      <path d="M4 18L8 6l12 3-2 9z" fill="currentColor" fillOpacity={0.2} />
      <text x={12} y={15.5} fontSize={8} textAnchor="middle" stroke="none" fill="currentColor">
        S
      </text>
    </>
  ),
  text: (
    <text x={12} y={18} fontSize={16} textAnchor="middle" stroke="none" fill="currentColor" fontFamily="serif">
      T
    </text>
  ),
}
