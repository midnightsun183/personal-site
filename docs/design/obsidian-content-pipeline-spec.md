# Spec: Obsidian notes as the source for map nodes and hosted pages

Status: PR1 (notes pipeline, feed sync removed) built October 18, 2026; PR2 (graph view) built October 19, 2026, from `docs/design/home-graph-plan.md`, whose decisions override this file's "Home map" section where they differ. Replaces the earlier draft of this file. Read `CLAUDE.md` and `docs/design/home-map.md` first; everything there still applies unless this doc says otherwise. This changes two things: **where content is written** (Obsidian notes instead of TypeScript), and **how the home map renders** (an Obsidian graph view, ported from Quartz, instead of the current custom field). See "Home map".

## Eng review decisions (October 18, 2026)

These override the sections below where they disagree.

- **Split into two changes.** PR1 is the notes pipeline plus removing the feed sync. PR2 is the graph view ("Home map"), planned and reviewed separately after PR1 lands (see `TODO.md`). In PR1 the current map keeps running, fed from notes. Body wikilinks become map edges in PR2, not PR1; PR1's edges are `themes` and `connects`, as today.
- **Renderer:** parse with `unified` + `remark-parse` + `remark-gfm`, then render with our own switch-based mdast-to-React function (`src/components/margins/NoteBody.tsx`). Not react-markdown: footnotes must land after their paragraph, and every body rule should be one visible case.
- **Allowed Markdown:** paragraphs, h2, h3, links, emphasis, strong, lists, inline code, code blocks, hr, footnotes, `> [!quote]`, plain `>`, and `graphic` blocks. Anything else (h1, tables, images, embeds, raw HTML, unknown callouts) fails the build.
- **Layout:** `src/lib/notes.ts` loads, parses, validates and resolves notes, and takes the notes root as a parameter (for test fixtures). `src/lib/catalog.ts` is the only file that imports it.
- **Dev reload:** notes are memoized in production only. In `next dev`, they're re-read on each request, so an edit shows on refresh.
- **Drafts in dev:** `next dev` also shows `draft` and `planned` notes, marked as drafts. Production is unchanged.
- **Slugs:** a published note with a body must set `slug` explicitly (the template prefills it). Retitling never changes a URL.
- **Sections:** the default stays as written (essay and explainer go to writing; venture is work/venture; everything else is work/project). An optional `section: writing | work` property overrides it.
- **One schema:** a single `Note` frontmatter schema replaces `MapNode` and the authoring side of `Entry`. `Entry` stays as the derived type pages consume. Summary max is 220 characters.
- **More build checks:** a note with both a body and a `url`; two notes with the same name, or an alias that collides with a note name; unquoted wikilinks in YAML (fail with a hint to quote them); footnotes that are undefined, unused or defined twice; duplicate or malformed `graphic` keys; body link hrefs that aren't https, `/path` or `mailto:`.
- **Parsing rules:** normalize CRLF and BOM before splitting frontmatter. Parse YAML with the 1.2 core schema so dates stay strings. Resolve `[[Note|shown]]` and `[[Note#Heading]]` by the part before `|` or `#`. Number named footnotes by first reference. A footnote's `<Note>` goes after the top-level block that contains the reference. In graphic blocks, split each line on the first colon. Hubs and map-only notes are never `Entry`s.
- **Confidentiality rules** (today in the `map.ts` header) move into both templates and `notes/README.md`.
- **Tests:** add Vitest. A fixture vault in `test/fixtures/notes/` holds one good note per branch and one broken note per build check. Unit tests cover `notes.ts`, and `renderToStaticMarkup` tests cover `NoteBody`. `prebuild` runs `vitest run`, replacing the feed check. Don't set `NODE_ENV=production` in Cloudflare's build settings, or devDependencies (and Vitest) won't install.
- **Before building:** commit the staged hover and fact-card work, so phase 2 can recover it from history.

## The problem

Adding one piece today means editing up to four code files:

| What | Where it lives now |
|---|---|
| Entry metadata (title, date, url, summary) | `src/content/catalog.ts` (`curated`) |
| Map node (kind, themes, weight, summary again) | `src/content/map.ts` (`mapNodes`) |
| Cross-theme links | `src/content/map.ts` (`mapEdges`) |
| Theme labels and "Did you know?" facts | `src/content/map.ts` (`themeLabels`, `themeFacts`), plus the `Theme` enum in `schema.ts` |
| Page body | `src/content/posts/*.tsx` or `work/*.tsx`, registered in `src/content/hosted.tsx` |

