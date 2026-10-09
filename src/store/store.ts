import { create } from 'zustand'
import { type Camera, TEXTBOOK_CAMERA } from '../render/camera'
import { type SolidSpec, defaultSpec } from '../geometry/solids'
import { makePlane } from '../scene/build'
import { DEFAULT_COLOR, type Doc, type Item, type PointRef, newId, removeWithDependents } from '../scene/model'
import type { Lang } from '../i18n'

export type Tool = 'select' | 'point' | 'segment' | 'line' | 'plane'
export type DisplayMode = 'all' | 'focus' | 'selected'

export const EMPTY_DOC: Doc = { solid: defaultSpec('prism'), items: [] }

interface State {
  doc: Doc
  past: Doc[]
  future: Doc[]
  selection: string[]
  mode: DisplayMode
  camera: Camera
  tool: Tool
  pending: PointRef[]
  lang: Lang
  showGrid: boolean
  dashedHidden: boolean

  /** Replace the document; pushes undo history unless `transient`. */
  setDoc(doc: Doc, transient?: boolean): void
  /** Snapshot for a following series of transient edits (e.g. dragging). */
  checkpoint(): void
  addItems(items: Item[]): void
  updateItem(id: string, patch: Partial<Item>, transient?: boolean): void
  removeItems(ids: string[]): void
  setSolid(spec: SolidSpec): void
  undo(): void
  redo(): void
  select(id: string | null, additive?: boolean): void
  setSelection(ids: string[]): void
  setMode(m: DisplayMode): void
  setCamera(c: Partial<Camera>): void
  setTool(t: Tool): void
  pick(ref: PointRef): void
  setLang(l: Lang): void
  toggle(key: 'showGrid' | 'dashedHidden'): void
}

const HISTORY = 100

export const useStore = create<State>((set, get) => ({
  doc: EMPTY_DOC,
  past: [],
  future: [],
  selection: [],
  mode: 'all',
  camera: TEXTBOOK_CAMERA,
  tool: 'select',
  pending: [],
  lang: 'en',
  showGrid: true,
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
    set({ selection: selection.filter((s) => keep.has(s)) })
  },
  setSolid(spec) {
    const { doc } = get()
    const sameKind = doc.solid.kind === spec.kind && ('n' in doc.solid ? doc.solid.n : 0) === ('n' in spec ? spec.n : 0)
    get().setDoc({ solid: spec, items: sameKind ? doc.items : [] })
    if (!sameKind) set({ selection: [], pending: [] })
  },
  undo() {
    const { past, future, doc } = get()
    if (!past.length) return
    set({ doc: past[past.length - 1], past: past.slice(0, -1), future: [doc, ...future], pending: [] })
  },
  redo() {
    const { past, future, doc } = get()
    if (!future.length) return
    set({ doc: future[0], future: future.slice(1), past: [...past, doc], pending: [] })
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
    set({ tool, pending: [] })
  },
  pick(ref) {
    const { tool, pending, doc } = get()
    if (pending.includes(ref)) return set({ pending: pending.filter((p) => p !== ref) })
    const next = [...pending, ref]
    if ((tool === 'segment' || tool === 'line') && next.length === 2) {
      const [a, b] = next
      const item: Item =
        tool === 'segment'
          ? { id: newId('s'), type: 'segment', a, b, aux: false, color: DEFAULT_COLOR.segment, visible: true }
          : { id: newId('l'), type: 'line', a, b, color: DEFAULT_COLOR.line, visible: true }
      get().addItems([item])
      return set({ pending: [] })
    }
    if (tool === 'plane' && next.length === 3) {
      get().addItems(makePlane(doc, next[0], next[1], next[2]))
      return set({ pending: [] })
    }
    set({ pending: next })
  },
  setLang(lang) {
    set({ lang })
  },
  toggle(key) {
    set({ [key]: !get()[key] } as Pick<State, typeof key>)
  },
}))
