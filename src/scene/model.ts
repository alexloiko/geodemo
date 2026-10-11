import type { SolidSpec } from '../geometry/solids'
import type { Vec3 } from '../geometry/vec'

/** Reference to a point: a solid vertex ("v3") or a point item id. */
export type PointRef = string
/**
 * Reference to something line-like: a segment / line item id, or an implicit
 * line through two points written "p1|p2" (solid edges, section and polygon sides).
 */
export type LineRef = string
/** Circle item id. */
export type CircleRef = string
/** "sheet" (z = 0), "f<face index>" or a plane item id. */
export type PlaneRef = string

export const vertexRef = (i: number): PointRef => `v${i}`
export const parseVertexRef = (r: PointRef): number | null => (/^v\d+$/.test(r) ? Number(r.slice(1)) : null)
export const pairRef = (a: PointRef, b: PointRef): LineRef => `${a}|${b}`
export const parsePairRef = (r: LineRef): [PointRef, PointRef] | null => {
  const i = r.indexOf('|')
  return i < 0 ? null : [r.slice(0, i), r.slice(i + 1)]
}
export const SHEET: PlaneRef = 'sheet'
/** Rims of bodies of revolution (base circles, sphere equator) are circles "rim0", "rim1". */
export const rimRef = (i: number): CircleRef => `rim${i}`
export const parseRimRef = (r: string): number | null => (/^rim\d+$/.test(r) ? Number(r.slice(3)) : null)
export const faceRef = (f: number): PlaneRef => `f${f}`
export const parseFaceRef = (r: PlaneRef): number | null => (/^f\d+$/.test(r) ? Number(r.slice(1)) : null)

/** Transformations; `vector` is a vector item id. */
export type Transform =
  | { kind: 'pointReflect'; center: PointRef }
  | { kind: 'lineReflect'; line: LineRef }
  | { kind: 'rotate'; center: PointRef; deg: number; plane: PlaneRef }
  | { kind: 'translate'; vector: string }
  | { kind: 'dilate'; center: PointRef; k: number }

export const tfRefs = (tf: Transform): string[] =>
  tf.kind === 'pointReflect' || tf.kind === 'dilate'
    ? [tf.center]
    : tf.kind === 'rotate'
      ? [tf.center, tf.plane]
      : tf.kind === 'lineReflect'
        ? [tf.line]
        : [tf.vector]

export type PointDef =
  /** Point on line a–b at parameter t (0 = a, 1 = b); `line` allows t outside [0, 1]. */
  | { kind: 'onSegment'; a: PointRef; b: PointRef; t: number; line?: boolean }
  /** Point on a constructed line item at parameter t (world units along its direction). */
  | { kind: 'onLine'; line: LineRef; t: number }
  /** Intersection of line (a1, a2) with line (b1, b2) — kept for v1 documents. */
  | { kind: 'intersection'; a1: PointRef; a2: PointRef; b1: PointRef; b2: PointRef }
  /** Intersection of solid edge a–b with a plane item (created with sections). */
  | { kind: 'edgePlane'; a: number; b: number; plane: string }
  /** Free point: on the sheet, or on a face / plane of the solid. */
  | { kind: 'free'; pos: Vec3; plane?: PlaneRef }
  | { kind: 'midpoint'; a: PointRef; b: PointRef }
  | { kind: 'onCircle'; circle: CircleRef; angle: number }
  /** Intersection number `index` of two lines / circles. */
  | { kind: 'meet'; o1: string; o2: string; index: number }
  /** Foot of the perpendicular from `point` to `line`. */
  | { kind: 'foot'; point: PointRef; line: LineRef }
  /** Tangency point number `index` of tangents from `point` to `circle`. */
  | { kind: 'tangency'; circle: CircleRef; point: PointRef; index: number }
  /** Point on the curved surface of a body of revolution (angle u, height fraction / latitude w). */
  | { kind: 'onSurface'; u: number; w: number }
  /** Point number `index` where a plane item cuts a circle (rims of bodies of revolution). */
  | { kind: 'circlePlane'; circle: CircleRef; plane: string; index: number }
  /** Where a line meets a plane (the trace of the line). */
  | { kind: 'linePlane'; line: LineRef; plane: PlaneRef }
  /** Orthogonal projection of a point onto a plane (foot of the perpendicular). */
  | { kind: 'projPlane'; point: PointRef; plane: PlaneRef }
  /** Triangle points; `a` is the vertex the element starts from. */
  | { kind: 'bisectorFoot' | 'incenter' | 'centroid' | 'orthocenter'; a: PointRef; b: PointRef; c: PointRef }
  /** Centre of a circle. */
  | { kind: 'center'; circle: CircleRef }
  /** Image of a point under a transformation. */
  | { kind: 'image'; src: PointRef; tf: Transform }

