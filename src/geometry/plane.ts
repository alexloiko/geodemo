import { type Vec3, add, cross, dot, len, normalize, scale, sub } from './vec'

/** Plane n·x = d with unit normal n. */
export interface Plane {
  n: Vec3
  d: number
}

export const EPS = 1e-9

/** Plane through three points, or null if they are (nearly) collinear. */
export function planeFrom3(a: Vec3, b: Vec3, c: Vec3): Plane | null {
  const raw = cross(sub(b, a), sub(c, a))
  const size = Math.max(len(sub(b, a)), len(sub(c, a)), 1e-12)
  if (len(raw) < 1e-7 * size * size) return null
  const n = normalize(raw)
  return { n, d: dot(n, a) }
}

export const signedDist = (pl: Plane, p: Vec3): number => dot(pl.n, p) - pl.d

/**
 * Intersection of lines (p1,p2) and (q1,q2). Returns the point or null when the
 * lines are parallel or skew (closest distance above tolerance relative to scale).
 */
export function intersectLines(p1: Vec3, p2: Vec3, q1: Vec3, q2: Vec3, relTol = 1e-6): Vec3 | null {
  const u = sub(p2, p1)
  const v = sub(q2, q1)
  const w = sub(p1, q1)
  const a = dot(u, u)
  const b = dot(u, v)
  const c = dot(v, v)
  const d = dot(u, w)
  const e = dot(v, w)
  const den = a * c - b * b
  if (a === 0 || c === 0 || Math.abs(den) < 1e-12 * a * c) return null
  const s = (b * e - c * d) / den
  const t = (a * e - b * d) / den
  const pa = add(p1, scale(u, s))
  const qb = add(q1, scale(v, t))
  const sz = Math.max(Math.sqrt(a), Math.sqrt(c), len(w), 1)
  if (len(sub(pa, qb)) > relTol * sz * 100) return null
  return scale(add(pa, qb), 0.5)
}

/** Parameter t where segment a→b meets the plane, or null when parallel. */
export function segmentPlaneT(pl: Plane, a: Vec3, b: Vec3): number | null {
  const da = signedDist(pl, a)
  const db = signedDist(pl, b)
  if (Math.abs(da - db) < EPS) return null
  return da / (da - db)
}
