# Architecture

Static single-page app: Vite + React + TypeScript, Zustand for state, no backend.

```
src/
  geometry/   pure math (no React), unit-tested
    vec.ts          Vec3 helpers
    plane.ts        plane from 3 points, line ∩ line, segment ∩ plane
    lines.ts        lines p + t·d: foot, parallel, perpendicular (in a plane), bisectors
    circle.ts       circles {c, n, r}: circumcircle, line ∩ circle, circle ∩ circle, tangents
    polyhedron.ts   convex polyhedron model, outward faces, edges, half-spaces
    solids.ts       SolidSpec → Polyhedron generators with textbook labels
    section.ts      convex polyhedron ∩ plane → ordered polygon; enclosing box
    visibility.ts   occluder predicate (half-spaces / exact for curved bodies), segment splitting
    revolution.ts   cylinder, cone, frustum, sphere: ray test, contour lines, surface points,
                    polygonal approximation for sections
  scene/      construction document
    model.ts        Item types (point, segment, line, plane, face, ratio), dependencies
    evaluate.ts     Doc → computed 3D geometry (points, sections, invalid items)
    build.ts        item factories (point on segment, intersection, plane + section points, ratio marks)
    tools.ts        click tools: input slots (point / line / circle / face) and builders
    names.ts        display names and descriptions (a, b … for lines, ω for circles)
    labels.ts       automatic names (K, L, M, …), subscripts
    example.ts      the textbook example document
  render/
    camera.ts       oblique (cabinet) and orthographic projections with yaw/pitch
    SvgCanvas.tsx   SVG drawing + pointer interaction; touch layer (tap on release, long press,
                    one-finger drag, two-finger pinch) that leaves mouse and pen untouched
    gestures.ts     pinch zoom/pan maths
    Label.tsx       italic serif labels with subscripts
  store/store.ts  app state, undo/redo, tool logic
  persist/        URL hash (lz-string) + localStorage
  i18n/           en / uk dictionaries, useT()
  ui/             Sidebar, construction forms, view controls, TouchBar, device detection
```

## Data model

A `Doc` is `{ solid: SolidSpec | null, items: Item[] }`; `solid: null` is the 2D sheet (a scene in
the plane z = 0 viewed from the top — the same 3D engine). References:

- points: solid vertices (`"v3"`) or point item ids;
- lines: segment/line item ids or implicit two-point lines `"p1|p2"` (edges, section and polygon sides);
- planes: `"sheet"`, faces `"f2"` or plane item ids.

Items only reference earlier items, so evaluation is a single pass in order. Item types: point
(many definitions — on segment/line/circle, free, midpoint, intersections, foot, tangency, edge ∩
plane), segment, line (through two points, parallel, perpendicular, perpendicular bisector, angle
bisector, tangent; extent line or ray), circle, polygon, angle, mark (right angle, ticks, equal
angles), plane (section), face highlight, ratio arc. Deleting an item removes its dependents.

Constructions that are ambiguous in space (perpendicular through a point on the line,
perpendicular bisector, circle by centre) store the plane they were built in.

## Tools

`scene/tools.ts` declares every tool as a list of input *slots* plus a `build` function returning
new items, an error, or a request to choose a plane. The store turns canvas clicks into picks
(creating points on lines/circles/faces/sheet where a point is expected) and runs the builder.

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
