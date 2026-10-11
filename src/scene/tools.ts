import { tangencyPoints } from '../geometry/circle'
import { distToLine, pointAt } from '../geometry/lines'
import { planeFrom3, signedDist } from '../geometry/plane'
import { type Vec3, dist } from '../geometry/vec'
import type { DictKey } from '../i18n/en'
import { makePlane } from './build'
import { type Evaluated, meetPoints, planesContaining, resolveLine, resolvePlane } from './evaluate'
import { nextLabel } from './labels'
import {
  AUX_COLOR,
  DEFAULT_COLOR,
  type Doc,
  type Item,
  type LineItem,
  type LineRef,
  type MarkDef,
  type PlaneRef,
  type PointDef,
  type PointItem,
  type PointRef,
  newId,
  pairRef,
} from './model'

export type ToolId =
  | 'select'
  | 'point'
  | 'segment'
  | 'line'
  | 'ray'
  | 'polygon'
  | 'midpoint'
  | 'perpendicular'
  | 'parallel'
  | 'perpBisector'
  | 'angleBisector'
  | 'intersect'
  | 'circleCP'
  | 'circle3'
  | 'circleCR'
  | 'tangent'
  | 'angle'
  | 'ratio'
  | 'ticks'
  | 'plane'
  | 'face'

/** What a tool expects to be clicked next. `curve` = line or circle. */
export type Slot = 'point' | 'line' | 'circle' | 'curve' | 'face'

export type Pick =
  | { kind: 'point'; ref: PointRef }
  | { kind: 'line'; ref: LineRef }
  | { kind: 'circle'; ref: string }
  | { kind: 'face'; face: number }

export interface ToolOptions {
  radius: number
  ratioText: string
  ticks: number
  /** Plane for planar constructions on solids; 'auto' picks the face that contains the input. */
  workingPlane: PlaneRef | 'auto'
}

export const DEFAULT_OPTIONS: ToolOptions = { radius: 3, ratioText: 'x', ticks: 1, workingPlane: 'auto' }

export interface BuildCtx {
  doc: Doc
  ev: Evaluated
  opts: ToolOptions
}

export type BuildResult =
  | { items: Item[] }
  | { error: DictKey }
  | { choosePlane: PlaneRef[]; build: (plane: PlaneRef) => BuildResult }

export type ToolGroup = 'basic' | 'construct' | 'circles' | 'marks' | 'solid'

export interface ToolDef {
  id: ToolId
  group: ToolGroup
  /** Input sequence; polygon repeats `point` until the first point is clicked again. */
  slots: Slot[]
  /** Only on solids (true) / only on the sheet (false) / both (undefined). */
  solidOnly?: boolean
  build?: (ctx: BuildCtx, picks: Pick[]) => BuildResult
}

// ---------------------------------------------------------------------------
// helpers

const refOf = (p: Pick): string => (p.kind === 'face' ? `f${p.face}` : p.ref)

/** Factory for new points that keeps labels unique within one build. */
function pointFactory(ctx: BuildCtx) {
  const used = [...ctx.ev.labels.values()]
  return (def: PointDef, prefer?: string, color = DEFAULT_COLOR.point): PointItem => {
    const label = nextLabel(used, { prefer, sheet: !ctx.doc.solid })
    used.push(label)
    return { id: newId('p'), type: 'point', label, color, visible: true, def }
  }
}

const mark = (def: MarkDef, color = DEFAULT_COLOR.mark): Item => ({
  id: newId('m'),
  type: 'mark',
  def,
  color,
  visible: true,
})

const line = (def: LineItem['def'], extent: LineItem['extent'] = 'line', aux = false): LineItem => ({
  id: newId('l'),
  type: 'line',
  def,
  extent,
  aux,
  color: aux ? AUX_COLOR : DEFAULT_COLOR.line,
  visible: true,
})

/** Two points spanning a line, for plane detection. */
function lineSpan(ctx: BuildCtx, ref: LineRef): Vec3[] {
  const l = resolveLine(ctx.ev, ref)
  return l ? [l.p, pointAt(l, 1)] : []
}

/** Run `f` in the working plane: explicit, the only containing one, or ask the user. */
function withPlane(ctx: BuildCtx, pts: Vec3[], f: (plane: PlaneRef) => BuildResult): BuildResult {
  const { opts, ev } = ctx
  if (!ev.solid) return f('sheet')
  if (opts.workingPlane !== 'auto') {
    const pl = resolvePlane(ev, opts.workingPlane)
    if (!pl || pts.some((p) => Math.abs(signedDist(pl, p)) > ev.tol * 10)) return { error: 'err.notInPlane' }
    return f(opts.workingPlane)
  }
  const cands = planesContaining(ev, pts)
  if (cands.length === 0) return { error: 'err.noPlane' }
  if (cands.length === 1) return f(cands[0])
  return { choosePlane: cands, build: f }
}

const P = (ctx: BuildCtx, r: PointRef) => ctx.ev.points.get(r)!

