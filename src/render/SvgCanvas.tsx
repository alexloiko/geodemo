import { useEffect, useMemo, useRef, useState } from 'react'
import { boundingRadius, edgesOf, faceNormal, halfSpaces, solidCenter } from '../geometry/polyhedron'
import { type Vec3, add, dot, scale, sub } from '../geometry/vec'
import { splitByVisibility } from '../geometry/visibility'
import { evaluate } from '../scene/evaluate'
import { depsOf, type Item, type PointItem, type PointRef, parseVertexRef } from '../scene/model'
import { makePointOnSegment } from '../scene/build'
import { useStore } from '../store/store'
import { makeProjector } from './camera'
import { Label } from './Label'

type P2 = [number, number]
type Look = 'normal' | 'dim' | 'hidden'

const GRID = 28
const SELECT_HALO = '#ffd54a'
const PENDING = '#f08c00'

/** Snap t to simple fractions (1/2, 1/3, 2/5 …) when close enough; clamp to [0, 1] unless on a line. */
function snapT(t: number, line = false): number {
  if (line && (t < 0 || t > 1)) return t
  let best = t
  let bestD = 0.02
  for (let den = 2; den <= 6; den++)
    for (let num = 1; num < den; num++) {
      const d = Math.abs(t - num / den)
      if (d < bestD) {
        bestD = d
        best = num / den
      }
    }
  return Math.min(1, Math.max(0, best))
}

/** Parameter of the projection of m onto screen segment a–b. */
function tOnScreen(m: P2, a: P2, b: P2): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const l2 = dx * dx + dy * dy || 1
  return ((m[0] - a[0]) * dx + (m[1] - a[1]) * dy) / l2
}

