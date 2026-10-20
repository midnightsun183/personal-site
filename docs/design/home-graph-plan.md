# Plan: PR2, the home map as an Obsidian graph view

Status: plan written, eng-reviewed and built October 19, 2026. Decisions are at the top; the rest of the file already
reflects them. One change while building: the map shaping moved from `catalog.ts` into a pure `src/lib/mapView.ts`, so
`mapData()` could be tested against the sample vault (`catalog.ts` is `server-only` and reads the real `notes/`).

The look and behavior come from `docs/design/obsidian-content-pipeline-spec.md`, sections "Home map" through
"Phase 2". This file says **how** to build it. Where the two disagree, this file's decisions win.

## Eng review decisions (October 19, 2026)

1. **Pixi, as specced** (1B). Port Quartz's graph with PixiJS 8, bundled and dynamically imported. Not Canvas 2D.
2. **Keyboard and screen readers: swap to the list** (2A). The canvas is `aria-hidden`. A "View as a list" button
   before it swaps in `MapList`; "View as a graph" swaps back.
3. **Card after a 1.5 s hover** (3A). Hover highlights at once; the card (today's `Panel`, with theme facts) appears
   after 1.5 s. Touch: first tap shows the card, second tap opens. Clicking a theme dot does nothing.
4. **Every dot is labeled** (4C). Labels fade only when zoomed out below about 0.6x.
5. **`weight` sizes dots too** (5C). Radius is `2 + sqrt(degree)`, plus `HEAVY_BONUS` for heavy pieces.
6. **Interaction logic is pure and tested** (6A). Press, drag, click, the card timer, the touch rule and the
   graph/list/failed mode live in `graph.ts` and are tested with Vitest fake timers. `MapGraph` only wires events.
7. **Reserve the graph's space while Pixi loads** (7A). No list flash, no jump; no-JS visitors still get the list.

Also settled without a question: `next/dynamic` with `ssr: false` for `MapGraph`; d3-drag attached before d3-zoom; a
Pixi failure falls back to the list with one `console.warn`; Pixi's ticker off, render on demand; one edge pass in
`mapData()`; `KIND_LABEL`, `neighborsOf` and `hash` move to `graph.ts` and `Panel` to `MapGraph.tsx` (no import
cycle); stale diagrams and comments updated in the same change.

## What changes

```
  BEFORE (PR1)                                   AFTER (PR2)
  ────────────                                   ───────────
  notes/ ─▶ loadVault ─▶ mapData()               notes/ ─▶ loadVault ─▶ mapData()
                           │ edges: themes,                          │ edges: themes, connects,
                           │        connects                         │        + body wikilinks
                           ▼                                         ▼
                        HomeMap                                   HomeMap  (mode: list | graph | failed)
                    ┌──────┴──────┐                          ┌───────┴─────────┐
                 MapList       MapField                   MapList          MapGraph (next/dynamic, ssr: false)
                 (kept)        DOM nodes + SVG lines,     (kept)           Pixi canvas, d3-force, d3-zoom,
                               rect collision, drift,                      d3-drag, Panel overlay
                               pen loop, cards                                  │
                                                                                ▼
                                                                          graph.ts (pure: geometry,
                                                                          interaction rules, KIND_LABEL)
```

MapField's 600 lines go. What survives from it: the 4 px click/drag threshold, `follow()` (same tab, new tab, router for
`/` paths), `Panel` and its facts, `neighborsOf`, `hash`.

## What we take from Quartz

`quartz-community/graph`, `src/components/scripts/graph.inline.ts` (MIT, Copyright (c) 2026 Quartz Community). Credit
and the MIT notice go in `MapGraph.tsx`'s header.

| From Quartz | Value | Keep? |
|---|---|---|
| Forces | `forceManyBody(-100 * repel)`, `forceCenter`, `forceLink(distance)`, `forceCollide(r)` x3 | Yes, as named constants |
| Node radius | `2 + sqrt(degree)` | Yes, precomputed (Quartz recounts every link per call), plus `HEAVY_BONUS` |
| Hover focus | non-neighbors and their links to alpha 0.2, active links darker | Yes, tweened over 200 ms |
| Labels | hidden until zoomed in, hovered label scaled 1.1 | Changed: always on, fading below about 0.6x |
| Zoom | `d3.zoom().scaleExtent([0.25, 4])` | Yes |
| Drag | `d3.drag` with a pointer offset, `alphaTarget(1)` while dragging | Yes, with alphaTarget 0.3 |
| Click | "drag shorter than 500 ms" | **No**: the spec's 4 px rule |
| Render loop | `requestAnimationFrame` forever | **No**: render on demand |
| CDN loading, content fetch, local graph, tags, radial, SPA hooks, localStorage "visited" | | No |

## Files