// ---------------------------------------------------------------------------
// tool table

export const TOOLS: ToolDef[] = [
  { id: 'select', group: 'basic', slots: [] },
  { id: 'point', group: 'basic', slots: ['point'], build: () => ({ items: [] }) },
  {
    id: 'segment',
    group: 'basic',
    slots: ['point', 'point'],
    build: (_ctx, [a, b]) => ({
      items: [
        { id: newId('s'), type: 'segment', a: refOf(a), b: refOf(b), aux: false, color: DEFAULT_COLOR.segment, visible: true },
      ],
    }),
  },
  {
    id: 'line',
    group: 'basic',
    slots: ['point', 'point'],
    build: (_ctx, [a, b]) => ({ items: [line({ kind: 'through', a: refOf(a), b: refOf(b) })] }),
  },
  {
    id: 'ray',
    group: 'basic',
    slots: ['point', 'point'],
    build: (_ctx, [a, b]) => ({ items: [line({ kind: 'through', a: refOf(a), b: refOf(b) }, 'ray')] }),
  },
  { id: 'polygon', group: 'basic', slots: ['point'] },
  {
    id: 'midpoint',
    group: 'construct',
    slots: ['point', 'point'],
    build: (ctx, [a, b]) => {
      const mk = pointFactory(ctx)
      return { items: [mk({ kind: 'midpoint', a: refOf(a), b: refOf(b) }, 'M')] }
    },
  },
  {
    id: 'perpendicular',
    group: 'construct',
    slots: ['point', 'line'],
    build: (ctx, [pp, lp]) => {
      const q = refOf(pp)
      const L = refOf(lp)
      const l = resolveLine(ctx.ev, L)
      if (!l) return { error: 'err.generic' }
      const mk = pointFactory(ctx)
      if (distToLine(l, P(ctx, q)) > ctx.ev.tol * 10) {
        // From a point off the line: unique perpendicular through the foot H.
        const h = mk({ kind: 'foot', point: q, line: L }, 'H')
        const perp = line({ kind: 'perpendicular', point: q, line: L })
        return { items: [perp, h, mark({ kind: 'right', at: h.id, l1: L, l2: perp.id, p2: q })] }
      }
      return withPlane(ctx, [P(ctx, q), ...lineSpan(ctx, L)], (plane) => {
        const perp = line({ kind: 'perpendicular', point: q, line: L, plane })
        return { items: [perp, mark({ kind: 'right', at: q, l1: L, l2: perp.id })] }
      })
    },
  },
  {
    id: 'parallel',
    group: 'construct',
    slots: ['point', 'line'],
    build: (_ctx, [pp, lp]) => ({ items: [line({ kind: 'parallel', point: refOf(pp), line: refOf(lp) })] }),
  },
  {
    id: 'perpBisector',
    group: 'construct',
    slots: ['point', 'point'],
    build: (ctx, [ap, bp]) => {
      const a = refOf(ap)
      const b = refOf(bp)
      return withPlane(ctx, [P(ctx, a), P(ctx, b)], (plane) => {
        const mk = pointFactory(ctx)
        const m = mk({ kind: 'midpoint', a, b }, 'M')
        const bis = line({ kind: 'perpBisector', a, b, plane })
        return {
          items: [
            bis,
            m,
            mark({ kind: 'ticks', a, b: m.id, count: 1 }),
            mark({ kind: 'ticks', a: m.id, b, count: 1 }),
            mark({ kind: 'right', at: m.id, l1: pairRef(a, b), l2: bis.id, p1: b }),
          ],
        }
      })
    },
  },
  {
    id: 'angleBisector',
    group: 'construct',
    slots: ['point', 'point', 'point'],
    build: (_ctx, [ap, op, bp]) => {
      const [a, vertex, b] = [refOf(ap), refOf(op), refOf(bp)]
      const bis = { ...line({ kind: 'angleBisector', a, vertex, b }, 'ray') }
      return { items: [bis, mark({ kind: 'equalAngles', a, vertex, b }, DEFAULT_COLOR.angle)] }
    },
  },
  {
    id: 'intersect',
    group: 'construct',
    slots: ['curve', 'curve'],
    build: (ctx, [p1, p2]) => {
      const [o1, o2] = [refOf(p1), refOf(p2)]
      const pts = meetPoints(ctx.ev, o1, o2)
      if (!pts.length) return { error: 'err.noIntersection' }
      const existing = [...ctx.ev.points.values()]
      const mk = pointFactory(ctx)
      const items = pts
        .map((p, index) => ({ p, index }))
        .filter(({ p }) => !existing.some((e) => dist(e, p) < ctx.ev.tol * 10))
        .map(({ index }) => mk({ kind: 'meet', o1, o2, index }))
      return items.length ? { items } : { error: 'err.alreadyThere' }
    },
  },
  {
    id: 'circleCP',
    group: 'circles',
    slots: ['point', 'point'],
    build: (ctx, [cp, tp]) => {
      const [center, through] = [refOf(cp), refOf(tp)]
      return withPlane(ctx, [P(ctx, center), P(ctx, through)], (plane) => ({
        items: [{ id: newId('c'), type: 'circle', def: { kind: 'centerPoint', center, through, plane }, color: DEFAULT_COLOR.circle, visible: true }],
      }))
    },
  },
  {
    id: 'circle3',
    group: 'circles',
    slots: ['point', 'point', 'point'],
    build: (ctx, [ap, bp, cp]) => {
      const [a, b, c] = [refOf(ap), refOf(bp), refOf(cp)]
      if (!planeFrom3(P(ctx, a), P(ctx, b), P(ctx, c))) return { error: 'err.collinear' }
      return { items: [{ id: newId('c'), type: 'circle', def: { kind: 'threePoints', a, b, c }, color: DEFAULT_COLOR.circle, visible: true }] }
    },
  },
  {
    id: 'circleCR',
    group: 'circles',
    slots: ['point'],
    build: (ctx, [cp]) => {
      const center = refOf(cp)
      return withPlane(ctx, [P(ctx, center)], (plane) => ({
        items: [{ id: newId('c'), type: 'circle', def: { kind: 'centerRadius', center, r: ctx.opts.radius, plane }, color: DEFAULT_COLOR.circle, visible: true }],
      }))
    },
  },
  {
    id: 'tangent',
    group: 'circles',
    slots: ['point', 'circle'],
    build: (ctx, [pp, cp]) => {
      const point = refOf(pp)
      const circle = refOf(cp)
      const c = ctx.ev.circles.get(circle)
      const q = P(ctx, point)
      if (!c) return { error: 'err.generic' }
      if (Math.abs(signedDist({ n: c.n, d: c.n[0] * c.c[0] + c.n[1] * c.c[1] + c.n[2] * c.c[2] }, q)) > ctx.ev.tol * 10)
        return { error: 'err.notInPlane' }
      const ts = tangencyPoints(c, q, ctx.ev.tol)
      if (!ts.length) return { error: 'err.inside' }
      if (ts.length === 1) return { items: [line({ kind: 'tangent', circle, point, index: 0 })] }
      const mk = pointFactory(ctx)
      const items: Item[] = []
      ts.forEach((_, index) => {
        const t = mk({ kind: 'tangency', circle, point, index })
        items.push(t, line({ kind: 'through', a: point, b: t.id }))
      })
      return { items }
    },
  },
  {
    id: 'angle',
    group: 'marks',
    slots: ['point', 'point', 'point'],
    build: (_ctx, [ap, op, bp]) => ({
      items: [
        { id: newId('a'), type: 'angle', a: refOf(ap), vertex: refOf(op), b: refOf(bp), arcs: 1, showValue: true, color: DEFAULT_COLOR.angle, visible: true },
      ],
    }),
  },
  {
    id: 'ratio',
    group: 'marks',
    slots: ['point', 'point'],
    build: (ctx, [ap, bp]) => ({
      items: [{ id: newId('r'), type: 'ratio', a: refOf(ap), b: refOf(bp), text: ctx.opts.ratioText, color: DEFAULT_COLOR.ratio, visible: true }],
    }),
  },
  {
    id: 'ticks',
    group: 'marks',
    slots: ['point', 'point'],
    build: (ctx, [ap, bp]) => ({ items: [mark({ kind: 'ticks', a: refOf(ap), b: refOf(bp), count: ctx.opts.ticks })] }),
  },
  {
    id: 'plane',
    group: 'solid',
    solidOnly: true,
    slots: ['point', 'point', 'point'],
    build: (ctx, [a, b, c]) => {
      const items = makePlane(ctx.doc, refOf(a), refOf(b), refOf(c))
      return items.length ? { items } : { error: 'err.collinear' }
    },
  },
  {
    id: 'face',
    group: 'solid',
    solidOnly: true,
    slots: ['face'],
    build: (_ctx, [f]) => ({
      items: [{ id: newId('f'), type: 'face', face: f.kind === 'face' ? f.face : 0, color: DEFAULT_COLOR.face, visible: true }],
    }),
  },
]

export const toolById = (id: ToolId): ToolDef => TOOLS.find((t) => t.id === id)!

export const GROUPS: ToolGroup[] = ['basic', 'construct', 'circles', 'marks', 'solid']

/** Next expected slot for a tool given the picks so far, or null when complete. */
export function nextSlot(tool: ToolDef, picks: Pick[]): Slot | null {
  if (tool.id === 'polygon') return 'point'
  return tool.slots[picks.length] ?? null
}

/** Does a pick satisfy a slot? */
export function fits(slot: Slot, p: Pick): boolean {
  if (slot === 'curve') return p.kind === 'line' || p.kind === 'circle'
  return slot === p.kind
}

/** Polygon from the picked points. */
export function makePolygon(picks: Pick[]): Item {
  return { id: newId('g'), type: 'polygon', pts: picks.map(refOf), color: DEFAULT_COLOR.polygon, visible: true }
}