export function SvgCanvas() {
  const st = useStore()
  const { doc, camera, selection, mode, tool, pending, showGrid, dashedHidden } = st
  const wrap = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState({ w: 800, h: 600 })
  const [hover, setHover] = useState<{ a: PointRef; b: PointRef; t: number; line: boolean } | null>(null)
  const drag = useRef<
    | { kind: 'rotate'; x: number; y: number; moved: boolean }
    | { kind: 'point'; id: string; a: PointRef; b: PointRef; line: boolean; moved: boolean }
    | null
  >(null)

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const ev = useMemo(() => evaluate(doc), [doc])
  const pr = useMemo(() => makeProjector(camera), [camera])
  const solid = ev.solid
  const R = useMemo(() => boundingRadius(solid), [solid])
  const hs = useMemo(() => halfSpaces(solid), [solid])
  const center3 = useMemo(() => solidCenter(solid), [solid])

  const k = (camera.zoom * Math.min(size.w, size.h) * 0.34) / R
  const c2 = pr.project(center3)
  const S = (p: Vec3): P2 => {
    const q = pr.project(p)
    return [size.w / 2 + (q[0] - c2[0]) * k, size.h / 2 - (q[1] - c2[1]) * k]
  }
  const centerS: P2 = [size.w / 2, size.h / 2]

  // ---- display filtering -------------------------------------------------
  const relevant = useMemo(() => {
    const set = new Set(selection)
    for (const it of doc.items) if (set.has(it.id)) for (const d of depsOf(it)) set.add(d)
    // Section points belong to their plane.
    for (const it of doc.items)
      if (it.type === 'point' && it.def.kind === 'edgePlane' && selection.includes(it.def.plane)) set.add(it.id)
    return set
  }, [selection, doc.items])
  const filtering = mode !== 'all' && selection.length > 0
  const look = (it: Item): Look => {
    if (!it.visible) return 'hidden'
    if (!filtering || relevant.has(it.id)) return 'normal'
    if (it.type === 'point' && doc.items.some((o) => relevant.has(o.id) && dependsOnRef(o, it.id))) return 'normal'
    return mode === 'focus' ? 'dim' : 'hidden'
  }
  const opacityOf = (l: Look) => (l === 'dim' ? 0.18 : 1)

  // ---- interaction -------------------------------------------------------
  const local = (e: React.PointerEvent | React.MouseEvent): P2 => {
    const r = svgRef.current!.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top]
  }

  const onBgDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    drag.current = { kind: 'rotate', x: e.clientX, y: e.clientY, moved: false }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    if (d.kind === 'rotate') {
      const dx = e.clientX - d.x
      const dy = e.clientY - d.y
      if (!d.moved && Math.hypot(dx, dy) < 3) return
      d.moved = true
      d.x = e.clientX
      d.y = e.clientY
      st.setCamera({
        yaw: camera.yaw + dx * 0.4,
        pitch: Math.max(-85, Math.min(85, camera.pitch + dy * 0.4)),
      })
    } else {
      const pa = ev.points.get(d.a)
      const pb = ev.points.get(d.b)
      if (!pa || !pb) return
      if (!d.moved) st.checkpoint()
      d.moved = true
      const t = snapT(tOnScreen(local(e), S(pa), S(pb)), d.line)
      const it = doc.items.find((i) => i.id === d.id) as PointItem
      st.updateItem(d.id, { def: { ...it.def, t } } as Partial<Item>, true)
    }
  }
  const onUp = () => {
    const d = drag.current
    drag.current = null
    if (d?.kind === 'rotate' && !d.moved) st.select(null)
  }
  const onWheel = (e: React.WheelEvent) => {
    st.setCamera({ zoom: Math.max(0.3, Math.min(4, camera.zoom * Math.exp(-e.deltaY * 0.0015))) })
  }

  const clickPoint = (ref: PointRef, e: React.PointerEvent) => {
    e.stopPropagation()
    if (tool === 'select') {
      st.select(ref, e.shiftKey || e.metaKey || e.ctrlKey)
      const it = doc.items.find((i) => i.id === ref)
      if (it?.type === 'point' && it.def.kind === 'onSegment') {
        drag.current = { kind: 'point', id: it.id, a: it.def.a, b: it.def.b, line: !!it.def.line, moved: false }
        ;(e.target as Element).setPointerCapture?.(e.pointerId)
      }
    } else if (tool !== 'point') st.pick(ref)
  }
  const clickItem = (id: string, e: React.PointerEvent) => {
    if (tool !== 'select') return
    e.stopPropagation()
    st.select(id, e.shiftKey || e.metaKey || e.ctrlKey)
  }
  /** Point-tool handlers for anything a point can sit on: edges, segments, section sides, lines. */
  const segHover = (a: PointRef, b: PointRef, line = false) => {
    const tAt = (e: React.PointerEvent) => {
      const pa = ev.points.get(a)!
      const pb = ev.points.get(b)!
      return snapT(tOnScreen(local(e), S(pa), S(pb)), line)
    }
    return {
      onPointerMove: (e: React.PointerEvent) => {
        if (tool !== 'point' || drag.current) return
        setHover({ a, b, t: tAt(e), line })
      },
      onPointerLeave: () => setHover(null),
      onPointerDown: (e: React.PointerEvent) => {
        if (tool !== 'point') return
        e.stopPropagation()
        const t = tAt(e)
        if (t === 0 || t === 1 || (!line && (t < 0 || t > 1))) return
        st.addItems([makePointOnSegment(doc, a, b, t, undefined, line)])
      },
    }
  }

  // ---- geometry → SVG ----------------------------------------------------
  const pieces = (a: Vec3, b: Vec3) => splitByVisibility(hs, pr.toViewer, a, b, R)
  const line = (a: Vec3, b: Vec3, props: React.SVGProps<SVGLineElement>, key: string) => {
    const [x1, y1] = S(a)
    const [x2, y2] = S(b)
    return <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} {...props} />
  }
  const dashedFor = (hidden: boolean) => (hidden && dashedHidden ? '7 6' : undefined)
  const drawPieces = (a: Vec3, b: Vec3, stroke: string, width: number, key: string, op = 1) =>
    pieces(a, b).map((pc, i) =>
      pc.hidden && !dashedHidden
        ? null
        : line(
            pc.a,
            pc.b,
            {
              stroke,
              strokeWidth: pc.hidden ? width * 0.85 : width,
              strokeDasharray: dashedFor(pc.hidden),
              strokeLinecap: 'round',
              opacity: op,
            },
            `${key}-${i}`,
          ),
    )
  const poly = (pts: Vec3[]) => pts.map((p) => S(p).join(',')).join(' ')

  const faceVisible = solid.faces.map((_, i) => dot(faceNormal(solid, i), pr.toViewer) > 1e-9)
  const edges = edgesOf(solid)
  const figureOp = filtering && mode === 'focus' ? 0.55 : 1

  const fills: React.ReactNode[] = []
  const strokes: React.ReactNode[] = []
  const underlays: React.ReactNode[] = []
  const hits: React.ReactNode[] = []
  const arcs: React.ReactNode[] = []

  // Figure edges.
  for (const e of edges) {
    const hidden = !faceVisible[e.faces[0]] && !faceVisible[e.faces[1]]
    if (hidden && !dashedHidden) continue
    strokes.push(
      line(
        solid.vertices[e.a].pos,
        solid.vertices[e.b].pos,
        {
          stroke: '#111',
          strokeWidth: hidden ? 1.6 : 2,
          strokeDasharray: dashedFor(hidden),
          strokeLinecap: 'round',
          opacity: figureOp,
        },
        `e${e.a}-${e.b}`,
      ),
    )
    if (tool === 'point') {
      const [a, b] = [`v${e.a}`, `v${e.b}`]
      hits.push(line(solid.vertices[e.a].pos, solid.vertices[e.b].pos, { className: 'hit-line', ...segHover(a, b) }, `he${e.a}-${e.b}`))
    }
  }

  for (const it of doc.items) {
    const l = look(it)
    if (l === 'hidden' || ev.invalid.has(it.id)) continue
    const op = opacityOf(l)
    const sel = selection.includes(it.id)
    switch (it.type) {
      case 'face': {
        const pts = solid.faces[it.face]?.map((i) => solid.vertices[i].pos)
        if (!pts) break
        fills.push(
          <polygon
            key={it.id}
            points={poly(pts)}
            fill={it.color}
            fillOpacity={0.32 * op}
            stroke={sel ? SELECT_HALO : 'none'}
            strokeWidth={sel ? 4 : 0}
            onPointerDown={(e) => clickItem(it.id, e)}
            className={tool === 'select' ? 'clickable' : undefined}
          />,
        )
        break
      }
      case 'plane': {
        const pl = ev.planes.get(it.id)
        if (!pl) break
        if (it.extend && pl.extension.length >= 3)
          fills.push(
            <polygon key={`${it.id}-x`} points={poly(pl.extension)} fill={it.color} fillOpacity={0.14 * op} />,
          )
        const sec = pl.section.map((v) => v.pos)
        if (sec.length >= 3) {
          fills.push(
            <polygon
              key={it.id}
              points={poly(sec)}
              fill={it.color}
              fillOpacity={0.3 * op}
              onPointerDown={(e) => clickItem(it.id, e)}
              className={tool === 'select' ? 'clickable' : undefined}
            />,
          )
          sec.forEach((p, i) => {
            const q = sec[(i + 1) % sec.length]
            if (sel) underlays.push(line(p, q, { stroke: SELECT_HALO, strokeWidth: 9, strokeLinecap: 'round' }, `${it.id}-u${i}`))
            strokes.push(...drawPieces(p, q, it.color, 2.4, `${it.id}-${i}`, op))
            const ra = pl.refs[i]
            const rb = pl.refs[(i + 1) % sec.length]
            if (ra && rb)
              hits.push(
                line(
                  p,
                  q,
                  {
                    className: tool === 'select' || tool === 'point' ? 'hit-line' : 'hit-line off',
                    onPointerDown: (e: React.PointerEvent) => (tool === 'point' ? undefined : clickItem(it.id, e)),
                    ...(tool === 'point' ? segHover(ra, rb) : {}),
                  },
                  `h${it.id}-${i}`,
                ),
              )
          })
        }
        break
      }
      case 'segment':
      case 'line': {
        let a = ev.points.get(it.a)!
        let b = ev.points.get(it.b)!
        if (it.type === 'line') [a, b] = extendLine(a, b, center3, R * 1.5)
        const aux = it.type === 'line' || it.aux
        if (sel) underlays.push(line(a, b, { stroke: SELECT_HALO, strokeWidth: 9, strokeLinecap: 'round' }, `${it.id}-u`))
        strokes.push(...drawPieces(a, b, it.color, aux ? 1.6 : 2.4, it.id, op))
        hits.push(
          line(
            a,
            b,
            {
              className: tool === 'select' || tool === 'point' ? 'hit-line' : 'hit-line off',
              onPointerDown: (e: React.PointerEvent) => (tool === 'point' ? undefined : clickItem(it.id, e)),
              ...(tool === 'point' ? segHover(it.a, it.b, it.type === 'line') : {}),
            },
            `h${it.id}`,
          ),
        )
        break
      }
      case 'ratio': {
        const a = S(ev.points.get(it.a)!)
        const b = S(ev.points.get(it.b)!)
        arcs.push(
          <RatioArc key={it.id} a={a} b={b} away={centerS} color={it.color} text={it.text} opacity={op} selected={sel} onDown={(e) => clickItem(it.id, e)} />,
        )
        break
      }
    }
  }

  // Points: solid vertices + point items.
  const pointNodes: React.ReactNode[] = []
  const labelNodes: React.ReactNode[] = []
  const pointRefs: { ref: PointRef; item?: PointItem }[] = [
    ...solid.vertices.map((_, i) => ({ ref: `v${i}` })),
    ...doc.items.filter((i): i is PointItem => i.type === 'point').map((i) => ({ ref: i.id, item: i })),
  ]
  for (const { ref, item } of pointRefs) {
    const p = ev.points.get(ref)
    if (!p) continue
    const l = item ? look(item) : 'normal'
    if (l === 'hidden') continue
    const op = item ? opacityOf(l) : figureOp
    const [x, y] = S(p)
    const sel = selection.includes(ref)
    const pend = pending.includes(ref)
    const isVertex = parseVertexRef(ref) !== null
    const hollow = !isVertex || sel || pend
    const color = item?.color ?? (sel ? '#2f45d8' : '#111')
    pointNodes.push(
      <g key={ref} opacity={op}>
        {(sel || pend) && <circle cx={x} cy={y} r={10} fill={pend ? PENDING : SELECT_HALO} opacity={0.55} />}
        <circle
          cx={x}
          cy={y}
          r={hollow ? 4.6 : 3.2}
          fill={hollow ? '#fff' : color}
          stroke={color}
          strokeWidth={hollow ? 2.2 : 0}
        />
        <circle
          cx={x}
          cy={y}
          r={11}
          className={tool === 'point' ? 'hit-point off' : 'hit-point'}
          onPointerDown={(e) => clickPoint(ref, e)}
        />
      </g>,
    )
    const label = ev.labels.get(ref) ?? ''
    const dir = labelDir([x, y], centerS)
    labelNodes.push(<Label key={`L${ref}`} x={x + dir[0] * 17} y={y + dir[1] * 17} text={label} opacity={op} />)
  }

  // Hover preview for the point tool.
  let preview: React.ReactNode = null
  if (hover && tool === 'point') {
    const pa = ev.points.get(hover.a)
    const pb = ev.points.get(hover.b)
    if (pa && pb && hover.t !== 0 && hover.t !== 1 && (hover.line || (hover.t > 0 && hover.t < 1))) {
      const [x, y] = S(add(pa, scale(sub(pb, pa), hover.t)))
      preview = (
        <g pointerEvents="none">
          <circle cx={x} cy={y} r={5} fill="#fff" stroke={PENDING} strokeWidth={2} />
          <text x={x + 10} y={y - 10} className="hover-t">
            {fraction(hover.t)}
          </text>
        </g>
      )
    }
  }

  return (
    <div className="canvas-wrap" ref={wrap}>
      <svg
        ref={svgRef}
        width={size.w}
        height={size.h}
        className={`canvas tool-${tool}`}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onWheel={onWheel}
      >
        <defs>
          <pattern id="grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
            <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke="#c9d3de" strokeWidth={1} />
          </pattern>
        </defs>
        <rect width={size.w} height={size.h} fill={showGrid ? 'url(#grid)' : '#fff'} onPointerDown={onBgDown} className="bg" />
        <g>{fills}</g>
        <g>{underlays}</g>
        <g pointerEvents="none">{strokes}</g>
        <g>{hits}</g>
        <g>{arcs}</g>
        <g>{pointNodes}</g>
        <g pointerEvents="none">{labelNodes}</g>
        {preview}
      </svg>
    </div>
  )
}

