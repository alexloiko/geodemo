import { create } from 'zustand'
import { type SolidSpec, defaultSpec } from '../geometry/solids'
import type { Vec3 } from '../geometry/vec'
import type { Lang } from '../i18n'
import type { DictKey } from '../i18n/en'
import { type Camera, TEXTBOOK_CAMERA, defaultCamera } from '../render/camera'
import { makePointOnSegment, usedLabels } from '../scene/build'
import { type Evaluated, evaluate, resolveLine } from '../scene/evaluate'
import { labelsFromA, nextLabel } from '../scene/labels'
import {
  DEFAULT_COLOR,
  type Doc,
  type Item,
  type LineRef,
  type PlaneRef,
  type PointItem,
  type PointRef,
  newId,
  removeWithDependents,
} from '../scene/model'
import {
  type BuildResult,
  DEFAULT_OPTIONS,
  type Pick,
  type ToolId,
  type ToolOptions,
  fits,
  makePolygon,
  nextSlot,
  toolById,
} from '../scene/tools'

export type Tool = ToolId
export type DisplayMode = 'all' | 'focus' | 'selected'

/** What the user clicked on the canvas (with a tool other than Select). */
export type CanvasHit =
  | { kind: 'point'; ref: PointRef }
  /** t is the parameter along resolveLine(ref); `bounded` for segments, edges and sides. */
  | { kind: 'line'; ref: LineRef; t: number; bounded: boolean }
  | { kind: 'circle'; ref: string; angle: number }
  | { kind: 'face'; face: number; pos: Vec3 }
  /** Curved surface of a body of revolution. */
  | { kind: 'surface'; u: number; w: number }
  /** A section (plane item) fill. */
  | { kind: 'plane'; ref: PlaneRef }
  /** Empty space; pos is set on the sheet. */
  | { kind: 'empty'; pos: Vec3 | null }

export const EMPTY_DOC: Doc = { solid: defaultSpec('prism'), items: [] }

interface PlaneChoice {
  options: PlaneRef[]
  build: (plane: PlaneRef) => BuildResult
}

interface State {
  doc: Doc
  past: Doc[]
  future: Doc[]
  selection: string[]
  mode: DisplayMode
  camera: Camera
  tool: Tool
  picks: Pick[]
  message: DictKey | null
  planeChoice: PlaneChoice | null
  opts: ToolOptions
  lang: Lang
  showGrid: boolean
  snapGrid: boolean
  dashedHidden: boolean

  /** Replace the document; pushes undo history unless `transient`. */
  setDoc(doc: Doc, transient?: boolean): void
  /** Snapshot for a following series of transient edits (e.g. dragging). */
  checkpoint(): void
  addItems(items: Item[]): void
  updateItem(id: string, patch: Partial<Item>, transient?: boolean): void
  removeItems(ids: string[]): void
  setSolid(spec: SolidSpec | null): void
  undo(): void
  redo(): void
  select(id: string | null, additive?: boolean): void
  setSelection(ids: string[]): void
  setMode(m: DisplayMode): void
  setCamera(c: Partial<Camera>): void
  setTool(t: Tool): void
  /** Feed a canvas click into the active tool. */
  hit(h: CanvasHit): void
  choosePlane(plane: PlaneRef | null): void
  finishPolygon(): void
  setOpts(o: Partial<ToolOptions>): void
  setLang(l: Lang): void
  toggle(key: 'showGrid' | 'dashedHidden' | 'snapGrid'): void
}

const HISTORY = 100

/** Create the point a click on a line / circle / face / empty sheet stands for. */
function materializePoint(doc: Doc, ev: Evaluated, h: CanvasHit): PointItem | null {
  const label = () => nextLabel(usedLabels(doc), { fromA: labelsFromA(doc.solid) })
  const point = (def: PointItem['def']): PointItem => ({
    id: newId('p'),
    type: 'point',
    label: label(),
    color: DEFAULT_COLOR.point,
    visible: true,
    def,
  })
  switch (h.kind) {
    case 'line': {
      const l = resolveLine(ev, h.ref)
      if (!l) return null
      if (l.a && l.b) {
        if (h.bounded && (h.t <= 0 || h.t >= 1)) return null
        return makePointOnSegment(doc, l.a, l.b, h.t, undefined, !h.bounded)
      }
      return point({ kind: 'onLine', line: h.ref, t: h.t })
    }
    case 'circle':
      return point({ kind: 'onCircle', circle: h.ref, angle: h.angle })
    case 'face':
      return point({ kind: 'free', pos: h.pos, plane: `f${h.face}` })
    case 'surface':
      return point({ kind: 'onSurface', u: h.u, w: h.w })
    case 'empty':
      return h.pos ? point({ kind: 'free', pos: h.pos, plane: 'sheet' }) : null
    case 'point':
    case 'plane':
      return null
  }
}

