import { describe, expect, it } from 'vitest'
import { en } from '../i18n/en'
import { uk } from '../i18n/uk'
import { translate } from '../i18n'
import { useStore } from '../store/store'
import { evaluate } from './evaluate'
import { ITEM_TYPES, type Doc } from './model'
import { makeNamer } from './names'
import { GROUPS, TOOLS, TOOL_ORDER } from './tools'

describe('tools are complete', () => {
  it.each(TOOLS.map((t) => [t.id, t] as const))('%s has labels, hints, a group and an order', (id, t) => {
    for (const d of [en, uk] as Record<string, string>[]) {
      expect(d[`tool.${id}`], `tool.${id}`).toBeTruthy()
      expect(d[`hint.${id}`], `hint.${id}`).toBeTruthy()
    }
    expect(GROUPS).toContain(t.group)
    expect(TOOL_ORDER).toContain(id)
  })

  it('the order lists every tool exactly once', () => {
    expect([...TOOL_ORDER].sort()).toEqual(TOOLS.map((t) => t.id).sort())
  })

  it('every group label and every slot prompt is translated', () => {
    for (const g of GROUPS.filter((g) => g !== 'basic'))
      for (const d of [en, uk] as Record<string, string>[]) expect(d[`group.${g}`], g).toBeTruthy()
    const slots = new Set(TOOLS.flatMap((t) => t.slots))
    for (const s of slots) for (const d of [en, uk] as Record<string, string>[]) expect(d[`need.${s}`], `need.${s}`).toBeTruthy()
  })

  it('every element type has a heading in the list', () => {
    for (const ty of ITEM_TYPES) for (const d of [en, uk] as Record<string, string>[]) expect(d[`type.${ty}`], ty).toBeTruthy()
  })
})

