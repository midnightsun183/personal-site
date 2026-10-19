# Design doc: the home page map

Status: built, October 18, 2026 (see the "Home map" section of `TODO.md` for what's done, deviations, and what's waiting on Corey). Read `CLAUDE.md` first. Everything there still applies; this doc only changes the home page.

## Summary

The home page becomes a field of nodes: the things Corey has made, written, and done, joined by threads that show how they connect across fields. Visitors point at a node to see its connections, drag nodes around, and click one to open it. The map replaces the current letter-style home (`src/app/page.tsx`).

The point of the map is the connections. A résumé lists Navy, finance, and teaching as separate jobs; the map shows that reactor chemistry and validating client data are the same habit. Every design choice below serves that.

## Decisions Corey has made

- The map is the home page concept (chosen over an index and a "desk" of draggable objects).
- Nodes move, react, and can be clicked and dragged.
- Keep everything high-level: **no figures, no client names, no identifying project details.** This tightens the existing confidentiality rule: case-study nodes carry no numbers even when a figure has been cleared elsewhere.
- Don't name the school where Corey taught. Say "a bilingual school" at most.
- The forecasting system he built stays off the site entirely.
- No images on the map.

## Open questions for Corey (answered October 18, 2026)

Answers: 1, the work sells itself, no pitch copy. 2, drop the letter. 3, planned nodes stay hidden, and (revised the same day) the map shows with any number of real nodes; the 8-node minimum below no longer applies. 4, very slow drift.

1. **Selling.** `CLAUDE.md` says "no hire me pitch." In the October 18 design chat Corey said he wants visitors to think "I want to hire this person" and that the site should help Telos Brothers. This doc keeps the existing rule (no pitch copy; the Telos node links out to telosbrothers.com) and assumes the work does the selling. Confirm.
2. **The letter.** The current home opens with a letter ("The boxes from Mallorca arrived on a Tuesday…"). Proposal: move it to About, and give the home one line above the map. Confirm, or keep the letter below the map.
3. **Planned nodes.** Most nodes below point to pieces that aren't written yet. Proposal: they stay in the data with `status: "planned"` and don't render until they have somewhere to go. The map launches with whatever is real (at least 8 nodes, or it looks empty). Confirm.
4. **Ambient motion.** Should nodes drift slightly when nobody is touching them, or sit still until hovered or dragged? This doc specifies a very slow drift, easy to turn off with one constant.

## Revision: themes instead of regions (October 18, 2026)

Corey asked for the map to work like an Obsidian graph: "everything is connected. Concepts that are unique are their own web." That replaces the regions below:

- **Themes are nodes.** Each piece lists its themes in `map.ts` (`themes: [...]`), and the build adds a node for every theme a published piece uses, with a thread to each of those pieces. A theme with one piece is its own small web.
- **No fixed regions, anchors or background region names.** The layout comes from the links, with a gentle pull toward the middle so separate webs stay in view.
- **Direct links between pieces are only for connections that cross themes.** Pieces that share a theme are already joined through it.
- **The list version is grouped by theme.** Each piece is listed in full under its first theme, and other themes name it in an "Also here" line.
- **The layout is computed before the first paint** (300 ticks), so the map appears settled; the load moment is the threads drawing in. Labels use rectangle collision instead of d3's circles, so they don't overlap.

**Interaction, revised the same day (Corey):**

- **Hover or focus a piece:** the pen loop is drawn around the whole node, and its card shows. The card stays while the pointer or focus is on it, and closes about 200 ms after both leave.
- **Click a piece:** go straight to it. Pieces with a link are real `<a>` elements, so Cmd, Ctrl or middle click opens a new tab and Enter follows the link. A piece with nowhere to go yet (Experts) pins its card instead.
- **Touch:** the first tap shows the card, the second follows the link.
- **Hover a theme:** its web lights up, with no card. **Click a theme:** a card with a "Did you know?" fact from Wikipedia, with a link to the article. Each further click, or "Another fact", shows the next. Facts are hand-curated and cited in `map.ts` (`themeFacts`), checked against the articles; nothing is fetched at runtime. The list version shows each theme's first fact under its heading.
- **Esc, Close, or clicking the background** closes any card. Focus goes back to the node without reopening it.

Sections below that describe regions, anchors and the region list are superseded by this one, and so is the original "Click a node" behavior.

## Revision: the map's data comes from notes (October 18, 2026)

