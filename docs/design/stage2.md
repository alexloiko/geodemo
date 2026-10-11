# Design: stage 2 — bodies of revolution and more constructions

Status: implemented in v0.3 (2026-10-11)

Owner decisions: single bodies first (combinations of bodies later); together with the bodies
add four groups of missing constructions — space constructions, one-click triangle elements,
transformations, coordinates / vectors / measurements / notes.

Work is split into five phases; each phase ends with tests, a browser check and a commit.

---

## Phase 1 — bodies of revolution (done)

New solids: **cylinder** (r, h), **cone** (r, h), **truncated cone** (r₁, r₂, h), **sphere** (r).

### Representation

A curved body keeps two descriptions:

- **analytic** (`geometry/revolution.ts`): `{ kind, r1, r2, h }` in a frame centred like the
  polyhedra (axis = z). Used for drawing, visibility and exact points.
- **approximation** (`Polyhedron`, 128 segments; sphere 64 × 32): used for sections and face
  hit areas, exactly like polyhedra. Approximation vertices are unlabelled and never drawn.

Named points become solid vertices with labels: cylinder / truncated cone `O`, `O₁` (base
centres), cone `O` and apex `S`, sphere `O`. Rims (base circles, sphere equator) are circles the
user can click: refs `rim0`, `rim1` in `ev.circles`, so all circle tools and "point on circle" work.

Only flat faces (bases) are offered as working planes and face highlights; lateral facets are
marked `smooth`.

### Visibility

`splitByVisibility` and friends take an **occluder predicate** `(q) ⇒ hidden` instead of
half-spaces. Polyhedra keep the half-space test; curved bodies get an exact ray test: the ray
`q + s·v` is clipped by the base planes, the lateral quadric (cylinder / cone) or the sphere,
and the point is hidden when an inside interval exists for `s > ε`. Bodies stay convex, so the
hidden part of a segment is still a single interval.

### Drawing (textbook style)

- rims as ellipses, hidden halves dashed (from the occluder);
- **contour generatrices**: roots of `normal(θ) · v = 0` along the rims (sampling + bisection),
  recomputed for every view; drawn solid;
- sphere: outline = great circle ⟂ view direction (always solid) + equator with its back half
  dashed;
- no facet edges.

### Points on the surface

Clicking the lateral surface casts the view ray against the analytic body (front intersection)
and creates `PointDef { kind: 'onSurface', u, v }` (angle + height; sphere: longitude + latitude).
Dragging re-casts the ray. Clicks on a base create a free point in that base plane (as for faces).

Default view for bodies of revolution: orthographic, from the front and slightly above
(horizontal base ellipses, round sphere), as in textbooks. The visibility test uses a tolerance of
3·10⁻³ of the body size so that chord midpoints and approximation vertices (slightly inside the
true surface) count as surface points. New points on these bodies are named from `A`; a section
corner above a bottom point `A` (same angle) is named `A₁`.

### Sections

The section polygon comes from the approximation (draws like an ellipse / rectangle / triangle).
Corner points where the section meets a rim are computed exactly as `circle ∩ plane` and added
as points (`PointDef { kind: 'circlePlane', circle, plane, index }`); approximate section
vertices snap to them. Sphere sections are exact circles. Section sides between two corner
points (e.g. an axial section) accept points like polyhedron sections.

---

## Phase 2 — space constructions (solids only) (done)

New input slot **plane**: a click on a face or on a section fill picks that plane.

`PlaneItem` gets a definition (persistence **v3**, v2 `{a, b, c}` migrates to `three`):

```ts
PlaneDef =
  | { kind: 'three'; a; b; c }                      // existing
  | { kind: 'parallel'; point; plane }              // plane through a point ∥ given plane
  | { kind: 'perpToLine'; point; line }             // plane through a point ⟂ a line
```

Tools (group *Space*):

