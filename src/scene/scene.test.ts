import { describe, expect, it } from 'vitest'
import { dist } from '../geometry/vec'
import { evaluate } from './evaluate'
import { exampleDoc } from './example'
import { removeWithDependents } from './model'

describe('example construction', () => {
  const doc = exampleDoc()
  const ev = evaluate(doc)
  const byLabel = (l: string) => [...ev.labels.entries()].find(([, v]) => v === l)![0]

  it('creates the section point L automatically and evaluates everything', () => {
    expect(ev.invalid.size).toBe(0)
    expect([...ev.labels.values()]).toEqual(expect.arrayContaining(['K', 'P', 'L']))
  })

  it('C_1L : LB_1 = 3 : 1', () => {
    const p = (l: string) => ev.points.get(byLabel(l))!
    expect(dist(p('C_1'), p('L')) / dist(p('L'), p('B_1'))).toBeCloseTo(3, 9)
  })

  it('L lies on segment PC (trace method)', () => {
    const p = (l: string) => ev.points.get(byLabel(l))!
    expect(dist(p('P'), p('L')) + dist(p('L'), p('C'))).toBeCloseTo(dist(p('P'), p('C')), 9)
  })

  it('removing K removes everything built on it', () => {
    const k = byLabel('K')
    const left = removeWithDependents(doc.items, [k])
    expect(left).toHaveLength(0)
  })
})
