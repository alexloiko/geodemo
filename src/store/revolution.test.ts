import { beforeEach, describe, expect, it } from 'vitest'
import { dist } from '../geometry/vec'
import { evaluate } from '../scene/evaluate'
import type { SolidSpec } from '../geometry/solids'
import { useStore } from './store'

const st = () => useStore.getState()
const ev = () => evaluate(st().doc)
const points = () => st().doc.items.filter((i) => i.type === 'point')

function load(solid: SolidSpec) {
  useStore.setState({ doc: { solid, items: [] }, picks: [], message: null, planeChoice: null, tool: 'select' })
}

describe('cylinder', () => {
  beforeEach(() => load({ kind: 'cylinder', r: 2, h: 4 }))

  it('has centres O, O₁ and two base circles', () => {
    const e = ev()
    expect([...e.labels.values()]).toEqual(['O', 'O_1'])
    expect(e.circles.has('rim0') && e.circles.has('rim1')).toBe(true)
  })

  it('axial section through O, O₁ and a point on the bottom circle is an exact rectangle', () => {
    st().setTool('point')
    st().hit({ kind: 'circle', ref: 'rim0', angle: 0.3 })
    const a = points()[0].id
    st().setTool('plane')
    st().hit({ kind: 'point', ref: 'v0' })
    st().hit({ kind: 'point', ref: 'v1' })
    st().hit({ kind: 'point', ref: a })
    const e = ev()
    // A plus three new exact corner points (two on each base circle), named like a textbook.
    expect(points()).toHaveLength(4)
    expect(points().map((p) => (p.type === 'point' ? p.label : '')).sort()).toEqual(['A', 'A_1', 'B', 'B_1'])
    const pl = [...e.planes.values()][0]
    expect(pl.section).toHaveLength(4)
    expect(pl.refs.every((r) => r !== null)).toBe(true)
    for (const v of pl.section) expect(Math.hypot(v.pos[0], v.pos[1])).toBeCloseTo(2, 9)
  })

  it('a click on the lateral surface creates a point on it', () => {
    st().setTool('point')
    st().hit({ kind: 'surface', u: 1, w: 0.5 })
    const p = ev().points.get(points()[0].id)!
    expect(Math.hypot(p[0], p[1])).toBeCloseTo(2, 9)
    expect(p[2]).toBeCloseTo(0, 9)
  })

  it('base faces are the only working planes', () => {
    st().setTool('perpBisector')
    st().hit({ kind: 'point', ref: 'v0' })
    st().setTool('point')
    st().hit({ kind: 'circle', ref: 'rim0', angle: 0 })
    st().setTool('perpBisector')
    st().hit({ kind: 'point', ref: 'v0' })
    st().hit({ kind: 'point', ref: points()[0].id })
    // O and the rim point both lie only in the bottom base.
    expect(st().planeChoice).toBeNull()
    expect(st().doc.items.some((i) => i.type === 'line')).toBe(true)
  })
})

describe('sphere', () => {
  beforeEach(() => load({ kind: 'sphere', r: 3 }))

  it('a plane section is an exact circle', () => {
    st().setTool('point')
    st().hit({ kind: 'surface', u: 0, w: 0.5 })
    st().hit({ kind: 'surface', u: 2, w: 0.5 })
    st().hit({ kind: 'surface', u: 4, w: 0.5 })
    const [a, b, c] = points().map((p) => p.id)
    st().setTool('plane')
    st().hit({ kind: 'point', ref: a })
    st().hit({ kind: 'point', ref: b })
    st().hit({ kind: 'point', ref: c })
    const pl = [...ev().planes.values()][0]
    expect(pl.circle!.r).toBeCloseTo(3 * Math.cos(0.5), 9)
    expect(dist(pl.circle!.c, [0, 0, 3 * Math.sin(0.5)])).toBeCloseTo(0, 9)
  })
})

describe('cone', () => {
  beforeEach(() => load({ kind: 'cone', r: 2, h: 4 }))

  it('axial section through the apex is a triangle with exact base corners', () => {
    st().setTool('plane')
    st().hit({ kind: 'point', ref: 'v0' }) // O
    st().hit({ kind: 'point', ref: 'v1' }) // S
    st().setTool('plane')
    st().hit({ kind: 'point', ref: 'v0' })
    st().hit({ kind: 'point', ref: 'v1' })
    st().hit({ kind: 'circle', ref: 'rim0', angle: 1 })
    const pl = [...ev().planes.values()][0]
    expect(pl.section).toHaveLength(3)
    expect(pl.refs.every((r) => r !== null)).toBe(true)
  })
})
