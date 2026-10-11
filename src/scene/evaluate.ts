import {
  type Circle3,
  planeBasis,
  circlePlanePoints,
  sphereSection,
  circleCenterPoint,
  circleCircle,
  circumcircle,
  lineCircle,
  pointOnCircle,
  tangencyPoints,
} from '../geometry/circle'
import {
  type Line3,
  angleBisector,
  foot,
  lineLine,
  lineThrough,
  parallelThrough,
  perpBisector,
  linePlane,
  perpendicularThrough,
  planePlane,
  pointAt,
} from '../geometry/lines'
import { type Plane, intersectLines, planeFrom3, signedDist } from '../geometry/plane'
import { type Polyhedron, boundingRadius, edgesOf, faceNormal, flatFaces } from '../geometry/polyhedron'
import { type SectionVertex, enclosingBox, section } from '../geometry/section'
import { rims, surfacePoint } from '../geometry/revolution'
import { buildSolid } from '../geometry/solids'
import { bisectorFoot, centroid3, incenter, incircle, orthocenter } from '../geometry/triangle'
import { type Tf, applyTf } from '../geometry/transform'
import { type Vec3, add, cross, dist, dot, len, lerp, normalize, scale, sub } from '../geometry/vec'
import {
  type CircleItem,
  type Doc,
  type LineItem,
  type LineRef,
  type PlaneDef,
  type PlaneRef,
  type PointItem,
  type PointRef,
  SHEET,
  type Transform,
  parseFaceRef,
  parsePairRef,
  rimRef,
} from './model'

export interface EvalPlane {
  plane: Plane
  section: SectionVertex[]
  /** Point ref at each section vertex (solid vertex or point item), when one exists. */
  refs: (PointRef | null)[]
  extension: Vec3[]
  /** Exact section circle of a sphere. */
  circle?: Circle3
}

/** An evaluated line-like object. For two-point lines p = A and d = B − A. */
export interface EvLine extends Line3 {
  a?: PointRef
  b?: PointRef
  extent: 'segment' | 'line' | 'ray'
}

export interface Evaluated {
  /** null on the 2D sheet. */
  solid: Polyhedron | null
  points: Map<PointRef, Vec3>
  /** Labels of every point (vertices and point items). */
  labels: Map<PointRef, string>
  planes: Map<string, EvalPlane>
  /** Segment and line items. */
  lines: Map<string, EvLine>
  circles: Map<string, Circle3>
  /** Vector items: [tail, head]. */
  vectors: Map<string, [Vec3, Vec3]>
  /** Items whose geometry could not be computed (e.g. skew lines). */
  invalid: Set<string>
  /** Typical size of the scene, for tolerances. */
  scaleRef: number
  tol: number
}

const SHEET_PLANE: Plane = { n: [0, 0, 1], d: 0 }

export function evaluate(doc: Doc): Evaluated {
  const solid = doc.solid ? buildSolid(doc.solid) : null
  const scaleRef = solid ? Math.max(boundingRadius(solid), 1) : 10
  const ev: Evaluated = {
    solid,
    points: new Map(),
    labels: new Map(),
    planes: new Map(),
    lines: new Map(),
    circles: new Map(),
    vectors: new Map(),
    invalid: new Set(),
    scaleRef,
    tol: 1e-6 * scaleRef,
  }
  solid?.vertices.forEach((v, i) => {
    if (solid.rev && !v.label) return // approximation vertices are not points
    ev.points.set(`v${i}`, v.pos)
    ev.labels.set(`v${i}`, v.label)
  })
  if (solid?.rev) rims(solid.rev).forEach((r, i) => ev.circles.set(rimRef(i), r.circle))
  const box = solid ? enclosingBox(solid) : null

  for (const it of doc.items) {
    let ok = true
    switch (it.type) {
      case 'point': {
        ev.labels.set(it.id, it.label)
        const p = evalPoint(it, ev)
        if (p) ev.points.set(it.id, p)
        else ok = false
        break
      }
      case 'segment': {
        const [a, b] = [ev.points.get(it.a), ev.points.get(it.b)]
        const l = a && b ? lineThrough(a, b) : null
        if (l) ev.lines.set(it.id, { ...l, a: it.a, b: it.b, extent: 'segment' })
        else ok = false
        break
      }
      case 'line': {
        const l = evalLine(it, ev)
        if (l) ev.lines.set(it.id, l)
        else ok = false
        break
      }
      case 'circle': {
        const c = evalCircle(it, ev)
        if (c) ev.circles.set(it.id, c)
        else ok = false
        break
      }
      case 'plane': {
        const pl = evalPlaneDef(it.def, ev)
        if (!pl || !solid || !box) {
          ok = false
          break
        }
        const rev = solid.rev
        const circle = rev?.kind === 'sphere' ? sphereSection([0, 0, 0], rev.r1, pl) : null
        ev.planes.set(it.id, {
          plane: pl,
          section: rev?.kind === 'sphere' ? [] : section(solid, pl),
          refs: [],
          extension: section(box, pl).map((v) => v.pos),
          ...(circle ? { circle } : {}),
        })
        break
      }
      case 'face':
        ok = !!solid?.faces[it.face]
        break
      case 'polygon':
        ok = it.pts.length >= 3 && it.pts.every((p) => ev.points.has(p))
        break
      case 'angle':
        ok = [it.a, it.vertex, it.b].every((p) => ev.points.has(p))
        break
      case 'ratio':
        ok = ev.points.has(it.a) && ev.points.has(it.b)
        break
      case 'vector': {
        const [a, b] = [ev.points.get(it.a), ev.points.get(it.b)]
        if (a && b) ev.vectors.set(it.id, [a, b])
        else ok = false
        break
      }
      case 'mark':
        ok = true
        break
    }
    if (!ok) ev.invalid.add(it.id)
  }

  // Section vertices get their refs once all points (incl. later edgePlane points) exist.
  // On curved bodies the approximate vertices snap to the exact rim points.
  const snap = solid?.rev ? 5e-3 * scaleRef : ev.tol
  for (const pl of ev.planes.values()) {
    pl.refs = pl.section.map((v) => {
      for (const [ref, p] of ev.points) if (dist(p, v.pos) < snap) return ref
      return null
    })
    if (solid?.rev)
      pl.section = pl.section.map((v, i) => (pl.refs[i] ? { ...v, pos: ev.points.get(pl.refs[i]!)! } : v))
  }
  return ev
}