| File | Change |
|---|---|
| `src/lib/notes.ts` | `PieceNote.links: string[]`: ids of body wikilinks, collected in `prepareBody` (it already resolves them). Update the pipeline diagram. |
| `src/lib/catalog.ts` | `mapData()`: one edge pass over `connects` and body links, one `seen` set, both ends shown, no self-links. Add `degree` per node. Update the docstring. |
| `src/components/margins/graph.ts` (new) | Pure, no React, no DOM, no Pixi. Geometry: `radius`, `seed`, `labelAlpha`, `hit`, `neighborsOf`, `hash`, `KIND_LABEL`. Interaction: `press`/`move`/`release` (click vs drag), the card timer rules, the touch two-tap rule, the HomeMap mode. |
| `src/components/margins/MapGraph.tsx` (new) | Client component: Pixi app, simulation, d3-zoom, d3-drag, draw, hover state, `Panel` overlay. Quartz credit, MIT notice and a flow diagram in the header. |
| `src/components/margins/HomeMap.tsx` | `HomeMap` (mode switch, "View as a list/graph") and `MapList`. `MapField`, `FieldNode`, `rectCollide`, drift go. Update the header diagram. |
| `src/components/margins/map.module.css` | Drop node, thread, loop, draw/flow keyframes. Keep list, panel, kind, fact. Add canvas, the view toggle, and the reserved-space rules (7A). |
| `src/components/margins/Marks.tsx` | Remove `PEN_LOOP` if nothing else imports it. |
| `src/app/layout.tsx` | The inline script also sets `<html data-js>`. |
| `package.json` | `pixi.js`, `d3-zoom`, `d3-drag`, `d3-selection` and their `@types`, exact versions. |
| `test/graph.test.ts`, `test/mapData.test.ts`, `test/MapList.test.tsx` (new) | See Tests. |
| Docs | `home-map.md` (dated revision, Implementation section), `CLAUDE.md` (Stack: PixiJS and the Quartz credit; Layout; diagram), spec status line, `TODO.md`. |

## How HomeMap loads (decision 7A)

```
 server HTML: MapList (always; no-JS and phones see it)
 inline script ─▶ <html data-js>

 CSS, wide screens only:
   [data-js] .list              hidden, and the graph's height reserved
   ...unless HomeMap sets       data-map="graph"  ─▶ graph drawn, list stays hidden
                                data-map="list"   ─▶ visitor chose the list
                                data-map="failed" ─▶ Pixi failed, list shown
   safety net: a CSS animation shows the list again after 4 s unless data-map is set
   (covers JS that never hydrates or a blocked chunk)

 HomeMap mode:  loading ──Pixi ready──▶ graph ◀──"View as a graph"── list
                   │                      └──"View as a list"──────▶ list
                   └──init throws / context lost──▶ failed (console.warn, list shown)
```

React's dev remount clears attributes on `<html>` (see `ThemeToggle.tsx:27`); HomeMap re-sets `data-js` the same way.
The future CSP item in `TODO.md` needs the inline script's new hash.

## How MapGraph runs

```
 mount
   ├─ await app.init({ autoStart: false, resolution: devicePixelRatio, autoDensity: true, backgroundAlpha: 0 })
   │     unmounted meanwhile? ─▶ app.destroy(), stop
   ├─ read tokens: getComputedStyle(--paper, --ink, --pencil, --rule, --pen); font family from <body> (Literata's
   │  generated name)
   ├─ await document.fonts.ready ─▶ create labels: white PIXI.Text, tinted (theme change re-tints, no rebuild)
   ├─ seed positions: hash(id) ─▶ deterministic
   ├─ reduced motion? ─yes─▶ sim.tick(300), stop, render once
   │                  └no──▶ sim.tick(150) before first render, then animate the rest
   ├─ fit to view: zoom transform that contains every node (40 px padding)
   └─ set data-map="graph"
   │
   ▼
 render() ◀── sim "tick" | zoom | hover change | theme change | resize
   │          (rAF-coalesced app.render(); nothing runs once settled and idle)
   ▼
 links (rule; active: pen, 1.75 px) ─▶ dots (pencil; hovered: pen) ─▶ labels (alpha from zoom)
 non-neighbors fade to 0.2 alpha over 200 ms (instant with reduced motion)

 events ─▶ graph.ts rules ─▶ effects
   pointer down on a dot ─▶ d3-drag (attached before d3-zoom; subject is null on background, so zoom pans)
     release, moved < 4 px ─▶ click: "/" router.push | https location / new tab | theme or none: nothing
     release, moved ≥ 4 px ─▶ release fx/fy, alphaTarget(0), settle
   wheel / pinch / background drag ─▶ d3-zoom, scale 0.25 to 4
   pointer move ─▶ hit() ─▶ hovered id (React state only when it changes)
   hover 1.5 s ─▶ card; leave dot and card ─▶ close; drag or zoom starts ─▶ cancel; Esc / Close ─▶ close
   touch tap 1 ─▶ card; tap 2 on the same dot ─▶ open

 theme toggle ─▶ MutationObserver on <html data-theme> + prefers-color-scheme change ─▶ re-read tokens, re-tint
 resize ─▶ ResizeObserver ─▶ app.renderer.resize, re-fit if the visitor hasn't zoomed
 webglcontextlost ─▶ mode "failed"
 unmount ─▶ sim.stop(), zoom/drag listeners off, observers off, app.destroy(true)
```