function dependsOnRef(it: Item, ref: string) {
  return depsOf(it).includes(ref)
}

/** Unit screen direction from the figure centre towards the point. */
function labelDir(p: P2, c: P2): P2 {
  const dx = p[0] - c[0]
  const dy = p[1] - c[1]
  const l = Math.hypot(dx, dy)
  return l < 1 ? [0.7, -0.7] : [dx / l, dy / l]
}

/** Clip the infinite line through a, b to a sphere of radius r around c. */
function extendLine(a: Vec3, b: Vec3, c: Vec3, r: number): [Vec3, Vec3] {
  const d = sub(b, a)
  const dd = dot(d, d)
  const w = sub(a, c)
  const bq = dot(w, d)
  const disc = bq * bq - dd * (dot(w, w) - r * r)
  let t0 = 0
  let t1 = 1
  if (disc > 0) {
    const s = Math.sqrt(disc)
    t0 = Math.min(0, (-bq - s) / dd)
    t1 = Math.max(1, (-bq + s) / dd)
  }
  return [add(a, scale(d, t0)), add(a, scale(d, t1))]
}

function fraction(t: number): string {
  for (let den = 2; den <= 6; den++)
    for (let num = 1; num < den; num++)
      if (Math.abs(t - num / den) < 1e-9) return `${num}:${den - num}`
  return `${Math.round(t * 100)}%`
}

