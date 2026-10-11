import type { Line3 } from './lines'
import { distToLine, foot, linePlane, paramOf, planePlane, pointAt } from './lines'
import type { Plane } from './plane'
import { type Vec3, add, cross, dist, dot, len, normalize, scale, sub } from './vec'

/** Circle with centre c, unit normal n, radius r. */
export interface Circle3 {
  c: Vec3
  n: Vec3
  r: number
}

/** Orthonormal basis (u, v) of the plane with normal n; deterministic. */
export function planeBasis(n: Vec3): [Vec3, Vec3] {
  const ref: Vec3 = Math.abs(n[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1]
  // For the sheet (n = z) u = x and v = y, so angles read like school trigonometry.
  const u = Math.abs(n[2]) > 0.9 ? normalize(sub(ref, scale(n, dot(ref, n)))) : normalize(cross(ref, n))
  const v = cross(n, u)
  return [u, v]
}

export const circlePlane = (c: Circle3): Plane => ({ n: c.n, d: dot(c.n, c.c) })

export function pointOnCircle(c: Circle3, angle: number): Vec3 {
  const [u, v] = planeBasis(c.n)
  return add(c.c, add(scale(u, c.r * Math.cos(angle)), scale(v, c.r * Math.sin(angle))))
}

export function angleOnCircle(c: Circle3, p: Vec3): number {
  const [u, v] = planeBasis(c.n)
  const w = sub(p, c.c)
  return Math.atan2(dot(w, v), dot(w, u))
}

export function sampleCircle(c: Circle3, n = 120): Vec3[] {
  const out: Vec3[] = []
  for (let i = 0; i < n; i++) out.push(pointOnCircle(c, (2 * Math.PI * i) / n))
  return out
}

export function circumcircle(a: Vec3, b: Vec3, c: Vec3): Circle3 | null {
  const ab = sub(b, a)
  const ac = sub(c, a)
  const n = cross(ab, ac)
  const n2 = dot(n, n)
  if (n2 < 1e-18) return null
  // Standard formula: centre = a + ((|ac|²(n×ab)... ) / (2|n|²)
  const t1 = scale(cross(n, ab), dot(ac, ac))
  const t2 = scale(cross(ac, n), dot(ab, ab))
  const off = scale(add(t1, t2), 1 / (2 * n2))
  const center = add(a, off)
  return { c: center, n: normalize(n), r: len(off) }
}

/** Circle with centre c through p, in the plane with normal n (p is assumed to lie in it). */
export function circleCenterPoint(center: Vec3, p: Vec3, n: Vec3): Circle3 | null {
  const r = dist(center, p)
  return r < 1e-12 ? null : { c: center, n: normalize(n), r }
}

/** Intersections of a line with a circle, ordered along the line. */
export function lineCircle(l: Line3, c: Circle3, tol: number): Vec3[] {
  if (Math.abs(dot(normalize(l.d), c.n)) < 1e-9) {
    // Line parallel to the circle plane: must lie in it.
    if (Math.abs(dot(sub(l.p, c.c), c.n)) > tol) return []
    const h = distToLine(l, c.c)
    if (h > c.r + tol) return []
    const f = foot(l, c.c)
    const s = Math.sqrt(Math.max(0, c.r * c.r - h * h)) / len(l.d)
    const t0 = paramOf(l, f)
    if (s * len(l.d) < tol) return [f]
    return [pointAt(l, t0 - s), pointAt(l, t0 + s)]
  }
  const x = linePlane(l, circlePlane(c))
  return x && Math.abs(dist(x, c.c) - c.r) < tol ? [x] : []
}

/** Intersections of two coplanar circles (non-coplanar circles: via the planes' common line). */
export function circleCircle(c1: Circle3, c2: Circle3, tol: number): Vec3[] {
  const coplanar = len(cross(c1.n, c2.n)) < 1e-9 && Math.abs(dot(sub(c2.c, c1.c), c1.n)) < tol
  if (!coplanar) {
    const dir = cross(c1.n, c2.n)
    if (len(dir) < 1e-9) return []
    // A point on both planes: solve in the span of the normals.
    const d1 = dot(c1.n, c1.c)
    const d2 = dot(c2.n, c2.c)
    const n12 = dot(c1.n, c2.n)
    const det = 1 - n12 * n12
    const a = (d1 - d2 * n12) / det
    const b = (d2 - d1 * n12) / det
    const p = add(scale(c1.n, a), scale(c2.n, b))
    return lineCircle({ p, d: dir }, c1, tol).filter((q) => Math.abs(dist(q, c2.c) - c2.r) < tol)
  }
  const d = dist(c1.c, c2.c)
  if (d < 1e-12 || d > c1.r + c2.r + tol || d < Math.abs(c1.r - c2.r) - tol) return []
  const w = scale(sub(c2.c, c1.c), 1 / d)
  const a = (d * d + c1.r * c1.r - c2.r * c2.r) / (2 * d)
  const h = Math.sqrt(Math.max(0, c1.r * c1.r - a * a))
  const base = add(c1.c, scale(w, a))
  if (h < tol) return [base]
  const perp = cross(c1.n, w)
  return [add(base, scale(perp, h)), sub(base, scale(perp, h))]
}

/**
 * Tangency points of tangents from p to the circle (p in the circle plane).
 * p on the circle → [p]; p inside → [].
 */
export function tangencyPoints(c: Circle3, p: Vec3, tol: number): Vec3[] {
  const w0 = sub(p, c.c)
  const d = len(w0)
  if (Math.abs(d - c.r) < tol) return [p]
  if (d < c.r) return []
  const w = scale(w0, 1 / d)
  const perp = cross(c.n, w)
  const along = (c.r * c.r) / d
  const across = (c.r * Math.sqrt(d * d - c.r * c.r)) / d
  return [add(c.c, add(scale(w, along), scale(perp, across))), add(c.c, sub(scale(w, along), scale(perp, across)))]
}

/** Points where a plane cuts a circle (none when the plane contains or misses it). */
export function circlePlanePoints(c: Circle3, pl: Plane, tol: number): Vec3[] {
  const l = planePlane(circlePlane(c), pl)
  return l ? lineCircle(l, c, tol) : []
}

/** Circle where a plane cuts a sphere, or null. */
export function sphereSection(center: Vec3, r: number, pl: Plane): Circle3 | null {
  const d = dot(pl.n, center) - pl.d
  if (Math.abs(d) >= r) return null
  return { c: sub(center, scale(pl.n, d)), n: pl.n, r: Math.sqrt(r * r - d * d) }
}
