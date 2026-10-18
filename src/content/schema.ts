// The catalog's shape. Shared by the site and by scripts/sync, so it uses relative imports only.
import { z } from "zod";

/** Where a thing lives. "here" means a page on this site. */
export const Source = z.enum(["here", "substack", "medium", "github", "telos", "other"]);
export type Source = z.infer<typeof Source>;

/** Writing is "essay". Everything else shows on Work. */
export const Kind = z.enum(["essay", "venture", "project", "repo"]);
export type Kind = z.infer<typeof Kind>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

/** An https URL, or a path on this site. Feeds are untrusted, so javascript:, data: and plain http are refused. */
const href = z.string().refine((v) => v.startsWith("/") || /^https:\/\/[^\s]+$/.test(v), "expected https URL or /path");

export const Entry = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "lowercase letters, digits and dashes"),
  kind: Kind,
  title: z.string().min(1).max(200),
  /** Plain text, never HTML. */
  summary: z.string().max(320).default(""),
  date: isoDate,
  source: Source,
  /** Where the title links: a page here (/work/x) or the thing itself (https://...). */
  url: href,
  /** The same piece elsewhere, e.g. a Substack essay cross-posted to Medium. */
  alsoAt: z.array(z.object({ source: Source, url: href })).default([]),
  /** The thing's own site, for work that has one (shown in addition to a page here). */
  site: href.optional(),
  /** Corey's short note in the margin. */
  note: z.string().max(200).optional(),
  featured: z.boolean().default(false),
  status: z.enum(["draft", "published"]),
  /** Copy that's standing in for something real. Shown as such, so it can't ship unnoticed. */
  placeholder: z.boolean().default(false),
});
export type Entry = z.infer<typeof Entry>;
export type EntryInput = z.input<typeof Entry>;

/** What scripts/sync writes: one block per feed, so a failing source keeps its last good entries. */
export const Snapshot = z.object({
  sources: z.record(
    z.string(),
    z.object({
      /** Last time this source was fetched successfully (ISO timestamp). */
      fetchedAt: z.iso.datetime(),
      entries: z.array(Entry),
    }),
  ),
});
export type Snapshot = z.infer<typeof Snapshot>;

/**
 * Home page map (docs/design/home-map.md). Themes are nodes too, like tags in an Obsidian graph: every piece
 * connects to the themes it touches, so work that shares a theme forms one web. Listed in reading order.
 */
export const Theme = z.enum(["reporting", "data", "operations", "building", "teaching", "language", "expertise", "places"]);
export type Theme = z.infer<typeof Theme>;

export const MapNode = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "lowercase letters, digits and dashes"),
  /** Short, as shown on the map. Blank takes the title of `entryId`. */
  label: z.string().max(80).default(""),
  kind: z.enum(["essay", "explainer", "tool", "case study", "venture", "book", "project", "download", "hub"]),
  /** The themes this piece touches; a thread runs to each. Only a hub may have none. */
  themes: z.array(Theme).default([]),
  weight: z.enum(["heavy", "normal"]),
  /** Plain text. No figures, client names, or the school's name. */
  summary: z.string().max(220),
  /** A catalog entry this node stands for. Its link wins over `href`. */
  entryId: z.string().optional(),
  href: href.optional(),
  /** The link's text, e.g. "Read it on Substack". Defaults from the link. */
  linkLabel: z.string().max(60).optional(),
  status: z.enum(["published", "planned"]),
  placeholder: z.boolean().default(false),
});
export type MapNode = z.infer<typeof MapNode>;
export type MapNodeInput = z.input<typeof MapNode>;

/** Two node ids; undirected. */
export const MapEdge = z.tuple([z.string(), z.string()]);
export type MapEdge = z.infer<typeof MapEdge>;

/** Sources older than this fail the build and the weekly check. */
export const STALE_AFTER_DAYS = 14;
