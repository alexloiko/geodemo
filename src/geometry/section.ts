import { type Plane, signedDist } from './plane'
import { type Polyhedron, boundingRadius, edgesOf, solidCenter } from './polyhedron'
import { type Vec3, centroid, cross, dist, dot, lerp, normalize, sub } from './vec'

export interface SectionVertex {
  pos: Vec3
  /** Set when the vertex coincides with a polyhedron vertex. */
  vertex?: number
  /** Set when the vertex lies strictly inside edge a–b at parameter t (from a to b). */
  edge?: { a: number; b: number; t: number }
}

/** Intersection polygon of a convex polyhedron and a plane, ordered around its centre. */
export function section(p: Polyhedron, pl: Plane): SectionVertex[] {
  const tol = 1e-7 * Math.max(boundingRadius(p), 1)
  const d = p.vertices.map((v) => signedDist(pl, v.pos))
  const out: SectionVertex[] = []
  d.forEach((di, i) => {
    if (Math.abs(di) <= tol) out.push({ pos: p.vertices[i].pos, vertex: i })
  })
  for (const e of edgesOf(p)) {
    const da = d[e.a]
    const db = d[e.b]
    if (Math.abs(da) <= tol || Math.abs(db) <= tol) continue
    if (da * db < 0) {
      const t = da / (da - db)
      out.push({ pos: lerp(p.vertices[e.a].pos, p.vertices[e.b].pos, t), edge: { a: e.a, b: e.b, t } })
    }
  }
  const uniq = out.filter((v, i) => out.findIndex((w) => dist(w.pos, v.pos) <= tol * 10) === i)
  if (uniq.length < 3) return []
  return orderAround(uniq, pl.n)
}

function orderAround<T extends { pos: Vec3 }>(pts: T[], n: Vec3): T[] {
  const c = centroid(pts.map((p) => p.pos))
  const ref = Math.abs(n[0]) < 0.9 ? ([1, 0, 0] as Vec3) : ([0, 1, 0] as Vec3)
  const u = normalize(cross(n, ref))
  const v = cross(n, u)
  const ang = (p: Vec3) => {
    const r = sub(p, c)
    return Math.atan2(dot(r, v), dot(r, u))
  }
  return [...pts].sort((a, b) => ang(a.pos) - ang(b.pos))
}

/** Axis-aligned box polyhedron around the solid, enlarged by `factor` (for drawing plane extensions). */
export function enclosingBox(p: Polyhedron, factor = 1.6): Polyhedron {
  const c = solidCenter(p)
  const r = boundingRadius(p) * factor
  const vertices = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({
    label: '',
    pos: [c[0] + (i & 1 ? r : -r), c[1] + (i & 2 ? r : -r), c[2] + (i & 4 ? r : -r)] as Vec3,
  }))
  // Outward CCW faces of the cube indexed by bit pattern (x=1, y=2, z=4).
  const faces = [
    [0, 2, 3, 1],
    [4, 5, 7, 6],
    [0, 1, 5, 4],
    [2, 6, 7, 3],
    [0, 4, 6, 2],
    [1, 3, 7, 5],
  ]
  return { vertices, faces }
}
