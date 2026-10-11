import { beforeEach, describe, expect, it } from 'vitest'
import { angleDeg } from '../geometry/lines'
import { type Vec3, dist, dot, normalize, sub } from '../geometry/vec'
import { migrate } from '../persist/persist'
import { evaluate } from '../scene/evaluate'
import type { Doc, Item } from '../scene/model'
import { type Tool, useStore } from './store'

const st = () => useStore.getState()
const ev = () => evaluate(st().doc)
const items = (type: Item['type']) => st().doc.items.filter((i) => i.type === type)
const ptByLabel = (l: string) => [...ev().labels.entries()].find(([, v]) => v === l)![0]
const pos = (l: string) => ev().points.get(ptByLabel(l))!

/** Click on the empty sheet at (x, y). */
const at = (x: number, y: number) => st().hit({ kind: 'empty', pos: [x, y, 0] })
const point = (label: string) => st().hit({ kind: 'point', ref: ptByLabel(label) })
const use = (t: Tool) => st().setTool(t)

function sheet() {
  useStore.setState({ doc: { solid: null, items: [] }, past: [], future: [], picks: [], message: null, planeChoice: null })
}

describe('tools on the 2D sheet', () => {
  beforeEach(sheet)

  it('segment by two clicks creates two points A, B and a segment', () => {
    use('segment')
    at(0, 0)
    at(4, 0)
    expect(items('point').map((p) => (p.type === 'point' ? p.label : ''))).toEqual(['A', 'B'])
    expect(items('segment')).toHaveLength(1)
  })

  it('perpendicular from an outside point creates the foot H and a right-angle mark', () => {
    use('segment')
    at(0, 0)
    at(6, 0)
    use('point')
    at(2, 3)
    use('perpendicular')
    point('C')
    st().hit({ kind: 'line', ref: items('segment')[0].id, t: 0.5, bounded: true })
    const h = pos('H')
    expect(h[0]).toBeCloseTo(2, 9)
    expect(h[1]).toBeCloseTo(0, 9)
    expect(items('mark')).toHaveLength(1)
  })

  it('perpendicular through a point on the line is perpendicular in the sheet', () => {
    use('segment')
    at(0, 0)
    at(6, 2)
    const seg = items('segment')[0].id
    use('perpendicular')
    st().hit({ kind: 'line', ref: seg, t: 0.5, bounded: true }) // creates a point on the segment
    st().hit({ kind: 'line', ref: seg, t: 0.5, bounded: true })
    const line = items('line')[0]
    const l = ev().lines.get(line.id)!
    expect(dot(normalize(l.d), normalize([6, 2, 0]))).toBeCloseTo(0, 9)
    expect(l.d[2]).toBeCloseTo(0, 9)
  })

  it('perpendicular bisector adds midpoint M, ticks and a right angle', () => {
    use('perpBisector')
    at(0, 0)
    at(4, 2)
    expect(pos('M')).toEqual([2, 1, 0])
    expect(items('mark')).toHaveLength(3)
    const l = ev().lines.get(items('line')[0].id)!
    const q: Vec3 = [l.p[0] + 3 * l.d[0], l.p[1] + 3 * l.d[1], 0]
    expect(dist(q, pos('A'))).toBeCloseTo(dist(q, pos('B')), 9)
  })

  it('angle bisector halves the angle', () => {
    use('angleBisector')
    at(4, 0)
    at(0, 0)
    at(1, 3)
    const l = ev().lines.get(items('line')[0].id)!
    const q: Vec3 = [l.p[0] + l.d[0], l.p[1] + l.d[1], 0]
    expect(angleDeg(pos('A'), pos('B'), q)).toBeCloseTo(angleDeg(q, pos('B'), pos('C')), 9)
  })

  it('circle through 3 points, then intersect it with a line → 2 points', () => {
    use('circle3')
    at(0, 0)
    at(4, 0)
    at(0, 4)
    const circle = items('circle')[0].id
    use('line')
    at(-5, 1)
    at(5, 1)
    const line = items('line')[0].id
    use('intersect')
    st().hit({ kind: 'line', ref: line, t: 0.5, bounded: false })
    st().hit({ kind: 'circle', ref: circle, angle: 0 })
    const c = ev().circles.get(circle)!
    const meet = st().doc.items.filter((i) => i.type === 'point' && i.def.kind === 'meet')
    expect(meet).toHaveLength(2)
    for (const m of meet) expect(dist(ev().points.get(m.id)!, c.c)).toBeCloseTo(c.r, 9)
  })

  it('tangents from an outside point touch the circle', () => {
    use('circleCR')
    st().setOpts({ radius: 2 })
    at(0, 0)
    use('tangent')
    at(5, 0)
    st().hit({ kind: 'circle', ref: items('circle')[0].id, angle: 0 })
    const touch = st().doc.items.filter((i) => i.type === 'point' && i.def.kind === 'tangency')
    expect(touch).toHaveLength(2)
    for (const t of touch) {
      const p = ev().points.get(t.id)!
      expect(dot(sub(p, [0, 0, 0]), sub(p, [5, 0, 0]))).toBeCloseTo(0, 9)
    }
  })

  it('point on a circle via a click on the circle', () => {
    use('circleCR')
    st().setOpts({ radius: 3 })
    at(0, 0)
    use('point')
    st().hit({ kind: 'circle', ref: items('circle')[0].id, angle: Math.PI / 2 })
    const p = items('point').at(-1)!
    expect(ev().points.get(p.id)![1]).toBeCloseTo(3, 9)
  })

  it('polygon closes when the first vertex is clicked again', () => {
    use('polygon')
    at(0, 0)
    at(4, 0)
    at(2, 3)
    point('A')
    expect(items('polygon')).toHaveLength(1)
  })

  it('reports an error when objects do not intersect', () => {
    use('circleCR')
    st().setOpts({ radius: 1 })
    at(0, 0)
    use('line')
    at(-5, 4)
    at(5, 4)
    use('intersect')
    st().hit({ kind: 'line', ref: items('line')[0].id, t: 0, bounded: false })
    st().hit({ kind: 'circle', ref: items('circle')[0].id, angle: 0 })
    expect(st().message).toBe('err.noIntersection')
  })
})

