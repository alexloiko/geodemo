import { useEffect, useMemo, useRef, useState } from 'react'
import { type Circle3, angleOnCircle, pointOnCircle, sampleCircle } from '../geometry/circle'
import { type Line3, angleDeg, pointAt } from '../geometry/lines'
import type { Plane } from '../geometry/plane'
import { boundingRadius, edgesOf, faceNormal, solidCenter } from '../geometry/polyhedron'
import { type Vec3, add, cross, dot, len, lerp, normalize, scale, sub } from '../geometry/vec'
import { contourGeneratrices, frontHit, sphereOutline, surfaceParams } from '../geometry/revolution'
import { makeOccluder, splitByVisibility } from '../geometry/visibility'
import { type EvLine, evaluate, resolveLine, resolvePlane } from '../scene/evaluate'
import { type Item, type LineRef, type PointItem, type PointRef, depsOf, pairRef, parseVertexRef } from '../scene/model'
import { nextSlot, toolById } from '../scene/tools'
import { useStore } from '../store/store'
import { SHEET_PROJECTOR, makeProjector } from './camera'
import { Label } from './Label'
import { prettyLabel } from '../scene/labels'

type P2 = [number, number]
type Look = 'normal' | 'dim' | 'hidden'

const GRID = 28
const SELECT_HALO = '#ffd54a'
const PENDING = '#f08c00'
const DRAGGABLE = ['onSegment', 'onLine', 'onCircle', 'free', 'onSurface']

/** Snap t to simple fractions (1/2, 1/3, 2/5 …) when close enough; clamp to [0, 1] when bounded. */
function snapT(t: number, bounded: boolean): number {
  if (!bounded && (t < 0 || t > 1)) return t
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
  return bounded ? Math.min(1, Math.max(0, best)) : best
}

/** Parameter of the projection of m onto screen line a→b (t = 0 at a, 1 at b). */
function tOnScreen(m: P2, a: P2, b: P2): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const l2 = dx * dx + dy * dy || 1
  return ((m[0] - a[0]) * dx + (m[1] - a[1]) * dy) / l2
}

const ptsAttr = (pts: P2[]) => pts.map((p) => `${p[0]},${p[1]}`).join(' ')

type Drag =
  | { kind: 'view'; x: number; y: number; moved: boolean }
  | { kind: 'point'; item: PointItem; moved: boolean }
  | { kind: 'text'; id: string; moved: boolean }

