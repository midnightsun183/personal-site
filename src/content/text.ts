// Text helpers shared by the catalog and scripts/sync. Relative imports only.
import { Source, type Entry } from "./schema.ts";

export function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 80)
    .replace(/^-+|-+$/g, "");
}

/**
 * The same piece in two feeds becomes one entry. The source listed earlier in the Source enum
 * (substack before medium) keeps the main link; the others move to `alsoAt`. Matching is by normalized title.
 */
export function dedupeAcrossSources(entries: Entry[]): Entry[] {
  const rank = (e: Entry) => Source.options.indexOf(e.source);
  const sorted = [...entries].sort((a, b) => rank(a) - rank(b));
  const kept = new Map<string, Entry>();
  const out: Entry[] = [];
  for (const e of sorted) {
    const key = `${e.kind}:${slugify(e.title)}`;
    const first = kept.get(key);
    if (first && first.source !== e.source) {
      first.alsoAt = [...first.alsoAt, { source: e.source, url: e.url }];
      continue;
    }
    const copy = { ...e, alsoAt: [...e.alsoAt] };
    kept.set(key, copy);
    out.push(copy);
  }
  return out;
}