describe('planar tools on a solid', () => {
  beforeEach(() => {
    useStore.setState({
      doc: { solid: { kind: 'cube', a: 4 }, items: [] },
      picks: [],
      message: null,
      planeChoice: null,
      opts: { ...st().opts, workingPlane: 'auto' },
    })
  })

  it('perpendicular bisector of an edge asks which face, then builds in it', () => {
    use('perpBisector')
    st().hit({ kind: 'point', ref: 'v0' })
    st().hit({ kind: 'point', ref: 'v1' })
    const choice = st().planeChoice!
    expect(choice.options.length).toBe(2)
    st().choosePlane(choice.options[0])
    const l = ev().lines.get(items('line')[0].id)!
    const face = Number(choice.options[0].slice(1))
    const n = (() => {
      const e = ev()
      const f = e.solid!.faces[face].map((i) => e.solid!.vertices[i].pos)
      return normalize([...((a: Vec3, b: Vec3) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]])(sub(f[1], f[0]), sub(f[2], f[0]))] as unknown as Vec3)
    })()
    expect(dot(l.d, n)).toBeCloseTo(0, 9)
  })

  it('perpendicular from a vertex to an edge in the same face needs no choice', () => {
    use('perpendicular')
    st().hit({ kind: 'point', ref: 'v2' })
    st().hit({ kind: 'line', ref: 'v0|v1', t: 0.5, bounded: true })
    expect(st().planeChoice).toBeNull()
    expect(items('line')).toHaveLength(1)
  })

  it('a click on a face creates a free point in that face', () => {
    use('point')
    st().hit({ kind: 'face', face: 0, pos: [0, 0, -2] })
    const p = items('point')[0]
    expect(p.type === 'point' && p.def.kind === 'free' && p.def.plane).toBe('f0')
  })
})

describe('persistence', () => {
  it('migrates v1 lines to v2 definitions', () => {
    const v1 = {
      v: 1,
      doc: {
        solid: { kind: 'cube', a: 4 },
        items: [{ id: 'l1', type: 'line', a: 'v0', b: 'v1', color: '#888', visible: true }],
      } as unknown as Doc,
    }
    const m = migrate(v1)!
    expect(m.v).toBe(2)
    const line = m.doc.items[0]
    expect(line.type === 'line' && line.def).toEqual({ kind: 'through', a: 'v0', b: 'v1' })
    expect(evaluate(m.doc).invalid.size).toBe(0)
  })
})