/** Resolve a transformation's refs; null when something is missing. */
export function resolveTf(ev: Evaluated, tf: Transform): Tf | null {
  const P = (r: PointRef) => ev.points.get(r)
  switch (tf.kind) {
    case 'pointReflect': {
      const c = P(tf.center)
      return c ? { kind: 'pointReflect', c } : null
    }
    case 'lineReflect': {
      const l = resolveLine(ev, tf.line)
      return l ? { kind: 'lineReflect', l } : null
    }
    case 'rotate': {
      const [c, pl] = [P(tf.center), resolvePlane(ev, tf.plane)]
      return c && pl ? { kind: 'rotate', c, axis: pl.n, rad: (tf.deg * Math.PI) / 180 } : null
    }
    case 'translate': {
      const v = ev.vectors.get(tf.vector)
      return v ? { kind: 'translate', v: sub(v[1], v[0]) } : null
    }
    case 'dilate': {
      const c = P(tf.center)
      return c ? { kind: 'dilate', c, k: tf.k } : null
    }
  }
}

/** A line item, a segment item or an implicit "a|b" line. */
export function resolveLine(ev: Evaluated, ref: LineRef): EvLine | null {
  const l = ev.lines.get(ref)
  if (l) return l
  const pair = parsePairRef(ref)
  if (!pair) return null
  const [a, b] = [ev.points.get(pair[0]), ev.points.get(pair[1])]
  const t = a && b ? lineThrough(a, b) : null
  return t ? { ...t, a: pair[0], b: pair[1], extent: 'line' } : null
}

export function resolvePlane(ev: Evaluated, ref: PlaneRef | undefined): Plane | null {
  if (!ref) return null
  if (ref === SHEET) return SHEET_PLANE
  const f = parseFaceRef(ref)
  if (f !== null) {
    if (!ev.solid || !ev.solid.faces[f]) return null
    const n = faceNormal(ev.solid, f)
    return { n, d: dot(n, ev.solid.vertices[ev.solid.faces[f][0]].pos) }
  }
  return ev.planes.get(ref)?.plane ?? null
}

/** Planes (sheet, faces, plane items) that contain all the given points. */
export function planesContaining(ev: Evaluated, pts: Vec3[]): PlaneRef[] {
  if (!ev.solid) return [SHEET]
  const out: PlaneRef[] = []
  const on = (pl: Plane) => pts.every((p) => Math.abs(signedDist(pl, p)) < ev.tol * 10)
  for (const i of flatFaces(ev.solid)) {
    const pl = resolvePlane(ev, `f${i}`)
    if (pl && on(pl)) out.push(`f${i}`)
  }
  for (const [id, pl] of ev.planes) if (on(pl.plane)) out.push(id)
  return out
}

