# Design: construction tools, circles and the 2D sheet

Status: implemented in v0.2 (2026-10-11)

## Why

Teacher feedback on v0.1: the board only supports a narrow set of stereometry constructions.
Needed: classic construction tasks — perpendicular and parallel lines through a point (on or off
the line), perpendicular bisector, angle bisector, circles (by 3 points, by centre and point),
plus intersections of any objects, midpoint, point on a circle, polygons and angles, tangents.
These are mostly planimetry tasks, so the board gets a **2D sheet mode** in addition to the
3D solids, and the same tools work in 3D inside a chosen plane.

Decisions (from the owner):
- both a 2D sheet and 3D (tools work inside a plane of the solid);
- show the result plus school marks (right-angle square, equal-segment ticks, equal-angle arcs);
  compass arcs are out of scope for now (stage 3, step-by-step playback);
- also: intersections of any objects, midpoint, point on a circle, polygons, angles, tangents.

## Core idea: one 3D engine, planar constructions inside a plane

Everything stays in 3D coordinates. A **2D sheet** is simply a document without a solid,
viewed from the top, where every construction lives in the plane `z = 0`.
In 3D a planar construction needs a **working plane**: a face of the solid, a section plane
or the sheet. This gives one evaluator for both modes.

| Construction | Needs a plane in 3D? |
|---|---|
| Perpendicular from a point **off** the line | no (foot of the perpendicular is unique) |
| Perpendicular through a point **on** the line | yes |
| Parallel through a point | no |
| Perpendicular bisector of a segment | yes |
| Angle bisector (A, O, B) | no (plane of the angle) |
| Circle through 3 points | no |
| Circle by centre and point / radius | yes |
| Tangents (at a point / from a point) | no (plane of the circle) |

**Plane choice in 3D**: the sidebar has a *Working plane* selector — `Auto` (default), any face
(e.g. `AA₁B₁B`) or any section plane. `Auto` picks the single face/plane that contains all the
clicked points; if there is none or more than one, the tool shows a small inline chooser.

## Data model changes (`src/scene/model.ts`)

`Doc.solid` becomes `SolidSpec | null`; `null` = 2D sheet.

References:
- `PointRef` — unchanged (`v3` or item id).
- `LineRef` — a line-like thing: a segment/line/ray item id, or an implicit line through two
  points written `"p1|p2"` (solid edges, section sides, polygon sides).
- `CircleRef` — circle item id.
- `PlaneRef` — `"sheet"`, `"f<face>"` or a plane item id.

New / extended items:

```ts
PointDef +=
  | { kind: 'free'; pos: Vec3; plane?: PlaneRef }          // click on the sheet or on a face
  | { kind: 'onLine'; line: LineRef; t: number }            // on a constructed line
  | { kind: 'tangency'; circle; point; index }              // created with tangents
  | { kind: 'midpoint'; a: PointRef; b: PointRef }
  | { kind: 'onCircle'; circle: CircleRef; angle: number }
  | { kind: 'meet'; o1: LineRef | CircleRef; o2: LineRef | CircleRef; index: 0 | 1 }
  | { kind: 'foot'; point: PointRef; line: LineRef }        // created with a perpendicular

LineItem.def =                                              // replaces LineItem {a, b}
  | { kind: 'through'; a: PointRef; b: PointRef }
  | { kind: 'parallel'; point: PointRef; line: LineRef }
  | { kind: 'perpendicular'; point: PointRef; line: LineRef; plane?: PlaneRef }
  | { kind: 'perpBisector'; a: PointRef; b: PointRef; plane?: PlaneRef }
  | { kind: 'angleBisector'; a: PointRef; vertex: PointRef; b: PointRef }
  | { kind: 'tangent'; circle: CircleRef; point: PointRef; index: 0 | 1 }
LineItem.extent: 'line' | 'ray'

CircleItem { type: 'circle'; def:
  | { kind: 'centerPoint'; center: PointRef; through: PointRef; plane?: PlaneRef }
  | { kind: 'threePoints'; a; b; c }
  | { kind: 'centerRadius'; center: PointRef; r: number; plane?: PlaneRef } }

PolygonItem { type: 'polygon'; pts: PointRef[] }            // fill + sides (sides are LineRefs)
AngleItem   { type: 'angle'; a; vertex; b; arcs: 1 | 2 | 3; showValue: boolean }
MarkItem    { type: 'mark'; def:
  | { kind: 'right'; at: PointRef; l1: LineRef; l2: LineRef; p1?; p2? }  // right-angle square
  | { kind: 'ticks'; a; b; count: 1 | 2 | 3 }               // equal-segment ticks
  | { kind: 'equalAngles'; a; vertex; b } }                 // arc with two ticks (bisector)
```