export type LineDef =
  | { kind: 'through'; a: PointRef; b: PointRef }
  | { kind: 'parallel'; point: PointRef; line: LineRef }
  | { kind: 'perpendicular'; point: PointRef; line: LineRef; plane?: PlaneRef }
  | { kind: 'perpBisector'; a: PointRef; b: PointRef; plane: PlaneRef }
  | { kind: 'angleBisector'; a: PointRef; vertex: PointRef; b: PointRef }
  /** Tangent from `point` to `circle` touching it at tangency point number `index`. */
  | { kind: 'tangent'; circle: CircleRef; point: PointRef; index: number }
  /** Line where two planes meet. */
  | { kind: 'planePlane'; p1: PlaneRef; p2: PlaneRef }
  /** Line through a point perpendicular to a plane. */
  | { kind: 'perpToPlane'; point: PointRef; plane: PlaneRef }
  /** Image of a line item under a transformation. */
  | { kind: 'image'; src: LineRef; tf: Transform }

export type PlaneDef =
  | { kind: 'three'; a: PointRef; b: PointRef; c: PointRef }
  /** Plane through a point parallel to a given plane (face, section, …). */
  | { kind: 'parallel'; point: PointRef; plane: PlaneRef }
  /** Plane through a point perpendicular to a line. */
  | { kind: 'perpToLine'; point: PointRef; line: LineRef }

export type CircleDef =
  | { kind: 'centerPoint'; center: PointRef; through: PointRef; plane: PlaneRef }
  | { kind: 'threePoints'; a: PointRef; b: PointRef; c: PointRef }
  | { kind: 'centerRadius'; center: PointRef; r: number; plane: PlaneRef }
  | { kind: 'incircle'; a: PointRef; b: PointRef; c: PointRef }
  | { kind: 'image'; src: CircleRef; tf: Transform }

export type MarkDef =
  /** Right-angle square at `at` between lines l1 and l2 (towards `p1` / `p2` when given). */
  | { kind: 'right'; at: PointRef; l1: LineRef; l2: LineRef; p1?: PointRef; p2?: PointRef }
  /** Equal-segment ticks on a–b. */
  | { kind: 'ticks'; a: PointRef; b: PointRef; count: number }
  /** Two equal half-angle arcs of angle a-vertex-b (angle bisector). */
  | { kind: 'equalAngles'; a: PointRef; vertex: PointRef; b: PointRef }
  /** Right-angle square at `at` between a line and a plane perpendicular to it. */
  | { kind: 'rightPlane'; at: PointRef; line: LineRef; plane: PlaneRef; toward?: PointRef }

interface Base {
  id: string
  color: string
  visible: boolean
}

export interface PointItem extends Base {
  type: 'point'
  label: string
  def: PointDef
  /** Show the coordinates next to the label: A(2; 3). */
  showCoords?: boolean
}

export interface SegmentItem extends Base {
  type: 'segment'
  a: PointRef
  b: PointRef
  /** Auxiliary segments are drawn thinner. */
  aux: boolean
}

export interface LineItem extends Base {
  type: 'line'
  def: LineDef
  /** A ray starts at def.a (through) / def.point / def.vertex. */
  extent: 'line' | 'ray'
  aux?: boolean
}

export interface CircleItem extends Base {
  type: 'circle'
  def: CircleDef
}

export interface PolygonItem extends Base {
  type: 'polygon'
  pts: PointRef[]
}

export interface AngleItem extends Base {
  type: 'angle'
  a: PointRef
  vertex: PointRef
  b: PointRef
  arcs: number
  showValue: boolean
}

export interface MarkItem extends Base {
  type: 'mark'
  def: MarkDef
}

export interface PlaneItem extends Base {
  type: 'plane'
  def: PlaneDef
  /** Draw the plane beyond the solid (faint). */
  extend: boolean
}

export interface FaceItem extends Base {
  type: 'face'
  face: number
}

/** Vector a → b (drawn with an arrow head). */
export interface VectorItem extends Base {
  type: 'vector'
  a: PointRef
  b: PointRef
  /** Auxiliary copy (dashed), e.g. in the triangle rule. */
  aux?: boolean
}

export type MeasureDef = { kind: 'length'; a: PointRef; b: PointRef } | { kind: 'area'; polygon: string }

/** A value shown on the drawing: AB = 5.39, S = 12.5. */
export interface MeasureItem extends Base {
  type: 'measure'
  def: MeasureDef
}

/** Free text anchored at a world position. */
export interface TextItem extends Base {
  type: 'text'
  text: string
  pos: Vec3
}

export interface RatioItem extends Base {
  type: 'ratio'
  a: PointRef
  b: PointRef
  text: string
}

export type Item =
  | PointItem
  | SegmentItem
  | LineItem
  | CircleItem
  | PolygonItem
  | AngleItem
  | MarkItem
  | PlaneItem
  | FaceItem
  | RatioItem
  | VectorItem
  | MeasureItem
  | TextItem
export type ItemType = Item['type']

export interface Doc {
  /** null = 2D sheet. */
  solid: SolidSpec | null
  items: Item[]
}

