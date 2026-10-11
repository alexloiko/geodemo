import { circlePlanePoints } from '../geometry/circle'
import { planeFrom3 } from '../geometry/plane'
import { rims } from '../geometry/revolution'
import { type Vec3, dist } from '../geometry/vec'
import { evaluate } from './evaluate'
import { labelsFromA, nextLabel, nextVariable } from './labels'
import {
  DEFAULT_COLOR,
  type Doc,
  type Item,
  type PlaneDef,
  type PlaneItem,
  type PointItem,
  type PointRef,
  type RatioItem,
  newId,
  rimRef,
} from './model'

/** Labels in use by vertices and point items. */
export function usedLabels(doc: Doc): string[] {
  return [...evaluate(doc).labels.values()]
}

export function makePointOnSegment(
  doc: Doc,
  a: PointRef,
  b: PointRef,
  t: number,
  label?: string,
  line = false,
): PointItem {
  return {
    id: newId('p'),
    type: 'point',
    label: label || nextLabel(usedLabels(doc), { fromA: labelsFromA(doc.solid) }),
    color: DEFAULT_COLOR.point,
    visible: true,
    def: line ? { kind: 'onSegment', a, b, t, line } : { kind: 'onSegment', a, b, t },
  }
}

export function makeIntersection(
  doc: Doc,
  a1: PointRef,
  a2: PointRef,
  b1: PointRef,
  b2: PointRef,
  label?: string,
): PointItem {
  return {
    id: newId('p'),
    type: 'point',
    label: label || nextLabel(usedLabels(doc), { fromA: labelsFromA(doc.solid) }),
    color: DEFAULT_COLOR.point,
    visible: true,
    def: { kind: 'intersection', a1, a2, b1, b2 },
  }
}

/** Plane through three points, with its section points (see makePlaneItems). */
export function makePlane(doc: Doc, a: PointRef, b: PointRef, c: PointRef, extend = false): Item[] {
  const ev = evaluate(doc)
  const [pa, pb, pc] = [ev.points.get(a), ev.points.get(b), ev.points.get(c)]
  if (!pa || !pb || !pc || !planeFrom3(pa, pb, pc)) return []
  return makePlaneItems(doc, { kind: 'three', a, b, c }, extend)
}

/**
 * Plane item plus a point item for every section vertex that is not already a
 * vertex or an existing point. Returns [] when the plane cannot be built.
 */
export function makePlaneItems(doc: Doc, def: PlaneDef, extend = false): Item[] {
  const ev = evaluate(doc)
  const plane: PlaneItem = {
    id: newId('pl'),
    type: 'plane',
    def,
    extend,
    color: DEFAULT_COLOR.plane,
    visible: true,
  }
  const withPlane: Doc = { ...doc, items: [...doc.items, plane] }
  const evPlane = evaluate(withPlane).planes.get(plane.id)
  if (!evPlane) return []
  const sec = evPlane.section
  const tol = ev.tol
  const existing = [...ev.points.values()]
  const out: Item[] = [plane]
  const labels = usedLabels(doc)
  const rev = ev.solid?.rev
  if (rev) {
    // Curved bodies: exact points where the plane cuts the base circles.
    const pl = evaluate(withPlane).planes.get(plane.id)!.plane
    // Named points, to call a point above a bottom point A (same angle) A₁.
    const named: { label: string; pos: Vec3 }[] = []
    for (const [ref, p] of ev.points) if (!ref.startsWith('v')) named.push({ label: ev.labels.get(ref) ?? '', pos: p })
    rims(rev).forEach((r, ri) => {
      if (!r.base) return
      circlePlanePoints(r.circle, pl, ev.tol).forEach((p, index) => {
        if (existing.some((q) => dist(q, p) < tol)) return
        // A point straight above a named bottom point A gets the textbook name A₁.
        const angle = (q: Vec3) => Math.atan2(q[1], q[0])
        const sameAngle = (q: Vec3) => Math.abs(Math.sin((angle(q) - angle(p)) / 2)) < 1e-6 && Math.hypot(q[0], q[1]) > tol
        const below = ri > 0 ? named.find((n) => n.pos[2] < p[2] && sameAngle(n.pos)) : undefined
        const label = nextLabel(labels, { fromA: true, prefer: below ? `${below.label}_1` : undefined })
        named.push({ label, pos: p })
        labels.push(label)
        existing.push(p)
        out.push({
          id: newId('p'),
          type: 'point',
          label,
          color: DEFAULT_COLOR.point,
          visible: true,
          def: { kind: 'circlePlane', circle: rimRef(ri), plane: plane.id, index },
        })
      })
    })
    return out
  }
  for (const v of sec) {
    if (!v.edge) continue
    if (existing.some((p) => dist(p, v.pos) < tol)) continue
    const label = nextLabel(labels)
    labels.push(label)
    out.push({
      id: newId('p'),
      type: 'point',
      label,
      color: DEFAULT_COLOR.point,
      visible: true,
      def: { kind: 'edgePlane', a: v.edge.a, b: v.edge.b, plane: plane.id },
    })
  }
  return out
}

function ratioText(k: number, v: string): string {
  return k === 1 ? v : `${k}${v}`
}

/** Two ratio arcs a–p and p–b labelled m·x and n·x. */
export function makeRatioMarks(doc: Doc, a: PointRef, p: PointRef, b: PointRef, m: number, n: number): RatioItem[] {
  const v = nextVariable(doc.items.filter((i): i is RatioItem => i.type === 'ratio').map((i) => i.text))
  const mk = (x: PointRef, y: PointRef, text: string): RatioItem => ({
    id: newId('r'),
    type: 'ratio',
    a: x,
    b: y,
    text,
    color: DEFAULT_COLOR.ratio,
    visible: true,
  })
  return [mk(a, p, ratioText(m, v)), mk(p, b, ratioText(n, v))]
}
