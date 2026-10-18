# TODO

## The plan: a hub, not a blog (decided in the October 18, 2026 review)

The site is the central index of everything Corey makes, wherever it lives: Telos Brothers, written-up client work, Substack and Medium articles, and a few public repos. It shows who he is, what he can do, and where he's going. It's not a résumé and not a blog. It's updated rarely, so it has to stay current without hand edits, and nothing on it should go visibly stale.

Decisions:
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
- [ ] Answer the hour-1 questions: what Telos Brothers is and Corey's role in it; the Substack, Medium and GitHub URLs; which public repos to list; which inbox messages go to
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
- [ ] Fill in the feed URLs in `scripts/sync/sources.ts`, then run `npm run sync` once and commit `src/content/snapshot.json`
- [ ] Replace the Telos Brothers placeholders (`content/catalog.ts`, `content/work/telos-brothers.tsx`) and the About copy
- [ ] Delete `public/lab/` before the first deploy (it gets copied into the export and would be public)
- [ ] Cloudflare setup: build command `npm run build`, output `out`, Node 24; environment variables `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (build) and `TURNSTILE_SECRET_KEY`, `RESEND_API_KEY`, `CONTACT_TO`, `CONTACT_FROM` (Functions); verify a sending domain in Resend.
- [ ] Launch check: connect coreymacdonald.com, click through every route at 360px and desktop in both themes, send a test message, run the Sync feeds workflow by hand
- [ ] Check GitHub Actions billing and budget settings before turning on the schedule. Private repos get 2,000 free minutes a month, and the sync uses about 240.

## Home map (docs/design/home-map.md)

Decided October 18, 2026: the work sells itself (no pitch copy; the Telos panel links out); the letter is dropped; planned nodes stay hidden; the map shows with any number of real nodes; nodes drift very slowly. Revised the same day: themes are nodes, Obsidian-style, instead of fixed regions (see the doc's "Revision" section).

Done:
- [x] Map data in `src/content/map.ts`: 20 pieces, each with its themes, plus 9 direct links that cross themes. `mapData()` in `src/lib/catalog.ts` adds a node for each theme in use and the threads to it. The build fails on a broken link, a duplicate id, an unknown `entryId`, a published piece with no themes, or a hub with no links (all checked).
- [x] `HomeMap.tsx`: the list version (server render, phones, no JS), grouped by theme, and the field (d3-force, hover and focus dimming, drag with neighbors following, background pan, click to open, walking panel to panel, Esc, click outside, Tab into the panel, reduced motion holds still)
- [x] Home page: one line, the map, latest writing. The letter and its live clocks are gone (`LiveTime` deleted).
- [x] Newest five feed essays attach to the Writing hub automatically.
- [x] Checked in a browser: both themes, 360px (list, no horizontal scroll), the switch at 720px, the interactions above; no label overlaps with 9 nodes (today) or 28 (preview). Preview builds (`NEXT_PUBLIC_MAP_PREVIEW=1`) show all pieces; never set it on Cloudflare.

Deviations from the doc, and why:
- Themes replace regions (Corey's call; see the doc's revision).
- The map is laid out before the first paint instead of settling visibly over 1.2 s; a visible settle left 28 nodes tangled.
- Dimmed nodes turn `--pencil` instead of fading to 25%, so their text keeps AA contrast. Threads still fade.
- Forces were retuned for themes and long labels: rectangle collision (not circles), repulsion -320 with a 520px reach, a light pull to the middle, links of 110px (to a theme) and 170px (between pieces). The field's height grows with the number of nodes (480 to 760px).
- The pen loop marks the open node only when its label is 28 characters or shorter.

Waiting on Corey:
- [ ] The line above the map (placeholder in `src/app/page.tsx`)
- [ ] Check the theme names and which themes each piece touches in `map.ts` (a first pass from the doc's regions and connection notes), and rewrite every summary (all placeholders), plus Second Lengua's URL
- [ ] Pick which planned pieces to write first. Today the map has 5 pieces in 4 small webs, plus feed essays once the feeds are configured.
- [ ] Look at a preview build and say whether the drift and the pen loop on the open node stay or go (`DRIFT` in `HomeMap.tsx`; the loop is in `FieldNode`)

Not done (nice-to-have in the doc):
- [ ] Arrow keys to move focus to the nearest connected node in that direction

## Deferred
- [ ] **Tests** (P2, M). Deferred as too much for now. When added, start with the sync guards: saved feed samples for Substack and Medium, an HTML error page returned with 200, an empty feed, a feed that shrinks, script in titles, `javascript:` links, dedupe, and the partial-failure exit code. Then the catalog gates (drafts, duplicate slugs, staleness), the contact function, and a smoke check per route.
- [ ] **Analytics** (P3, S): Cloudflare Web Analytics. Free, cookieless, no consent banner.
- [ ] **RSS out** (P2, S): one `/feed.xml` built from the catalog that merges every source.
- [ ] **Share images** (P2, M): an Open Graph image per page in the Margins style, made by a build script (dynamic image routes don't work in a static export).
- [ ] **Hosted interactive pieces** (P3, M): MDX only for essays that need charts or sidenotes Substack can't do. Post components: sidenote, figure with caption, full-bleed image, pull quote, chart wrapper.
- [ ] Content Security Policy through `_headers`, with a hash for the inline theme script

## Vision (small touches, later)
- [ ] Reading time from the feed's word count, in the Writing margin ("On Substack. 7 min.")
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
