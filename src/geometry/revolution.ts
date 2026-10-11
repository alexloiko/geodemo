import type { Circle3 } from './circle'
import { type Polyhedron, type Vertex, orientOutward } from './polyhedron'
import { type Vec3, add, len, normalize, scale } from './vec'

export type RevKind = 'cylinder' | 'cone' | 'frustum' | 'sphere'

/**
 * Body of revolution about the z axis, centred like the polyhedra:
 * bases at z = ±h/2 with radii r1 (bottom) and r2 (top); a cone has r2 = 0.
 * A sphere has radius r1 and h = 2·r1.
 */
export interface Revolution {
  kind: RevKind
  r1: number
  r2: number
  h: number
}

const SEGMENTS = 128

/** Radius of the lateral surface at height z. */
export const radiusAt = (b: Revolution, z: number): number => b.r1 + ((b.r2 - b.r1) * (z + b.h / 2)) / b.h

/** Labelled points of the body: base centres, apex, sphere centre. */
export function namedPoints(b: Revolution): Vertex[] {
  const h2 = b.h / 2
  switch (b.kind) {
    case 'sphere':
      return [{ label: 'O', pos: [0, 0, 0] }]
    case 'cone':
      return [
        { label: 'O', pos: [0, 0, -h2] },
        { label: 'S', pos: [0, 0, h2] },
      ]
    default:
      return [
        { label: 'O', pos: [0, 0, -h2] },
        { label: 'O_1', pos: [0, 0, h2] },
      ]
  }
}

/** Circles the user can click: bases (bottom first) or the sphere's equator. */
export function rims(b: Revolution): { circle: Circle3; base: boolean }[] {
  const up: Vec3 = [0, 0, 1]
  if (b.kind === 'sphere') return [{ circle: { c: [0, 0, 0], n: up, r: b.r1 }, base: false }]
  const out = [{ circle: { c: [0, 0, -b.h / 2] as Vec3, n: up, r: b.r1 }, base: true }]
  if (b.kind !== 'cone') out.push({ circle: { c: [0, 0, b.h / 2], n: up, r: b.r2 }, base: true })
  return out
}

/**
 * Parameter intervals where q + s·v is inside the body (closed set).
 * Usually one interval; the list form keeps degenerate cases simple.
 */
export function rayIntervals(b: Revolution, q: Vec3, v: Vec3): [number, number][] {
  if (b.kind === 'sphere') {
    const A = v[0] * v[0] + v[1] * v[1] + v[2] * v[2]
    const B = 2 * (q[0] * v[0] + q[1] * v[1] + q[2] * v[2])
    const C = q[0] * q[0] + q[1] * q[1] + q[2] * q[2] - b.r1 * b.r1
    const disc = B * B - 4 * A * C
    if (disc < 0) return []
    const s = Math.sqrt(disc)
    return [[(-B - s) / (2 * A), (-B + s) / (2 * A)]]
  }
  const h2 = b.h / 2
  // Height range of the body along the ray.
  let lo = -Infinity
  let hi = Infinity
  if (Math.abs(v[2]) < 1e-12) {
    if (q[2] < -h2 || q[2] > h2) return []
  } else {
    const s1 = (-h2 - q[2]) / v[2]
    const s2 = (h2 - q[2]) / v[2]
    lo = Math.min(s1, s2)
    hi = Math.max(s1, s2)
  }
  // Lateral surface: x² + y² ≤ (a + k z)² with R(z) = a + k z.
  const k = (b.r2 - b.r1) / b.h
  const a = b.r1 + k * h2
  const rq = a + k * q[2]
  const A = v[0] * v[0] + v[1] * v[1] - k * k * v[2] * v[2]
  const B = 2 * (q[0] * v[0] + q[1] * v[1]) - 2 * k * v[2] * rq
  const C = q[0] * q[0] + q[1] * q[1] - rq * rq
  const pieces: [number, number][] = []
  if (Math.abs(A) < 1e-12) {
    if (Math.abs(B) < 1e-12) {
      if (C <= 0) pieces.push([-Infinity, Infinity])
    } else if (B > 0) pieces.push([-Infinity, -C / B])
    else pieces.push([-C / B, Infinity])
  } else {
    const disc = B * B - 4 * A * C
    if (A > 0) {
      if (disc >= 0) {
        const s = Math.sqrt(disc)
        pieces.push([(-B - s) / (2 * A), (-B + s) / (2 * A)])
      }
    } else if (disc < 0) pieces.push([-Infinity, Infinity])
    else {
      const s = Math.sqrt(disc)
      const r1 = (-B + s) / (2 * A)
      const r2 = (-B - s) / (2 * A)
      pieces.push([-Infinity, Math.min(r1, r2)], [Math.max(r1, r2), Infinity])
    }
  }
  return pieces
    .map(([p0, p1]) => [Math.max(p0, lo), Math.min(p1, hi)] as [number, number])
    .filter(([p0, p1]) => p1 >= p0)
}

/**
 * True when the ray from q towards the viewer passes through the body's interior.
 * The tolerance absorbs points that sit slightly inside the surface: chord midpoints
 * of sampled curves and vertices of the polygonal approximation used for sections.
 */
export function isHiddenRev(b: Revolution, q: Vec3, toViewer: Vec3, scaleRef: number): boolean {
  const eps = 3e-3 * scaleRef
  return rayIntervals(b, q, toViewer).some(([s0, s1]) => s1 - Math.max(s0, 0) > eps)
}

/**
 * Contour generatrices for a view direction: lateral lines whose surface
 * normal is perpendicular to the view. None when looking along the axis of a cone.
 */