/** Order of the groups in the element list; the record makes the list exhaustive at compile time. */
const ITEM_TYPE_ORDER: Record<ItemType, number> = {
  point: 0,
  segment: 1,
  line: 2,
  vector: 3,
  circle: 4,
  polygon: 5,
  angle: 6,
  plane: 7,
  face: 8,
  mark: 9,
  ratio: 10,
  measure: 11,
  text: 12,
}
export const ITEM_TYPES = (Object.keys(ITEM_TYPE_ORDER) as ItemType[]).sort((a, b) => ITEM_TYPE_ORDER[a] - ITEM_TYPE_ORDER[b])

export const PALETTE = ['#2f45d8', '#d1382c', '#2e9a5a', '#f0a23a', '#8a8a8a', '#8e44ad', '#111111']

export const DEFAULT_COLOR: Record<ItemType, string> = {
  point: '#2f45d8',
  segment: '#2f45d8',
  line: '#2f45d8',
  circle: '#2f45d8',
  polygon: '#2e9a5a',
  angle: '#d1382c',
  mark: '#111111',
  plane: '#2f45d8',
  face: '#2e9a5a',
  ratio: '#d1382c',
  vector: '#111111',
  measure: '#111111',
  text: '#111111',
}
/** Images under transformations get their own colour. */
export const IMAGE_COLOR = '#8e44ad'
export const AUX_COLOR = '#8a8a8a'

/** All refs (point / line / circle / plane) mentioned by an item. */
export function refsOf(item: Item): string[] {
  const r: string[] = []
  const add = (...xs: (string | undefined)[]) => {
    for (const x of xs) if (x) r.push(x)
  }
  switch (item.type) {
    case 'point': {
      const d = item.def
      switch (d.kind) {
        case 'onSegment':
        case 'midpoint':
          add(d.a, d.b)
          break
        case 'onLine':
          add(d.line)
          break
        case 'intersection':
          add(d.a1, d.a2, d.b1, d.b2)
          break
        case 'edgePlane':
          add(d.plane)
          break
        case 'free':
          add(d.plane)
          break
        case 'onCircle':
          add(d.circle)
          break
        case 'meet':
          add(d.o1, d.o2)
          break
        case 'foot':
          add(d.point, d.line)
          break
        case 'tangency':
          add(d.circle, d.point)
          break
        case 'circlePlane':
          add(d.circle, d.plane)
          break
        case 'onSurface':
          break
        case 'linePlane':
          add(d.line, d.plane)
          break
        case 'projPlane':
          add(d.point, d.plane)
          break
        case 'bisectorFoot':
        case 'incenter':
        case 'centroid':
        case 'orthocenter':
          add(d.a, d.b, d.c)
          break
        case 'center':
          add(d.circle)
          break
        case 'image':
          add(d.src, ...tfRefs(d.tf))
          break
      }
      break
    }
    case 'line': {
      const d = item.def
      switch (d.kind) {
        case 'through':
          add(d.a, d.b)
          break
        case 'parallel':
          add(d.point, d.line)
          break
        case 'perpendicular':
          add(d.point, d.line, d.plane)
          break
        case 'perpBisector':
          add(d.a, d.b, d.plane)
          break
        case 'angleBisector':
          add(d.a, d.vertex, d.b)
          break
        case 'tangent':
          add(d.circle, d.point)
          break
        case 'planePlane':
          add(d.p1, d.p2)
          break
        case 'perpToPlane':
          add(d.point, d.plane)
          break
        case 'image':
          add(d.src, ...tfRefs(d.tf))
          break
      }
      break
    }
    case 'circle': {
      const d = item.def
      if (d.kind === 'image') add(d.src, ...tfRefs(d.tf))
      else if (d.kind === 'threePoints' || d.kind === 'incircle') add(d.a, d.b, d.c)
      else if (d.kind === 'centerPoint') add(d.center, d.through, d.plane)
      else add(d.center, d.plane)
      break
    }
    case 'mark': {
      const d = item.def
      if (d.kind === 'right') add(d.at, d.l1, d.l2, d.p1, d.p2)
      else if (d.kind === 'rightPlane') add(d.at, d.line, d.plane, d.toward)
      else if (d.kind === 'ticks') add(d.a, d.b)
      else add(d.a, d.vertex, d.b)
      break
    }
    case 'polygon':
      add(...item.pts)
      break
    case 'angle':
      add(item.a, item.vertex, item.b)
      break
    case 'segment':
    case 'ratio':
    case 'vector':
      add(item.a, item.b)
      break
    case 'measure':
      if (item.def.kind === 'length') add(item.def.a, item.def.b)
      else add(item.def.polygon)
      break
    case 'text':
      break
    case 'plane': {
      const d = item.def
      if (d.kind === 'three') add(d.a, d.b, d.c)
      else if (d.kind === 'parallel') add(d.point, d.plane)
      else add(d.point, d.line)
      break
    }
    case 'face':
      break
  }
  // Implicit "a|b" lines depend on both points.
  return r.flatMap((x) => parsePairRef(x) ?? [x])
}

/** Item ids that `item` depends on (solid vertices, faces and the sheet excluded). */
export function depsOf(item: Item): string[] {
  return refsOf(item).filter(
    (r) => parseVertexRef(r) === null && parseFaceRef(r) === null && parseRimRef(r) === null && r !== SHEET,
  )
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