describe('every element gets a description', () => {
  const st = () => useStore.getState()
  const pt = (l: string) => st().hit({ kind: 'point', ref: [...evaluate(st().doc).labels.entries()].find(([, v]) => v === l)![0] })
  const at = (x: number, y: number) => st().hit({ kind: 'empty', pos: [x, y, 0], spot: [x, y, 0] })
  const last = (type: string) => st().doc.items.filter((i) => i.type === type).at(-1)!.id

  function sheetDoc(): Doc {
    useStore.setState({ doc: { solid: null, items: [] }, picks: [], message: null, planeChoice: null })
    st().setTool('polygon')
    at(0, 0)
    at(6, 0)
    at(1, 4)
    pt('A')
    for (const t of ['median', 'altitude', 'triBisector', 'midline', 'incircle', 'circumcircle', 'centroid', 'orthocenter'] as const) {
      st().setTool(t)
      pt('A')
      pt('B')
      pt('C')
    }
    st().setTool('midpoint'); pt('A'); pt('C')
    st().setTool('perpBisector'); pt('A'); pt('B')
    st().setTool('angleBisector'); pt('B'); pt('A'); pt('C')
    st().setTool('line'); at(-3, -3); at(-1, 5)
    st().setTool('parallel'); pt('C'); st().hit({ kind: 'line', ref: last('line'), t: 0, bounded: false })
    st().setTool('perpendicular'); pt('C'); st().hit({ kind: 'line', ref: last('line'), t: 0, bounded: false })
    st().setTool('circleCR'); pt('A')
    st().setTool('tangent'); at(9, 9); st().hit({ kind: 'circle', ref: last('circle'), angle: 0 })
    st().setTool('circleCP'); pt('B'); pt('C')
    st().setTool('intersect'); st().hit({ kind: 'circle', ref: last('circle'), angle: 0 }); st().hit({ kind: 'line', ref: last('line'), t: 0, bounded: false })
    st().setTool('point'); st().hit({ kind: 'circle', ref: last('circle'), angle: 1 })
    st().setTool('center'); st().hit({ kind: 'circle', ref: last('circle'), angle: 0 })
    st().setTool('angle'); pt('B'); pt('A'); pt('C')
    st().setTool('ratio'); pt('A'); pt('B')
    st().setTool('ticks'); pt('A'); pt('C')
    st().setTool('vector'); pt('A'); pt('B')
    st().setTool('vector'); pt('B'); pt('C')
    const vs = st().doc.items.filter((i) => i.type === 'vector').map((v) => v.id)
    st().setTool('vectorSum'); st().hit({ kind: 'vector', ref: vs[0] }); st().hit({ kind: 'vector', ref: vs[1] })
    st().setTool('translate'); st().hit({ kind: 'polygon', ref: last('polygon') }); st().hit({ kind: 'vector', ref: vs[0] })
    st().setTool('reflectPoint'); st().hit({ kind: 'circle', ref: last('circle'), angle: 0 }); pt('A')
    st().setTool('reflectLine'); st().hit({ kind: 'line', ref: last('line'), t: 0, bounded: false }); st().hit({ kind: 'line', ref: last('segment'), t: 0.5, bounded: true })
    st().setTool('rotate'); pt('C'); pt('A')
    st().setTool('dilate'); pt('B'); pt('A')
    st().setTool('length'); pt('A'); pt('B')
    st().setTool('area'); st().hit({ kind: 'polygon', ref: last('polygon') })
    st().setTool('text'); at(2, 7)
    st().setTool('ray'); at(-5, 0); at(-4, 1)
    return st().doc
  }

  function solidDoc(kind: 'cube' | 'cylinder'): Doc {
    useStore.setState({ doc: { solid: kind === 'cube' ? { kind, a: 4 } : { kind, r: 2, h: 4 }, items: [] }, picks: [], message: null, planeChoice: null })
    if (kind === 'cylinder') {
      st().setTool('point'); st().hit({ kind: 'circle', ref: 'rim0', angle: 1 }); st().hit({ kind: 'surface', u: 2, w: 0.4 })
      st().setTool('plane'); st().hit({ kind: 'point', ref: 'v0' }); st().hit({ kind: 'point', ref: 'v1' }); pt('A')
      return st().doc
    }
    st().setTool('point'); st().hit({ kind: 'line', ref: 'v0|v1', t: 0.5, bounded: true }); st().hit({ kind: 'face', face: 1, pos: [0, 0, 2] })
    st().setTool('plane'); st().hit({ kind: 'point', ref: 'v0' }); st().hit({ kind: 'point', ref: 'v2' }); st().hit({ kind: 'point', ref: 'v6' })
    st().setTool('face'); st().hit({ kind: 'face', face: 0, pos: [0, 0, -2] })
    st().setTool('segment'); st().hit({ kind: 'point', ref: 'v0' }); st().hit({ kind: 'point', ref: 'v6' })
    st().setTool('trace'); st().hit({ kind: 'line', ref: last('segment'), t: 0.5, bounded: true }); st().hit({ kind: 'face', face: 1, pos: [0, 0, 2] })
    st().setTool('planesMeet'); st().hit({ kind: 'face', face: 2, pos: [0, 0, 0] }); st().hit({ kind: 'plane', ref: last('plane') })
    st().setTool('parallelPlane'); pt('K'); st().hit({ kind: 'face', face: 0, pos: [0, 0, -2] })
    st().setTool('planePerpLine'); pt('K'); st().hit({ kind: 'line', ref: last('segment'), t: 0.5, bounded: true })
    st().setTool('perpPlane'); pt('K'); st().hit({ kind: 'plane', ref: st().doc.items.filter((i) => i.type === 'plane')[0].id })
    st().setTool('lineAngle'); st().hit({ kind: 'line', ref: last('segment'), t: 0.5, bounded: true }); st().hit({ kind: 'face', face: 0, pos: [0, 0, -2] })
    return st().doc
  }

  it.each([['sheet'], ['cube'], ['cylinder']] as const)('%s: every item has a description in both languages', (which) => {
    const doc = which === 'sheet' ? sheetDoc() : solidDoc(which)
    const ev = evaluate(doc)
    const bad = doc.items.filter((i) => ev.invalid.has(i.id)).map((i) => JSON.stringify(i))
    expect(bad, 'no invalid items').toEqual([])
    for (const lang of ['en', 'uk'] as const) {
      const names = makeNamer(doc, ev, (k, v) => translate(lang, k, v))
      for (const it of doc.items) {
        const d = names.describe(it)
        expect(d, `${it.type} ${JSON.stringify('def' in it ? it.def : '')}`).toBeTruthy()
        expect(d).not.toMatch(/undefined|\?\?|\{[a-z]\}/)
      }
    }
    if (which === 'sheet') {
      const types = new Set(doc.items.map((i) => i.type))
      for (const t of ['point', 'segment', 'line', 'vector', 'circle', 'polygon', 'angle', 'mark', 'ratio', 'measure', 'text']) expect(types).toContain(t)
    }
  })
})
