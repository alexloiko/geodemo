import { type Polyhedron, type Vertex, orientOutward } from './polyhedron'
import type { Vec3 } from './vec'

export type SolidSpec =
  | { kind: 'cube'; a: number }
  | { kind: 'cuboid'; a: number; b: number; c: number }
  | { kind: 'parallelepiped'; a: number; b: number; c: number; shift: number }
  | { kind: 'prism'; n: number; side: number; height: number; shift: number }
  | { kind: 'pyramid'; n: number; side: number; height: number; apex: 'center' | 'vertex' }
  | { kind: 'frustum'; n: number; side: number; top: number; height: number }
  | { kind: 'tetrahedron'; a: number }
  | { kind: 'octahedron'; a: number }

export type SolidKind = SolidSpec['kind']

export const SOLID_KINDS: SolidKind[] = [
  'cube',
  'cuboid',
  'parallelepiped',
  'prism',
  'pyramid',
  'frustum',
  'tetrahedron',
  'octahedron',
]

export function defaultSpec(kind: SolidKind): SolidSpec {
  switch (kind) {
    case 'cube':
      return { kind, a: 4 }
    case 'cuboid':
      return { kind, a: 5, b: 3, c: 3.5 }
    case 'parallelepiped':
      return { kind, a: 5, b: 3, c: 3.5, shift: 1.2 }
    case 'prism':
      return { kind, n: 3, side: 5, height: 4, shift: 0 }
    case 'pyramid':
      return { kind, n: 4, side: 4, height: 5, apex: 'center' }
    case 'frustum':
      return { kind, n: 4, side: 5, top: 2.5, height: 3.5 }
    case 'tetrahedron':
      return { kind, a: 5 }
    case 'octahedron':
      return { kind, a: 4 }
  }
}

const BASE_LETTERS = 'ABCDEFGH'

/**
 * Regular n-gon in the z=0 plane, labelled clockwise when seen from above,
 * starting front-left (textbook convention: A front-left, B back-left …).
 */
function regularPolygon(n: number, side: number): [number, number][] {
  const r = side / (2 * Math.sin(Math.PI / n))
  // Triangles start back-left so the third vertex sits in front (as in textbooks).
  const start = n === 3 ? 150 : 180 + 180 / n
  const pts: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const ang = ((start - (360 / n) * i) * Math.PI) / 180
    pts.push([r * Math.cos(ang), r * Math.sin(ang)])
  }
  return pts
}

function rectangle(a: number, b: number): [number, number][] {
  // Clockwise from above starting front-left: A(-,-) B(-,+) C(+,+) D(+,-)
  return [
    [-a / 2, -b / 2],
    [-a / 2, b / 2],
    [a / 2, b / 2],
    [a / 2, -b / 2],
  ]
}

/** Prism over a base polygon: bottom A, B, …; top A_1, B_1, …; top shifted by (dx, 0). */
function prismOver(base: [number, number][], h: number, dx = 0, topScale = 1): Polyhedron {
  const n = base.length
  const vertices: Vertex[] = []
  base.forEach(([x, y], i) => vertices.push({ label: BASE_LETTERS[i], pos: [x, y, 0] }))
  base.forEach(([x, y], i) =>
    vertices.push({ label: `${BASE_LETTERS[i]}_1`, pos: [x * topScale + dx, y * topScale, h] }),
  )
  const faces: number[][] = [
    base.map((_, i) => i),
    base.map((_, i) => n + i),
    ...base.map((_, i) => [i, (i + 1) % n, n + ((i + 1) % n), n + i]),
  ]
  return center(orientOutward({ vertices, faces }))
}

function pyramidOver(base: [number, number][], apex: Vec3, apexLabel = 'S'): Polyhedron {
  const n = base.length
  const vertices: Vertex[] = base.map(([x, y], i) => ({ label: BASE_LETTERS[i], pos: [x, y, 0] }))
  vertices.push({ label: apexLabel, pos: apex })
  const faces = [base.map((_, i) => i), ...base.map((_, i) => [i, (i + 1) % n, n])]
  return center(orientOutward({ vertices, faces }))
}

/** Move so the bounding box is centred at the origin (keeps rotation pleasant). */
function center(p: Polyhedron): Polyhedron {
  const lo = [Infinity, Infinity, Infinity]
  const hi = [-Infinity, -Infinity, -Infinity]
  for (const v of p.vertices)
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], v.pos[k])
      hi[k] = Math.max(hi[k], v.pos[k])
    }
  const c = [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2)
  return {
    ...p,
    vertices: p.vertices.map((v) => ({ ...v, pos: [v.pos[0] - c[0], v.pos[1] - c[1], v.pos[2] - c[2]] })),
  }
}

export function buildSolid(s: SolidSpec): Polyhedron {
  switch (s.kind) {
    case 'cube':
      return prismOver(rectangle(s.a, s.a), s.a)
    case 'cuboid':
      return prismOver(rectangle(s.a, s.b), s.c)
    case 'parallelepiped':
      return prismOver(rectangle(s.a, s.b), s.c, s.shift)
    case 'prism':
      return prismOver(regularPolygon(s.n, s.side), s.height, s.shift)
    case 'pyramid': {
      const base = regularPolygon(s.n, s.side)
      const [ax, ay] = s.apex === 'vertex' ? base[0] : [0, 0]
      return pyramidOver(base, [ax, ay, s.height])
    }
    case 'frustum':
      return prismOver(regularPolygon(s.n, s.side), s.height, 0, s.top / s.side)
    case 'tetrahedron': {
      const base = regularPolygon(3, s.a)
      return pyramidOver(base, [0, 0, s.a * Math.sqrt(2 / 3)], 'D')
    }
    case 'octahedron': {
      const sq = rectangle(s.a, s.a)
      const h = s.a / Math.SQRT2
      const vertices: Vertex[] = sq.map(([x, y], i) => ({ label: BASE_LETTERS[i], pos: [x, y, 0] }))
      vertices.push({ label: 'E', pos: [0, 0, h] }, { label: 'F', pos: [0, 0, -h] })
      const faces: number[][] = []
      for (let i = 0; i < 4; i++) {
        faces.push([i, (i + 1) % 4, 4], [(i + 1) % 4, i, 5])
      }
      return center(orientOutward({ vertices, faces }))
    }
  }
}
