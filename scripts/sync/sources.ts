// The feeds the sync job reads. A source with an empty `feed` is skipped (and isn't checked for staleness).
// Order matters: when the same piece appears in two feeds, the earlier source is the main link.
import type { Source } from "../../src/content/schema.ts";

export type FeedSource = {
  /** Key in snapshot.json. */
  id: string;
  source: Source;
  /** RSS URL, e.g. https://NAME.substack.com/feed or https://medium.com/feed/@NAME */
  feed: string;
};

export const SOURCES: FeedSource[] = [
  { id: "substack", source: "substack", feed: "" }, // TODO: Corey's Substack feed URL
  { id: "medium", source: "medium", feed: "" }, // TODO: Corey's Medium feed URL
];

export function configured(): FeedSource[] {
  return SOURCES.filter((s) => s.feed !== "");
}
