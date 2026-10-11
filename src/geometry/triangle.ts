import { type Circle3, circumcircle } from './circle'
import { type Vec3, add, cross, dist, len, lerp, normalize, scale, sub } from './vec'

export const centroid3 = (a: Vec3, b: Vec3, c: Vec3): Vec3 => scale(add(add(a, b), c), 1 / 3)

/** Incentre: vertices weighted by the opposite side lengths. */
export function incenter(a: Vec3, b: Vec3, c: Vec3): Vec3 | null {
  const [la, lb, lc] = [dist(b, c), dist(c, a), dist(a, b)]
  const p = la + lb + lc
  if (p < 1e-12) return null
  return scale(add(add(scale(a, la), scale(b, lb)), scale(c, lc)), 1 / p)
}

/** Orthocentre via H = A + B + C − 2·O (O = circumcentre), valid in the triangle's plane. */
export function orthocenter(a: Vec3, b: Vec3, c: Vec3): Vec3 | null {
  const o = circumcircle(a, b, c)
  if (!o) return null
  return sub(add(add(a, b), c), scale(o.c, 2))
}

/** Where the bisector from a meets side bc: BL / LC = AB / AC. */
export function bisectorFoot(a: Vec3, b: Vec3, c: Vec3): Vec3 | null {
  const [ab, ac] = [dist(a, b), dist(a, c)]
  if (ab + ac < 1e-12) return null
  return lerp(b, c, ab / (ab + ac))
}

export function incircle(a: Vec3, b: Vec3, c: Vec3): Circle3 | null {
  const n = cross(sub(b, a), sub(c, a))
  const area2 = len(n)
  if (area2 < 1e-12) return null
  const i = incenter(a, b, c)!
  const p = dist(a, b) + dist(b, c) + dist(c, a)
  return { c: i, n: normalize(n), r: area2 / p }
}
