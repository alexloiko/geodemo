import { planeFrom3 } from '../geometry/plane'
import { dist } from '../geometry/vec'
import { evaluate } from './evaluate'
import { nextLabel, nextVariable } from './labels'
import {
  DEFAULT_COLOR,
  type Doc,
  type Item,
  type PlaneItem,
  type PointItem,
  type PointRef,
  type RatioItem,
  newId,
} from './model'

/** Labels in use by vertices and point items. */
export function usedLabels(doc: Doc): string[] {
  return [...evaluate(doc).labels.values()]
}

export function makePointOnSegment(doc: Doc, a: PointRef, b: PointRef, t: number, label?: string): PointItem {
  return {
    id: newId('p'),
    type: 'point',
    label: label || nextLabel(usedLabels(doc)),
    color: DEFAULT_COLOR.point,
    visible: true,
    def: { kind: 'onSegment', a, b, t },
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
    label: label || nextLabel(usedLabels(doc)),
    color: DEFAULT_COLOR.point,
    visible: true,
    def: { kind: 'intersection', a1, a2, b1, b2 },
  }
}

/**
 * Plane through three points plus a point item for every section vertex that
 * is not already a vertex or an existing point. Returns [] for collinear points.
 */
export function makePlane(doc: Doc, a: PointRef, b: PointRef, c: PointRef, extend = false): Item[] {
  const ev = evaluate(doc)
  const [pa, pb, pc] = [ev.points.get(a), ev.points.get(b), ev.points.get(c)]
  if (!pa || !pb || !pc || !planeFrom3(pa, pb, pc)) return []
  const plane: PlaneItem = {
    id: newId('pl'),
    type: 'plane',
    a,
    b,
    c,
    extend,
    color: DEFAULT_COLOR.plane,
    visible: true,
  }
  const withPlane: Doc = { ...doc, items: [...doc.items, plane] }
  const sec = evaluate(withPlane).planes.get(plane.id)?.section ?? []
  const tol = 1e-6 * Math.max(...ev.solid.vertices.map((v) => Math.hypot(...v.pos)), 1)
  const existing = [...ev.points.values()]
  const out: Item[] = [plane]
  const labels = usedLabels(doc)
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
