# Notes

Every note here becomes part of coreymacdonald.com when it's pushed. The full format is in
`docs/design/obsidian-content-pipeline-spec.md`; templates are in `_templates/`.

- `themes/`: one note per theme. Its body is a list of cited "Did you know?" facts.
- Everything else is a piece. Subfolders are only for organizing; they don't change URLs.
- Files and folders starting with `_` or `.` are ignored by the build.
- A body with no `url` becomes a page here. A `url` with no body is a link out. Neither is a map-only piece.
- `status: draft` never builds, but shows (marked) in `npm run dev`. `planned` shows on the map only in preview builds and in dev.
- A bad note fails the build with a message naming the file. The live site stays as it was.

Rules for everything here:

- High-level only: no figures, no client names, no identifying project details, without Corey's written permission.
  Keep unreviewed client write-ups at `status: draft`.
- Never name the school. "A bilingual school" at most.
- The forecasting system stays off the site entirely.
- Platforms (Snowflake, ServiceNow, Python...) are never pieces or themes.
- Don't invent biographical facts. Mark stand-in copy with `placeholder: true`.
