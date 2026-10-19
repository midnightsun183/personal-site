---
# Required. essay | explainer | tool | case study | venture | book | project | download | hub
kind: essay
# Required. draft (never built; shown in `npm run dev`) | planned (map only, in preview) | published
status: draft
# Required unless kind is hub. Wikilinks to notes in themes/, quoted.
themes: ["[[Places]]"]
# Optional. Links that cross themes. One side is enough; the map draws them both ways.
connects: []
# Plain text, up to 220 characters. No figures, client names, or the school's name.
summary:
# Required once published with a body or a url. YYYY-MM-DD.
date:
# Required once published with a body: it's the URL (/writing/<slug> or /work/<slug>). Never change it after.
slug:
# Optional. heavy | normal (default)
weight: normal
# Optional. Defaults to the filename.
# title:
# Optional. A shorter label for the map.
# label:
# Optional. The piece lives elsewhere (Substack, Medium, GitHub). Then leave the body empty.
# url: https://
# Optional. The same piece cross-posted elsewhere.
# also-at: [https://]
# Optional. The thing's own site, shown alongside a page here.
# site: https://
# Optional. A short note in the margin of lists.
# note:
# Optional. The map card's link text, e.g. "In progress."
# link-label:
# Optional. Overrides where a page goes: writing | work. Default: essay and explainer go to writing.
# section: writing
# featured: false
# placeholder: false
---

The body becomes a page here. Leave it empty for a link out or a map-only piece.

Footnotes: a sentence.[^1] Each note sits beside the paragraph that references it.

> [!quote]
> A pull quote.

```graphic
daylight-chart
caption: Captions go in the margin by default.
caption-at: margin
```

[^1]: The footnote, one paragraph.