export function SvgCanvas() {
  const st = useStore()
  const { doc, camera, selection, mode, tool, picks, showGrid, dashedHidden, snapGrid, showAxes } = st
  const wrap = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState({ w: 800, h: 600 })
  const [hover, setHover] = useState<Vec3 | null>(null)
  const drag = useRef<Drag | null>(null)

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const ev = useMemo(() => evaluate(doc), [doc])
  const solid = ev.solid
  const sheet = !solid
  const pr = useMemo(() => (sheet ? SHEET_PROJECTOR : makeProjector(camera)), [sheet, camera])
  const R = useMemo(() => (solid ? boundingRadius(solid) : 10), [solid])
  const hidden = useMemo(() => makeOccluder(solid, pr.toViewer), [solid, pr])
  const center3: Vec3 = useMemo(() => (solid ? solidCenter(solid) : [0, 0, 0]), [solid])

  // ---- world ↔ screen ----------------------------------------------------
  const k = sheet ? GRID * camera.zoom : (camera.zoom * Math.min(size.w, size.h) * 0.34) / R
  const c2 = pr.project(center3)
  const ox = size.w / 2 + camera.pan[0]
  const oy = size.h / 2 + camera.pan[1]
  const S = (p: Vec3): P2 => {
    const q = pr.project(p)
    return [ox + (q[0] - c2[0]) * k, oy - (q[1] - c2[1]) * k]
  }
  const centerS = S(center3)
  /** Screen point → world point on a plane (parallel projection is affine, so solve 2×2). */
  const unproject = (m: P2, pl: Plane): Vec3 => {
    const n = pl.n
    const ref: Vec3 = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]
    const u = normalize(cross(n, ref))
    const v = cross(n, u)
    const O = scale(n, pl.d)
    const s0 = S(O)
    const su = S(add(O, u))
    const sv = S(add(O, v))
    const a = [su[0] - s0[0], su[1] - s0[1]]
    const b = [sv[0] - s0[0], sv[1] - s0[1]]
    const det = a[0] * b[1] - a[1] * b[0] || 1e-12
    const rx = m[0] - s0[0]
    const ry = m[1] - s0[1]
    const x = (rx * b[1] - ry * b[0]) / det
    const y = (a[0] * ry - a[1] * rx) / det
    return add(O, add(scale(u, x), scale(v, y)))
  }
  const sheetPoint = (m: P2): Vec3 => {
    let x = (m[0] - ox) / k
    let y = -(m[1] - oy) / k
    if (snapGrid) {
      const rx = Math.round(x)
      const ry = Math.round(y)
      if (Math.hypot(rx - x, ry - y) < 0.25) [x, y] = [rx, ry]
    }
    return [x, y, 0]
  }

  // ---- visibility --------------------------------------------------------
  const pieces = (a: Vec3, b: Vec3) => (solid ? splitByVisibility(hidden, a, b) : [{ a, b, hidden: false }])
  const hiddenPt = hidden

  // ---- display filtering -------------------------------------------------
  const relevant = useMemo(() => {
    const set = new Set(selection)
    for (const it of doc.items) if (set.has(it.id)) for (const d of depsOf(it)) set.add(d)
    for (const it of doc.items)
      if (it.type === 'point' && (it.def.kind === 'edgePlane' || it.def.kind === 'circlePlane') && selection.includes(it.def.plane))
        set.add(it.id)
    return set
  }, [selection, doc.items])
  const filtering = mode !== 'all' && selection.length > 0
  const look = (it: Item): Look => {
    if (!it.visible) return 'hidden'
    if (!filtering || relevant.has(it.id)) return 'normal'
    return mode === 'focus' ? 'dim' : 'hidden'
  }
  const opacityOf = (l: Look) => (l === 'dim' ? 0.18 : 1)

  // ---- tool state --------------------------------------------------------
  const slot = tool === 'select' ? null : nextSlot(toolById(tool), picks)
  const wantsPoint = slot === 'point'
  const wantsLine = slot === 'line' || slot === 'curve' || slot === 'object'
  const wantsCircle = slot === 'circle' || slot === 'curve' || slot === 'object'
  const wantsPlane = slot === 'plane'
  const wantsObject = slot === 'object'
  const wantsVector = slot === 'vector'
  const wantsPolygon = slot === 'polygon'
  const pickedRefs = new Set(picks.map((p) => (p.kind === 'face' ? `f${p.face}` : p.ref)))
  const pickedFace = (f: number) => pickedRefs.has(`f${f}`)

  // ---- interaction -------------------------------------------------------
  const local = (e: React.PointerEvent | React.MouseEvent): P2 => {
    const r = svgRef.current!.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top]
  }
  const additive = (e: React.PointerEvent) => e.shiftKey || e.metaKey || e.ctrlKey

  const onBgDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    drag.current = { kind: 'view', x: e.clientX, y: e.clientY, moved: false }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    if (d.kind === 'view') {
      const dx = e.clientX - d.x
      const dy = e.clientY - d.y
      if (!d.moved && Math.hypot(dx, dy) < 3) return
      d.moved = true
      d.x = e.clientX
      d.y = e.clientY
      if (sheet || e.shiftKey) st.setCamera({ pan: [camera.pan[0] + dx, camera.pan[1] + dy] })
      else st.setCamera({ yaw: camera.yaw + dx * 0.4, pitch: Math.max(-85, Math.min(85, camera.pitch + dy * 0.4)) })
      return
    }
    if (d.kind === 'text') {
      if (!d.moved) st.checkpoint()
      d.moved = true
      const m = local(e)
      const n = normalize(pr.toViewer)
      st.updateItem(d.id, { pos: sheet ? sheetPoint(m) : unproject(m, { n, d: dot(n, center3) }) } as Partial<Item>, true)
      return
    }
    const def = dragDef(d.item, local(e))
    if (!def) return
    if (!d.moved) st.checkpoint()
    d.moved = true
    st.updateItem(d.item.id, { def } as Partial<Item>, true)
  }
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current
    drag.current = null
    if (d?.kind !== 'view' || d.moved) return
    if (tool === 'select') st.select(null)
    else {
      const m = local(e)
      const n = normalize(pr.toViewer)
      st.hit({ kind: 'empty', pos: sheet ? sheetPoint(m) : null, spot: sheet ? sheetPoint(m) : unproject(m, { n, d: dot(n, center3) }) })
    }
  }
  const onWheel = (e: React.WheelEvent) => {
    st.setCamera({ zoom: Math.max(0.3, Math.min(5, camera.zoom * Math.exp(-e.deltaY * 0.0015))) })
  }

  /** Angle on a circle closest to a screen point. */
  const angleAt = (c: Circle3, m: P2): number => {
    const samples = sampleCircle(c, 180)
    let best = 0
    let bestD = Infinity
    samples.forEach((p, i) => {
      const s = S(p)
      const dd = Math.hypot(s[0] - m[0], s[1] - m[1])
      if (dd < bestD) {
        bestD = dd
        best = i
      }
    })
    return angleOnCircle(c, samples[best])
  }

  /** New definition of a dragged point for the mouse position. */
  const dragDef = (it: PointItem, m: P2): PointItem['def'] | null => {
    const d = it.def
    switch (d.kind) {
      case 'onSegment': {
        const [pa, pb] = [ev.points.get(d.a), ev.points.get(d.b)]
        return pa && pb ? { ...d, t: snapT(tOnScreen(m, S(pa), S(pb)), !d.line) } : null
      }
      case 'onLine': {
        const l = resolveLine(ev, d.line)
        return l ? { ...d, t: tOnScreen(m, S(l.p), S(pointAt(l, 1))) } : null
      }
      case 'onCircle': {
        const c = ev.circles.get(d.circle)
        return c ? { ...d, angle: angleAt(c, m) } : null
      }
      case 'onSurface': {
        const hit = surfaceHit(m)
        return hit?.part === 'curved' && solid?.rev ? { ...d, ...surfaceParams(solid.rev, hit.pos) } : null
      }
      case 'free': {
        if (!d.plane || d.plane === 'sheet') return { ...d, pos: sheetPoint(m) }
        const pl = resolvePlane(ev, d.plane)
        return pl ? { ...d, pos: unproject(m, pl) } : null
      }
      default:
        return null
    }
  }

  const onPointDown = (ref: PointRef, e: React.PointerEvent) => {
    e.stopPropagation()
    if (tool !== 'select') return st.hit({ kind: 'point', ref })
    st.select(ref, additive(e))
    const it = doc.items.find((i) => i.id === ref)
    if (it?.type === 'point' && DRAGGABLE.includes(it.def.kind)) {
      drag.current = { kind: 'point', item: it, moved: false }
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
    }
  }

  /** Hit area of something line-like. `select` is the item selected by the Select tool. */
  const lineHit = (a: Vec3, b: Vec3, ref: LineRef, bounded: boolean, select: string | null, key: string) => {
    const active = tool === 'select' ? !!select : wantsPoint || wantsLine
    const tAt = (e: React.PointerEvent) => {
      const l = resolveLine(ev, ref)!
      const t = tOnScreen(local(e), S(l.p), S(pointAt(l, 1)))
      return l.a && l.b ? snapT(t, bounded) : t
    }
    const [x1, y1] = S(a)
    const [x2, y2] = S(b)
    return (
      <line
        key={key}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        className={active ? 'hit-line' : 'hit-line off'}
        onPointerMove={(e) => {
          if (!wantsPoint || drag.current) return
          const t = tAt(e)
          setHover(bounded && (t <= 0 || t >= 1) ? null : pointAt(resolveLine(ev, ref)!, t))
        }}
        onPointerLeave={() => setHover(null)}
        onPointerDown={(e) => {
          if (tool === 'select') {
            if (!select) return
            e.stopPropagation()
            return st.select(select, additive(e))
          }
          if (!wantsPoint && !wantsLine) return
          e.stopPropagation()
          st.hit({ kind: 'line', ref, t: tAt(e), bounded })
        }}
      />
    )
  }

  /** First point of a body of revolution under the mouse. */
  const surfaceHit = (m: P2) => {
    if (!solid?.rev) return null
    const n = normalize(pr.toViewer)
    const X = unproject(m, { n, d: dot(n, center3) })
    return frontHit(solid.rev, X, n)
  }

  const onFaceDown = (f: number, e: React.PointerEvent) => {
    if (solid?.smooth?.[f]) {
      // Curved surface: exact point on the body.
      if (!wantsPoint) return
      e.stopPropagation()
      const hit = surfaceHit(local(e))
      if (hit?.part === 'curved' && solid.rev) st.hit({ kind: 'surface', ...surfaceParams(solid.rev, hit.pos) })
      return
    }
    const pl = resolvePlane(ev, `f${f}`)
    if (!pl) return
    e.stopPropagation()
    st.hit({ kind: 'face', face: f, pos: unproject(local(e), pl) })
  }

  // ---- geometry → SVG ----------------------------------------------------
  const svgLine = (a: Vec3, b: Vec3, props: React.SVGProps<SVGLineElement>, key: string) => {
    const [x1, y1] = S(a)
    const [x2, y2] = S(b)
    return <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} {...props} />
  }
  const dashedFor = (hidden: boolean) => (hidden && dashedHidden ? '7 6' : undefined)
  const drawPieces = (a: Vec3, b: Vec3, stroke: string, width: number, key: string, op = 1) =>
    pieces(a, b).map((pc, i) =>
      pc.hidden && !dashedHidden
        ? null
        : svgLine(
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
  /** Closed curve split into visible / hidden runs. */
  const drawCurve = (pts: Vec3[], stroke: string, width: number, key: string, op = 1) => {
    const all = [...pts, pts[0]]
    const runs: { hidden: boolean; pts: Vec3[] }[] = []
    for (let i = 0; i < all.length - 1; i++) {
      const h = hiddenPt(lerp(all[i], all[i + 1], 0.5))
      const last = runs[runs.length - 1]
      if (last && last.hidden === h) last.pts.push(all[i + 1])
      else runs.push({ hidden: h, pts: [all[i], all[i + 1]] })
    }
    return runs.map((r, i) =>
      r.hidden && !dashedHidden ? null : (
        <polyline
          key={`${key}-${i}`}
          points={ptsAttr(r.pts.map(S))}
          fill="none"
          stroke={stroke}
          strokeWidth={r.hidden ? width * 0.85 : width}
          strokeDasharray={dashedFor(r.hidden)}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={op}
        />
      ),
    )
  }
  const poly = (pts: Vec3[]) => ptsAttr(pts.map(S))

  /** Visible extent of a segment / line / ray. */
  const lineExtent = (l: EvLine): [Vec3, Vec3] => {
    if (l.extent === 'segment') return [l.p, pointAt(l, 1)]
    const dir = normalize(l.d)
    let t0: number
    let t1: number
    if (sheet) {
      // Long enough to leave the viewport, measured from the screen centre's foot on the line.
      const big = Math.hypot(size.w, size.h) / k
      const c = sheetPoint([size.w / 2, size.h / 2])
      const mid = dot(sub(c, l.p), dir)
      ;[t0, t1] = [mid - big, mid + big]
    } else {
      const w = sub(l.p, center3)
      const bq = dot(w, dir)
      const off = len(sub(w, scale(dir, bq)))
      const r = Math.max(R * 1.5, off + R * 0.8)
      const s = Math.sqrt(Math.max(0, r * r - off * off))
      ;[t0, t1] = [-bq - s, -bq + s]
    }
    // Always include the defining points.
    const tb = len(l.d)
    t0 = Math.min(t0, 0)
    t1 = Math.max(t1, tb)
    if (l.extent === 'ray') t0 = 0
    return [add(l.p, scale(dir, t0)), add(l.p, scale(dir, t1))]
  }

  const faceVisible = solid ? solid.faces.map((_, i) => dot(faceNormal(solid, i), pr.toViewer) > 1e-9) : []
  const figureOp = filtering && mode === 'focus' ? 0.55 : 1

  const labelCenter: P2 = sheet ? sheetLabelAnchor() : centerS
  const fills: React.ReactNode[] = []
  const faceHits: React.ReactNode[] = []
  const strokes: React.ReactNode[] = []
  const underlays: React.ReactNode[] = []
  const hits: React.ReactNode[] = []
  const marks: React.ReactNode[] = []

  const halo = (a: Vec3, b: Vec3, key: string, color = SELECT_HALO) =>
    underlays.push(svgLine(a, b, { stroke: color, strokeWidth: 9, strokeLinecap: 'round', opacity: 0.75 }, key))

  // Solid edges and faces.
  if (solid?.rev) {
    const rev = solid.rev
    // Rims (base circles / equator): dashed where hidden, clickable like circles.
    ev.circles.forEach((c, ref) => {
      if (!ref.startsWith('rim')) return
      const pts = sampleCircle(c, 160)
      if (pickedRefs.has(ref))
        underlays.push(<polygon key={`pk${ref}`} points={poly(pts)} fill="none" stroke={PENDING} strokeWidth={8} opacity={0.6} />)
      strokes.push(...drawCurve(pts, '#111', 2, ref, figureOp))
      if (wantsPoint || wantsCircle)
        hits.push(
          <polygon
            key={`h${ref}`}
            points={poly(pts)}
            className="hit-curve"
            onPointerMove={(e) => wantsPoint && !drag.current && setHover(pointOnCircle(c, angleAt(c, local(e))))}
            onPointerLeave={() => setHover(null)}
            onPointerDown={(e) => {
              e.stopPropagation()
              st.hit({ kind: 'circle', ref, angle: angleAt(c, local(e)) })
            }}
          />,
        )
    })
    if (rev.kind === 'sphere') {
      const out = sampleCircle(sphereOutline(rev, pr.toViewer), 160)
      strokes.push(<polygon key="outline" points={poly(out)} fill="none" stroke="#111" strokeWidth={2} opacity={figureOp} />)
    } else
      contourGeneratrices(rev, pr.toViewer).forEach(([a, b], i) =>
        strokes.push(svgLine(a, b, { stroke: '#111', strokeWidth: 2, strokeLinecap: 'round', opacity: figureOp }, `gen${i}`)),
      )
    if (wantsPoint || slot === 'face' || wantsPlane)
      solid.faces.forEach((f, i) => {
        if (!faceVisible[i] || (!wantsPoint && solid.smooth?.[i])) return
        faceHits.push(
          <polygon key={`fh${i}`} points={poly(f.map((v) => solid.vertices[v].pos))} className="hit-face" onPointerDown={(e) => onFaceDown(i, e)} />,
        )
      })
  } else if (solid) {
    for (const e of edgesOf(solid)) {
      const hidden = !faceVisible[e.faces[0]] && !faceVisible[e.faces[1]]
      const [a, b] = [solid.vertices[e.a].pos, solid.vertices[e.b].pos]
      const ref = pairRef(`v${e.a}`, `v${e.b}`)
      if (pickedRefs.has(ref)) halo(a, b, `pk${ref}`, PENDING)
      if (!(hidden && !dashedHidden))
        strokes.push(
          svgLine(
            a,
            b,
            { stroke: '#111', strokeWidth: hidden ? 1.6 : 2, strokeDasharray: dashedFor(hidden), strokeLinecap: 'round', opacity: figureOp },
            `e${e.a}-${e.b}`,
          ),
        )
      hits.push(lineHit(a, b, ref, true, null, `he${e.a}-${e.b}`))
    }
    if (wantsPoint || slot === 'face' || wantsPlane)
      solid.faces.forEach((f, i) => {
        if (!faceVisible[i]) return
        faceHits.push(
          <polygon key={`fh${i}`} points={poly(f.map((v) => solid.vertices[v].pos))} className="hit-face" onPointerDown={(e) => onFaceDown(i, e)} />,
        )
      })
  }

  // Picked faces (plane slots) are tinted until the tool completes.
  if (solid)
    solid.faces.forEach((f, i) => {
      if (pickedFace(i))
        fills.push(<polygon key={`pf${i}`} points={poly(f.map((v) => solid.vertices[v].pos))} fill={PENDING} fillOpacity={0.28} pointerEvents="none" />)
    })

  for (const it of doc.items) {
    const l = look(it)
    if (l === 'hidden' || ev.invalid.has(it.id)) continue
    const op = opacityOf(l)
    const sel = selection.includes(it.id)
    const pend = pickedRefs.has(it.id)
    const clickSelect = (e: React.PointerEvent) => {
      if (wantsPlane && it.type === 'plane') {
        e.stopPropagation()
        return st.hit({ kind: 'plane', ref: it.id })
      }
      if ((wantsObject || wantsPolygon) && it.type === 'polygon') {
        e.stopPropagation()
        return st.hit({ kind: 'polygon', ref: it.id })
      }
      if (tool !== 'select') return
      e.stopPropagation()
      st.select(it.id, additive(e))
    }
    const selectable =
      tool === 'select' || (wantsPlane && it.type === 'plane') || ((wantsObject || wantsPolygon) && it.type === 'polygon')
        ? 'clickable'
        : undefined
    switch (it.type) {
      case 'face': {
        const pts = solid?.faces[it.face]?.map((i) => solid.vertices[i].pos)
        if (!pts) break
        fills.push(
          <polygon
            key={it.id}
            points={poly(pts)}
            fill={it.color}
            fillOpacity={0.32 * op}
            stroke={sel ? SELECT_HALO : 'none'}
            strokeWidth={sel ? 4 : 0}
            onPointerDown={clickSelect}
            className={selectable}
          />,
        )
        break
      }
      case 'plane': {
        const pl = ev.planes.get(it.id)
        if (!pl) break
        if (it.extend && pl.extension.length >= 3)
          fills.push(<polygon key={`${it.id}-x`} points={poly(pl.extension)} fill={it.color} fillOpacity={0.14 * op} />)
        if (pl.circle) {
          const pts = sampleCircle(pl.circle, 160)
          fills.push(<polygon key={it.id} points={poly(pts)} fill={pend ? PENDING : it.color} fillOpacity={0.3 * op} onPointerDown={clickSelect} className={selectable} />)
          if (sel) underlays.push(<polygon key={`${it.id}-u`} points={poly(pts)} fill="none" stroke={SELECT_HALO} strokeWidth={8} opacity={0.6} />)
          strokes.push(...drawCurve(pts, it.color, 2.4, it.id, op))
          break
        }
        const sec = pl.section.map((v) => v.pos)
        if (sec.length < 3) break
        fills.push(<polygon key={it.id} points={poly(sec)} fill={pend ? PENDING : it.color} fillOpacity={0.3 * op} onPointerDown={clickSelect} className={selectable} />)
        if (solid?.rev) strokes.push(...drawCurve(sec, it.color, 2.4, `${it.id}-c`, op))
        sec.forEach((p, i) => {
          const q = sec[(i + 1) % sec.length]
          if (sel) halo(p, q, `${it.id}-u${i}`)
          if (!solid?.rev) strokes.push(...drawPieces(p, q, it.color, 2.4, `${it.id}-${i}`, op))
          const [ra, rb] = [pl.refs[i], pl.refs[(i + 1) % sec.length]]
          if (ra && rb) hits.push(lineHit(p, q, pairRef(ra, rb), true, it.id, `h${it.id}-${i}`))
        })
        break
      }
      case 'polygon': {
        const pts = it.pts.map((r) => ev.points.get(r)!)
        fills.push(<polygon key={it.id} points={poly(pts)} fill={it.color} fillOpacity={0.18 * op} onPointerDown={clickSelect} className={selectable} />)
        pts.forEach((p, i) => {
          const q = pts[(i + 1) % pts.length]
          if (sel) halo(p, q, `${it.id}-u${i}`)
          strokes.push(...drawPieces(p, q, it.color, 2.2, `${it.id}-${i}`, op))
          hits.push(lineHit(p, q, pairRef(it.pts[i], it.pts[(i + 1) % pts.length]), true, it.id, `h${it.id}-${i}`))
        })
        break
      }
      case 'segment':
      case 'line': {
        const ln = ev.lines.get(it.id)!
        const [a, b] = lineExtent(ln)
        if (sel) halo(a, b, `${it.id}-u`)
        if (pend) halo(a, b, `${it.id}-p`, PENDING)
        strokes.push(...drawPieces(a, b, it.color, it.aux ? 1.6 : it.type === 'line' ? 1.8 : 2.4, it.id, op))
        hits.push(lineHit(a, b, it.id, it.type === 'segment', it.id, `h${it.id}`))
        break
      }
      case 'circle': {
        const c = ev.circles.get(it.id)!
        const pts = sampleCircle(c, 120)
        if (sel || pend)
          underlays.push(<polygon key={`${it.id}-u`} points={poly(pts)} fill="none" stroke={pend ? PENDING : SELECT_HALO} strokeWidth={8} opacity={0.6} />)
        strokes.push(...drawCurve(pts, it.color, 2, it.id, op))
        const active = tool === 'select' || wantsPoint || wantsCircle
        hits.push(
          <polygon
            key={`h${it.id}`}
            points={poly(pts)}
            className={active ? 'hit-curve' : 'hit-curve off'}
            onPointerMove={(e) => {
              if (!wantsPoint || drag.current) return
              setHover(pointOnCircle(c, angleAt(c, local(e))))
            }}
            onPointerLeave={() => setHover(null)}
            onPointerDown={(e) => {
              if (tool === 'select') {
                e.stopPropagation()
                return st.select(it.id, additive(e))
              }
              if (!wantsPoint && !wantsCircle) return
              e.stopPropagation()
              st.hit({ kind: 'circle', ref: it.id, angle: angleAt(c, local(e)) })
            }}
          />,
        )
        break
      }
      case 'angle': {
        const [a, o, b] = [ev.points.get(it.a)!, ev.points.get(it.vertex)!, ev.points.get(it.b)!]
        marks.push(
          <g key={it.id} opacity={op} onPointerDown={clickSelect} className={selectable}>
            {angleMark(a, o, b, it.arcs, it.color, sel, it.showValue)}
          </g>,
        )
        break
      }
      case 'mark': {
        const d = it.def
        let node: React.ReactNode = null
        if (d.kind === 'right') {
          const at = ev.points.get(d.at)
          const l1 = resolveLine(ev, d.l1)
          const l2 = resolveLine(ev, d.l2)
          if (at && l1 && l2) node = rightMark(at, l1, l2, it.color, d.p1, d.p2)
        } else if (d.kind === 'ticks') {
          const [a, b] = [ev.points.get(d.a), ev.points.get(d.b)]
          if (a && b) node = ticksMark(S(a), S(b), d.count, it.color)
        } else if (d.kind === 'rightPlane') {
          const at = ev.points.get(d.at)
          const l = resolveLine(ev, d.line)
          const pl = resolvePlane(ev, d.plane)
          if (at && l && pl) {
            // Second side: the in-plane direction that is least foreshortened on screen.
            let w = cross(pl.n, pr.toViewer)
            if (len(w) < 1e-6) w = cross(pl.n, [1, 0, 0])
            const towards = d.toward ? ev.points.get(d.toward) : undefined
            let d1 = normalize(l.d)
            if (towards && dot(sub(towards, at), d1) < 0) d1 = scale(d1, -1)
            const s = 13 / k
            const a1 = scale(d1, s)
            const a2 = scale(normalize(w), s)
            node = <polyline points={ptsAttr([add(at, a1), add(at, add(a1, a2)), add(at, a2)].map(S))} fill="none" stroke={it.color} strokeWidth={1.6} />
          }
        } else {
          const [a, o, b] = [ev.points.get(d.a), ev.points.get(d.vertex), ev.points.get(d.b)]
          if (a && o && b) node = angleMark(a, o, b, 1, it.color, false, false, true)
        }
        marks.push(
          <g key={it.id} opacity={op} onPointerDown={clickSelect} className={selectable}>
            {sel && (
              <g stroke={SELECT_HALO} strokeWidth={7} opacity={0.7}>
                {node}
              </g>
            )}
            {node}
          </g>,
        )
        break
      }
      case 'vector': {
        const [a, b] = ev.vectors.get(it.id)!
        if (sel) halo(a, b, `${it.id}-u`)
        if (pend) halo(a, b, `${it.id}-p`, PENDING)
        if (it.aux) strokes.push(svgLine(a, b, { stroke: it.color, strokeWidth: 1.6, strokeDasharray: '6 5', opacity: op }, it.id))
        else strokes.push(...drawPieces(a, b, it.color, 2.2, it.id, op))
        const [sa, sb] = [S(a), S(b)]
        const l = Math.hypot(sb[0] - sa[0], sb[1] - sa[1]) || 1
        const [ux, uy] = [(sb[0] - sa[0]) / l, (sb[1] - sa[1]) / l]
        const head = [
          [sb[0], sb[1]],
          [sb[0] - ux * 13 - uy * 5, sb[1] - uy * 13 + ux * 5],
          [sb[0] - ux * 13 + uy * 5, sb[1] - uy * 13 - ux * 5],
        ] as P2[]
        marks.push(<polygon key={`${it.id}-h`} points={ptsAttr(head)} fill={it.color} opacity={op} pointerEvents="none" />)
        const active = tool === 'select' || wantsVector
        hits.push(
          <line
            key={`h${it.id}`}
            x1={sa[0]}
            y1={sa[1]}
            x2={sb[0]}
            y2={sb[1]}
            className={active ? 'hit-line' : 'hit-line off'}
            onPointerDown={(e) => {
              e.stopPropagation()
              if (tool === 'select') st.select(it.id, additive(e))
              else if (wantsVector) st.hit({ kind: 'vector', ref: it.id })
            }}
          />,
        )
        break
      }
      case 'measure': {
        const m = ev.measures.get(it.id)!
        let [x, y] = S(m.at)
        if (m.along) {
          // Beside the segment, away from the figure.
          const [a, b] = [S(m.along[0]), S(m.along[1])]
          const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
          let [nx, ny] = [-(b[1] - a[1]) / l, (b[0] - a[0]) / l]
          if (nx * (x - labelCenter[0]) + ny * (y - labelCenter[1]) < 0) [nx, ny] = [-nx, -ny]
          ;[x, y] = [x + nx * 16, y + ny * 16]
        }
        const lbl = (r: string) => prettyLabel(ev.labels.get(r) ?? '')
        const name = it.def.kind === 'length' ? lbl(it.def.a) + lbl(it.def.b) : 'S'
        marks.push(
          <text key={it.id} x={x} y={y} className={`measure-text${sel ? ' sel' : ''}`} fill={it.color} opacity={op} onPointerDown={clickSelect}>
            {name} = {fmtNum(m.value)}
          </text>,
        )
        break
      }
      case 'text': {
        const [x, y] = S(it.pos)
        marks.push(
          <text
            key={it.id}
            x={x}
            y={y}
            className={`note-text${sel ? ' sel' : ''}${tool === 'select' ? ' drag' : ''}`}
            fill={it.color}
            opacity={op}
            onPointerDown={(e) => {
              if (tool !== 'select') return
              e.stopPropagation()
              st.select(it.id, additive(e))
              drag.current = { kind: 'text', id: it.id, moved: false }
              ;(e.target as Element).setPointerCapture?.(e.pointerId)
            }}
          >
            {it.text}
          </text>,
        )
        break
      }
      case 'ratio': {
        const a = S(ev.points.get(it.a)!)
        const b = S(ev.points.get(it.b)!)
        marks.push(<RatioArc key={it.id} a={a} b={b} away={centerS} color={it.color} text={it.text} opacity={op} selected={sel} onDown={clickSelect} />)
        break
      }
    }
  }

  // Points: solid vertices + point items.
  const pointNodes: React.ReactNode[] = []
  const labelNodes: React.ReactNode[] = []
  const pointRefs: { ref: PointRef; item?: PointItem }[] = [
    ...(solid ? solid.vertices.map((_, i) => ({ ref: `v${i}` })) : []),
    ...doc.items.filter((i): i is PointItem => i.type === 'point').map((i) => ({ ref: i.id, item: i })),
  ]
  const pointsActive = tool === 'select' || wantsPoint || wantsObject
  for (const { ref, item } of pointRefs) {
    const p = ev.points.get(ref)
    if (!p) continue
    const l = item ? look(item) : 'normal'
    if (l === 'hidden') continue
    const op = item ? opacityOf(l) : figureOp
    const [x, y] = S(p)
    const sel = selection.includes(ref)
    const pend = pickedRefs.has(ref)
    const hollow = parseVertexRef(ref) === null || sel || pend
    const color = item?.color ?? (sel ? '#2f45d8' : '#111')
    const draggable = tool === 'select' && !!item && DRAGGABLE.includes(item.def.kind)
    pointNodes.push(
      <g key={ref} opacity={op}>
        {(sel || pend) && <circle cx={x} cy={y} r={10} fill={pend ? PENDING : SELECT_HALO} opacity={0.55} />}
        <circle cx={x} cy={y} r={hollow ? 4.6 : 3.2} fill={hollow ? '#fff' : color} stroke={color} strokeWidth={hollow ? 2.2 : 0} />
        <circle
          cx={x}
          cy={y}
          r={11}
          className={`hit-point${pointsActive ? '' : ' off'}${draggable ? ' drag' : ''}`}
          onPointerDown={(e) => onPointDown(ref, e)}
        />
      </g>,
    )
    const dir = labelDir([x, y], labelCenter)
    const coords = item?.showCoords ? `(${fmtNum(p[0])}; ${fmtNum(p[1])}${sheet ? '' : `; ${fmtNum(p[2])}`})` : ''
    labelNodes.push(
      <Label key={`L${ref}`} x={x + dir[0] * (coords ? 30 : 17)} y={y + dir[1] * 17} text={ev.labels.get(ref) ?? ''} suffix={coords} opacity={op} />,
    )
  }

  const preview =
    hover && wantsPoint ? <circle cx={S(hover)[0]} cy={S(hover)[1]} r={5} fill="#fff" stroke={PENDING} strokeWidth={2} pointerEvents="none" /> : null

  // Grid: on the sheet it moves with the content (one cell = one unit).
  const cell = sheet ? GRID * camera.zoom : GRID
  const gx = sheet ? ox % cell : 0
  const gy = sheet ? oy % cell : 0

  return (
    <div className="canvas-wrap" ref={wrap}>
      <svg
        ref={svgRef}
        width={size.w}
        height={size.h}
        className={`canvas tool-${tool} ${sheet ? 'sheet' : 'solid'}`}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onWheel={onWheel}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <pattern id="grid" x={gx} y={gy} width={cell} height={cell} patternUnits="userSpaceOnUse">
            <path d={`M ${cell} 0 L 0 0 0 ${cell}`} fill="none" stroke="#c9d3de" strokeWidth={1} />
          </pattern>
        </defs>
        <rect width={size.w} height={size.h} fill={showGrid ? 'url(#grid)' : '#fff'} onPointerDown={onBgDown} className="bg" />
        {sheet && showAxes && <Axes ox={ox} oy={oy} k={k} w={size.w} h={size.h} />}
        <g>{fills}</g>
        <g>{faceHits}</g>
        <g>{underlays}</g>
        <g pointerEvents="none">{strokes}</g>
        <g>{hits}</g>
        <g>{marks}</g>
        <g>{pointNodes}</g>
        <g pointerEvents="none">{labelNodes}</g>
        {preview}
      </svg>
    </div>
  )

  // ---- marks (hoisted helpers using the current projection) ---------------

  /** Arc(s) of angle a-o-b drawn in its own plane; a right angle gets a square. */
  function angleMark(a: Vec3, o: Vec3, b: Vec3, arcs: number, color: string, selected: boolean, showValue: boolean, ticks = false) {
    const ua = normalize(sub(a, o))
    const ub = normalize(sub(b, o))
    const phi = (angleDeg(a, o, b) * Math.PI) / 180
    const w0 = sub(ub, scale(ua, dot(ua, ub)))
    if (len(w0) < 1e-9) return null
    const w = normalize(w0)
    const r0 = 24 / k
    const at = (r: number, th: number) => add(o, scale(add(scale(ua, Math.cos(th)), scale(w, Math.sin(th))), r))
    const out: React.ReactNode[] = []
    if (selected) out.push(<circle key="sel" cx={S(o)[0]} cy={S(o)[1]} r={30} fill={SELECT_HALO} opacity={0.35} />)
    if (Math.abs(phi - Math.PI / 2) < 1e-6 && !ticks) {
      const s = 14 / k
      const pts = [add(o, scale(ua, s)), add(o, add(scale(ua, s), scale(ub, s))), add(o, scale(ub, s))].map(S)
      out.push(<polyline key="sq" points={ptsAttr(pts)} fill="none" stroke={color} strokeWidth={1.8} />)
    } else {
      for (let i = 0; i < arcs; i++) {
        const r = r0 + (i * 5) / k
        const pts: P2[] = []
        for (let j = 0; j <= 24; j++) pts.push(S(at(r, (phi * j) / 24)))
        out.push(<polyline key={`a${i}`} points={ptsAttr(pts)} fill="none" stroke={color} strokeWidth={1.8} />)
      }
      if (ticks)
        for (const f of [0.25, 0.75]) {
          const p1 = S(at(r0 - 5 / k, phi * f))
          const p2 = S(at(r0 + 5 / k, phi * f))
          out.push(<line key={`t${f}`} x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} stroke={color} strokeWidth={1.8} />)
        }
    }
    if (showValue) {
      const pos = S(at(r0 + 22 / k, phi / 2))
      out.push(
        <text key="v" x={pos[0]} y={pos[1]} className="angle-text" fill={color}>
          {Math.round(((phi * 180) / Math.PI) * 10) / 10}°
        </text>,
      )
    }
    return out
  }

  /** Right-angle square at `at`, sides along l1 / l2 (towards p1 / p2 when given). */
  function rightMark(at: Vec3, l1: Line3, l2: Line3, color: string, p1?: PointRef, p2?: PointRef) {
    const towards = (l: Line3, p?: PointRef) => {
      const d = normalize(l.d)
      const q = p ? ev.points.get(p) : undefined
      return q && dot(sub(q, at), d) < 0 ? scale(d, -1) : d
    }
    const s = 13 / k
    const d1 = scale(towards(l1, p1), s)
    const d2 = scale(towards(l2, p2), s)
    const pts = [add(at, d1), add(at, add(d1, d2)), add(at, d2)].map(S)
    return <polyline points={ptsAttr(pts)} fill="none" stroke={color} strokeWidth={1.6} />
  }

  /** On the sheet labels are pushed away from the centroid of all points. */
  function sheetLabelAnchor(): P2 {
    const pts = [...ev.points.values()].map(S)
    if (!pts.length) return [ox, oy]
    return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length]
  }
}