`map.ts` and the feed sync are gone (`docs/design/obsidian-content-pipeline-spec.md`, PR1). Every node is a note in `notes/`:

- **Pieces** are notes outside `notes/themes/`. `themes: ["[[Places]]"]` replaces the `themes` array, `connects: ["[[X]]"]` replaces `mapEdges` (one side is enough), and the note's body or `url` replaces `entryId` and `href`: a note is its entry and its node at once.
- **Themes** are notes in `notes/themes/`. Their bodies list the "Did you know?" facts, each ending in its source link (replaces `themeFacts`). `order` sets the list order; `label` the display name.
- **No feed nodes.** Substack and Medium posts are notes with a `url`; the newest-five feed attachment is removed.
- **Order within a theme** is heavy before normal, then alphabetical by label (it used to be the order in `map.ts`).
- `next dev` shows planned and draft notes too. Preview builds show planned notes, as before.

The field, its interactions, and the list version are unchanged. The graph-view rebuild is PR2 (see `TODO.md`). The "Data" section below is superseded by this one.

## What the map is not

- Not a skills cloud. Platforms (Snowflake, ServiceNow, Python…) are never nodes. They can appear inside a node's panel as "built with" if Corey wants, nowhere else.
- Not a timeline or a résumé. No dates on nodes, no job titles, no employers as nodes.
- Not a graph-database demo. No force-graph chrome: no physics toggles, no node counts, no legend of node types, no zoom controls.

## Layout and look

Use the existing Margins tokens and type. Do not use the mockup's colors.

- **Type:** Literata (already loaded in `layout.tsx`). Node labels upright; a node's kind ("essay", "tool") in italic, which matches "italic is the margin's voice."
- **Color:** `--ink` for labels, `--rule` for resting threads, `--pen` for active threads and active labels, `--pencil` for the kind line and dimmed state, `--hi` (highlighter) behind the focused node's label. Both themes must work; check contrast of dimmed labels in dark mode.
- **Regions:** nodes cluster loosely into regions. Each region has a large, faint italic label in the background (`--rule` color, `aria-hidden`), placed by the region's anchor. Regions: Reporting and data, Operations, Building, Language and teaching, Expertise, Places.
- **Size:** the map spans the `full` grid column. Height about `min(78vh, 760px)` on desktop. One line of copy above it, in Corey's voice (placeholder until he writes it); latest writing below it (reuse the existing `EntryList` section).
- **Hierarchy:** three node weights. Heavy (Experts, Telos Brothers, Second Lengua): larger label. Normal: most nodes. Light: auto-attached feed essays, smaller and in `--pencil` until hovered.
- **Hand-drawn marks:** the existing marks are a deliberate part of the style. One optional touch: the focused node gets the `Scribble` circle instead of a plain highlight. Try it; drop it if it's noisy.

## Interaction

### On load (the one orchestrated moment)
Nodes start at their region anchors and the simulation settles them over about 1.2 s. Threads draw in with a stroke-dashoffset animation, staggered. Nothing else animates on load.

### Resting
Optional slow drift (open question 4): a very low simulation target alpha so nodes breathe slightly. Pause when the tab is hidden, while the panel is open, and under `prefers-reduced-motion`.

### Hover or focus a node
- The node and its direct neighbors stay at full strength; the node's label gets `--pen`.
- Every other node and thread dims to about 25% opacity over 300 ms.
- Threads to neighbors turn `--pen`, slightly thicker, with a slow dash flowing away from the focused node.
- Keyboard focus does exactly what hover does.

### Drag a node
- Pointer down on a node, then move more than 4 px: it's a drag. Use pointer capture.
- The dragged node follows the pointer (`fx`, `fy`); connected nodes follow through the link springs, so the visitor feels the connections physically.
- On release, unpin the node and let the simulation settle it. It doesn't need to return to its old place.
- Cursor: `grab` on nodes, `grabbing` while dragging.

### Drag the background
Pans the whole map. Clamp so the content can't be dragged entirely off screen. No zoom in v1.

### Click a node (pointer down and up within 4 px)
Opens the node's panel. The panel is a small card anchored beside the node (flip sides near edges) on desktop. It holds:
- Title, kind (italic), a one- to two-sentence summary
- "Connects to" followed by the neighbor names, each a button that moves focus to that node and pans it into view. This lets visitors walk the map from panel to panel.
- One link that says what it does ("Read it on Substack", "Go to telosbrothers.com", "Read the case study"). No CTA-speak.
- A close button (`aria-label="Close"`). Esc closes. Clicking the background closes.