Constructions add their marks automatically (perpendicular → right-angle square at the foot;
perpendicular bisector → ticks on both halves + square; angle bisector → equal arcs). Marks are
ordinary items, so they can be hidden or deleted.

The existing `intersection {a1, a2, b1, b2}` point stays readable; new intersections use
`meet`. Persistence goes to `VERSION = 2` with a migration of v1 documents
(`line {a, b}` → `def: {kind: 'through'}`).

## Geometry (`src/geometry`)

- `lines.ts`: line as `{p, d}`; foot of perpendicular; parallel; perpendicular inside a plane
  (`d' = n × d`); bisector directions; line ∩ line (existing), line ∩ plane.
- `circle.ts`: circle as `{c, n, r}`; circumcircle of 3 points; line ∩ circle (in the circle plane);
  circle ∩ circle (coplanar); tangents from a point; projection to screen as a sampled polyline
  (an ellipse under parallel projection), split by the existing visibility test in 3D.
- Visibility: with no solid nothing is hidden (explicit guard — an empty half-space list must
  not report "hidden").

## Interaction

**Click tools with a signature** (GeoGebra-like). Each tool declares the sequence of inputs it
needs, e.g. Perpendicular = `[point, line]`, Circle 3 points = `[point, point, point]`,
Intersect = `[lineOrCircle, lineOrCircle]`. The hint line shows the next expected input.
In a *point* slot, clicking a line/circle creates a point on it, and (2D sheet / face in 3D)
clicking empty space creates a free point — so most constructions are a few clicks.

Tool groups in the sidebar (icons, 4 per row, keyboard shortcuts kept for the basics):
- **Basic**: Select, Point, Segment, Line, Ray, Polygon
- **Construct**: Midpoint, Perpendicular, Parallel, Perpendicular bisector, Angle bisector,
  Intersect
- **Circles**: Circle (centre + point), Circle (3 points), Circle (centre + radius), Tangent
- **Mark**: Angle, Ratio mark, Equal ticks
- **3D only**: Plane (section), Highlight face

## 2D sheet

- New figure option *Sheet (2D)* at the top of the figure list.
- Camera: fixed top view; drag on empty space pans, wheel zooms; the grid moves with the
  content and one cell = one unit, with optional snapping of free points to grid nodes.
- Rotation and the Textbook/Orthographic switch are hidden in 2D.

## Rendering additions

Circles (sampled ellipses), rays, polygons (fill + sides), angle arcs with optional value in
degrees, right-angle squares, ticks; free points drawn like other user points; in 3D the faces
get hit areas so a point can be put on a face.

## Testing

Unit tests for every geometric construction in both 2D and inside an inclined face of a solid
(perpendicularity, equal distances, equal angles, tangency), migration v1 → v2, and tool flows
(clicking sequences produce the right items). Manual check in the browser of every tool in 2D
and on a prism face.

## Out of scope (later)

Compass arcs and step-by-step playback (stage 3), measurements panel (stage 4), dynamic
dragging of free points in 3D off a face.
