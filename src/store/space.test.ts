import { beforeEach, describe, expect, it } from 'vitest'
import { angleDeg } from '../geometry/lines'
import { type Vec3, dist, dot, normalize, sub } from '../geometry/vec'
import { migrate } from '../persist/persist'
import { evaluate } from '../scene/evaluate'
import type { Doc, Item } from '../scene/model'
import { useStore } from './store'

const st = () => useStore.getState()
const ev = () => evaluate(st().doc)
const items = (type: Item['type']) => st().doc.items.filter((i) => i.type === type)
const V = ['A', 'B', 'C', 'D', 'A_1', 'B_1', 'C_1', 'D_1']
const v = (l: string) => `v${V.indexOf(l)}`
const pos = (ref: string) => ev().points.get(ref)!
/** Face index of the cube whose vertices are exactly these labels. */
const face = (...ls: string[]) => {
  const e = ev()
  return e.solid!.faces.findIndex((f) => f.length === ls.length && f.every((i) => ls.includes(e.solid!.vertices[i].label)))
}

beforeEach(() => {
  useStore.setState({ doc: { solid: { kind: 'cube', a: 4 }, items: [] }, picks: [], message: null, planeChoice: null })
})

describe('space constructions on a cube', () => {
  it('trace of the diagonal A C₁ on the top face is C₁', () => {
    st().setTool('segment')
    st().hit({ kind: 'point', ref: v('A') })
    st().hit({ kind: 'point', ref: v('C_1') })
    st().setTool('trace')
    st().hit({ kind: 'line', ref: items('segment')[0].id, t: 0.5, bounded: true })
    st().hit({ kind: 'face', face: face('A_1', 'B_1', 'C_1', 'D_1'), pos: [0, 0, 2] })
    const p = items('point')[0]
    expect(dist(pos(p.id), pos(v('C_1')))).toBeCloseTo(0, 9)
  })

  it('planes ∩: two adjacent faces meet along their common edge', () => {
    st().setTool('planesMeet')
    st().hit({ kind: 'face', face: face('A', 'B', 'B_1', 'A_1'), pos: [0, 0, 0] })
    st().hit({ kind: 'face', face: face('B', 'C', 'C_1', 'B_1'), pos: [0, 0, 0] })
    const l = ev().lines.get(items('line')[0].id)!
    const d = normalize(sub(pos(v('B_1')), pos(v('B'))))
    expect(Math.abs(dot(normalize(l.d), d))).toBeCloseTo(1, 9)
  })

  it('parallel plane through the midpoint of AA₁ cuts a square section', () => {
    st().setTool('midpoint')
    st().hit({ kind: 'point', ref: v('A') })
    st().hit({ kind: 'point', ref: v('A_1') })
    st().setTool('parallelPlane')
    st().hit({ kind: 'point', ref: items('point')[0].id })
    st().hit({ kind: 'face', face: face('A', 'B', 'C', 'D'), pos: [0, 0, -2] })
    const pl = [...ev().planes.values()][0]
    expect(pl.section).toHaveLength(4)
    for (const s of pl.section) expect(s.pos[2]).toBeCloseTo(0, 9)
  })

  it('perpendicular from C₁ to the plane (A B D) lands on C', () => {
    st().setTool('plane')
    for (const l of ['A', 'B', 'D']) st().hit({ kind: 'point', ref: v(l) })
    const plane = items('plane')[0].id
    st().setTool('perpPlane')
    st().hit({ kind: 'point', ref: v('C_1') })
    st().hit({ kind: 'plane', ref: plane })
    // The foot is the vertex C itself: no duplicate point, the mark sits at C.
    expect(items('point')).toHaveLength(0)
    const m = items('mark')[0]
    expect(m.type === 'mark' && m.def.kind === 'rightPlane' && m.def.at).toBe(v('C'))
  })

  it('angle between the diagonal A C₁ and the base is arctan(1/√2)', () => {
    st().setTool('segment')
    st().hit({ kind: 'point', ref: v('A') })
    st().hit({ kind: 'point', ref: v('C_1') })
    st().setTool('lineAngle')
    st().hit({ kind: 'line', ref: items('segment')[0].id, t: 0.5, bounded: true })
    st().hit({ kind: 'face', face: face('A', 'B', 'C', 'D'), pos: [0, 0, -2] })
    const ang = items('angle')[0]
    if (ang.type !== 'angle') throw new Error()
    const deg = angleDeg(pos(ang.a), pos(ang.vertex), pos(ang.b))
    expect(deg).toBeCloseTo((Math.atan(1 / Math.SQRT2) * 180) / Math.PI, 9)
    // The trace of AC₁ on the base is A itself: no duplicate point O.
    expect(ang.vertex).toBe(v('A'))
  })

  it('plane through the centre perpendicular to the diagonal is a regular hexagon', () => {
    st().setTool('segment')
    st().hit({ kind: 'point', ref: v('A') })
    st().hit({ kind: 'point', ref: v('C_1') })
    st().setTool('midpoint')
    st().hit({ kind: 'point', ref: v('A') })
    st().hit({ kind: 'point', ref: v('C_1') })
    const m = items('point')[0].id
    st().setTool('planePerpLine')
    st().hit({ kind: 'point', ref: m })
    st().hit({ kind: 'line', ref: items('segment')[0].id, t: 0.3, bounded: true })
    const sec = [...ev().planes.values()][0].section
    expect(sec).toHaveLength(6)
    const sides = sec.map((s, i) => dist(s.pos, sec[(i + 1) % 6].pos))
    for (const x of sides) expect(x).toBeCloseTo(sides[0], 9)
  })

  it('a click on a section picks its plane', () => {
    st().setTool('plane')
    for (const l of ['A', 'C', 'C_1']) st().hit({ kind: 'point', ref: v(l) })
    st().setTool('perpPlane')
    st().hit({ kind: 'point', ref: v('B') })
    st().hit({ kind: 'plane', ref: items('plane')[0].id })
    const h = items('point').find((p) => p.type === 'point' && p.label === 'H')!
    // Foot of B on the diagonal plane ACC₁ is the centre of the base … projected: on line AC.
    const [a, c] = [pos(v('A')), pos(v('C'))]
    const hp: Vec3 = pos(h.id)
    expect(dist(hp, [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, hp[2]])).toBeCloseTo(0, 9)
  })
})

describe('persistence v2 → v3', () => {
  it('planes get a definition', () => {
    const v2 = {
      v: 2,
      doc: {
        solid: { kind: 'cube', a: 4 },
        items: [{ id: 'pl1', type: 'plane', a: 'v0', b: 'v1', c: 'v2', extend: false, color: '#00f', visible: true }],
      } as unknown as Doc,
    }
    const m = migrate(v2)!
    const p = m.doc.items[0]
    expect(p.type === 'plane' && p.def).toEqual({ kind: 'three', a: 'v0', b: 'v1', c: 'v2' })
    expect(evaluate(m.doc).planes.size).toBe(1)
  })
})
