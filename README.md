# GeoDemo

Interactive board for demonstrating school geometry: plane constructions on a 2D sheet
and solid-geometry (stereometry) problems on polyhedra. Construct perpendiculars, parallels,
bisectors, circles, tangents and intersections; build cross-sections by a plane through
three points, highlight faces and annotate ratios and angles — drawn in the familiar
textbook style (squared paper, dashed hidden edges, A₁-style labels, right-angle squares).

UI languages: English and Ukrainian.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # geometry + construction unit tests
npm run build    # static build in dist/
```

## Using it

- **Figure** — *Sheet (2D)* for plane geometry, or a solid: cube, rectangular box,
  oblique parallelepiped, prism (n = 3…8), pyramid (apex over centre or over a vertex),
  truncated pyramid, regular tetrahedron and octahedron. Changing the type clears the construction.
- **Tools** work by clicking, the hint shows what to click next. In a *point* step a click on a
  line, circle, face or (on the sheet) empty space creates the point there.
  - *Basic*: Select, Point, Segment, Line, Ray, Polygon.
  - *Construct*: Midpoint, Perpendicular (from a point off the line → foot H; through a point on
    the line → in the working plane), Parallel, Perpendicular bisector, Angle bisector, Intersect
    (any two lines / segments / edges / circles).
  - *Circles*: centre + point, three points, centre + radius, tangents from a point.
  - *Marks*: angle (with degrees), ratio arc, equal-segment ticks. Constructions add the usual
    marks themselves (right-angle squares, ticks, equal-angle arcs).
  - *Solid*: plane through 3 points (section built automatically), face highlight.
  - Keys 1–9: Select, Point, Segment, Line, Polygon, Perpendicular, Parallel, Circle, Intersect;
    Enter closes a polygon, Esc cancels.
- **Working plane** (solids): planar constructions use the face/section that contains the
  clicked points; when several fit, the board asks which one. It can also be fixed in the sidebar.
- **Exact construction** forms: point on an edge with a ratio m : n (optionally adds
  "3x / x" marks), segment (normal or auxiliary), intersection of two lines, plane through
  3 points (optionally shown beyond the solid), face highlight, free ratio mark.
- **Elements** list: colour (click the swatch), rename points, show/hide, delete
  (dependents are removed too), `aux` / `ext` toggles.
- **Display** modes: *All*, *Focus* (dims everything not selected), *Only selected*.
- **View**: drag to rotate (Shift+drag pans), wheel to zoom, *Textbook* (cabinet oblique) or
  *Orthographic*. On the sheet drag pans; one grid cell is one unit and points snap to grid nodes.
- **Undo/redo** (Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z), **Delete** removes the selection,
  **Esc** cancels. The construction is kept in localStorage and in the URL —
  *Copy link* shares it.
- **Example** loads the classic task: prism ABCA₁B₁C₁, A₁K : KB₁ = 3 : 1, section (ACK).

## Docs

- [Architecture](docs/architecture.md)
- [Rendering approaches](docs/rendering-approaches.md)
- [Roadmap](docs/roadmap.md)
- [Design: construction tools, circles and 2D sheet](docs/design/constructions.md)

## Deployment

Deployed on Vercel from the `main` branch (Git integration): every push to `main`
updates production, other branches get preview URLs. Vercel auto-detects Vite
(`npm run build` → `dist/`); no `vercel.json` is needed because the app is a single
page and its state lives in the URL hash.
