# Rendering approaches

The owner asked to keep a list of possible approaches and start with the simplest one.

| Approach | Pros | Cons | Status |
|---|---|---|---|
| **Own 3D model → SVG projection** | Full control of the textbook look (dashed hidden lines, labels, arcs, grid); exact geometry; tiny bundle; crisp export to SVG/PNG later | Hidden-line logic is ours (easy for convex polyhedra, harder for curved bodies) | **Chosen for the MVP** |
| Three.js / WebGL (e.g. react-three-fiber) | Real 3D, lighting, easy curved surfaces | Textbook style (dashed hidden edges, 2D labels, ratio arcs) needs custom shaders/overlays; heavier | Fallback for bodies of revolution if SVG gets hard |
| GeoGebra 3D embed (`deployggb.js`) | Mature construction engine, sections and curved bodies out of the box | Little control over look and UI; external script and licence terms for non-commercial use | Reference / fallback |
| JSXGraph 3D | Construction-oriented, MIT-like licence | 3D module is limited; styling closer to plots than textbooks | Not planned |

## Notes for stage 2 (bodies of revolution)

Cylinders, cones and spheres can stay in SVG: silhouettes are ellipses/segments in a parallel
projection, and plane sections are ellipses (or parabola/hyperbola arcs for cones) that can be
sampled into polylines and split with the same visibility test. Revisit Three.js only if that
turns out to be insufficient.