export const useStore = create<State>((set, get) => {
  const apply = (r: BuildResult) => {
    if ('items' in r) {
      get().addItems(r.items)
      set({ message: null, planeChoice: null })
    } else if ('error' in r) set({ message: r.error, planeChoice: null })
    else set({ planeChoice: { options: r.choosePlane, build: r.build }, message: 'msg.choosePlane' })
  }

  return {
    doc: EMPTY_DOC,
    past: [],
    future: [],
    selection: [],
    mode: 'all',
    camera: TEXTBOOK_CAMERA,
    tool: 'select',
    picks: [],
    message: null,
    planeChoice: null,
    opts: DEFAULT_OPTIONS,
    lang: 'en',
    showGrid: true,
    snapGrid: true,
    dashedHidden: true,

    setDoc(doc, transient) {
      if (transient) return set({ doc })
      const { past, doc: cur } = get()
      set({ doc, past: [...past, cur].slice(-HISTORY), future: [] })
    },
    checkpoint() {
      const { past, doc } = get()
      set({ past: [...past, doc].slice(-HISTORY), future: [] })
    },
    addItems(items) {
      if (!items.length) return
      const { doc, mode, selection } = get()
      get().setDoc({ ...doc, items: [...doc.items, ...items] })
      // Keep new elements visible while a filtering display mode is active.
      if (mode !== 'all' && selection.length) set({ selection: [...selection, ...items.map((i) => i.id)] })
    },
    updateItem(id, patch, transient) {
      const { doc } = get()
      const items = doc.items.map((it) => (it.id === id ? ({ ...it, ...patch } as Item) : it))
      get().setDoc({ ...doc, items }, transient)
    },
    removeItems(ids) {
      const { doc, selection } = get()
      const items = removeWithDependents(doc.items, ids)
      const keep = new Set(items.map((i) => i.id))
      get().setDoc({ ...doc, items })
      set({ selection: selection.filter((s) => keep.has(s)), picks: [] })
    },
    setSolid(spec) {
      const { doc } = get()
      const sameKind =
        !!spec && !!doc.solid && doc.solid.kind === spec.kind && ('n' in doc.solid ? doc.solid.n : 0) === ('n' in spec ? spec.n : 0)
      get().setDoc({ solid: spec, items: sameKind ? doc.items : [] })
      if (!sameKind) set({ selection: [], picks: [], planeChoice: null, message: null, opts: { ...get().opts, workingPlane: 'auto' } })
      if (spec?.kind !== doc.solid?.kind) set({ camera: { ...defaultCamera(spec?.kind ?? null) } })
      if (!spec && toolById(get().tool).solidOnly) set({ tool: 'select' })
    },
    undo() {
      const { past, future, doc } = get()
      if (!past.length) return
      set({ doc: past[past.length - 1], past: past.slice(0, -1), future: [doc, ...future], picks: [], planeChoice: null })
    },
    redo() {
      const { past, future, doc } = get()
      if (!future.length) return
      set({ doc: future[0], future: future.slice(1), past: [...past, doc], picks: [], planeChoice: null })
    },
    select(id, additive) {
      if (id === null) return set({ selection: [] })
      const sel = get().selection
      if (additive) set({ selection: sel.includes(id) ? sel.filter((s) => s !== id) : [...sel, id] })
      else set({ selection: [id] })
    },
    setSelection(ids) {
      set({ selection: ids })
    },
    setMode(mode) {
      set({ mode })
    },
    setCamera(c) {
      set({ camera: { ...get().camera, ...c } })
    },
    setTool(tool) {
      set({ tool, picks: [], message: null, planeChoice: null })
    },
    hit(h) {
      const { tool, picks, doc, opts } = get()
      const def = toolById(tool)
      const slot = nextSlot(def, picks)
      if (tool === 'select' || !slot) return
      const ev = evaluate(doc)

      // Turn the click into a pick for the expected slot.
      let pick: Pick | null = null
      if (slot === 'point') {
        if (h.kind === 'point') pick = { kind: 'point', ref: h.ref }
        else {
          const p = materializePoint(doc, ev, h)
          if (!p) return
          get().addItems([p])
          pick = { kind: 'point', ref: p.id }
        }
      } else if (slot === 'plane') {
        if (h.kind === 'face') pick = { kind: 'plane', ref: `f${h.face}` }
        else if (h.kind === 'plane') pick = { kind: 'plane', ref: h.ref }
      } else if (h.kind === 'line') pick = { kind: 'line', ref: h.ref }
      else if (h.kind === 'circle') pick = { kind: 'circle', ref: h.ref }
      else if (h.kind === 'face') pick = { kind: 'face', face: h.face }
      if (!pick || !fits(slot, pick)) return set({ message: `need.${slot}` as DictKey })

      if (tool === 'polygon') {
        const first = picks[0]
        if (pick.kind === 'point' && first?.kind === 'point' && pick.ref === first.ref) {
          if (picks.length >= 3) {
            get().addItems([makePolygon(picks)])
            set({ picks: [], message: null })
          }
          return
        }
        if (picks.some((p) => p.kind === 'point' && pick.kind === 'point' && p.ref === pick.ref)) return
        return set({ picks: [...picks, pick], message: null })
      }

      // Clicking an already picked point un-picks it.
      if (pick.kind === 'point' && picks.some((p) => p.kind === 'point' && p.ref === pick.ref) && tool !== 'point')
        return set({ picks: picks.filter((p) => !(p.kind === 'point' && p.ref === pick.ref)) })

      const next = [...picks, pick]
      if (nextSlot(def, next) !== null) return set({ picks: next, message: null })
      set({ picks: [] })
      if (def.build) apply(def.build({ doc: get().doc, ev: evaluate(get().doc), opts }, next))
    },
    choosePlane(plane) {
      const pc = get().planeChoice
      if (!pc || !plane) return set({ planeChoice: null, message: null })
      apply(pc.build(plane))
    },
    finishPolygon() {
      const { tool, picks } = get()
      if (tool !== 'polygon' || picks.length < 3) return
      get().addItems([makePolygon(picks)])
      set({ picks: [] })
    },
    setOpts(o) {
      set({ opts: { ...get().opts, ...o } })
    },
    setLang(lang) {
      set({ lang })
    },
    toggle(key) {
      set({ [key]: !get()[key] } as Pick2<State, typeof key>)
    },
  }
})

type Pick2<T, K extends keyof T> = { [P in K]: T[P] }
