// Hand-written entries: work, hosted pieces, public repos, and anything the feeds don't cover.
// Feed entries come from snapshot.json (written by scripts/sync). If both have the same URL, this file wins.
//
// Client work: no client names, figures or identifying details without written permission.
// Keep a write-up at status "draft" until it's cleared; drafts never build.
import type { EntryInput } from "./schema.ts";

export const curated: EntryInput[] = [
  {
    id: "telos-brothers",
    kind: "venture",
    title: "Telos Brothers",
    summary: "Placeholder: what Telos Brothers is, in a sentence or two.",
    date: "2026-01-01",
    source: "here",
    url: "/work/telos-brothers",
    site: "https://telosbrothers.com",
    note: "Placeholder: my role.",
    featured: true,
    status: "published",
    placeholder: true,
  },
  {
    id: "same-latitude-different-ocean",
    kind: "essay",
    title: "Same latitude, different ocean",
    summary: "Mallorca and Maryland sit on almost the same line around the globe. It took moving to notice.",
    date: "2026-10-17",
    source: "here",
    url: "/writing/same-latitude-different-ocean",
    note: "6 min, with a chart you can drag.",
    status: "published",
    placeholder: true,
  },
];
