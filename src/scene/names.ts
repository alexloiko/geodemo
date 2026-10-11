import type { DictKey } from '../i18n/en'
import type { Evaluated } from './evaluate'
import { prettyLabel } from './labels'
import {
  type Doc,
  type Item,
  type LineRef,
  type PlaneDef,
  type PlaneRef,
  SHEET,
  type Transform,
  parseFaceRef,
  parsePairRef,
  parseRimRef,
} from './model'

type T = (key: DictKey, vars?: Record<string, string>) => string

const LINE_LETTERS = 'abcdefghkmnpqrst'
const SUB = '₀₁₂₃₄₅₆₇₈₉'
const sub = (n: number) => String(n).replace(/\d/g, (d) => SUB[Number(d)])

/** Display names for points, lines, circles and planes of a document. */
export function makeNamer(doc: Doc, ev: Evaluated, t: T) {
  // Constructed lines are called a, b, c …; circles ω, ω₂, …
  const lineNames = new Map<string, string>()
  const circleNames = new Map<string, string>()
  let li = 0
  let ci = 0
  for (const it of doc.items) {
    if (it.type === 'line' && it.def.kind !== 'through') {
      const n = Math.floor(li / LINE_LETTERS.length)
      lineNames.set(it.id, LINE_LETTERS[li % LINE_LETTERS.length] + (n ? sub(n + 1) : ''))
      li++
    }
    if (it.type === 'circle') {
      circleNames.set(it.id, ci ? `ω${sub(ci + 1)}` : 'ω')
      ci++
    }
  }
  const byId = new Map(doc.items.map((i) => [i.id, i]))

  const point = (r: string) => prettyLabel(ev.labels.get(r) ?? '?')
  const pair = (a: string, b: string) => point(a) + point(b)
  const line = (ref: LineRef): string => {
    const p = parsePairRef(ref)
    if (p) return pair(p[0], p[1])
    const it = byId.get(ref)
    if (it?.type === 'segment') return pair(it.a, it.b)
    if (it?.type === 'line' && it.def.kind === 'through') return pair(it.def.a, it.def.b)
    return lineNames.get(ref) ?? circleNames.get(ref) ?? '?'
  }
  const circle = (ref: string) => {
    if (parseRimRef(ref) !== null) {
      // Rims are named after their centre: (O), (O₁).
      const c = ev.circles.get(ref)
      const centre = c && [...ev.points.entries()].find(([, p]) => Math.hypot(p[0] - c.c[0], p[1] - c.c[1], p[2] - c.c[2]) < ev.tol)
      return centre ? `(${point(centre[0])})` : t('rim')
    }
    return circleNames.get(ref) ?? '?'
  }
  const solidLabel = (i: number) => prettyLabel(ev.solid?.vertices[i]?.label ?? '?')
  const face = (f: number) => {
    const s = ev.solid
    if (s?.rev) {
      // A base of a body of revolution is named after its centre.
      const vs = (s.faces[f] ?? []).map((i) => s.vertices[i].pos)
      const z = vs.reduce((acc, p) => acc + p[2], 0) / Math.max(vs.length, 1)
      const centre = [...ev.points.entries()].find(([r, p]) => r.startsWith('v') && Math.abs(p[2] - z) < ev.tol && Math.hypot(p[0], p[1]) < ev.tol)
      return `${t('rim')} ${centre ? point(centre[0]) : ''}`.trim()
    }
    return (s?.faces[f] ?? []).map(solidLabel).join('')
  }
  const plane = (ref: PlaneRef): string => {
    if (ref === SHEET) return t('plane.sheet')
    const f = parseFaceRef(ref)
    if (f !== null) return t('plane.face', { f: face(f) })
    const it = byId.get(ref)
    return it?.type === 'plane' ? planeItemName(it.def) : '?'
  }
  /** Planes through three points read (ABC); others get α, β, γ … in order. */
  const planeLetters = new Map<string, string>()
  for (const it of doc.items)
    if (it.type === 'plane' && it.def.kind !== 'three') planeLetters.set(it.id, 'αβγδεζ'[planeLetters.size % 6])
  function planeItemName(d: PlaneDef): string {
    if (d.kind === 'three') return `(${point(d.a)}${point(d.b)}${point(d.c)})`
    const it = doc.items.find((i) => i.type === 'plane' && i.def === d)
    return (it && planeLetters.get(it.id)) ?? 'α'
  }

  const vector = (id: string) => {
    const it = byId.get(id)
    return it?.type === 'vector' ? `${pair(it.a, it.b)}⃗` : '?'
  }
  const tfText = (tf: Transform): string => {
    switch (tf.kind) {
      case 'pointReflect':
        return t('tf.pointReflect', { c: point(tf.center) })
      case 'lineReflect':
        return t('tf.lineReflect', { l: line(tf.line) })
      case 'rotate':
        return t('tf.rotate', { c: point(tf.center), a: String(tf.deg) })
      case 'translate':
        return t('tf.translate', { v: vector(tf.vector) })
      case 'dilate':
        return t('tf.dilate', { c: point(tf.center), k: String(tf.k) })
    }
  }

  /** Short name shown before the description ("a", "ω", "K"), or null. */
  const nameOf = (it: Item): string | null =>
    it.type === 'line' ? (lineNames.get(it.id) ?? null) : it.type === 'circle' ? (circleNames.get(it.id) ?? null) : null

  const describe = (it: Item): string => {
    switch (it.type) {
      case 'point': {
        const d = it.def
        switch (d.kind) {
          case 'onSegment': {
            const inside = d.t > 0 && d.t < 1
            return `∈ ${pair(d.a, d.b)}${inside ? ` · ${ratioOf(d.t)}` : ''}`
          }
          case 'onLine':
            return `∈ ${line(d.line)}`
          case 'intersection':
            return t('desc.meet', { a: pair(d.a1, d.a2), b: pair(d.b1, d.b2) })
          case 'edgePlane':
            return t('desc.edgePlane', { e: solidLabel(d.a) + solidLabel(d.b) })
          case 'free':
            return d.plane && d.plane !== SHEET ? `∈ ${plane(d.plane)}` : t('desc.free')
          case 'midpoint':
            return t('desc.midpoint', { s: pair(d.a, d.b) })
          case 'onCircle':
            return t('desc.onCircle', { c: circle(d.circle) })
          case 'meet':
            return t('desc.meet', { a: line(d.o1), b: line(d.o2) })
          case 'foot':
            return t('desc.foot', { p: point(d.point), l: line(d.line) })
          case 'tangency':
            return t('desc.tangency', { p: point(d.point) })
          case 'onSurface':
            return t('desc.onSurface')
          case 'circlePlane':
            return t('desc.circlePlane', { c: circle(d.circle) })
          case 'linePlane':
            return t('desc.linePlane', { l: line(d.line), q: plane(d.plane) })
          case 'projPlane':
            return t('desc.projPlane', { p: point(d.point), q: plane(d.plane) })
          case 'bisectorFoot':
            return t('desc.bisectorFoot', { a: point(d.a), s: pair(d.b, d.c) })
          case 'incenter':
          case 'centroid':
          case 'orthocenter':
            return t(`desc.${d.kind}`, { t: point(d.a) + point(d.b) + point(d.c) })
          case 'center':
            return t('desc.center', { c: circle(d.circle) })
          case 'image':
            return `${point(d.src)} → ${tfText(d.tf)}`
        }
        break
      }
      case 'segment':
        return pair(it.a, it.b)
      case 'line': {
        const d = it.def
        switch (d.kind) {
          case 'through':
            return it.extent === 'ray' ? t('desc.ray', { s: pair(d.a, d.b) }) : pair(d.a, d.b)
          case 'parallel':
            return t('desc.parallel', { l: line(d.line), p: point(d.point) })
          case 'perpendicular':
            return t('desc.perpendicular', { l: line(d.line), p: point(d.point) })
          case 'perpBisector':
            return t('desc.perpBisector', { s: pair(d.a, d.b) })
          case 'angleBisector':
            return t('desc.angleBisector', { a: point(d.a) + point(d.vertex) + point(d.b) })
          case 'tangent':
            return t('desc.tangent', { c: circle(d.circle), p: point(d.point) })
          case 'planePlane':
            return t('desc.planePlane', { a: plane(d.p1), b: plane(d.p2) })
          case 'perpToPlane':
            return t('desc.perpToPlane', { p: point(d.point), q: plane(d.plane) })
          case 'image':
            return `${line(d.src)} → ${tfText(d.tf)}`
        }
        break
      }
      case 'circle': {
        const d = it.def
        if (d.kind === 'centerPoint') return t('desc.circleCP', { c: point(d.center), p: point(d.through) })
        if (d.kind === 'threePoints') return t('desc.circle3', { a: point(d.a), b: point(d.b), c: point(d.c) })
        if (d.kind === 'incircle') return t('desc.incircle', { t: point(d.a) + point(d.b) + point(d.c) })
        if (d.kind === 'image') return `${circle(d.src)} → ${tfText(d.tf)}`
        return t('desc.circleCR', { c: point(d.center), r: String(d.r) })
      }
      case 'polygon':
        return it.pts.map(point).join('')
      case 'angle':
        return `∠${point(it.a)}${point(it.vertex)}${point(it.b)}`
      case 'mark': {
        const d = it.def
        if (d.kind === 'right' || d.kind === 'rightPlane') return t('desc.right', { p: point(d.at) })
        if (d.kind === 'ticks') return t('desc.ticks', { s: pair(d.a, d.b) })
        return t('desc.equalAngles', { p: point(d.vertex) })
      }
      case 'plane': {
        const d = it.def
        if (d.kind === 'three') return planeItemName(d)
        if (d.kind === 'parallel') return `${planeItemName(d)}: ${t('desc.planeParallel', { p: point(d.point), q: plane(d.plane) })}`
        return `${planeItemName(d)}: ${t('desc.planePerpLine', { p: point(d.point), l: line(d.line) })}`
      }
      case 'face':
        return face(it.face)
      case 'ratio':
        return `${pair(it.a, it.b)} = ${it.text}`
      case 'vector':
        return vector(it.id)
      case 'measure': {
        const v = ev.measures.get(it.id)?.value
        const val = v === undefined ? '' : ` = ${Math.round(v * 100) / 100}`
        if (it.def.kind === 'length') return `${pair(it.def.a, it.def.b)}${val}`
        const poly = byId.get(it.def.polygon)
        return `S(${poly?.type === 'polygon' ? poly.pts.map(point).join('') : '?'})${val}`
      }
      case 'text':
        return it.text
    }
    return ''
  }

  return { point, line, circle, plane, face, vector, nameOf, describe }
}

export function ratioOf(t: number): string {
  for (let den = 2; den <= 12; den++) {
    const num = Math.round(t * den)
    if (num > 0 && num < den && Math.abs(t - num / den) < 1e-6) return `${num}:${den - num}`
  }
  return `${Math.round(t * 100)}%`
}
