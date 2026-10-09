# GeoDemo — working notes

- The project owner gives instructions in Ukrainian; **all code, comments and docs are in English**.
- UI is bilingual: every user-facing string goes into both `src/i18n/en.ts` and `src/i18n/uk.ts`
  (the `uk` dictionary is typed against `en`, so a missing key fails `tsc`).
- Geometry lives in `src/geometry` as pure TypeScript with Vitest tests; keep React out of it.
- The construction document (`src/scene/model.ts`) is plain JSON — it is persisted to the URL and
  localStorage, so changing its shape requires bumping `VERSION` in `src/persist/persist.ts`.
- Rendering approach and alternatives: `docs/rendering-approaches.md` (try the simplest first).
- Commands: `npm run dev`, `npm test`, `npm run build`, `npm run lint`.
