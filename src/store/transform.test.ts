import { beforeEach, describe, expect, it } from 'vitest'
import { type Vec3, dist } from '../geometry/vec'
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
const close = (a: Vec3, b: Vec3) => expect(dist(a, b)).toBeCloseTo(0, 9)

/** Triangle ABC (polygon) and a point O on the sheet. */
beforeEach(() => {
  useStore.setState({ doc: { solid: null, items: [] }, picks: [], message: null, opts: { ...st().opts, angle: 90, k: 2 } })
  pick('polygon')
  at(1, 0)
  at(3, 0)
  at(1, 2)
  pt('A')
  pick('point')
  at(0, 0)
})
const triangle = () => items('polygon')[0].id

describe('transformations on the sheet', () => {
  it('point symmetry of a polygon gives A′B′C′ with primes', () => {
    pick('reflectPoint')
    st().hit({ kind: 'polygon', ref: triangle() })
    pt('D')
    close(pos('A′'), [-1, 0, 0])
    close(pos('B′'), [-3, 0, 0])
    close(pos('C′'), [-1, -2, 0])
    expect(items('polygon')).toHaveLength(2)
  })

  it('line symmetry about the side AB', () => {
    pick('reflectLine')
    pt('C')
    st().hit({ kind: 'line', ref: `${ref('A')}|${ref('B')}`, t: 0.5, bounded: true })
    close(pos('C′'), [1, -2, 0])
  })

  it('rotation by 90° about D', () => {
    pick('rotate')
    pt('B')
    pt('D')
    close(pos('B′'), [0, 3, 0])
  })

  it('translation by a vector', () => {
    pick('vector')
    pt('D')
    pt('A')
    pick('translate')
    pt('C')
    st().hit({ kind: 'vector', ref: items('vector')[0].id })
    close(pos('C′'), [2, 2, 0])
  })

  it('homothety with k = 2 maps a circle to a circle of double radius', () => {
    pick('circleCR')
    st().setOpts({ radius: 1 })
    pt('B')
    pick('dilate')
    st().hit({ kind: 'circle', ref: items('circle')[0].id, angle: 0 })
    pt('D')
    const img = ev().circles.get(items('circle')[1].id)!
    close(img.c, [6, 0, 0])
    expect(img.r).toBeCloseTo(2, 9)
  })

  it('image of a segment keeps it a segment between image points', () => {
    pick('segment')
    pt('A')
    pt('C')
    pick('reflectPoint')
    st().hit({ kind: 'line', ref: items('segment')[0].id, t: 0.5, bounded: true })
    pt('B')
    expect(items('segment')).toHaveLength(2)
    close(pos('A′'), [5, 0, 0])
  })
})

describe('labels of repeated images', () => {
  it('a second image of A is A″', () => {
    pick('reflectPoint')
    pt('A')
    pt('D')
    pick('dilate')
    pt('A')
    pt('D')
    expect(ev().points.has(ref('A″'))).toBe(true)
  })
})

describe('transformations in space', () => {
  it('half-turn of a cube vertex about the axis through the centres of two faces', () => {
    useStore.setState({ doc: { solid: { kind: 'cube', a: 2 }, items: [] }, picks: [], message: null })
    pick('line')
    st().hit({ kind: 'empty', pos: null })
    // Axis: the vertical line through the centre (points on the bottom and top faces).
    st().setTool('point')
    st().hit({ kind: 'face', face: 0, pos: [0, 0, -1] })
    st().hit({ kind: 'face', face: 1, pos: [0, 0, 1] })
    const [p, q] = st().doc.items.map((i) => i.id)
    pick('line')
    st().hit({ kind: 'point', ref: p })
    st().hit({ kind: 'point', ref: q })
    pick('reflectLine')
    st().hit({ kind: 'point', ref: 'v0' })
    st().hit({ kind: 'line', ref: items('line')[0].id, t: 0, bounded: false })
    // A goes to the opposite vertex of the bottom face (C), which already exists.
    expect(st().message).toBe('err.alreadyThere')
  })
})
