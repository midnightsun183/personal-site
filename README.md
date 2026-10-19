# coreymacdonald.com

Corey MacDonald's personal site. Next.js 16, built as a static export and served from Cloudflare's free plan.
How it's built and why: `CLAUDE.md` and `TODO.md`.

## Writing for the site

All content lives in `notes/`, one Markdown file per piece and one per theme. There's no code to edit to add a piece,
theme, fact or link. The format is in `docs/design/obsidian-content-pipeline-spec.md` (the decisions at the top win),
and `notes/_templates/` has a template for each kind of note with every property explained.

- **A page here:** a note with a body and no `url`. Set `slug` before publishing; it's the URL and shouldn't change.
- **A link out** (Substack, Medium, GitHub): a note with a `url` and no body.
- **A map-only piece:** neither. Planned pieces live in `notes/map/` with `status: planned`.
- **A theme:** a note in `notes/themes/` whose body lists "Did you know?" facts, each ending in its source link.

`status: draft` keeps a note off the live site, but `npm run dev` shows it, marked, so you can check it first. Edits
show in `npm run dev` on refresh. If a note breaks a rule, the build fails with a message naming the file, and the live
site stays as it was.

### Getting notes to GitHub

`notes/` is inside the repo, so notes go up with the commits you already make. No Obsidian plugin is needed.

1. **Open `notes/` as its own vault** in Obsidian. Edit, then commit and push as usual (GitHub Desktop, VS Code, or the
   terminal). Cloudflare rebuilds on push.
2. **Or show it inside your main vault** with a Windows directory junction. Obsidian follows junctions. Don't nest the
   main vault inside the repo, or the repo inside the main vault.
   ```
   mklink /J "<main vault>\Site" "C:\Users\PC\Documents\Projects\personal-site\notes"
   ```
3. **Away from this PC:** press `.` on the repo at github.com to open github.dev, which edits Markdown and commits from
   a browser.

## Commands

Run from Windows (PowerShell): `node_modules` is installed there, and the build needs its native binaries.

- `npm run dev`: local site at http://localhost:3000
- `npm test`: the notes tests (Vitest)
- `npm run build`: tests, then the static export into `out/`
- `npm run lint`

Cloudflare: build command `npm run build`, output `out`, Node 24. Don't set `NODE_ENV=production` there, or the tests
can't install and every build fails.
