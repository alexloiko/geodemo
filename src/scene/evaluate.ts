import { type Plane, intersectLines, planeFrom3, signedDist } from '../geometry/plane'
import { type Polyhedron, edgesOf } from '../geometry/polyhedron'
import { type SectionVertex, enclosingBox, section } from '../geometry/section'
import { buildSolid } from '../geometry/solids'
import { type Vec3, dist, lerp } from '../geometry/vec'
import type { Doc, Item, PointRef } from './model'

export interface EvalPlane {
  plane: Plane
  section: SectionVertex[]
  /** Point ref at each section vertex (solid vertex or point item), when one exists. */
  refs: (PointRef | null)[]
  extension: Vec3[]
}

export interface Evaluated {
  solid: Polyhedron
  points: Map<PointRef, Vec3>
  /** Labels of every point (vertices and point items). */
  labels: Map<PointRef, string>
  planes: Map<string, EvalPlane>
  /** Items whose geometry could not be computed (e.g. skew lines). */
  invalid: Set<string>
}

export function evaluate(doc: Doc): Evaluated {
  const solid = buildSolid(doc.solid)
  const points = new Map<PointRef, Vec3>()
  const labels = new Map<PointRef, string>()
  solid.vertices.forEach((v, i) => {
    points.set(`v${i}`, v.pos)
    labels.set(`v${i}`, v.label)
  })
  const planes = new Map<string, EvalPlane>()
  const invalid = new Set<string>()
  const box = enclosingBox(solid)
  const get = (r: PointRef) => points.get(r)

  for (const it of doc.items) {
    if (it.type === 'point') {
      labels.set(it.id, it.label)
      const p = evalPoint(it, solid, get, planes)
      if (p) points.set(it.id, p)
      else invalid.add(it.id)
    } else if (it.type === 'plane') {
      const [a, b, c] = [get(it.a), get(it.b), get(it.c)]
      const pl = a && b && c ? planeFrom3(a, b, c) : null
      if (!pl) {
        invalid.add(it.id)
        continue
      }
      planes.set(it.id, {
        plane: pl,
        section: section(solid, pl),
        refs: [],
        extension: section(box, pl).map((v) => v.pos),
      })
    } else if (needsPoints(it) && !refsOf(it).every((r) => points.has(r))) {
      invalid.add(it.id)
    }
  }
  // Section vertices get their refs once all points (incl. later edgePlane points) exist.
  const tol = 1e-6 * Math.max(...solid.vertices.map((v) => Math.hypot(...v.pos)), 1)
  for (const pl of planes.values())
    pl.refs = pl.section.map((v) => {
      for (const [ref, p] of points) if (dist(p, v.pos) < tol) return ref
      return null
    })
  return { solid, points, labels, planes, invalid }
}

function needsPoints(it: Item): boolean {
  return it.type === 'segment' || it.type === 'line' || it.type === 'ratio'
}

function refsOf(it: Item): PointRef[] {
  return 'a' in it && 'b' in it ? [it.a, it.b] : []
}

function evalPoint(
  it: Extract<Item, { type: 'point' }>,
  solid: Polyhedron,
  get: (r: PointRef) => Vec3 | undefined,
  planes: Map<string, EvalPlane>,
): Vec3 | null {
  const d = it.def
  switch (d.kind) {
    case 'onSegment': {
      const a = get(d.a)
      const b = get(d.b)
      return a && b ? lerp(a, b, d.t) : null
    }
    case 'intersection': {
      const [a1, a2, b1, b2] = [get(d.a1), get(d.a2), get(d.b1), get(d.b2)]
      return a1 && a2 && b1 && b2 ? intersectLines(a1, a2, b1, b2) : null
    }
    case 'edgePlane': {
      const pl = planes.get(d.plane)
      const a = solid.vertices[d.a]?.pos
      const b = solid.vertices[d.b]?.pos
      if (!pl || !a || !b) return null
      const da = signedDist(pl.plane, a)
      const db = signedDist(pl.plane, b)
      if (da * db > 0 || da === db) return null
      return lerp(a, b, da / (da - db))
    }
  }
}

/** Solid edges as vertex refs, for pickers and forms. */
export function solidEdges(solid: Polyhedron): [PointRef, PointRef][] {
  return edgesOf(solid).map((e) => [`v${e.a}`, `v${e.b}`])
}

