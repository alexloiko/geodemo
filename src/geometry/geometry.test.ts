import { describe, expect, it } from 'vitest'
import { makeProjector, TEXTBOOK_CAMERA } from '../render/camera'
import { intersectLines, planeFrom3 } from './plane'
import { edgesOf, halfSpaces } from './polyhedron'
import { section } from './section'
import { buildSolid, defaultSpec, SOLID_KINDS } from './solids'
import { dist, lerp } from './vec'
import { isHidden, splitByVisibility } from './visibility'

const idx = (labels: string[], l: string) => labels.indexOf(l)

describe('solids', () => {
  it.each(SOLID_KINDS)('%s satisfies Euler V - E + F = 2', (kind) => {
    const p = buildSolid(defaultSpec(kind))
    expect(p.vertices.length - edgesOf(p).length + p.faces.length).toBe(2)
    // every edge has two faces
    expect(edgesOf(p).every((e) => e.faces[1] >= 0)).toBe(true)
  })
})

describe('cube sections', () => {
  const cube = buildSolid({ kind: 'cube', a: 2 })
  const P = (l: string) => cube.vertices[idx(cube.vertices.map((v) => v.label), l)].pos
  it('diagonal plane A B_1 C... gives a triangle through three vertices', () => {
    const pl = planeFrom3(P('A'), P('C'), P('B_1'))!
    expect(section(cube, pl)).toHaveLength(3)
  })
  it('plane through midpoints gives a regular hexagon', () => {
    const mids = [
      lerp(P('A'), P('B'), 0.5),
      lerp(P('B'), P('C'), 0.5),
      lerp(P('C'), P('C_1'), 0.5),
    ]
    const sec = section(cube, planeFrom3(mids[0], mids[1], mids[2])!)
    expect(sec).toHaveLength(6)
    const sides = sec.map((v, i) => dist(v.pos, sec[(i + 1) % 6].pos))
    for (const s of sides) expect(s).toBeCloseTo(sides[0], 9)
  })
  it('horizontal plane gives a square', () => {
    const sec = section(cube, planeFrom3(lerp(P('A'), P('A_1'), 0.3), lerp(P('B'), P('B_1'), 0.3), lerp(P('C'), P('C_1'), 0.3))!)
    expect(sec).toHaveLength(4)
  })
})

describe('textbook example: triangular prism, A_1K : KB_1 = 3 : 1, plane (A, C, K)', () => {
  const prism = buildSolid({ kind: 'prism', n: 3, side: 5, height: 4, shift: 0 })
  const L = prism.vertices.map((v) => v.label)
  const P = (l: string) => prism.vertices[idx(L, l)].pos
  const K = lerp(P('A_1'), P('B_1'), 0.75)
  const pl = planeFrom3(P('A'), P('C'), K)!
  const sec = section(prism, pl)

  it('section is a quadrilateral A, C, L, K', () => {
    expect(sec).toHaveLength(4)
    const vs = sec.filter((v) => v.vertex !== undefined).map((v) => L[v.vertex!]).sort()
    expect(vs).toEqual(['A', 'C'])
  })

  it('L lies on B_1C_1 with C_1L : LB_1 = 3 : 1', () => {
    const onB1C1 = sec.find((v) => v.edge && [L[v.edge.a], L[v.edge.b]].sort().join() === 'B_1,C_1')!
    expect(onB1C1).toBeDefined()
    const l = onB1C1.pos
    expect(dist(P('C_1'), l) / dist(l, P('B_1'))).toBeCloseTo(3, 9)
  })

  it('P = AK ∩ BB_1 lies above B_1 with B_1P = BB_1 / 3', () => {
    const p = intersectLines(P('A'), K, P('B'), P('B_1'))!
    expect(p).not.toBeNull()
    expect(p[2]).toBeGreaterThan(P('B_1')[2])
    expect(dist(P('B_1'), p)).toBeCloseTo(dist(P('B'), P('B_1')) / 3, 9)
  })

  it('AK is hidden and AC visible in the textbook view', () => {
    const pr = makeProjector(TEXTBOOK_CAMERA)
    const hs = halfSpaces(prism)
    const mid = lerp(P('A'), K, 0.5)
    expect(isHidden(hs, pr.toViewer, mid, 5)).toBe(true)
    expect(isHidden(hs, pr.toViewer, lerp(P('A'), P('C'), 0.5), 5)).toBe(false)
    // AB is the hidden back edge (dashed in the textbook drawing)
    expect(isHidden(hs, pr.toViewer, lerp(P('A'), P('B'), 0.5), 5)).toBe(true)
  })

  it('a segment crossing behind the solid splits into visible-hidden-visible', () => {
    const pr = makeProjector(TEXTBOOK_CAMERA)
    const hs = halfSpaces(prism)
    // segment from far left-back to far right-back behind the prism
    const pieces = splitByVisibility(hs, pr.toViewer, [-20, 10, -3.5], [20, 10, -3.5], 5)
    expect(pieces.map((p) => p.hidden)).toEqual([false, true, false])
  })
})
