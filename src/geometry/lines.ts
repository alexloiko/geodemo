import { type Plane, intersectLines } from './plane'
import { type Vec3, add, cross, dot, len, normalize, scale, sub } from './vec'

/** Line p + t·d. For lines through two points d = b − a (not unit), so t matches segment ratios. */
export interface Line3 {
  p: Vec3
  d: Vec3
}

export const pointAt = (l: Line3, t: number): Vec3 => add(l.p, scale(l.d, t))

export function lineThrough(a: Vec3, b: Vec3): Line3 | null {
  const d = sub(b, a)
  return len(d) < 1e-12 ? null : { p: a, d }
}

/** Parameter of the orthogonal projection of q onto the line. */
export const paramOf = (l: Line3, q: Vec3): number => dot(sub(q, l.p), l.d) / dot(l.d, l.d)

export const foot = (l: Line3, q: Vec3): Vec3 => pointAt(l, paramOf(l, q))

export const distToLine = (l: Line3, q: Vec3): number => len(sub(q, foot(l, q)))

export const parallelThrough = (l: Line3, q: Vec3): Line3 => ({ p: q, d: normalize(l.d) })

/**
 * Perpendicular to l through q. If q is off the line the result is unique
 * (through the foot); otherwise it is taken inside the plane with normal n.
 */
export function perpendicularThrough(l: Line3, q: Vec3, n: Vec3 | null, tol: number): Line3 | null {
  const f = foot(l, q)
  const off = sub(q, f)
  if (len(off) > tol) return { p: f, d: normalize(off) }
  if (!n) return null
  const d = cross(n, l.d)
  return len(d) < 1e-12 ? null : { p: q, d: normalize(d) }
}

/** Perpendicular bisector of a–b inside the plane with normal n. */
export function perpBisector(a: Vec3, b: Vec3, n: Vec3): Line3 | null {
  const m = scale(add(a, b), 0.5)
  const d = cross(n, sub(b, a))
  return len(d) < 1e-12 ? null : { p: m, d: normalize(d) }
}

/** Bisector of angle a-o-b (internal), as a ray-like line from o. */
export function angleBisector(a: Vec3, o: Vec3, b: Vec3): Line3 | null {
  const ua = normalize(sub(a, o))
  const ub = normalize(sub(b, o))
  const d = add(ua, ub)
  if (len(d) < 1e-9) {
    // Straight angle: bisector is perpendicular to the line inside any plane — undefined in 3D.
    return null
  }
  return { p: o, d: normalize(d) }
}

export function lineLine(l1: Line3, l2: Line3): Vec3 | null {
  return intersectLines(l1.p, add(l1.p, l1.d), l2.p, add(l2.p, l2.d))
}

export function linePlane(l: Line3, pl: Plane): Vec3 | null {
  const den = dot(pl.n, l.d)
  if (Math.abs(den) < 1e-12) return null
  return pointAt(l, (pl.d - dot(pl.n, l.p)) / den)
}

/** Angle a-o-b in degrees. */
export function angleDeg(a: Vec3, o: Vec3, b: Vec3): number {
  const ua = normalize(sub(a, o))
  const ub = normalize(sub(b, o))
  return (Math.acos(Math.max(-1, Math.min(1, dot(ua, ub)))) * 180) / Math.PI
}

/** Line where two planes meet, or null when they are parallel. */
export function planePlane(p1: Plane, p2: Plane): Line3 | null {
  const dir = cross(p1.n, p2.n)
  const det = dot(dir, dir)
  if (det < 1e-18) return null
  // Point = ((d1 n2 − d2 n1) × dir) / |dir|²  … expressed via the standard formula.
  const p = scale(add(scale(cross(p2.n, dir), p1.d), scale(cross(dir, p1.n), p2.d)), 1 / det)
  return { p, d: normalize(dir) }
}