## The goal

**One Markdown note per piece, one note per theme, in a folder Corey opens in Obsidian.** Adding a piece, theme, fact, or link is writing or editing a note. No TypeScript edits.

The only thing that still needs code is a **new kind of interactive graphic**, once per graphic, not once per post.

**Notes are the only content source.** Pieces published on Substack or Medium also get a note (with a `url`). There are no imports, no feeds, and no sync job. The notes replace `curated`, `map.ts`, `hosted.tsx`, and `snapshot.json` as inputs to `src/lib/catalog.ts`. The query functions (`writing`, `work`, `featuredWork`, `bySlug`, `hosted`, `mapData`) keep their signatures (`mapData` gains node positions). The page routes and the components don't change. The map's field is rebuilt (see "Home map").

## Not changing

- The map's list version (`MapList` in `HomeMap.tsx`). The field above it is rebuilt, and `home-map.md`'s interaction rules are replaced by "Home map" below.
- The Margins components (`Note`, `NoteRef`, `Aside`, `DaylightChart`, `ParallelMap`, `margins.module.css`).
- Strictness: a bad note **fails the build** with a message naming the file, as the catalog and map do today. The last deploy stays live.
- Static export, $0, no runtime fetches, no `dangerouslySetInnerHTML`.

## Home map: an Obsidian graph view (phase 1)

Decided October 18, 2026, with reference screenshots of Corey's own Obsidian graph: the home map **is an Obsidian graph view** that visitors can explore. Every dot is a published `.md` note. This replaces the current field and the canvas-card idea.

### Look (match Obsidian's graph view)

