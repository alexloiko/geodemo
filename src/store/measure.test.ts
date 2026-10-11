import { beforeEach, describe, expect, it } from 'vitest'
import { dist } from '../geometry/vec'
import { evaluate, polygonArea } from '../scene/evaluate'
import type { Item } from '../scene/model'
import { type Tool, useStore } from './store'

const st = () => useStore.getState()
const ev = () => evaluate(st().doc)
const items = (type: Item['type']) => st().doc.items.filter((i) => i.type === type)
const ref = (l: string) => [...ev().labels.entries()].find(([, v]) => v === l)![0]
const at = (x: number, y: number) => st().hit({ kind: 'empty', pos: [x, y, 0] })
const pt = (l: string) => st().hit({ kind: 'point', ref: ref(l) })
const pick = (t: Tool) => st().setTool(t)

beforeEach(() => useStore.setState({ doc: { solid: null, items: [] }, picks: [], message: null, opts: { ...st().opts, text: '' } }))

describe('vectors', () => {
  it('sum by the triangle rule: AB + CD = AE with E = B + CD', () => {
    pick('vector')
    at(0, 0)
    at(3, 1)
    pick('vector')
    at(5, 5)
    at(6, 7)
    const [v1, v2] = items('vector').map((v) => v.id)
    pick('vectorSum')
    st().hit({ kind: 'vector', ref: v1 })
    st().hit({ kind: 'vector', ref: v2 })
    const vs = items('vector')
    expect(vs).toHaveLength(4) // two given, the dashed copy, the sum
    const sum = ev().vectors.get(vs[3].id)!
    expect(dist(sum[0], [0, 0, 0])).toBeCloseTo(0, 9)
    expect(dist(sum[1], [4, 3, 0])).toBeCloseTo(0, 9)
  })
})

describe('measurements', () => {
  it('length follows the points', () => {
    pick('length')
    at(0, 0)
    at(3, 4)
    const m = items('measure')[0].id
    expect(ev().measures.get(m)!.value).toBeCloseTo(5, 9)
    const b = st().doc.items.find((i) => i.type === 'point' && i.label === 'B')!
    st().updateItem(b.id, { def: { kind: 'free', pos: [6, 8, 0], plane: 'sheet' } })
    expect(ev().measures.get(m)!.value).toBeCloseTo(10, 9)
  })

  it('area of a polygon (also in space)', () => {
    pick('polygon')
    at(0, 0)
    at(4, 0)
    at(4, 3)
    pt('A')
    pick('area')
    st().hit({ kind: 'polygon', ref: items('polygon')[0].id })
    expect(ev().measures.get(items('measure')[0].id)!.value).toBeCloseTo(6, 9)
    expect(polygonArea([[0, 0, 0], [0, 4, 3], [2, 4, 3]])).toBeCloseTo(5, 9)
  })
})

describe('notes and coordinates', () => {
  it('a note is placed where the user clicks, with the default text', () => {
    pick('text')
    st().hit({ kind: 'empty', pos: [1, 2, 0], spot: [1, 2, 0] })
    const n = items('text')[0]
    expect(n.type === 'text' && n.pos).toEqual([1, 2, 0])
    expect(n.type === 'text' && n.text.length).toBeGreaterThan(0)
  })

  it('custom note text from the option', () => {
    st().setOpts({ text: 'Дано: AB = 5' })
    pick('text')
    st().hit({ kind: 'empty', pos: null, spot: [0, 0, 0] })
    const n = items('text')[0]
    expect(n.type === 'text' && n.text).toBe('Дано: AB = 5')
  })
})