function evalPlaneDef(d: PlaneDef, ev: Evaluated): Plane | null {
  const P = (r: PointRef) => ev.points.get(r)
  switch (d.kind) {
    case 'three': {
      const [a, b, c] = [P(d.a), P(d.b), P(d.c)]
      return a && b && c ? planeFrom3(a, b, c) : null
    }
    case 'parallel': {
      const [q, pl] = [P(d.point), resolvePlane(ev, d.plane)]
      return q && pl ? { n: pl.n, d: dot(pl.n, q) } : null
    }
    case 'perpToLine': {
      const [q, l] = [P(d.point), resolveLine(ev, d.line)]
      if (!q || !l) return null
      const n = normalize(l.d)
      return { n, d: dot(n, q) }
    }
  }
}

function evalLine(it: LineItem, ev: Evaluated): EvLine | null {
  const P = (r: PointRef) => ev.points.get(r)
  const d = it.def
  const extent = it.extent === 'ray' ? 'ray' : 'line'
  switch (d.kind) {
    case 'through': {
      const [a, b] = [P(d.a), P(d.b)]
      const l = a && b ? lineThrough(a, b) : null
      return l ? { ...l, a: d.a, b: d.b, extent } : null
    }
    case 'parallel': {
      const [q, L] = [P(d.point), resolveLine(ev, d.line)]
      return q && L ? { ...parallelThrough(L, q), extent } : null
    }
    case 'perpendicular': {
      const [q, L] = [P(d.point), resolveLine(ev, d.line)]
      if (!q || !L) return null
      const pl = resolvePlane(ev, d.plane)
      const l = perpendicularThrough(L, q, pl?.n ?? null, ev.tol)
      return l ? { ...l, extent } : null
    }
    case 'perpBisector': {
      const [a, b, pl] = [P(d.a), P(d.b), resolvePlane(ev, d.plane)]
      const l = a && b && pl ? perpBisector(a, b, pl.n) : null
      return l ? { ...l, extent } : null
    }
    case 'angleBisector': {
      const [a, o, b] = [P(d.a), P(d.vertex), P(d.b)]
      const l = a && o && b ? angleBisector(a, o, b) : null
      return l ? { ...l, extent } : null
    }
    case 'planePlane': {
      const [a, b] = [resolvePlane(ev, d.p1), resolvePlane(ev, d.p2)]
      const l = a && b ? planePlane(a, b) : null
      return l ? { ...l, extent } : null
    }
    case 'image': {
      const [l, tf] = [resolveLine(ev, d.src), resolveTf(ev, d.tf)]
      if (!l || !tf) return null
      const p = applyTf(tf, l.p)
      return { p, d: sub(applyTf(tf, pointAt(l, 1)), p), extent: l.extent === 'segment' ? 'line' : l.extent }
    }
    case 'perpToPlane': {
      const [q, pl] = [P(d.point), resolvePlane(ev, d.plane)]
      if (!q || !pl) return null
      // Through the foot, so the line starts at the plane.
      const f = sub(q, scale(pl.n, dot(pl.n, q) - pl.d))
      return { p: f, d: pl.n, extent }
    }
    case 'tangent': {
      const [c, q] = [ev.circles.get(d.circle), P(d.point)]
      if (!c || !q) return null
      const t = tangencyPoints(c, q, ev.tol)[d.index]
      if (!t) return null
      const dir = dist(t, q) < ev.tol ? cross(c.n, sub(t, c.c)) : sub(t, q)
      return len(dir) < 1e-12 ? null : { p: q, d: normalize(dir), extent }
    }
  }
}

function evalCircle(it: CircleItem, ev: Evaluated): Circle3 | null {
  const P = (r: PointRef) => ev.points.get(r)
  const d = it.def
  switch (d.kind) {
    case 'threePoints': {
      const [a, b, c] = [P(d.a), P(d.b), P(d.c)]
      return a && b && c ? circumcircle(a, b, c) : null
    }
    case 'centerPoint': {
      const [c, p, pl] = [P(d.center), P(d.through), resolvePlane(ev, d.plane)]
      return c && p && pl ? circleCenterPoint(c, p, pl.n) : null
    }
    case 'centerRadius': {
      const [c, pl] = [P(d.center), resolvePlane(ev, d.plane)]
      return c && pl && d.r > 0 ? { c, n: pl.n, r: d.r } : null
    }
    case 'incircle': {
      const [a, b, c] = [P(d.a), P(d.b), P(d.c)]
      return a && b && c ? incircle(a, b, c) : null
    }
    case 'image': {
      const [src, tf] = [ev.circles.get(d.src), resolveTf(ev, d.tf)]
      if (!src || !tf) return null
      // Similarity: map the centre, the normal direction and one point of the circle.
      const c = applyTf(tf, src.c)
      const n = normalize(sub(applyTf(tf, add(src.c, src.n)), c))
      const u = planeBasis(src.n)[0]
      return { c, n, r: dist(c, applyTf(tf, add(src.c, scale(u, src.r)))) }
    }
  }
}

