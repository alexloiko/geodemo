import { beforeEach, describe, expect, it } from 'vitest'
import { foot, lineThrough } from '../geometry/lines'
import { type Vec3, dist, dot, sub } from '../geometry/vec'
import { evaluate } from '../scene/evaluate'
import type { Item } from '../scene/model'
import { type Tool, useStore } from './store'

const st = () => useStore.getState()
const ev = () => evaluate(st().doc)
const items = (type: Item['type']) => st().doc.items.filter((i) => i.type === type)
const ref = (l: string) => [...ev().labels.entries()].find(([, v]) => v === l)![0]
const pos = (l: string) => ev().points.get(ref(l))!
const at = (x: number, y: number) => st().hit({ kind: 'empty', pos: [x, y, 0] })
const pt = (l: string) => st().hit({ kind: 'point', ref: ref(l) })
const pick = (t: Tool) => st().setTool(t)

/** Triangle ABC on the sheet. */
function triangle(a: Vec3, b: Vec3, c: Vec3) {
  useStore.setState({ doc: { solid: null, items: [] }, picks: [], message: null })
  pick('polygon')
  at(a[0], a[1])
  at(b[0], b[1])
  at(c[0], c[1])
  pt('A')
}

describe('triangle tools on the sheet', () => {
  beforeEach(() => triangle([0, 0, 0], [6, 0, 0], [1, 4, 0]))

  it('median from C: midpoint M of AB, segment, ticks', () => {
    pick('median')
    pt('C')
    pt('A')
    pt('B')
    expect(pos('M')).toEqual([3, 0, 0])
    expect(items('segment')).toHaveLength(1)
    expect(items('mark')).toHaveLength(2)
  })

  it('altitude from C: foot H on AB, right angle', () => {
    pick('altitude')
    pt('C')
    pt('A')
    pt('B')
    expect(dist(pos('H'), [1, 0, 0])).toBeCloseTo(0, 9)
    expect(items('mark')).toHaveLength(1)
  })

  it('bisector from A splits BC in the ratio AB : AC', () => {
    pick('triBisector')
    pt('A')
    pt('B')
    pt('C')
    const [b, c, l] = [pos('B'), pos('C'), pos('L')]
    expect(dist(b, l) / dist(l, c)).toBeCloseTo(dist(pos('A'), b) / dist(pos('A'), c), 9)
  })

  it('midline from A joins the midpoints of AB and AC', () => {
    pick('midline')
    pt('A')
    pt('B')
    pt('C')
    expect(pos('M')).toEqual([3, 0, 0])
    expect(pos('N')).toEqual([0.5, 2, 0])
  })

  it('incircle touches all sides', () => {
    pick('incircle')
    pt('A')
    pt('B')
    pt('C')
    const c = ev().circles.get(items('circle')[0].id)!
    for (const [x, y] of [
      ['A', 'B'],
      ['B', 'C'],
      ['C', 'A'],
    ]) {
      const l = lineThrough(pos(x), pos(y))!
      expect(dist(c.c, foot(l, c.c))).toBeCloseTo(c.r, 9)
    }
  })

  it('centroid G with three auxiliary medians', () => {
    pick('centroid')
    pt('A')
    pt('B')
    pt('C')
    expect(dist(pos('G'), [7 / 3, 4 / 3, 0])).toBeCloseTo(0, 9)
    expect(items('segment').filter((s) => s.type === 'segment' && s.aux)).toHaveLength(3)
  })

  it('orthocentre H: CH ⟂ AB and AH ⟂ BC', () => {
    pick('orthocenter')
    pt('A')
    pt('B')
    pt('C')
    const h = pos('H')
    expect(dot(sub(h, pos('C')), sub(pos('B'), pos('A')))).toBeCloseTo(0, 9)
    expect(dot(sub(h, pos('A')), sub(pos('C'), pos('B')))).toBeCloseTo(0, 9)
  })

  it('centre of a circumcircle', () => {
    pick('circle3')
    pt('A')
    pt('B')
    pt('C')
    pick('center')
    st().hit({ kind: 'circle', ref: items('circle')[0].id, angle: 0 })
    const o = pos('O')
    expect(dist(o, pos('A'))).toBeCloseTo(dist(o, pos('B')), 9)
    expect(dist(o, pos('A'))).toBeCloseTo(dist(o, pos('C')), 9)
  })
})

describe('obtuse triangle', () => {
  beforeEach(() => triangle([0, 0, 0], [4, 0, 0], [6, 3, 0]))

  it('altitude from C falls outside AB: the side is extended with a dashed segment', () => {
    pick('altitude')
    pt('C')
    pt('A')
    pt('B')
    expect(dist(pos('H'), [6, 0, 0])).toBeCloseTo(0, 9)
    expect(items('segment').filter((s) => s.type === 'segment' && s.aux)).toHaveLength(1)
  })
})

describe('triangle tools on a solid face', () => {
  it('altitude of the lateral face SAB of a pyramid lands on AB', () => {
    useStore.setState({ doc: { solid: { kind: 'pyramid', n: 4, side: 4, height: 5, apex: 'center' }, items: [] }, picks: [] })
    pick('altitude')
    st().hit({ kind: 'point', ref: 'v4' }) // S
    st().hit({ kind: 'point', ref: 'v0' })
    st().hit({ kind: 'point', ref: 'v1' })
    const h = items('point')[0].id
    const p = ev().points.get(h)!
    const [a, b] = [ev().points.get('v0')!, ev().points.get('v1')!]
    // Regular pyramid: the apothem's foot is the midpoint of the base edge.
    expect(dist(p, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2])).toBeCloseTo(0, 9)
  })
})
