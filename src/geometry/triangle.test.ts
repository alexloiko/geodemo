import { describe, expect, it } from 'vitest'
import { angleDeg, foot, lineThrough } from './lines'
import { bisectorFoot, centroid3, incenter, incircle, orthocenter } from './triangle'
import { type Vec3, dist, dot, sub } from './vec'

const A: Vec3 = [0, 0, 0]
const B: Vec3 = [7, 0, 0]
const C: Vec3 = [2, 5, 1] // not in z = 0: works in any plane

describe('triangle centres', () => {
  it('centroid divides medians 2:1', () => {
    const g = centroid3(A, B, C)
    const m: Vec3 = [(B[0] + C[0]) / 2, (B[1] + C[1]) / 2, (B[2] + C[2]) / 2]
    expect(dist(A, g) / dist(g, m)).toBeCloseTo(2, 9)
  })

  it('incentre is equidistant from the sides and the incircle touches them', () => {
    const i = incenter(A, B, C)!
    const d = [lineThrough(A, B)!, lineThrough(B, C)!, lineThrough(C, A)!].map((l) => dist(i, foot(l, i)))
    expect(d[1]).toBeCloseTo(d[0], 9)
    expect(d[2]).toBeCloseTo(d[0], 9)
    expect(incircle(A, B, C)!.r).toBeCloseTo(d[0], 9)
  })

  it('orthocentre: AH ⟂ BC and BH ⟂ CA', () => {
    const h = orthocenter(A, B, C)!
    expect(dot(sub(h, A), sub(C, B))).toBeCloseTo(0, 9)
    expect(dot(sub(h, B), sub(A, C))).toBeCloseTo(0, 9)
  })

  it('bisector foot splits the angle in half', () => {
    const l = bisectorFoot(A, B, C)!
    expect(angleDeg(B, A, l)).toBeCloseTo(angleDeg(l, A, C), 9)
  })
})
