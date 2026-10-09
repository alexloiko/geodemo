import { useStore } from '../store/store'
import { makeIntersection, makePlane, makePointOnSegment, makeRatioMarks } from './build'
import { DEFAULT_COLOR, type Doc, newId } from './model'

/**
 * The textbook example: right triangular prism ABCA₁B₁C₁, K on A₁B₁ with
 * A₁K : KB₁ = 3 : 1, section by plane (A, C, K) and the auxiliary point
 * P = AK ∩ BB₁ used to find L on B₁C₁.
 * Vertex refs: v0 A, v1 B, v2 C, v3 A₁, v4 B₁, v5 C₁.
 */
export function exampleDoc(): Doc {
  let doc: Doc = { solid: { kind: 'prism', n: 3, side: 5, height: 4, shift: 0 }, items: [] }
  const push = (...items: Doc['items']) => (doc = { ...doc, items: [...doc.items, ...items] })
  const k = makePointOnSegment(doc, 'v3', 'v4', 0.75, 'K')
  push(k)
  push(...makeRatioMarks(doc, 'v3', k.id, 'v4', 3, 1))
  const p = makeIntersection(doc, 'v0', k.id, 'v1', 'v4', 'P')
  p.color = DEFAULT_COLOR.line
  push(p)
  const aux = (a: string, b: string) => ({ id: newId('s'), type: 'segment' as const, a, b, aux: true, color: DEFAULT_COLOR.line, visible: true })
  push(aux(k.id, p.id), aux('v4', p.id))
  push(...makePlane(doc, 'v0', 'v2', k.id))
  return doc
}

export function loadExample() {
  useStore.getState().setDoc(exampleDoc())
  useStore.getState().setSelection([])
}
