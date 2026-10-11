import { describe, expect, it } from 'vitest'
import {
  circleCenterPoint,
  circleCircle,
  circumcircle,
  lineCircle,
  pointOnCircle,
  angleOnCircle,
  tangencyPoints,
} from './circle'
import { angleBisector, angleDeg, foot, lineThrough, perpBisector, perpendicularThrough, parallelThrough } from './lines'
import { planeFrom3 } from './plane'
import { type Vec3, cross, dist, dot, normalize, sub } from './vec'

const Z: Vec3 = [0, 0, 1]
const tol = 1e-9

// An inclined plane to check that constructions do not assume z = 0.
const P0: Vec3 = [1, 2, 3]
const PU: Vec3 = normalize([1, 1, 0.5])
const PV: Vec3 = normalize(cross(cross(PU, [0.2, -0.4, 1]), PU))
const N = normalize(cross(PU, PV))
const inPlane = (x: number, y: number): Vec3 => [
  P0[0] + PU[0] * x + PV[0] * y,
  P0[1] + PU[1] * x + PV[1] * y,
  P0[2] + PU[2] * x + PV[2] * y,
]

describe.each([
  ['sheet', (x: number, y: number): Vec3 => [x, y, 0], Z],
  ['inclined plane', inPlane, N],
] as const)('constructions on %s', (_name, P, n) => {
  const A = P(0, 0)
  const B = P(6, 0)
  const C = P(2, 4)
  const AB = lineThrough(A, B)!

  it('perpendicular from an outside point passes through the foot', () => {
    const l = perpendicularThrough(AB, C, null, 1e-9)!
    expect(dot(l.d, AB.d)).toBeCloseTo(0, 9)
    expect(dist(l.p, foot(AB, C))).toBeCloseTo(0, 9)
  })

  it('perpendicular through a point on the line stays in the plane', () => {
    const M = P(3, 0)
    const l = perpendicularThrough(AB, M, n, 1e-9)!
    expect(dot(l.d, AB.d)).toBeCloseTo(0, 9)
    expect(dot(l.d, n)).toBeCloseTo(0, 9)
  })

  it('parallel keeps direction', () => {
    const l = parallelThrough(AB, C)
    expect(cross(l.d, AB.d).every((x) => Math.abs(x) < 1e-9)).toBe(true)
  })

  it('perpendicular bisector points are equidistant from the ends', () => {
    const l = perpBisector(A, B, n)!
    const q: Vec3 = [l.p[0] + 2.5 * l.d[0], l.p[1] + 2.5 * l.d[1], l.p[2] + 2.5 * l.d[2]]
    expect(dist(q, A)).toBeCloseTo(dist(q, B), 9)
  })

  it('angle bisector splits the angle in half', () => {
    const l = angleBisector(A, C, B)!
    const q: Vec3 = [l.p[0] + l.d[0], l.p[1] + l.d[1], l.p[2] + l.d[2]]
    expect(angleDeg(A, C, q)).toBeCloseTo(angleDeg(q, C, B), 9)
  })

  it('circumcircle passes through the three points', () => {
    const c = circumcircle(A, B, C)!
    for (const p of [A, B, C]) expect(dist(p, c.c)).toBeCloseTo(c.r, 9)
    expect(Math.abs(dot(c.n, n))).toBeCloseTo(1, 9)
  })

  it('point on circle round-trips its angle', () => {
    const c = circleCenterPoint(A, B, n)!
    const p = pointOnCircle(c, 1.1)
    expect(dist(p, A)).toBeCloseTo(c.r, 9)
    expect(angleOnCircle(c, p)).toBeCloseTo(1.1, 9)
  })

  it('line ∩ circle gives two points on both', () => {
    const c = circleCenterPoint(A, P(3, 0), n)!
    const pts = lineCircle(AB, c, tol)
    expect(pts).toHaveLength(2)
    for (const p of pts) expect(dist(p, A)).toBeCloseTo(3, 9)
  })

  it('circle ∩ circle gives two points on both circles', () => {
    const c1 = circleCenterPoint(A, P(4, 0), n)!
    const c2 = circleCenterPoint(B, P(2, 0), n)!
    const pts = circleCircle(c1, c2, tol)
    expect(pts).toHaveLength(2)
    for (const p of pts) {
      expect(dist(p, A)).toBeCloseTo(4, 9)
      expect(dist(p, B)).toBeCloseTo(4, 9)
    }
  })

  it('tangents from an outside point are perpendicular to the radius', () => {
    const c = circleCenterPoint(A, P(2, 0), n)!
    const ts = tangencyPoints(c, B, tol)
    expect(ts).toHaveLength(2)
    for (const t of ts) expect(dot(sub(t, A), sub(t, B))).toBeCloseTo(0, 9)
  })
})

describe('plane helper sanity', () => {
  it('inclined plane normal is consistent', () => {
    const pl = planeFrom3(inPlane(0, 0), inPlane(1, 0), inPlane(0, 1))!
    expect(Math.abs(dot(pl.n, N))).toBeCloseTo(1, 9)
  })
})
