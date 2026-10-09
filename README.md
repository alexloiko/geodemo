# GeoDemo

Interactive board for demonstrating school solid-geometry (stereometry) problems.
Pick a polyhedron, put points on edges, draw segments and lines, build cross-sections
by a plane through three points, highlight faces and annotate ratios — drawn in the
familiar textbook style (squared paper, dashed hidden edges, A₁-style labels).

UI languages: English and Ukrainian.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # geometry + construction unit tests
npm run build    # static build in dist/
```

## Using it

- **Figure** — cube, rectangular box, oblique parallelepiped, prism (n = 3…8),
  pyramid (apex over centre or over a vertex), truncated pyramid, regular tetrahedron
  and octahedron. Sliders change dimensions; changing the type clears the construction.
- **Tools** (keys 1–5): Select · Point (click an edge/segment, snaps to 1/2, 1/3, …) ·
  Segment (two points) · Line (two points, drawn extended) · Plane (three points; the
  section polygon and its new vertices are built automatically).
- **Exact construction** forms: point on an edge with a ratio m : n (optionally adds
  "3x / x" marks), segment (normal or auxiliary), intersection of two lines, plane through
  3 points (optionally shown beyond the solid), face highlight, free ratio mark.
- **Elements** list: colour (click the swatch), rename points, show/hide, delete
  (dependents are removed too), `aux` / `ext` toggles.
- **Display** modes: *All*, *Focus* (dims everything not selected), *Only selected*.
- **View**: drag to rotate, wheel to zoom, *Textbook* (cabinet oblique) or *Orthographic*.
- **Undo/redo** (Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z), **Delete** removes the selection,
  **Esc** cancels. The construction is kept in localStorage and in the URL —
  *Copy link* shares it.
- **Example** loads the classic task: prism ABCA₁B₁C₁, A₁K : KB₁ = 3 : 1, section (ACK).

## Docs

- [Architecture](docs/architecture.md)
- [Rendering approaches](docs/rendering-approaches.md)
- [Roadmap](docs/roadmap.md)
