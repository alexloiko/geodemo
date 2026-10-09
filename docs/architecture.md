# Architecture

Static single-page app: Vite + React + TypeScript, Zustand for state, no backend.

```
src/
  geometry/   pure math (no React), unit-tested
    vec.ts          Vec3 helpers
    plane.ts        plane from 3 points, line ∩ line, segment ∩ plane
    polyhedron.ts   convex polyhedron model, outward faces, edges, half-spaces
    solids.ts       SolidSpec → Polyhedron generators with textbook labels
    section.ts      convex polyhedron ∩ plane → ordered polygon; enclosing box
    visibility.ts   hidden-point test and visible/hidden segment splitting
  scene/      construction document
    model.ts        Item types (point, segment, line, plane, face, ratio), dependencies
    evaluate.ts     Doc → computed 3D geometry (points, sections, invalid items)
    build.ts        item factories (point on segment, intersection, plane + section points, ratio marks)
    labels.ts       automatic names (K, L, M, …), subscripts
    example.ts      the textbook example document
  render/
    camera.ts       oblique (cabinet) and orthographic projections with yaw/pitch
    SvgCanvas.tsx   SVG drawing + pointer interaction
    Label.tsx       italic serif labels with subscripts
  store/store.ts  app state, undo/redo, tool logic
  persist/        URL hash (lz-string) + localStorage
  i18n/           en / uk dictionaries, useT()
  ui/             Sidebar, construction forms, view controls
```

## Data model

A `Doc` is `{ solid: SolidSpec, items: Item[] }`. Points are referenced either as solid
vertices (`"v3"`) or by item id. Items only reference earlier items, so evaluation is a
single pass in order. Kinds of point:

- `onSegment {a, b, t}` — on an edge or user segment (dragging changes `t`);
- `intersection {a1, a2, b1, b2}` — of two lines, invalid when skew/parallel;
- `edgePlane {a, b, plane}` — where a plane cuts a solid edge (created with a section).

Deleting an item removes all items depending on it.

## Rendering

1. Build the polyhedron from the spec; evaluate the construction.
2. Project with a parallel projection (`camera.ts`); `toViewer` is the world direction
   towards the viewer.
3. A face is visible when its outward normal has a positive dot product with `toViewer`;
   a solid edge is dashed when both adjacent faces are hidden.
4. Any other segment is split by `splitByVisibility`: a point is hidden when the ray towards
   the viewer passes through the solid's interior. For a convex solid the hidden part of a
   segment is a single interval, found by sampling and bisection.
5. Layers: grid → fills (plane extensions, faces, sections) → selection halos → strokes →
   hit areas → ratio arcs → points → labels.

## Display modes

`all` draws everything visible. With a non-empty selection, `focus` dims non-relevant items
and `selected` hides them. "Relevant" = selected items, their dependencies and points
created by a selected plane.
