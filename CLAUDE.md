# coreymacdonald.com

Corey MacDonald's personal site: the central place for everything he makes, wherever it lives. That covers Telos Brothers, written-up client work, articles on Substack and Medium, and a few public repos. It shows who he is, what he can do, and where he's going.

@AGENTS.md

## What this site is (and isn't)

- **It's a hub, not a blog and not a résumé.** It indexes Corey's work with his own framing and links out to where each piece lives. Articles stay on Substack and Medium. Only pieces that need what those platforms can't do (interactive charts, sidenotes) are hosted here.
- **It shows capability without selling.** Work is shown as real projects with context (the problem, what he built, what came of it), not as a services page. No pricing, no "hire me" pitch.
- **It's updated rarely, so nothing on it should go visibly stale.** New articles arrive as notes (one Markdown file per piece in `notes/`), not code edits. Don't add anything that advertises when the site was last touched: no Now page, no jottings, no "updated on" stamps, no "currently" copy that will rot. "Where I'm going" is written to stay true for a year.
- **Life and places sit alongside the work.** It's personal in tone, not corporate.
- **The audience is US English (en-US) only.** It isn't bilingual.

## Copy rules

- No "Corey is X who does Y" lines, taglines, role lists, or "at the intersection of" phrasing.
- No CTA-speak ("See my work", "Let's connect"). Links say what they do: "Write to me", "Send message", "Read it on Substack".
- First person, plain verbs, sentence case. Write the way Corey talks, not the way a résumé reads.
- Don't invent biographical facts. Known background: US Navy nuclear, then finance (Ariel Investments, PGIM Fixed Income, Assette), lived in Mallorca, taught at a bilingual school, now consulting and living in Maryland. He's involved with Telos Brothers (telosbrothers.com), but what it is and his role aren't confirmed yet, so don't describe them. If a detail isn't confirmed, mark it as placeholder and ask.
- **Client confidentiality:** no client names, figures or identifying details in Work write-ups without Corey's written permission. Unreviewed write-ups stay `status: draft`, and drafts never build (they show, marked, only in `npm run dev`).
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
- Keep engineering in proportion to a simple personal site. Prefer the smallest thing that's robust. The notes pipeline has Vitest tests (he chose them in the October 18, 2026 eng review); a broader suite is still deferred in `TODO.md`.
- Only stage changes with `git add`. Never commit or push; Corey does that himself.
- Nothing is in production yet, so breaking changes are fine.

## Architecture

The full plan and its reasoning are in `TODO.md` ("The plan: a hub, not a blog").

```
  notes/  (Obsidian vault: one .md per piece,                    ┌──▶ /            one line, the map of everything, latest writing
           one per theme in notes/themes/)                       ├──▶ /work        ventures and projects, with case studies
      │                                                          ├──▶ /writing     every article, any source
      ▼                                                          ├──▶ /about       story plus where I'm going
  lib/notes.ts ──▶ lib/catalog.ts (query functions) ─────────────┤
  (parse, check,     server-only, memoized in production         └──▶ /contact     form ──▶ Pages Function ──▶ mail API
   fail the build)
```

- **Pages read only from the catalog's query functions** (`writing`, `work`, `featuredWork`, `bySlug`, `hosted`, `pageBody`, `hrefFor`, `mapData`), never from notes directly. Client components import types from `lib/catalog.ts` and link helpers from `lib/sources.ts`, never catalog values (it reads the disk and is `server-only`).
- **Notes are the only content source.** A body with no `url` is a page here; a `url` with no body is a link out (Substack, Medium, GitHub); neither is a map-only piece. The format is `docs/design/obsidian-content-pipeline-spec.md` (decisions at the top). A bad note fails the build with its path, so the last deploy stays live.
- **Bodies render through `NoteBody`** from a checked allowlist of Markdown. No raw HTML, no images yet, no `dangerouslySetInnerHTML`. Interactive graphics are ```` ```graphic ```` blocks registered in `src/content/graphics.ts` (one line per graphic).
- **The site never fetches at runtime.**
- **Contact:** a Cloudflare Pages Function checks the honeypot and Turnstile, then sends through a mail API. Store nothing, and never log message bodies.

## Stack

- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 (via the `@tailwindcss/turbopack` loader in `next.config.ts`). One CSS module (`margins.module.css`) carries the layout.
- **Target: a static export on Cloudflare's free plan** (`output: "export"`, no adapter). That rules out server actions, `next/image` optimization (use `images.unoptimized`), redirects and headers in `next.config` (use `_redirects` and `_headers`), and dynamic params outside `generateStaticParams`.
- `cacheComponents` and `partialPrefetching` are off: they do nothing for plain files and block `dynamicParams = false`.
- **Read `node_modules/next/dist/docs/` before writing Next code.** This version differs from older training data (see AGENTS.md).
- Notes: `unified` + `remark-parse` + `remark-gfm` (parsing only; rendering is our own `NoteBody`), `yaml` (1.2 core schema, so dates stay strings), zod for frontmatter.
- Commands: `npm run dev`, `npm run build` (runs the tests first, via `prebuild`), `npm test` (Vitest), `npm run lint`. Don't set `NODE_ENV=production` in Cloudflare's build settings, or devDependencies (Vitest) won't install and every build fails.

## Layout

- `src/app/`: routes. The root layout renders the header and footer around every page, and each page's elements sit directly in `main`'s grid. `globals.css` holds the palette tokens and light/dark themes.
- `src/components/margins/`: the site's components and its CSS module. The nav items live in `nav.ts`.
- `notes/`: all content, opened as an Obsidian vault. `themes/` holds one note per theme (its body is a list of cited "Did you know?" facts); every other note is a piece, and subfolders are only for organizing. `_templates/` and `_README.md` (the confidentiality rules) are skipped by the build, as is anything starting with `_` or `.`. High-level only: no figures, client names, the school's name, or the forecasting system.
- `src/content/`: `schema.ts` (zod frontmatter schemas and the `Entry` type), `graphics.ts` (the graphic registry), `text.ts` (slugify).
- `src/lib/notes.ts`: reads and checks the vault. `src/lib/catalog.ts`: the query functions every page uses. `src/lib/sources.ts`: link helpers safe for client components. `src/lib/contact.ts`: form rules shared by the form and the Function. `src/lib/dates.ts`: date labels.
- The home map: `src/components/margins/HomeMap.tsx` renders `mapData()`; the design is `docs/design/home-map.md`. Build with `NEXT_PUBLIC_MAP_PREVIEW=1` to see planned nodes; never set it in production.
- `test/`: Vitest. `fixtures/notes/` is a sample vault with one note per branch; broken notes are written inline in `notes.test.ts`.
- `functions/api/contact.ts`: the Cloudflare Pages Function behind the form.
- `.github/dependabot.yml`: monthly update PRs.
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