function RatioArc(props: {
  a: P2
  b: P2
  away: P2
  color: string
  text: string
  opacity: number
  selected: boolean
  onDown: (e: React.PointerEvent) => void
}) {
  const { a, b, away, color, text, opacity, selected, onDown } = props
  const mx = (a[0] + b[0]) / 2
  const my = (a[1] + b[1]) / 2
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const l = Math.hypot(dx, dy) || 1
  let nx = -dy / l
  let ny = dx / l
  if (nx * (mx - away[0]) + ny * (my - away[1]) < 0) {
    nx = -nx
    ny = -ny
  }
  const h = Math.max(7, Math.min(20, l * 0.16))
  const cx = mx + nx * h * 2
  const cy = my + ny * h * 2
  const d = `M ${a[0]} ${a[1]} Q ${cx} ${cy} ${b[0]} ${b[1]}`
  return (
    <g opacity={opacity} onPointerDown={onDown} className="clickable">
      {selected && <path d={d} fill="none" stroke={SELECT_HALO} strokeWidth={8} />}
      <path d={d} fill="none" stroke={color} strokeWidth={2} />
      <path d={d} fill="none" stroke="transparent" strokeWidth={12} />
      <text x={mx + nx * (h + 13)} y={my + ny * (h + 13)} className="ratio-text" fill="#111">
        {text}
      </text>
    </g>
  )
}