Only one panel at a time.

### Keyboard
- Tab moves through nodes in a fixed reading order (region by region, heavy nodes first), then into the panel when it's open.
- Enter or Space opens the panel. Esc closes it and returns focus to the node.
- Arrow keys are a nice-to-have: move focus to the nearest connected node in that direction.

### Small screens (under 720 px) and no JavaScript
No draggable field. Render the same data as a list grouped by region: each node's title, kind, summary, link, and a "Connects to" line listing its neighbors as in-page links. This list is also the server-rendered HTML (the static export ships it), so the content is crawlable and works before hydration. On desktop, the interactive map replaces it after hydration.

## Data

Superseded: the data now lives in notes (see "Revision: the map's data comes from notes" above). Kept for the history of the inventory.

### Where nodes live
Add `src/content/map.ts`, hand-written, read only through `src/lib/catalog.ts` like everything else.

```ts
// Shape only; validate with zod in schema.ts.
type MapNode = {
  id: string;                 // lowercase-dashes
  label: string;              // short, as shown on the map
  kind: "essay" | "explainer" | "tool" | "case study" | "venture" | "book" | "project" | "download";
  region: "reporting" | "operations" | "building" | "language" | "expertise" | "places";
  weight: "heavy" | "normal";
  summary: string;            // plain text, max ~200 chars, no figures or client names
  entryId?: string;           // a catalog entry this node stands for; its url wins over `href`
  href?: string;              // https or /path, same refinement as Entry.url
  linkLabel?: string;         // the link's text, e.g. "Read it on Substack"
  status: "published" | "planned";
  placeholder?: boolean;      // copy standing in for something real (same meaning as in Entry)
};

type MapEdge = [string, string]; // two node ids; undirected
```

- A node with `entryId` takes its URL, and its title if `label` is blank, from the catalog entry, so the map can't link somewhere the rest of the site doesn't.
- Build-time checks (throw, like the duplicate-id check in `load()`): every edge references existing nodes; no duplicate ids; every `entryId` exists; no published node is isolated (zero edges).
- `planned` nodes and their edges are filtered out before rendering.

### Feed essays
Essays from the snapshot attach automatically as light nodes to the "Writing" hub node in the Places region, newest five only, so the map never fills up with posts. A curated node with the same `entryId` replaces the automatic one, which lets Corey promote an essay into the map proper with its own edges.

### Starting inventory
Proposed from the vault (`Career/Projects/Platforms I've Used.md`) and the design chat. Every label and summary is a placeholder for Corey to rewrite. Nothing below includes figures, client names, or the school's name.

