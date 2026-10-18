// Turning untrusted feed items into catalog entries. Pure functions: no network, no clock, no files.
// Cross-source dedupe happens later, in the catalog (src/content/text.ts), so each feed is stored as-is.
import { Entry, type Source } from "../../src/content/schema.ts";
import { slugify } from "../../src/content/text.ts";
import type { RawItem } from "./feed.ts";

const SUMMARY_MAX = 300;

/** HTML to plain text: drop tags (and script/style contents), decode the common entities, collapse whitespace. */
export function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cut at a word boundary and add an ellipsis, so summaries never end mid-word. */
export function truncate(s: string, max = SUMMARY_MAX): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:]+$/, "")}…`;
}

export type Dropped = { title: string; reason: string };

/** Feed items to entries. Items that fail validation are dropped with a reason, never patched up. */
export function toEntries(items: RawItem[], source: Source): { entries: Entry[]; dropped: Dropped[] } {
  const entries: Entry[] = [];
  const dropped: Dropped[] = [];
  const ids = new Set<string>();
  for (const item of items) {
    const title = stripHtml(item.title);
    const date = new Date(item.pubDate);
    if (Number.isNaN(date.getTime())) {
      dropped.push({ title: title || "(untitled)", reason: `unreadable date "${item.pubDate}"` });
      continue;
    }
    // Two pieces with the same title in one feed still need distinct ids.
    let id = `${source}-${slugify(title) || "untitled"}`;
    for (let n = 2; ids.has(id); n++) id = `${source}-${slugify(title) || "untitled"}-${n}`;

    const result = Entry.safeParse({
      id,
      kind: "essay",
      title,
      summary: truncate(stripHtml(item.description || item.content)),
      date: date.toISOString().slice(0, 10),
      source,
      url: item.link.trim(),
      status: "published",
    });
    if (result.success) {
      ids.add(id);
      entries.push(result.data);
    } else {
      dropped.push({
        title: title || "(untitled)",
        reason: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      });
    }
  }
  return { entries, dropped };
}
