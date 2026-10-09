import { type Vec3, centroid, dot, normalize, sub } from './vec'

export interface Vertex {
  /** Label using "_" for subscripts, e.g. "A_1". */
  label: string
  pos: Vec3
}

/** Convex polyhedron. Faces are vertex index loops, counter-clockwise seen from outside. */
export interface Polyhedron {
  vertices: Vertex[]
  faces: number[][]
}

export interface Edge {
  a: number
  b: number
  /** Indices of the two adjacent faces. */
  faces: [number, number]
}

export function faceNormal(p: Polyhedron, f: number): Vec3 {
  const pts = p.faces[f].map((i) => p.vertices[i].pos)
  // Newell's method: robust for any planar polygon.
  let nx = 0
  let ny = 0
  let nz = 0
  for (let i = 0; i < pts.length; i++) {
    const c = pts[i]
    const n = pts[(i + 1) % pts.length]
    nx += (c[1] - n[1]) * (c[2] + n[2])
    ny += (c[2] - n[2]) * (c[0] + n[0])
    nz += (c[0] - n[0]) * (c[1] + n[1])
  }
  return normalize([nx, ny, nz])
}

export const solidCenter = (p: Polyhedron): Vec3 => centroid(p.vertices.map((v) => v.pos))

/** Reverse any face whose normal points inward, so all faces are outward CCW. */
export function orientOutward(p: Polyhedron): Polyhedron {
  const c = solidCenter(p)
  const faces = p.faces.map((f, i) => {
    const pts = f.map((k) => p.vertices[k].pos)
    const n = faceNormal(p, i)
    return dot(n, sub(centroid(pts), c)) < 0 ? [...f].reverse() : f
  })
  return { ...p, faces }
}

export function edgesOf(p: Polyhedron): Edge[] {
  const map = new Map<string, Edge>()
  p.faces.forEach((f, fi) => {
    for (let i = 0; i < f.length; i++) {
      const a = f[i]
      const b = f[(i + 1) % f.length]
      const key = a < b ? `${a}-${b}` : `${b}-${a}`
      const e = map.get(key)
      if (e) e.faces[1] = fi
      else map.set(key, { a: Math.min(a, b), b: Math.max(a, b), faces: [fi, -1] })
    }
  })
  return [...map.values()]
}

/** Outward half-spaces n·x <= d for each face. */
export function halfSpaces(p: Polyhedron): { n: Vec3; d: number }[] {
  return p.faces.map((f, i) => {
    const n = faceNormal(p, i)
    return { n, d: dot(n, p.vertices[f[0]].pos) }
  })
}

export function boundingRadius(p: Polyhedron): number {
  const c = solidCenter(p)
  let r = 0
  for (const v of p.vertices) {
    const d = sub(v.pos, c)
    r = Math.max(r, Math.hypot(d[0], d[1], d[2]))
  }
  return r
}