| id | label | kind | region | weight | status |
|---|---|---|---|---|---|
| `telos-brothers` | Telos Brothers | venture | reporting | heavy | published (`entryId: telos-brothers`; description still a placeholder) |
| `reporting-overhaul` | Automating a global manager's client reporting | case study | reporting | normal | planned |
| `stalled-implementation` | Getting a stalled implementation moving | case study | reporting | normal | planned |
| `factsheet` | How a factsheet gets built | explainer | reporting | normal | planned |
| `manual-cost` | What manual reporting costs | tool | reporting | normal | planned |
| `data-blocks` | Data blocks | explainer | reporting | normal | planned |
| `procedures` | Procedures, written by the people who run them | essay | operations | normal | planned |
| `reactor-chemistry` | What reactor chemistry taught me about data | essay | operations | normal | planned |
| `plant-monitoring` | Running plants from a screen away | essay | operations | normal | planned |
| `maker-projects` | Arduino and Raspberry Pi projects | project | building | normal | planned |
| `image-generation` | Image generation experiments | project | building | normal | planned |
| `vault-skills` | Obsidian vault skills | download | building | normal | planned |
| `experts` | Experts | book | expertise | heavy | published (no link yet; panel says it's in progress) |
| `unrecorded` | Unrecorded isn't absent | essay | expertise | normal | planned |
| `credential-vs-record` | Credential vs. track record | explainer | expertise | normal | planned |
| `second-lengua` | Second Lengua | venture | language | heavy | published (description and URL are placeholders) |
| `learning-spanish` | Learning Spanish as an adult | essay | language | normal | planned |
| `bilingual-classroom` | Teaching in a bilingual classroom | essay | language | normal | planned |
| `same-latitude` | Same latitude, different ocean | essay | places | normal | published (`entryId: same-latitude-different-ocean`) |
| `writing` | Writing | hub | places | normal | published (links to `/writing`; feed essays attach here) |

Edges (each is a connection a visitor should be able to see the reason for):

```
factsheet – data-blocks          factsheet – manual-cost         manual-cost – telos-brothers
data-blocks – telos-brothers     reporting-overhaul – telos-brothers
stalled-implementation – telos-brothers                          reporting-overhaul – data-blocks
reactor-chemistry – data-blocks  (sampling and specs ↔ validating client data)
procedures – reporting-overhaul  (written procedures ↔ the runbooks clients now operate from)
plant-monitoring – manual-cost   procedures – experts            unrecorded – experts
credential-vs-record – experts   bilingual-classroom – experts   procedures – bilingual-classroom (training people)
bilingual-classroom – learning-spanish                          learning-spanish – second-lengua
bilingual-classroom – second-lengua                             learning-spanish – same-latitude
vault-skills – image-generation  vault-skills – unrecorded       maker-projects – plant-monitoring
writing – experts                writing – same-latitude
```

At launch only the published nodes render: Telos Brothers, Experts, Second Lengua, Same latitude, Writing, plus feed essays. That's below the 8-node minimum, so either Corey clears several planned pieces first, or the map ships after the first few are written. Flag this to him rather than padding the map.

## Implementation

- **Component:** `src/components/margins/HomeMap.tsx`, a client component (`"use client"`), rendered from `src/app/page.tsx` with data passed in from the catalog queries. It renders the list version on the server and swaps to the field after mount on wide screens.
- **Physics:** use `d3-force` (the only new dependency; it pulls in `d3-quadtree`, `d3-dispatch`, `d3-timer`). Forces: `forceLink` (distance about 140, strength 0.4), `forceManyBody` (strength about -350), `forceCollide` sized to each label's measured box plus padding, and `forceX`/`forceY` toward the node's region anchor (strength about 0.06) so regions stay recognizable. Don't hand-roll a simulation.
- **Deterministic start:** seed initial positions from the region anchor plus a hash of the node id, so the settled layout is the same on every visit.
- **Rendering:** SVG `<line>`s for threads underneath; HTML `<button>`s for nodes on top, absolutely positioned. Update positions on each tick by writing `transform` directly through refs in one `requestAnimationFrame` loop. **Never call `setState` per tick.** React state holds only focus, hover, the open panel, and pan.
- **Region anchors:** fractions of the map's width and height, so the layout scales with the container. Recompute on resize (ResizeObserver) and reheat the simulation gently (`alpha(0.3)`).
- **Reduced motion:** run the simulation to completion synchronously before first paint (`simulation.tick(300)`, then stop), skip the thread draw-in, the dash flow, and the drift. Dragging still works, but release doesn't animate.
- **Static export:** nothing here needs a server. No runtime fetches.
- **Styles:** add classes to `margins.module.css` (or a `map.module.css` beside it if it grows past ~60 lines). Keep the existing selector-specificity conventions.
- **Accessibility:** nodes are real `<button>`s with `aria-pressed` for the open one. The field has `role="group"` and an `aria-label` that explains it ("Map of my work. Each item connects to related work."). The panel is a `role="dialog"` that is not modal (no focus trap), labelled by its title. Thread SVG is `aria-hidden`. Dimmed text must still meet AA contrast, or it must be hidden from the accessibility tree while dimmed.
- **Performance budget:** at most about 40 nodes on screen. Hold 60 fps while dragging on a mid-range laptop. If it doesn't, drop the dash-flow animation first.

## Done when

- The map renders on the home page in both themes, with the line of copy above it and latest writing below.
- Hover, keyboard focus, drag (node and background), click to open, walking from panel to panel, Esc, and click-outside all work as described.
- At 360 px the list version shows, with no horizontal scroll.
- Reduced motion produces a static, settled map with everything still usable.
- The build fails on a broken edge, a duplicate id, an unknown `entryId`, or an isolated published node.
- No figures, client names, school name, or forecasting system anywhere in `map.ts`.
- `TODO.md` has a "Home map" section with what's done and what's waiting on Corey (open questions, copy, which planned nodes to write first).
- Changes are staged with `git add` only. Don't commit or push.
