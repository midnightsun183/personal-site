# TODO

## The plan: a hub, not a blog (decided in the October 18, 2026 review)

The site is the central index of everything Corey makes, wherever it lives: Telos Brothers, written-up client work, Substack and Medium articles, and a few public repos. It shows who he is, what he can do, and where he's going. It's not a résumé and not a blog. It's updated rarely, so it has to stay current without hand edits, and nothing on it should go visibly stale.

Decisions (the ingestion, sync and staleness items were replaced on October 18, 2026 by notes; see "Notes pipeline" below):
- **Hub that links out.** Articles stay on Substack and Medium. Only interactive pieces Substack can't do are hosted here.
- **Nav:** Work · Writing · About · Write to me. Drop jottings and Now (both need frequent updates). "Where I'm going" is an evergreen direction statement on About and Home.
- **One catalog.** Every page reads entries from `content/` through query functions (`latest`, `byKind`, `featured`, `bySlug`), never from a source directly. Entry fields: id, kind, title, summary, date, updated, source, url, topics, featured, status (`draft | published`), framing.
- **Ingestion: a saved snapshot.** A scheduled GitHub Action (every 6 hours, plus a manual run button) fetches the Substack and Medium RSS feeds, validates them, and commits a JSON snapshot. It commits only when the data changed. The site never fetches at runtime.
- **Sync guards (required even without tests):** retry 2x, then keep last good data. Refuse to write when a feed returns 0 items or shrinks by more than 50%. Strip HTML to plain text and accept `https:` links only. Dedupe Substack and Medium copies. Use a concurrency group so runs never overlap.
- **Partial failure:** commit the sources that worked, keep last good data for the ones that failed, then exit red so GitHub emails the failure.
- **Staleness gate:** the snapshot records `fetchedAt` for each source. The build and a weekly check fail if any source is more than 14 days old. (GitHub disables schedules on repos with no activity for 60 days, and this catches it.)
- **GitHub repos:** added by hand in the curated catalog. Most code is private, so there's no GitHub API and no Code section.
- **Hosting:** Cloudflare free plan, static (`output: "export"`). No adapter. Use `images.unoptimized`, `dynamicParams = false`, and `_headers` / `_redirects` files.
- **Contact:** a Cloudflare Pages Function (`functions/api/contact.ts`) checks the honeypot and Turnstile, then sends through a mail API. Store nothing, and never log message bodies. If Turnstile is blocked, show an explanation only, with no fallback email.
- **Client confidentiality:** no client names, figures or identifying details in Work write-ups without written permission. Unreviewed entries stay `draft`, and drafts never build.