Positions never go through React state. React holds the hovered id, the card id, the fact index and the mode.

## Tests

```
 graph.ts geometry (Vitest)
   radius(0) = 2, radius(4) = 4, heavy adds HEAVY_BONUS, theme gets none
   seed(): same id, same position; different ids differ; inside the box
   labelAlpha(): 1 at k ≥ 0.6, fades toward 0 below, clamped
   hit(): nearest dot within radius + 5 screen px (divided by k); null on background; topmost wins on overlap
   neighborsOf(): undirected, no duplicates

 graph.ts interaction (Vitest, fake timers)
   press + release under 4 px ─▶ click; at 4 px or more ─▶ drag, no click
   click target: "/" path ─▶ push; https ─▶ assign; meta/ctrl/middle ─▶ new tab; theme or no href ─▶ nothing
   hover 1499 ms ─▶ no card; 1500 ms ─▶ card
   leave dot, enter card within linger ─▶ card stays; leave both ─▶ closes
   drag or zoom during the 1.5 s ─▶ timer cancelled
   touch: tap 1 ─▶ card, no navigation; tap 2 same dot ─▶ open; tap 2 other dot ─▶ that dot's card
   mode: loading ─▶ graph | failed; graph ⇄ list

 mapData (Vitest, sample vault in test/fixtures/notes)
   body wikilink between two shown pieces ─▶ one edge
   same pair via connects and body ─▶ one edge
   body wikilink to a planned piece ─▶ no edge in production, edge with PREVIEW
   body wikilink to itself ─▶ no edge
   degree counts every edge; heavy and normal weights carried through
   draft never in production output

 MapList (renderToStaticMarkup)
   a body-wikilink edge appears in "Connects to"
```

Pixi itself isn't unit-tested (no WebGL in Vitest). Check by hand against the spec's "Done when" list on the built
export served by `scratchpad/serve.py`: both themes, reduced motion, 360 px (list), the list/graph swap, WebGL off
(list returns), drag at 60 fps, slow 3G (reserved space, no jump), and Corey's Obsidian screenshots side by side. A
Playwright version of these checks is a TODO.

## Failure modes

| Codepath | Realistic failure | Test | Handled | Visitor sees |
|---|---|---|---|---|
| Body-link edges | Link to a hidden note draws an edge to nothing | mapData | both ends shown | nothing wrong |
| Pixi init | No WebGL, or init throws | mode test | mode "failed" + warn | the list |
| Pixi init | Unmount before init resolves | none | destroy after await | nothing |
| Context loss | GPU reset mid-visit | mode test | `webglcontextlost` ─▶ failed | the list |
| Reserved space | JS never hydrates | none (TODO 2) | CSS 4 s safety net | list after 4 s |
| Tokens | Read before theme applied | none | re-read on every theme change | right colors |
| Fonts | Labels made before Literata loads | none | wait for fonts.ready | right font |
| Card timer | Fires after a drag starts | interaction test | cancel on drag/zoom | no stray card |
| Click vs drag | Tiny drag opens a page | interaction test | 4 px rule | no surprise nav |
| Resize / DPR | Blurry or stretched canvas | none | resolution + resize | sharp canvas |

No critical gaps: every untested row has handling, and none fails silently into a blank map.

## What already exists (reused)

`d3-force` and the simulation pattern; `hash()`, `neighborsOf()`, `follow()`, `DRAG_THRESHOLD` and `Panel` from
`HomeMap.tsx`; `MapList`; wikilink resolution in `prepareBody`; the edge dedupe in `mapData()`; the inline theme script
in `layout.tsx`; `ThemeToggle`'s dev-remount workaround.

## Not in scope

- Ambient drift (removed; the graph settles and stops).
- Keyboard walking of the graph itself, and arrow keys (TODO 1: a focus layer over the dots).
- Browser tests of the canvas (TODO 2: Playwright smoke on the export).
- Local graph on piece pages, tag nodes, "visited" colors (Quartz features we don't need).
- Canvas 2D (reviewed and declined, decision 1).
- Images in notes (the photo slot) and redirects for renamed slugs: separate TODOs.