/** Number for labels: up to 2 decimals, no trailing zeros. */
const fmtNum = (v: number) => String(Math.round(v * 100) / 100).replace('-0', '0')

/** Coordinate axes of the sheet with unit ticks. */
function Axes({ ox, oy, k, w, h }: { ox: number; oy: number; k: number; w: number; h: number }) {
  const step = k >= 24 ? 1 : k >= 10 ? 2 : 5
  const ticks: React.ReactNode[] = []
  for (let i = Math.ceil(-ox / k / step) * step; i * k + ox <= w; i += step) {
    if (i === 0) continue
    const x = ox + i * k
    ticks.push(<line key={`x${i}`} x1={x} y1={oy - 4} x2={x} y2={oy + 4} />, <text key={`tx${i}`} x={x} y={oy + 16} className="axis-num">{i}</text>)
  }
  for (let i = Math.ceil((oy - h) / k / step) * step; oy - i * k >= 0; i += step) {
    if (i === 0) continue
    const y = oy - i * k
    ticks.push(<line key={`y${i}`} x1={ox - 4} y1={y} x2={ox + 4} y2={y} />, <text key={`ty${i}`} x={ox - 8} y={y + 4} className="axis-num end">{i}</text>)
  }
  return (
    <g className="axes" pointerEvents="none">
      <line x1={0} y1={oy} x2={w} y2={oy} />
      <line x1={ox} y1={h} x2={ox} y2={0} />
      <path d={`M ${w - 2} ${oy} l -10 -4 v 8 z M ${ox} 2 l -4 10 h 8 z`} className="arrow" />
      <text x={w - 14} y={oy - 10} className="axis-name">x</text>
      <text x={ox + 10} y={14} className="axis-name">y</text>
      <text x={ox - 8} y={oy + 16} className="axis-num end">0</text>
      {ticks}
    </g>
  )
}

function ticksMark(a: P2, b: P2, count: number, color: string) {
  const mx = (a[0] + b[0]) / 2
  const my = (a[1] + b[1]) / 2
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const l = Math.hypot(dx, dy) || 1
  const [ux, uy] = [dx / l, dy / l]
  const [nx, ny] = [-uy, ux]
  const out: React.ReactNode[] = []
  for (let i = 0; i < count; i++) {
    const off = (i - (count - 1) / 2) * 5
    const cx = mx + ux * off
    const cy = my + uy * off
    out.push(<line key={i} x1={cx - nx * 6} y1={cy - ny * 6} x2={cx + nx * 6} y2={cy + ny * 6} stroke={color} strokeWidth={1.8} />)
  }
  return out
}

/** Unit screen direction from a centre towards the point. */
function labelDir(p: P2, c: P2): P2 {
  const dx = p[0] - c[0]
  const dy = p[1] - c[1]
  const l = Math.hypot(dx, dy)
  return l < 1 ? [0.7, -0.7] : [dx / l, dy / l]
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
  const d = `M ${a[0]} ${a[1]} Q ${mx + nx * h * 2} ${my + ny * h * 2} ${b[0]} ${b[1]}`
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