## v1: build the hub
- [ ] Answer the hour-1 questions: what Telos Brothers is and Corey's role in it; which public repos to list; which inbox messages go to
- [x] Rewrite `CLAUDE.md` for the hub premise
- [x] Catalog: zod schema (`content/schema.ts`), curated `content/catalog.ts`, `content/snapshot.json`, queries in `lib/catalog.ts`, cross-source dedupe
- [x] Sync: `scripts/sync/` (one RSS parser covers both feeds), all guards, a 3-day heartbeat, and a job summary. Checked against real Substack and Medium feeds and simulated failures.
- [x] GitHub Action (`.github/workflows/sync.yml`): 6-hour schedule plus a manual run, a concurrency group, `contents: write` only, actions pinned to SHAs, a weekly staleness check, and Dependabot
- [x] `/work` index and `/work/[slug]` case study pages (Telos is a placeholder until the hour-1 answers)
- [x] `/writing`: every article from the catalog, with the source in the margin and "also on Medium" for cross-posts; links open in the same tab (the gutter shows month and year; no separate year headings)
- [x] `/about`: the story plus a "Where I'm going" section (placeholder copy); Now card removed
- [x] `/contact`: form posts to the Pages Function (`functions/api/contact.ts`) with Turnstile, expired-token retry, the blocked-script message after 10 seconds, length caps and a counter. All server paths checked with a stubbed fetch.
- [x] Home: the letter, what I'm building, latest writing (dateline and photos removed)
- [x] `PageTitle` component
- [x] Static export: `output: "export"`. `cacheComponents` and `partialPrefetching` are off (they block `dynamicParams = false`).
- [x] Deleted: `jottings/`, `DayLength`, the Now card, `actions.ts`, `content/writing.ts`, `PostList`
- [ ] Add a note in `notes/writing/` for each existing Substack and Medium post (`url`, no body), from `notes/_templates/piece.md`
- [ ] Replace the Telos Brothers placeholders (`notes/work/Telos Brothers.md`) and the About copy
- [ ] Delete `public/lab/` before the first deploy (it gets copied into the export and would be public)
- [ ] Cloudflare setup: build command `npm run build`, output `out`, Node 24; environment variables `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (build) and `TURNSTILE_SECRET_KEY`, `RESEND_API_KEY`, `CONTACT_TO`, `CONTACT_FROM` (Functions); verify a sending domain in Resend.
- [ ] Launch check: connect coreymacdonald.com, click through every route at 360px and desktop in both themes, send a test message

## Home map (docs/design/home-map.md)

Decided October 18, 2026: the work sells itself (no pitch copy; the Telos panel links out); the letter is dropped; planned nodes stay hidden; the map shows with any number of real nodes; nodes drift very slowly. Revised the same day: themes are nodes, Obsidian-style, instead of fixed regions (see the doc's "Revision" section).

Done:
- [x] Map data in `src/content/map.ts`: 20 pieces, each with its themes, plus 9 direct links that cross themes. `mapData()` in `src/lib/catalog.ts` adds a node for each theme in use and the threads to it. The build fails on a broken link, a duplicate id, an unknown `entryId`, a published piece with no themes, or a hub with no links (all checked).
- [x] `HomeMap.tsx`: the list version (server render, phones, no JS), grouped by theme, and the field (d3-force, hover and focus dimming, drag with neighbors following, background pan, click to open, walking panel to panel, Esc, click outside, Tab into the panel, reduced motion holds still)
- [x] Home page: one line, the map, latest writing. The letter and its live clocks are gone (`LiveTime` deleted).
- [x] Hover or focus a piece: pen loop plus card; click goes to it (real links: new tab with Cmd, Ctrl or middle click); touch taps preview first. Click a theme: a cited "Did you know?" fact from Wikipedia, cycling on each click. Esc and Close don't reopen the card.
- [x] ~~Newest five feed essays attach to the Writing hub automatically.~~ Removed with the feed sync; posts are notes now.
- [x] Checked in a browser: both themes, 360px (list, no horizontal scroll), the switch at 720px, the interactions above; no label overlaps with 9 nodes (today) or 28 (preview). Preview builds (`NEXT_PUBLIC_MAP_PREVIEW=1`) show all pieces; never set it on Cloudflare.

Deviations from the doc, and why:
- Themes replace regions (Corey's call; see the doc's revision).
- The map is laid out before the first paint instead of settling visibly over 1.2 s; a visible settle left 28 nodes tangled.
- Dimmed nodes turn `--pencil` instead of fading to 25%, so their text keeps AA contrast. Threads still fade.
- Forces were retuned for themes and long labels: rectangle collision (not circles), repulsion -320 with a 520px reach, a light pull to the middle, links of 110px (to a theme) and 170px (between pieces). The field's height grows with the number of nodes (480 to 760px).
- The pen loop is drawn around the whole node, so it fits labels of any length.

Waiting on Corey:
- [ ] The line above the map (placeholder in `src/app/page.tsx`)
- [ ] Check the theme names and which themes each piece touches (the notes in `notes/`, a first pass from the doc's regions and connection notes), and rewrite every summary (all placeholders), plus Second Lengua's URL
- [ ] Pick which planned pieces to write first (`notes/map/`, `status: planned`). Today the map has 5 pieces in 4 small webs.
- [x] ~~Look at a preview build and say whether the drift stays~~ PR2 removed the drift: the graph settles and stops.
- [ ] Look at the graph next to your Obsidian screenshots (`npm run dev`, or a preview build) and say what to tune: the force constants are named at the top of `MapGraph.tsx`, dot sizes and label fade in `graph.ts`
- [ ] Read the theme facts in `notes/themes/` (two or three per theme, each cited) and swap any that don't fit

Not done (nice-to-have in the doc):
- [ ] Arrow keys to move focus to the nearest connected node in that direction (now part of "Keyboard walking of the graph" below)

## Notes pipeline (docs/design/obsidian-content-pipeline-spec.md)

Eng review on October 18, 2026: split into PR1 (notes plus removing the feed sync) and PR2 (the graph view). Decisions are at the top of the spec.

PR1, built October 18, 2026:
- [x] `notes/`: 8 theme notes (facts moved from `themeFacts` unchanged), 5 published pieces, 15 planned pieces, `_templates/`, `_README.md` (the confidentiality rules)
- [x] `src/lib/notes.ts` (load, check, resolve, prepare bodies), one `PieceFrontmatter` schema, `NoteBody` renderer, `src/content/graphics.ts` (daylight-chart, parallel-map)
- [x] Catalog reads notes only; drafts and planned notes show, marked, in `npm run dev`; memoized in production only
- [x] Feed sync removed: `scripts/sync/`, `snapshot.json`, `sync.yml`, `fast-xml-parser`, cross-source dedupe, the staleness check
- [x] Vitest: 76 tests against a sample vault (every build check has a broken-note case); `prebuild` runs them
- [x] Before/after export diff: only the merged `same-latitude` id, the dropped photo slot, and (preview only) alphabetical order within a theme
- [x] Fixed on the way: `href` accepted protocol-relative `//host` links; now refused
- [ ] **Photo slot** dropped from "Same latitude, different ocean" ("harbor at golden hour", caption in the margin) until notes support images
- [ ] Open question from the spec: `notes/` as its own vault, or a junction inside the main vault? Only changes which README option you use; both are documented.