/** All intersection points of two line-like / circle objects, in a stable order. */
export function meetPoints(ev: Evaluated, o1: string, o2: string): Vec3[] {
  const c1 = ev.circles.get(o1)
  const c2 = ev.circles.get(o2)
  const l1 = c1 ? null : resolveLine(ev, o1)
  const l2 = c2 ? null : resolveLine(ev, o2)
  if (l1 && l2) {
    const p = lineLine(l1, l2)
    return p ? [p] : []
  }
  if (l1 && c2) return lineCircle(l1, c2, ev.tol)
  if (c1 && l2) return lineCircle(l2, c1, ev.tol)
  if (c1 && c2) return circleCircle(c1, c2, ev.tol)
  return []
}

function evalPoint(it: PointItem, ev: Evaluated): Vec3 | null {
  const P = (r: PointRef) => ev.points.get(r)
  const d = it.def
  switch (d.kind) {
    case 'onSegment': {
      const [a, b] = [P(d.a), P(d.b)]
      return a && b ? lerp(a, b, d.t) : null
    }
    case 'onLine': {
      const l = resolveLine(ev, d.line)
      return l ? pointAt(l, d.t) : null
    }
    case 'intersection': {
      const [a1, a2, b1, b2] = [P(d.a1), P(d.a2), P(d.b1), P(d.b2)]
      return a1 && a2 && b1 && b2 ? intersectLines(a1, a2, b1, b2) : null
    }
    case 'edgePlane': {
      const pl = ev.planes.get(d.plane)
      const a = ev.solid?.vertices[d.a]?.pos
      const b = ev.solid?.vertices[d.b]?.pos
      if (!pl || !a || !b) return null
      const da = signedDist(pl.plane, a)
      const db = signedDist(pl.plane, b)
      if (da * db > 0 || da === db) return null
      return lerp(a, b, da / (da - db))
    }
    case 'free':
      return d.pos
    case 'midpoint': {
      const [a, b] = [P(d.a), P(d.b)]
      return a && b ? lerp(a, b, 0.5) : null
    }
    case 'onCircle': {
      const c = ev.circles.get(d.circle)
      return c ? pointOnCircle(c, d.angle) : null
    }
    case 'meet':
      return meetPoints(ev, d.o1, d.o2)[d.index] ?? null
    case 'foot': {
      const [q, l] = [P(d.point), resolveLine(ev, d.line)]
      return q && l ? foot(l, q) : null
    }
    case 'tangency': {
      const [c, q] = [ev.circles.get(d.circle), P(d.point)]
      return c && q ? (tangencyPoints(c, q, ev.tol)[d.index] ?? null) : null
    }
    case 'onSurface':
      return ev.solid?.rev ? surfacePoint(ev.solid.rev, d.u, d.w) : null
    case 'linePlane': {
      const [l, pl] = [resolveLine(ev, d.line), resolvePlane(ev, d.plane)]
      return l && pl ? linePlane(l, pl) : null
    }
    case 'projPlane': {
      const [q, pl] = [P(d.point), resolvePlane(ev, d.plane)]
      return q && pl ? sub(q, scale(pl.n, dot(pl.n, q) - pl.d)) : null
    }
    case 'bisectorFoot':
    case 'incenter':
    case 'centroid':
    case 'orthocenter': {
      const [a, b, c] = [P(d.a), P(d.b), P(d.c)]
      if (!a || !b || !c) return null
      if (d.kind === 'centroid') return centroid3(a, b, c)
      if (d.kind === 'incenter') return incenter(a, b, c)
      if (d.kind === 'orthocenter') return orthocenter(a, b, c)
      return bisectorFoot(a, b, c)
    }
    case 'center':
      return ev.circles.get(d.circle)?.c ?? null
    case 'image': {
      const [p, tf] = [P(d.src), resolveTf(ev, d.tf)]
      return p && tf ? applyTf(tf, p) : null
    }
    case 'circlePlane': {
      const [c, pl] = [ev.circles.get(d.circle), ev.planes.get(d.plane)]
      return c && pl ? (circlePlanePoints(c, pl.plane, ev.tol)[d.index] ?? null) : null
    }
  }
}

/** Solid edges as vertex refs, for pickers and forms. */
export function solidEdges(solid: Polyhedron | null): [PointRef, PointRef][] {
  return solid && !solid.rev ? edgesOf(solid).map((e) => [`v${e.a}`, `v${e.b}`]) : []
}