| Tool | Clicks | Result |
|---|---|---|
| Trace of a line | line, plane | point `line ∩ plane` (`PointDef linePlane`) |
| Planes intersection | plane, plane | line (`LineDef planePlane`) |
| Parallel plane | point, plane | plane + its section |
| Perpendicular to a plane | point, plane | line ⟂ plane, foot `H` (`PointDef projPlane`), right-angle square |
| Line–plane angle | line, plane | trace `O`, foot `H` of a line point, segments, ∠ with degrees |
| Plane ⟂ line | point, line | plane + section |

Section, plane extension and auto section points work for every plane definition. Feet of
perpendiculars that fall on an existing point (e.g. a vertex) reuse it instead of adding a duplicate.

---

## Phase 3 — triangle in one click (done)

Three clicks: the vertex the element starts from, then the other two vertices. Works on the sheet
and in space (in the plane of the three points).

| Tool | Result |
|---|---|
| Median | midpoint of the opposite side, segment, equal ticks |
| Altitude | foot (`foot`), segment, right-angle square; dashed extension of the side when the foot is outside |
| Bisector (triangle) | point on the opposite side (`bisectorFoot`), segment, equal-angle arcs |
| Midline | midpoints of the two adjacent sides + segment |
| Incircle | incentre `I` + circle (`CircleDef incircle`) |
| Centroid / orthocentre | point `G` with dashed medians / point `H` with dashed altitude lines |
| Centre of a circle | one click on a circle → its centre (`PointDef center`) |

---

## Phase 4 — transformations (done)

New slot **object**: a point, segment, line, circle or polygon. Tools:

| Tool | Clicks | Options |
|---|---|---|
| Point symmetry | object, centre | — |
| Line symmetry | object, line | (in space: half-turn about the line) |
| Rotation | object, centre | angle in degrees; in space around the normal of the working plane |
| Translation | object, vector | — |
| Homothety | object, centre | coefficient k |

Images keep their structure: a polygon gives the polygon of image points, a segment two image
points and a segment, a circle a circle. Image points are labelled with a prime (`A → A′`, then
`A″`, `A‴`) and drawn in purple. The vector item needed for translations is part of this phase.

```ts
Transform =
  | { kind: 'pointReflect'; center } | { kind: 'lineReflect'; line }
  | { kind: 'rotate'; center; deg; plane } | { kind: 'translate'; vector }
  | { kind: 'dilate'; center; k }
PointDef  += { kind: 'image'; src: PointRef; tf: Transform }
LineDef   += { kind: 'image'; src: LineRef; tf: Transform }
CircleDef += { kind: 'image'; src: CircleRef; tf: Transform }
```

---

## Phase 5 — coordinates, vectors, measurements, notes (done)

- **Axes** on the sheet (display toggle) with unit ticks and numbers; **point by coordinates**
  form; per-point toggle to show coordinates in the label (`A(2; 3)`).
- **Vector** item (`{ a, b }`, arrow head, label with an arrow) and **vector sum** tool
  (triangle rule: the second vector is copied dashed to the end of the first).
- **Measurements**: length `AB = 5.39` (tool: two points), polygon area (tool: polygon);
  values follow the construction when points move. Units: grid cells on the sheet, solid units
  on solids. Angles already show degrees.
- **Text notes**: tool + text option; a click places a note (world-anchored, moves with the view).

---

## Sidebar

The **basic tools** (Select, Point, Segment, Line, Ray, Polygon) are always visible. Below them
a row of **group tabs** (Construct · Triangle · Circles · Transform · Measure · Space) shows the
additional tools of one group at a time, 4 per row. The active tool, its hint and its options stay
visible under the tools. Keyboard shortcuts stay for the basic tools.

## Testing

Per phase: unit tests for the geometry (exact rim points, contour generatrices tangent to the
view, sections of each body, all triangle centres, transforms, measurements) and tool-flow tests
through the store; migration v2 → v3; browser check of the textbook look for each body.