- [x] **PR2: the graph view**, built October 19, 2026 from `docs/design/home-graph-plan.md` (decisions at the top):
  - Pixi graph in `MapGraph.tsx` (adapted from Quartz, MIT credit in the header), pure rules in `graph.ts`, map shaping moved to a pure `src/lib/mapView.ts`
  - Body wikilinks are map edges (footnotes included), deduped with `themes` and `connects`; nodes carry `degree`
  - Hover highlight, card after 1.5 s (theme facts kept), click to open, drag, pan, zoom, two-tap on touch, Esc
  - "View as a list" swap for keyboard and screen-reader users; list fallback when WebGL fails; graph space held while Pixi loads, with a 4 s safety net in the inline script
  - `MapField`, drift, rectangle collision, the pen loop on nodes, `--z-map-node` and the field CSS removed
  - Tests: 117 (was 76): `graph.test.ts`, `mapData.test.ts`, `MapList.test.tsx`, plus body-link cases in `notes.test.ts`
  - Checked on the export: both themes, hover and card, Esc, click (client navigation), drag, wheel zoom, list swap and back, WebGL off, reduced motion, the loading state, 360 px, and the preview build (28 nodes)
- [ ] **Wheel over the graph zooms instead of scrolling the page** (P3, S). Same as Obsidian and Quartz, and what the spec asks for, but on a full-width home-page map a reader scrolling past can get caught. If it bothers you: zoom only with Ctrl/Cmd + wheel (d3-zoom `filter`) and show a hint on plain wheel.
- [ ] **Labels overlap in dense spots** (P3, S). Every dot is labeled (decision 4C), and in the preview build a few long labels touch ("Learning Spanish as an adult" and "Obsidian vault skills"). The spec allows overlap; if it reads badly, raise `COLLIDE_PAD` or `LINK_DISTANCE` in `MapGraph.tsx`.
- [ ] **Keyboard walking of the graph** (P3, M). PR2 makes the canvas `aria-hidden` and gives keyboard users a "View as a list" swap, a step back from the old map, which Tab could walk. Add invisible focusable buttons that sit over each dot and follow drag and zoom, so Tab and arrow keys move through the graph and focus opens the card. Feed focus into the same pure hover and card rules in `graph.ts`. Covers the arrow-key item under Home map. Depends on PR2.
- [ ] **Redirects for renamed slugs** (P3, S). An optional `old-slugs: [...]` note property that writes `public/_redirects` lines (301 from each old path to the current one) at build, and fails if an old slug matches a live one. `slug` is required on published pages, so accidental URL changes already fail; this covers deliberate renames. Cloudflare Pages reads `_redirects` from the output root, and static export copies `public/` into `out/`. Build it the first time a slug actually changes.

