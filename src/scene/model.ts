import type { SolidSpec } from '../geometry/solids'

/** Reference to a point: a solid vertex ("v3") or a point item id. */
export type PointRef = string

export const vertexRef = (i: number): PointRef => `v${i}`
export const parseVertexRef = (r: PointRef): number | null => (/^v\d+$/.test(r) ? Number(r.slice(1)) : null)

export type PointDef =
  /** Point on segment a–b at parameter t (0 = a, 1 = b); `line` allows t outside [0, 1]. */
  | { kind: 'onSegment'; a: PointRef; b: PointRef; t: number; line?: boolean }
  /** Intersection of line (a1, a2) with line (b1, b2). */
  | { kind: 'intersection'; a1: PointRef; a2: PointRef; b1: PointRef; b2: PointRef }
  /** Intersection of solid edge a–b with a plane item (created with sections). */
  | { kind: 'edgePlane'; a: number; b: number; plane: string }

interface Base {
  id: string
  color: string
  visible: boolean
}

export interface PointItem extends Base {
  type: 'point'
  label: string
  def: PointDef
}

export interface SegmentItem extends Base {
  type: 'segment'
  a: PointRef
  b: PointRef
  /** Auxiliary segments are drawn thinner (grey by default). */
  aux: boolean
}

export interface LineItem extends Base {
  type: 'line'
  a: PointRef
  b: PointRef
}

export interface PlaneItem extends Base {
  type: 'plane'
  a: PointRef
  b: PointRef
  c: PointRef
  /** Draw the plane beyond the solid (faint). */
  extend: boolean
}

export interface FaceItem extends Base {
  type: 'face'
  face: number
}

export interface RatioItem extends Base {
  type: 'ratio'
  a: PointRef
  b: PointRef
  text: string
}

export type Item = PointItem | SegmentItem | LineItem | PlaneItem | FaceItem | RatioItem
export type ItemType = Item['type']

export interface Doc {
  solid: SolidSpec
  items: Item[]
}

export const PALETTE = ['#2f45d8', '#d1382c', '#2e9a5a', '#f0a23a', '#8a8a8a', '#8e44ad', '#111111']

export const DEFAULT_COLOR: Record<ItemType, string> = {
  point: '#2f45d8',
  segment: '#2f45d8',
  line: '#8a8a8a',
  plane: '#2f45d8',
  face: '#2e9a5a',
  ratio: '#d1382c',
}

/** Item ids that `item` depends on. */
export function depsOf(item: Item): string[] {
  const refs: string[] = []
  switch (item.type) {
    case 'point': {
      const d = item.def
      if (d.kind === 'onSegment') refs.push(d.a, d.b)
      else if (d.kind === 'intersection') refs.push(d.a1, d.a2, d.b1, d.b2)
      else refs.push(d.plane)
      break
    }
    case 'segment':
    case 'line':
    case 'ratio':
      refs.push(item.a, item.b)
      break
    case 'plane':
      refs.push(item.a, item.b, item.c)
      break
    case 'face':
      break
  }
  return refs.filter((r) => parseVertexRef(r) === null)
}

/** Remove items and everything that (transitively) depends on them. */
export function removeWithDependents(items: Item[], ids: string[]): Item[] {
  const gone = new Set(ids)
  let changed = true
  while (changed) {
    changed = false
    for (const it of items) {
      if (!gone.has(it.id) && depsOf(it).some((d) => gone.has(d))) {
        gone.add(it.id)
        changed = true
      }
    }
  }
  return items.filter((it) => !gone.has(it.id))
}

let counter = 0
export const newId = (prefix: string) => `${prefix}${Date.now().toString(36)}${(counter++).toString(36)}`
