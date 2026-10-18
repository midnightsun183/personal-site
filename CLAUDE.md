# coreymacdonald.com

Corey MacDonald's personal site: the central place for everything he makes, wherever it lives. That covers Telos Brothers, written-up client work, articles on Substack and Medium, and a few public repos. It shows who he is, what he can do, and where he's going.

@AGENTS.md

## What this site is (and isn't)

- **It's a hub, not a blog and not a résumé.** It indexes Corey's work with his own framing and links out to where each piece lives. Articles stay on Substack and Medium. Only pieces that need what those platforms can't do (interactive charts, sidenotes) are hosted here.
- **It shows capability without selling.** Work is shown as real projects with context (the problem, what he built, what came of it), not as a services page. No pricing, no "hire me" pitch.
- **It's updated rarely, so it has to stay current by itself.** New articles arrive through the sync job, not hand edits. Don't add anything that advertises when the site was last touched: no Now page, no jottings, no "updated on" stamps, no "currently" copy that will rot. "Where I'm going" is written to stay true for a year.
- **Life and places sit alongside the work.** It's personal in tone, not corporate.
- **The audience is US English (en-US) only.** It isn't bilingual.

## Copy rules

- No "Corey is X who does Y" lines, taglines, role lists, or "at the intersection of" phrasing.
- No CTA-speak ("See my work", "Let's connect"). Links say what they do: "Write to me", "Send message", "Read it on Substack".
- First person, plain verbs, sentence case. Write the way Corey talks, not the way a résumé reads.
- Don't invent biographical facts. Known background: US Navy nuclear, then finance (Ariel Investments, PGIM Fixed Income, Assette), lived in Mallorca, taught at a bilingual school, now consulting and living in Maryland. He's involved with Telos Brothers (telosbrothers.com), but what it is and his role aren't confirmed yet, so don't describe them. If a detail isn't confirmed, mark it as placeholder and ask.
- **Client confidentiality:** no client names, figures or identifying details in Work write-ups without Corey's written permission. Unreviewed write-ups stay `status: "draft"`, and drafts never build.
- Hosted pieces should be more interesting than a wall of text. Use margin or sidenotes, figures, interactive charts, pull quotes and full-width images where they earn it.

## Design rules

- Direction: A, "Margins" (see `public/lab/a2*.html`). Four lanes on wide screens: gutter (dates), text, notes, and wide. Italic is the margin's voice (notes, captions); headings and body stay upright.
- Avoid AI slop and template defaults: the cream-plus-terracotta serif look, a black page with one acid-green accent, the SaaS card grid, tracked ALL-CAPS eyebrow labels, `A · B · C` meta strings, a `→` on every link, decorative 01/02/03 numbering, fade-up on every section.
- Aim for distinctive and personal, but calm and readable. No palettes that are loud just to be different.
- Spend boldness in one place per page, and keep the rest quiet.
- The hand-drawn marks (highlighter, scribble circle, pen arrow) are a deliberate choice. Keep them, even if a design checklist flags sketchy SVG.
- Light/dark follows the system, with a toggle in the footer.
- Required quality floor: real light and dark themes, WCAG AA contrast, visible keyboard focus, `prefers-reduced-motion` respected, works at 360px wide with no horizontal scroll, readable line lengths (under ~75 characters).

## Working with Corey