## Deferred
- [ ] **More tests** (P2, M). The notes pipeline and (after PR2) `mapData()` and the map's interaction rules have Vitest coverage. Still untested: the contact function, and a browser smoke check. For the smoke check, a Playwright script against `out/` (served with the .html fallback, like `scratchpad/serve.py`): every route loads; on the home page the canvas draws on a wide screen, the list shows at 360 px, the list/graph swap works, the list returns with WebGL off, and the reserved space never stays blank; both themes. Vitest can't see Pixi, the reserved-space CSS or the fallback, so a regression there would leave a blank map. Costs Playwright and a browser download in dev setup.
- [ ] **Analytics** (P3, S): Cloudflare Web Analytics. Free, cookieless, no consent banner.
- [ ] **RSS out** (P2, S): one `/feed.xml` built from the catalog that merges every source.
- [ ] **Share images** (P2, M): an Open Graph image per page in the Margins style, made by a build script (dynamic image routes don't work in a static export).
- [ ] **Hosted interactive pieces** (P3, M): MDX only for essays that need charts or sidenotes Substack can't do. Post components: sidenote, figure with caption, full-bleed image, pull quote, chart wrapper.
- [ ] Content Security Policy through `_headers`, with a hash for the inline theme script

## Vision (small touches, later)
- [ ] Reading time in the Writing margin ("On Substack. 7 min."), from a note property or the body's word count
- [ ] A print stylesheet so a Work page prints as a clean one-page brief
- [ ] A 404 in Corey's voice, with the three latest pieces and links to Work and Writing
- [ ] Honest status on Work items, in the margin ("Active since 2025", "Wound down in 2024")
- [ ] An "Elsewhere" footer line (Substack, Medium, GitHub, Telos Brothers) with `rel="me"`

## Content
- [ ] Real copy for the home letter and About (no "Corey is X that does Y")
- [ ] Work write-ups: Telos Brothers first, then cleared client projects
- [ ] Photos: Mallorca, Maryland, other personal ones
- [ ] Decide whether LinkedIn belongs anywhere on the site

## Ship
- [ ] Metadata, sitemap, robots
- [ ] Accessibility pass: contrast, keyboard, screen reader, reduced motion
- [ ] Performance pass: font subsetting, image sizes, Lighthouse
- [ ] Replace `favicon.ico`, update `README.md`, delete `public/lab/`

## Done
- [x] Design direction A, "Margins": letter-like page, sidenotes, one serif, hand-drawn marks kept
- [x] Light/dark follows the system, with a toggle in the footer (saved in localStorage; picking the system's theme clears it)
- [x] Design tokens in `globals.css`; Literata via `next/font`
- [x] Shared header (skip link, nav with the current page marked) and footer (nav, colophon, theme toggle)
- [x] Routes: `/`, `/writing`, `/writing/[slug]`, `/jottings`, `/about`, `/contact` (jottings and the Now card are due for removal in v1)
- [x] All fixes from the A second-pass review (input contrast, sidenote markers, italics, duplicate latest post, inline errors)
- [x] Contact form UI with blur validation and a honeypot
- [x] Deleted the starter components, the empty `writing/layout.tsx`, and the boilerplate SVGs
