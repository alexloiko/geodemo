import { describe, expect, it } from 'vitest'
import { makeProjector, ORTHO_CAMERA, TEXTBOOK_CAMERA } from '../render/camera'
import { planeFrom3 } from './plane'
import { section } from './section'
import { buildSolid } from './solids'
import {
  type Revolution,
  axisDist,
  contourGeneratrices,
  frontHit,
  isHiddenRev,
  radiusAt,
  rayIntervals,
  surfaceParams,
  surfacePoint,
} from './revolution'
import { type Vec3, add, cross, dist, dot, normalize, scale, sub } from './vec'

const cyl: Revolution = { kind: 'cylinder', r1: 2, r2: 2, h: 4 }
const cone: Revolution = { kind: 'cone', r1: 2, r2: 0, h: 4 }
const frustum: Revolution = { kind: 'frustum', r1: 3, r2: 1.5, h: 3 }
const sphere: Revolution = { kind: 'sphere', r1: 3, r2: 3, h: 6 }

describe.each([cyl, cone, frustum, sphere])('$kind', (b) => {
  it('ray through the centre enters and leaves the body', () => {
    const iv = rayIntervals(b, [-10, 0, 0], [1, 0, 0])
    expect(iv).toHaveLength(1)
    const r0 = b.kind === 'sphere' ? b.r1 : radiusAt(b, 0)
    expect(iv[0][0]).toBeCloseTo(10 - r0, 9)
    expect(iv[0][1]).toBeCloseTo(10 + r0, 9)
  })

  it('surface params round-trip', () => {
    const p = surfacePoint(b, 0.7, b.kind === 'sphere' ? 0.4 : 0.3)
    const { u, w } = surfaceParams(b, p)
    expect(dist(surfacePoint(b, u, w), p)).toBeCloseTo(0, 9)
  })

  it('front surface points are visible, back ones hidden', () => {
    const v = makeProjector(TEXTBOOK_CAMERA).toViewer
    const hit = frontHit(b, [0, 0, 0], v)!
    expect(isHiddenRev(b, hit.pos, v, 3)).toBe(false)
    const back = frontHit(b, [0, 0, 0], scale(v, -1))!
    expect(isHiddenRev(b, back.pos, v, 3)).toBe(true)
  })
})

describe('visibility of sampled curves', () => {
  it('front half of the sphere equator is visible, back half hidden (chord midpoints)', () => {
    const v = makeProjector(ORTHO_CAMERA).toViewer
    const n = 160
    const mid = (i: number): Vec3 => {
      const a = (2 * Math.PI * i) / n
      const b = (2 * Math.PI * (i + 1)) / n
      return [1.5 * (Math.cos(a) + Math.cos(b)), 1.5 * (Math.sin(a) + Math.sin(b)), 0]
    }
    const hidden = Array.from({ length: n }, (_, i) => isHiddenRev(sphere, mid(i), v, 3))
    const visible = hidden.filter((h) => !h).length
    expect(visible).toBeGreaterThan(n * 0.4)
    expect(visible).toBeLessThan(n * 0.6)
  })
})

describe('contour generatrices', () => {
  it.each([cyl, cone, frustum])('$kind: surface normal along the contour is ⟂ view', (b) => {
    const v = makeProjector(ORTHO_CAMERA).toViewer
    const gs = contourGeneratrices(b, v)
    expect(gs).toHaveLength(2)
    for (const [p, q] of gs) {
      // normal = (tangent along the rim) × (generatrix direction)
      const th = Math.atan2(p[1], p[0])
      const tangent: Vec3 = [-Math.sin(th), Math.cos(th), 0]
      const n = normalize(cross(tangent, sub(q, p)))
      expect(Math.abs(dot(n, v))).toBeLessThan(1e-9)
    }
  })

  it('no contour lines for a cone seen from straight above', () => {
    expect(contourGeneratrices(cone, [0, 0, 1])).toHaveLength(0)
  })
})

describe('sections of the approximation', () => {
  it('axial section of a cylinder is a rectangle 2r × h', () => {
    const p = buildSolid({ kind: 'cylinder', r: 2, h: 4 })
    const sec = section(p, planeFrom3([0, 0, 0], [1, 0, 0], [0, 0, 1])!)
    expect(sec).toHaveLength(4)
    for (const v of sec) expect(axisDist(v.pos)).toBeCloseTo(2, 3)
  })

  it('section parallel to the base of a cone is a circle of the right radius', () => {
    const p = buildSolid({ kind: 'cone', r: 2, h: 4 })
    const sec = section(p, planeFrom3([0, 0, 0], [1, 0, 0], [0, 1, 0])!)
    for (const v of sec) expect(axisDist(v.pos)).toBeCloseTo(1, 3)
  })

  it('named points come first and are not on faces', () => {
    const p = buildSolid({ kind: 'cylinder', r: 2, h: 4 })
    expect(p.vertices.slice(0, 2).map((v) => v.label)).toEqual(['O', 'O_1'])
    expect(new Set(p.faces.flat()).has(0)).toBe(false)
  })

  it('front hit on the top base is classified as top', () => {
    const hit = frontHit(cyl, [0.5, 0.5, 0], [0, 0, 1])!
    expect(hit.part).toBe('top')
    expect(dist(hit.pos, add([0.5, 0.5, 0], [0, 0, 2]))).toBeCloseTo(0, 9)
  })
})