- Ask questions before diving into anything big, but keep it to the few that change the outcome.
- He's direct and output-oriented. Prefer concise, structured answers and working results over theory.
- Keep engineering in proportion to a simple personal site. He turned down a full test suite as "too much for a simple site" (it's deferred in `TODO.md`). Prefer the smallest thing that's robust.
- Only stage changes with `git add`. Never commit or push; Corey does that himself.
- Nothing is in production yet, so breaking changes are fine.

## Architecture

The full plan and its reasoning are in `TODO.md` ("The plan: a hub, not a blog").

```
  Substack RSS ──┐                                          ┌──▶ /            one line, the map of everything, latest writing
  Medium RSS   ──┴─▶ sync job ──▶ content/snapshot.json ─┐  ├──▶ /work        ventures and projects, with case studies
               (GitHub Action,     (committed; only       ├──▶ catalog ──┼──▶ /writing     every article, any source
                every 6 hours)      changed data)         │  (query     ├──▶ /about       story plus where I'm going
  content/catalog.ts (hand-written: work, framing, ──────┘   functions) └──▶ /contact     form ──▶ Pages Function ──▶ mail API
                      featured picks, public repos)
```

- **Pages read only from the catalog's query functions** (`writing`, `work`, `featuredWork`, `bySlug`, `mapData`), never from a source or snapshot directly. A new source means a new adapter, not page changes.
- **The site never fetches at runtime.** External content arrives only through the committed snapshot.
- **Sync guards are required:** retry, then keep last good data. Refuse to write when a feed returns 0 items or shrinks by more than 50%. Store summaries as plain text (strip HTML) and accept `https:` links only. When one source fails, commit the others and exit red. The build fails if any source's `fetchedAt` is more than 14 days old.
- **Feed content is untrusted.** Never render it with `dangerouslySetInnerHTML`.
- **Contact:** a Cloudflare Pages Function checks the honeypot and Turnstile, then sends through a mail API. Store nothing, and never log message bodies.

## Stack

- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 (via the `@tailwindcss/turbopack` loader in `next.config.ts`). One CSS module (`margins.module.css`) carries the layout.
- **Target: a static export on Cloudflare's free plan** (`output: "export"`, no adapter). That rules out server actions, `next/image` optimization (use `images.unoptimized`), redirects and headers in `next.config` (use `_redirects` and `_headers`), and dynamic params outside `generateStaticParams`.
- `cacheComponents` and `partialPrefetching` are off: they do nothing for plain files and block `dynamicParams = false`.
- **Read `node_modules/next/dist/docs/` before writing Next code.** This version differs from older training data (see AGENTS.md).
- Commands: `npm run dev`, `npm run build` (runs the feed check first, via `prebuild`), `npm run lint`, `npm run sync` (pull feeds into the snapshot), `npm run check:feeds`.
- Scripts in `scripts/` are TypeScript run directly by Node 24 (type stripping), so they can't use TS-only syntax such as enums or constructor parameter properties. Anything they share with `src/` (`content/schema.ts`, `content/text.ts`, `lib/contact.ts`) uses relative imports with `.ts` extensions, never `@/`.

## Layout

- `src/app/`: routes. The root layout renders the header and footer around every page, and each page's elements sit directly in `main`'s grid. `globals.css` holds the palette tokens and light/dark themes.
- `src/components/margins/`: the site's components and its CSS module. The nav items live in `nav.ts`.
- `src/content/`: `schema.ts` (zod, shared with the sync), `catalog.ts` (hand-written entries), `snapshot.json` (written by the sync only; don't hand-edit), `hosted.tsx` (bodies for pages hosted here, in `posts/` and `work/`), `text.ts` (slugify, cross-source dedupe).
- `src/content/map.ts`: the home page map, Obsidian-style: each piece lists its themes, themes become nodes, and direct links are only for connections that cross themes (high-level only: no figures, client names, the school's name, or the forecasting system). `src/components/margins/HomeMap.tsx` renders it; the design is `docs/design/home-map.md`. Build with `NEXT_PUBLIC_MAP_PREVIEW=1` to see planned nodes; never set it in production.
- `src/lib/catalog.ts`: the query functions every page uses. `src/lib/contact.ts`: form rules shared by the form and the Function. `src/lib/dates.ts`: date labels.
- `scripts/sync/`: the feed sync (`main.ts`), the staleness check (`check.ts`), the feed list (`sources.ts`).
- `functions/api/contact.ts`: the Cloudflare Pages Function behind the form.
- `.github/workflows/sync.yml`: scheduled sync and weekly check. `.github/dependabot.yml`: monthly update PRs.
- `src/lib/daylight.ts`: pure helpers for the daylight chart.
- `TODO.md`: the plan and the running task list. Keep it updated as work lands.
- **Due for deletion before launch:** `public/lab/` (the design mockups). It gets copied into the export, so it would be public.

## Gotchas

- `next.config.ts`: the Tailwind loader rule skips `*.module.css`. Without that, CSS Modules compile as global CSS and their class maps come back empty.
- `node_modules` is installed from Windows, so build locally from Windows (`npm run build` in PowerShell). Under WSL, `next build` fails on the missing Linux `lightningcss` binary. CI builds on Linux after a fresh `npm ci`, so this doesn't affect deploys.
- **Next 16 static export on Windows writes prefetch files to the wrong paths** (`about/__next.about/__PAGE__.txt` instead of `about/__next.about.__PAGE__.txt`), because `path.relative` returns backslashes. Locally that only shows as 404s on prefetch; pages still work. Cloudflare builds on Linux, where the names come out right.
- To preview the export locally, serve `out/` so `/about` maps to `about.html` (Cloudflare does this). A plain static server shows a folder listing instead, because `out/about/` also exists.
- Without `NEXT_PUBLIC_TURNSTILE_SITE_KEY` at build time, the form says sending is off. The Function only exists on Cloudflare, so locally the form can't send.
- Theme: an inline script in the root layout applies the saved theme before first paint, and `ThemeToggle` re-applies it after React's dev remount. Its label comes from CSS (`.to-dark` / `.to-light`), so it's right before hydration.