- **Nodes are dots.** Size scales gently with the number of links, as in Obsidian, so hubs read larger. Unlinked notes appear as lone dots.
- **Lines are thin and straight.** No curves, no arrowheads.
- **Plain background** (`--paper`, the page color). No dotted grid, no cards, no borders.
- **Labels:** by default only on the hovered node, and on large nodes once zoomed in (Obsidian's "text fades at zoom" behavior). Labels may overlap other dots and labels, especially while dragging, as in Obsidian.
- **No collision rules.** The only forces are link springs, many-body repulsion, and centering (Obsidian's "center force", "repel force", "link force", "link distance"). Delete the current rectangle collision.
- **Colors from site tokens, read at runtime**, and re-read when the theme toggles. Dots and lines rest in `--pencil`/`--rule`; the hovered node and its links use `--pen` (the screenshots' purple accent maps to `--pen`). Real light and dark themes.

### Behavior

- **Pan** by dragging the background. **Zoom** with the wheel, a pinch, or a trackpad. Clamp zoom to a sensible range. On load, fit everything in view.
- **Drag a node:** it follows the pointer, connected nodes follow through the physics, and the simulation reheats. On release, the node is let go and the graph settles.
- **Hover a node:** it and its direct neighbors stay at full strength, and its links turn `--pen` and get thicker. **Every other node and link fades into the background** (low opacity; optionally a slight blur if it stays smooth at 60 fps). Its label shows. The transition is quick (about 150 to 250 ms) both ways.
- **Click a node:** open it. Pieces with a page go to their page, pieces with a `url` go there, and nodes with neither (theme notes, Experts, planned pieces in preview) do nothing in phase 1. A press that moves more than 4 px is a drag, not a click.
- **Idle:** the graph settles and stops. No ambient drift in phase 1; remove `DRIFT`.
- **Reduced motion:** a settled layout with no animated transitions. Hover still highlights, and drag still works without the follow-through animation.
- **Deterministic:** seed initial positions from a hash of each id, so the graph looks the same on every visit.

### What's on the graph

- **Every published note**, including theme notes. Each note is one dot.
- **Edges come from every wikilink**, Obsidian-style: `themes`, `connects`, and wikilinks in the body. Duplicates are removed, and links are undirected. (This replaces "Don't auto-generate edges from body wikilinks" under "Links".)
- No automatic nodes: remove the "newest five feed essays on the Writing hub" logic.
- `planned` notes render only in preview builds (`NEXT_PUBLIC_MAP_PREVIEW=1`), as today. `draft` notes never render.

### Build with: port Quartz's graph view

Don't hand-roll this. Port the graph component from **Quartz** (an open-source Obsidian-to-website generator): `github.com/quartz-community/graph`, MIT-licensed. It is a near-clone of Obsidian's graph and uses the same approach Obsidian does: **d3-force** for the physics (already a dependency here) and **PixiJS** for WebGL drawing. It already has drag with follow-through, zoom, pan, hover focus (`focusOnHover`), and Obsidian-style force settings (`repelForce`, `centerForce`, `linkDistance`).

- Read its source first, then port the rendering and interaction code into a client component rendered by `HomeMap` (replacing `MapField`). Keep its credit and MIT notice in a header comment.
- Drop the Quartz-specific parts: its content-index fetch, local/global graph modes, tag nodes, radial mode, and SPA navigation hooks. Data comes from `mapData()` as props. There's no runtime fetch.
- Adapt it to this site: site tokens, Next `Link`/`router` navigation on click, reduced motion, resize handling, and cleanup on unmount (destroy the Pixi app, stop the simulation).
- Load Pixi only on the home page. Use a dynamic import inside the component, and bundle it (no CDN, because nothing is fetched at runtime).
- Expose the force settings as named constants at the top of the file, so feel can be tuned without hunting.
- If porting turns out to be harder than adapting, use `force-graph` (vasturiano, MIT, canvas-based) as the fallback. Ask Corey before switching.

### Tear down

- `MapField` in `HomeMap.tsx`: the custom d3-force field, rectangle collision, presettle-for-labels logic, drift, the pen loop on nodes, preview and pinned cards, and theme-fact cards. The hover card and theme facts come back in phase 2.
- Map styles in `map.module.css` that only the old field used.
- In `mapData()`: generated theme nodes (themes are notes now), feed auto-nodes, and the `weight` and `group` fields if nothing else uses them.

### Keep

- The list version (`MapList`): server-rendered, crawlable, shown under 720 px and without JS, and grouped by theme (theme = a theme note a piece links to in `themes`). On wide screens, keep it available to keyboard and screen-reader users with a "View as a list" link before the graph. A WebGL canvas isn't accessible on its own, so the canvas element is `aria-hidden`.
- The quality floor in `CLAUDE.md`: 360 px without horizontal scroll (the list), both themes, reduced motion, visible focus, and 60 fps while dragging with the current node count.

## Phase 2 (not now): hover card

After a node has been hovered for **1.5 seconds**, a card appears beside it with the note's title, kind, and summary, similar to today's preview card (link text, close on leave, Esc). Theme notes show their "Did you know?" facts here. Touch gets an equivalent (e.g. long-press). Specify it separately once phase 1 is in.

## Folder

```
notes/                      # open as an Obsidian vault (see "Getting notes to GitHub")
  themes/                   # one note per theme
    Places.md
    Reporting.md
    ...
  writing/                  # organization only; the build reads every .md under notes/
    Same latitude, different ocean.md
  work/
    Telos Brothers.md
  map/                      # map-only pieces (planned pieces, Experts, the Writing hub)
    Experts.md
    Writing.md
    ...
  _templates/               # ignored by the build; for Obsidian's Templates core plugin
    piece.md
    theme.md
```

- The build reads every `*.md` under `notes/`. Notes in `notes/themes/` are themes; every other note is a piece. It skips `.obsidian/` and any file or folder starting with `_`.
- Subfolders are for Corey's organization only. They don't affect URLs or kinds.
- `.gitignore`: add `notes/.obsidian/`.

## Piece notes

```yaml
---
kind: essay                         # required. essay | explainer | tool | case study | venture | book | project | download | hub
status: published                   # required. published | planned | draft (same meanings as today)
themes: ["[[Places]]"]              # required unless kind is hub; wikilinks to theme notes
connects: ["[[Learning Spanish as an adult]]", "[[Writing]]"]   # optional; cross-theme links (today's mapEdges)
summary: Mallorca and Maryland sit on almost the same line around the globe. It took moving to notice.
date: 2026-10-17                    # required for published pieces with a page or url
weight: normal                      # optional. heavy | normal (default normal)
title: Same latitude, different ocean   # optional; defaults to the filename
label: Same latitude                # optional; shorter map label (today's MapNode.label)
slug: same-latitude-different-ocean # optional; defaults to slugified title
url: https://example.substack.com/p/...  # optional; the piece lives elsewhere (no page here)
site: https://telosbrothers.com     # optional; Entry.site
note: 6 min, with a chart you can drag.  # optional; margin note on lists
link-label: In progress.            # optional; MapNode.linkLabel
featured: false                     # optional
placeholder: true                   # optional; same meaning as today
---

Body (optional). If present and there's no `url`, it becomes a page on this site.
```

### What a note becomes

| Note has | Result |
|---|---|
| Body, no `url` | A hosted page plus its map node (today's curated `source: "here"` entry + `hosted.tsx` body + map node) |
| `url`, no body | A link-out entry plus map node |
| Neither (e.g. Experts, planned pieces) | Map node only |
| `kind: hub` with `url: /writing` | The Writing hub, as today |

- **Section** for a hosted page comes from `kind`: `essay` and `explainer` go to `/writing/{slug}`, and every other kind goes to `/work/{slug}`. Map `kind` to the existing `Entry.kind`: `essay`/`explainer` → `essay`; `venture` → `venture`; anything else → `project`. Confirm this with Corey before building.
- **IDs** are the slug. Keep today's ids for existing pieces (`telos-brothers`, `same-latitude-different-ocean`). Note that the map node `same-latitude` and the entry `same-latitude-different-ocean` merge into one id; update anything that referenced the old one.
- **One note is one entry and one node.** `entryId` goes away, because the node and the entry are now the same thing.

### Pieces published elsewhere (Substack, Medium, GitHub)

A note with a `url` and no body. Corey writes it by hand when he publishes:

```yaml
---
kind: essay
status: published
title: Some post
date: 2026-11-02
summary: One line.
url: https://example.substack.com/p/some-post
also-at: [https://medium.com/@corey/some-post]   # optional; the same piece cross-posted
themes: ["[[Expertise]]"]
---
```

- `source` is inferred from the `url` host: `substack.com` (and `*.substack.com`) → `substack`, `medium.com` → `medium`, `github.com` → `github`, `telosbrothers.com` → `telos`, any other host → `other`, and no `url` → `here`. `also-at` entries are inferred the same way. Drop `source` from the author-facing contract.
- The existing link labels ("Read it on Substack") keep working from the inferred source.

## Theme notes

`notes/themes/Places.md`:

```markdown
---
order: 8          # optional; position in the list version (today's enum order). Ties sort by name.
label: Places     # optional; defaults to the filename
---

- The 39th parallel north runs through the Chesapeake Bay Bridge and less than a mile north of Washington, D.C. [39th parallel north](https://en.wikipedia.org/wiki/39th_parallel_north)
- On the 39th parallel, the sun is up for 14 hours 54 minutes at the summer solstice and 9 hours 26 minutes at the winter solstice. [39th parallel north](https://en.wikipedia.org/wiki/39th_parallel_north)
```

- Each top-level list item is one fact. The **last link** in the item is the source (its text is `source`, its href is `url`), and the rest is `text`.
- A fact without an `https:` link fails the build.
- The theme id is the slugified filename (`Places.md` → `places`), so map node ids stay `theme-places`.
- The `Theme` zod enum becomes a string validated against the theme notes that exist. Adding a theme is adding a note.

## Links

- `themes` and `connects` hold wikilinks (`"[[Note name]]"`, quoted, which is how Obsidian writes link properties). Plain strings also work. They resolve by filename, case-insensitive, or by an `aliases` property.
- A link to a note that doesn't exist **fails the build** (today: "points at unknown node"). A link to a `planned` or `draft` note is dropped from the view, as planned edges are today.
- `connects` is one-directional in the note but undirected on the map. A link on either side is enough, and duplicates are removed.
- Every wikilink is an edge on the map, Obsidian-style, including links in the body (see "Home map"). `connects` is for links that don't belong in the prose.
- Wikilinks **in the body** render as internal links when the target is published and has a page here (or a `url`). Otherwise they render as plain text.

## Body format

Plain Markdown, rendered at build time to React using the existing components. **No raw HTML** (ignore or reject it) and no `dangerouslySetInnerHTML`. Use the smallest dependency set that does this. Likely `react-markdown` + `remark-gfm` + a small custom plugin, plus a YAML/frontmatter parser. Read `node_modules/next/dist/docs/` first, per `AGENTS.md`.

| Markdown | Renders as (must match today's markup in `posts/same-latitude-different-ocean.tsx`) |
|---|---|
| Paragraphs, `## h2`, links, emphasis | Same elements as today |
| Footnote `[^1]` + `[^1]: text` | `<NoteRef n={1} />` at the reference, `<Note n={1}>` placed **directly after the paragraph** that references it (not collected at the end) |
| `> [!quote]` callout | `<blockquote className={s.pull}>` (pull quote) |
| Plain `>` blockquote | Plain `<blockquote>` |
| ` ```graphic ` block | A registered component (see below) |
| `[[Wikilink]]` | See "Links" |
| `![[embed]]`, images | Fail the build with a clear message for now. Images are out of scope. |

### Interactive graphics

In the note:

````markdown
```graphic
daylight-chart
caption: Hours of daylight through the year. Solid line Palma, dashed Laurel. Drag to see how little they disagree.
caption-at: margin
```

```graphic
parallel-map
wide: true
caption: Not to scale. Drawn freehand, like most of my maps.
caption-at: below
```
````

- Line 1 is the graphic's name. The remaining lines are `key: value`.
- Reserved keys control the wrapper and reproduce today's markup exactly:
  - `wide: true` gives `figure` the `s.wide` class. A figure that today has extra classes (e.g. `s.map` on the parallel map) gets them from the registry entry.
  - `caption-at: below` produces a `<figcaption className={`${s.cap} ${s.capBelow}`}>`.
  - `caption-at: margin` (the default) produces an `<Aside className={s.cap}>` after the figure.
- All other keys are props, validated by the graphic's zod schema in the registry. Unknown keys or bad values fail the build.
- **Registry:** `src/content/graphics.ts` maps name → `{ component, props: zod schema, figureClass? }`. Start with `daylight-chart` (props: `compact?: boolean`) and `parallel-map` (no props).
- An unknown graphic name fails the build with the note's filename.
- **Adding a new graphic** means writing a component in `src/components/margins/` and adding one line to the registry. That's the only code step left, and it's once per graphic.
- In Obsidian the block shows as a labelled code block, which keeps the note readable.

## Getting notes to GitHub (no Obsidian Git plugin)

`notes/` lives inside the repo, so notes go up with the commits Corey already makes. No plugin is needed. Document these in `README.md`:

1. **Open `notes/` as its own vault.** Edit, then commit and push as usual (GitHub Desktop, VS Code, or the terminal). Cloudflare rebuilds on push.
2. **Or put it inside the main vault** with a Windows directory junction, so the notes show up next to everything else. Obsidian follows junctions. Don't nest the main vault inside the repo, or the repo inside the main vault.
   ```
   mklink /J "<main vault>\Site" "C:\Users\PC\Documents\Projects\personal-site\notes"
   ```
3. **Away from this PC:** github.com's web editor (press `.` on the repo for github.dev) edits Markdown and commits from a browser, for free.



## Remove the feed sync

Substack and Medium posts are notes now, so the import pipeline goes away entirely:

- Delete `scripts/sync/` (`main.ts`, `feed.ts`, `normalize.ts`, `sources.ts`, `check.ts`), `src/content/snapshot.json`, and `.github/workflows/sync.yml`. Keep `.github/dependabot.yml`.
- `package.json`: remove the `prebuild`, `sync`, and `check:feeds` scripts and the `fast-xml-parser` dependency. Also remove `zod` if nothing else uses it (it's likely still used to validate notes, so keep it then).
- `schema.ts`: remove `Snapshot` and `STALE_AFTER_DAYS`.
- `text.ts`: remove the cross-source dedupe (`dedupeAcrossSources`). A cross-posted piece is one note with `also-at`. Keep `slugify`.
- `lib/catalog.ts`: `load()` reads notes only. Drop the URL-override merge.
- `CLAUDE.md`: remove the feed parts of the architecture diagram, the "Sync guards" and "Feed content is untrusted" bullets, the sync commands, and the "It's updated rarely, so it has to stay current by itself" bullet's mention of the sync job (new articles now arrive as notes). Update the Layout list.
- `TODO.md`: close or remove any feed or sync tasks.

## Migration (from what exists)

1. **Themes:** create `notes/themes/{Label}.md` for each entry in `themeLabels`. Set `order` to the current enum order and move each theme's `themeFacts` into the list format. Keep every fact and source exactly.
2. **Published pieces** (merge each catalog entry with its map node into one note):
   - `Telos Brothers.md`: data from `curated` + `mapNodes`, body from `work/telos-brothers.tsx`, with its placeholder copy kept and marked.
   - `Same latitude, different ocean.md`: data from `curated` + the `same-latitude` node, body converted from `posts/same-latitude-different-ocean.tsx`. Footnotes become `[^n]`, the pull quote a `> [!quote]`, and the two figures `graphic` blocks.
   - `Experts.md`, `Second Lengua.md`, `Writing.md` (hub, `url: /writing`).
3. **The photo slot** ("Photo slot, harbor at golden hour") in the latitude post has no equivalent while images are out of scope. Drop it, and list it in `TODO.md` for Corey.
4. **Planned pieces:** one small note each in `notes/map/` with `status: planned`, no body, and the current summary, themes, kind, and weight. These double as Corey's to-write list in Obsidian.
5. **`mapEdges`:** move each pair into `connects` on the first node of the pair. Keep the inline comments as a line of body text in that note if useful.
6. **Templates:** `notes/_templates/piece.md` and `theme.md` with every property listed and commented.
7. **Remove** `curated` (and `catalog.ts` if empty), `map.ts`, `hosted.tsx`, and `posts/` and `work/` under `src/content/`. Remove the feed sync (see "Remove the feed sync"). The snapshot is empty today, so no feed posts need converting. Remove the `Theme` enum in favor of the dynamic check.
8. **Verify the migration is invisible** (do the content migration first, with the old map still in place, then rebuild the map). Run `npm run build` before and after, then diff `out/index.html`, `out/writing.html`, `out/work.html`, `out/writing/same-latitude-different-ocean.html`, and `out/work/telos-brothers.html`, ignoring hashed asset names. Differences should be limited to the dropped photo slot and the merged `same-latitude` id. Also diff a `NEXT_PUBLIC_MAP_PREVIEW=1` build of the home page, so planned nodes are checked too.
9. **Docs:** update `CLAUDE.md` (Architecture diagram, Layout, the `map.ts` bullet, Stack: add PixiJS and the Quartz credit), `docs/design/home-map.md` (the "Data", "Interaction" and "Implementation" sections, plus a dated revision note for the graph view and phase 2), `README.md` (author workflow), and `TODO.md`.

## Build checks (all fail the build, naming the file)

- Missing or invalid `kind` or `status`, or a bad `date`, `url`, or `site` (same refinements as `Entry`)
- Duplicate slug or id
- A `themes` or `connects` link to a note that doesn't exist
- A published non-hub piece with no themes, or a published hub with no links (as today)
- A theme fact without an `https:` source link
- An unknown graphic name, or graphic props that fail its schema
- Image embeds or raw HTML in a body

## Done when

- [ ] Adding a published note with a body creates its page and its map node, with no code edits.
- [ ] A note with a Substack or Medium `url` and no body lists the piece on `/writing` (linking out) and puts it on the map.
- [ ] The feed sync is fully removed (see "Remove the feed sync"), and `npm run build` no longer runs a feed check.
- [ ] Adding a theme note creates its dot on the map, and its facts are parsed and validated. Showing the facts waits for phase 2.
- [ ] Changing `status` to `planned` or `draft` hides the piece exactly as today.
- [ ] Adding `connects: ["[[X]]"]` draws the edge.
- [ ] A `graphic` block renders the registered component; a second post can reuse it with different props.
- [ ] The before/after diff (Migration step 8) shows no unintended changes on every page except the home map.
- [ ] The home map looks and behaves like Corey's Obsidian graph: dots, straight lines, plain background, pan, zoom, and drag (neighbors follow; labels may overlap). Hovering fades everything not connected and highlights the links. Clicking opens the note. It's checked in both themes and with reduced motion, the list is reachable by keyboard, and the old `MapField` code is gone.
- [ ] All build checks above fire on a deliberately broken note (try each once, then revert).
- [ ] `npm run lint` and `npm run build` pass.
- [ ] The docs listed in Migration step 9 are updated.
- [ ] Changes are staged with `git add` only. Don't commit or push.

## Open questions for Corey (ask before building)

1. The `kind` → section/`Entry.kind` mapping above: is it right?
2. Should `notes/` be its own vault, or a junction inside the main vault? This only affects the README instructions.