export function contourGeneratrices(b: Revolution, v: Vec3): [Vec3, Vec3][] {
  if (b.kind === 'sphere') return []
  // Outward normal along the generatrix at angle θ: (cos θ, sin θ, (r1 − r2)/h).
  const kz = (b.r1 - b.r2) / b.h
  const rho = Math.hypot(v[0], v[1])
  const rhs = -v[2] * kz
  if (rho < 1e-12 || Math.abs(rhs) > rho) return []
  const base = Math.atan2(v[1], v[0])
  const d = Math.acos(rhs / rho)
  return [base + d, base - d].map((th) => {
    const c = Math.cos(th)
    const s = Math.sin(th)
    return [
      [b.r1 * c, b.r1 * s, -b.h / 2],
      [b.r2 * c, b.r2 * s, b.h / 2],
    ] as [Vec3, Vec3]
  })
}

/** Sphere contour: the great circle perpendicular to the view direction. */
export const sphereOutline = (b: Revolution, v: Vec3): Circle3 => ({ c: [0, 0, 0], n: normalize(v), r: b.r1 })

/**
 * Point of the curved surface from parameters: lateral surface — angle u and
 * height fraction w ∈ [0, 1] from the bottom; sphere — longitude u, latitude w.
 */
export function surfacePoint(b: Revolution, u: number, w: number): Vec3 {
  if (b.kind === 'sphere') {
    const c = Math.cos(w)
    return [b.r1 * c * Math.cos(u), b.r1 * c * Math.sin(u), b.r1 * Math.sin(w)]
  }
  const z = -b.h / 2 + w * b.h
  const r = radiusAt(b, z)
  return [r * Math.cos(u), r * Math.sin(u), z]
}

export function surfaceParams(b: Revolution, p: Vec3): { u: number; w: number } {
  const u = Math.atan2(p[1], p[0])
  if (b.kind === 'sphere') return { u, w: Math.asin(Math.max(-1, Math.min(1, p[2] / b.r1))) }
  return { u, w: (p[2] + b.h / 2) / b.h }
}

/**
 * First point of the body seen along the view ray through X (the viewer is at +∞ along v).
 * `part` tells whether it lies on a base or on the curved surface.
 */
export function frontHit(b: Revolution, X: Vec3, v: Vec3): { pos: Vec3; part: 'bottom' | 'top' | 'curved' } | null {
  const iv = rayIntervals(b, X, v)
  if (!iv.length) return null
  const s = Math.max(...iv.map((i) => i[1]))
  if (!Number.isFinite(s)) return null
  const pos = add(X, scale(v, s))
  if (b.kind !== 'sphere') {
    const tol = 1e-7 * b.h
    if (Math.abs(pos[2] + b.h / 2) < tol && Math.hypot(pos[0], pos[1]) < b.r1 - tol) return { pos, part: 'bottom' }
    if (Math.abs(pos[2] - b.h / 2) < tol && Math.hypot(pos[0], pos[1]) < b.r2 - tol) return { pos, part: 'top' }
  }
  return { pos, part: 'curved' }
}

/**
 * Polyhedral approximation used for sections and hit areas. The named points
 * come first (so v0, v1 … are O, O₁ / S); approximation vertices are unlabelled.
 * `smooth[f]` marks lateral facets.
 */
export function approximate(b: Revolution): Polyhedron {
  const named = namedPoints(b)
  const vertices: Vertex[] = [...named]
  const faces: number[][] = []
  const smooth: boolean[] = []
  const ring = (r: number, z: number, n: number) => {
    const start = vertices.length
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * i) / n
      vertices.push({ label: '', pos: [r * Math.cos(a), r * Math.sin(a), z] })
    }
    return (i: number) => start + (((i % n) + n) % n)
  }

  if (b.kind === 'sphere') {
    const lon = 64
    const lat = 32
    const south = vertices.length
    vertices.push({ label: '', pos: [0, 0, -b.r1] })
    const rings = []
    for (let j = 1; j < lat; j++) {
      const phi = -Math.PI / 2 + (Math.PI * j) / lat
      rings.push(ring(b.r1 * Math.cos(phi), b.r1 * Math.sin(phi), lon))
    }
    const north = vertices.length
    vertices.push({ label: '', pos: [0, 0, b.r1] })
    for (let i = 0; i < lon; i++) {
      faces.push([south, rings[0](i + 1), rings[0](i)])
      faces.push([north, rings[rings.length - 1](i), rings[rings.length - 1](i + 1)])
      for (let j = 0; j < rings.length - 1; j++) faces.push([rings[j](i), rings[j](i + 1), rings[j + 1](i + 1), rings[j + 1](i)])
    }
    faces.forEach(() => smooth.push(true))
    return { ...orientOutward({ vertices, faces }), smooth, rev: b }
  }

  const n = SEGMENTS
  const bottom = ring(b.r1, -b.h / 2, n)
  faces.push(Array.from({ length: n }, (_, i) => bottom(i)))
  smooth.push(false)
  if (b.kind === 'cone') {
    const apex = named.findIndex((p) => p.label === 'S')
    for (let i = 0; i < n; i++) {
      faces.push([bottom(i), bottom(i + 1), apex])
      smooth.push(true)
    }
  } else {
    const top = ring(b.r2, b.h / 2, n)
    faces.push(Array.from({ length: n }, (_, i) => top(i)))
    smooth.push(false)
    for (let i = 0; i < n; i++) {
      faces.push([bottom(i), bottom(i + 1), top(i + 1), top(i)])
      smooth.push(true)
    }
  }
  return { ...orientOutward({ vertices, faces }), smooth, rev: b }
}

/** Distance from p to the axis, for tests. */
export const axisDist = (p: Vec3) => len([p[0], p[1], 0])
