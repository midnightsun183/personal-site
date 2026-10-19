// The catalog's shape: what a note's frontmatter may say, and what pages receive. Notes are read by
// src/lib/notes.ts; pages read the result only through src/lib/catalog.ts.
import { z } from "zod";

/** Where a thing lives. "here" means a page on this site. Inferred from a note's `url`, never written by hand. */
export const Source = z.enum(["here", "substack", "medium", "github", "telos", "other"]);
export type Source = z.infer<typeof Source>;

/** Writing is "essay". Everything else shows on Work. */
export type Kind = "essay" | "venture" | "project";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

/** An https URL, or a path on this site. javascript:, data:, plain http and protocol-relative //host are refused. */
export const href = z.string().refine((v) => /^\/(?!\/)/.test(v) || /^https:\/\/[^\s]+$/.test(v), "expected https URL or /path");

/** A string or a list of strings; Obsidian writes single-value properties either way. */
const stringList = z.union([z.string().transform((s) => [s]), z.array(z.string())]).default([]);

/** Properties Obsidian may add on its own. Accepted and ignored. */
const obsidianKeys = { tags: z.unknown().optional(), cssclasses: z.unknown().optional() };

export const PieceKind = z.enum(["essay", "explainer", "tool", "case study", "venture", "book", "project", "download", "hub"]);
export type PieceKind = z.infer<typeof PieceKind>;

/**
 * A piece note's frontmatter (any note outside notes/themes/). Strict: an unknown property fails the build, which
 * catches typos like `linkLabel` for `link-label`. Cross-field rules (date, slug, body vs url) live in notes.ts.
 */
export const PieceFrontmatter = z.strictObject({
  kind: PieceKind,
  status: z.enum(["published", "planned", "draft"]),
  /** Wikilinks to theme notes. Required unless kind is hub. */
  themes: stringList,
  /** Wikilinks to any note, for connections that cross themes. Undirected on the map. */
  connects: stringList,
  /** Plain text. No figures, client names, or the school's name. Shown in lists and on the map. */
  summary: z.string().max(220).default(""),
  date: isoDate.optional(),
  weight: z.enum(["heavy", "normal"]).default("normal"),
  /** Defaults to the filename. */
  title: z.string().min(1).max(200).optional(),
  /** A shorter label for the map. Defaults to the title. */
  label: z.string().max(80).optional(),
  /** The id and, for a page here, the URL. Required on a published note with a body, so retitling never moves a page. */
  slug: z.string().regex(/^[a-z0-9-]+$/, "lowercase letters, digits and dashes").optional(),
  /** The piece lives elsewhere (https), or, for a hub, a page here (/writing). */
  url: href.optional(),
  /** The same piece cross-posted elsewhere. */
  "also-at": z.array(href).default([]),
  /** The thing's own site, shown in addition to a page here. */
  site: href.optional(),
  /** Corey's short note in the margin of lists. */
  note: z.string().max(200).optional(),
  /** The map card's link text, e.g. "In progress." for a piece with no link yet. */
  "link-label": z.string().max(60).optional(),
  featured: z.boolean().default(false),
  /** Copy that's standing in for something real. Shown as such, so it can't ship unnoticed. */
  placeholder: z.boolean().default(false),
  /** Overrides where a page goes. Default: essay and explainer go to writing, everything else to work. */
  section: z.enum(["writing", "work"]).optional(),
  aliases: stringList,
  ...obsidianKeys,
});
export type PieceFrontmatter = z.infer<typeof PieceFrontmatter>;

/** A theme note's frontmatter (notes/themes/*.md). Its body is a list of facts. */
export const ThemeFrontmatter = z.strictObject({
  /** Position in the list version. Ties, and themes without one, sort by name. */
  order: z.number().int().optional(),
  /** Defaults to the filename. */
  label: z.string().min(1).max(40).optional(),
  aliases: stringList,
  ...obsidianKeys,
});
export type ThemeFrontmatter = z.infer<typeof ThemeFrontmatter>;

/** One listed thing: a page here or a link out. Derived from a note with a body or a `url`. */
export type Entry = {
  id: string;
  kind: Kind;
  title: string;
  /** Plain text, never HTML. */
  summary: string;
  date: string;
  source: Source;
  /** Where the title links: a page here (/work/x) or the thing itself (https://...). */
  url: string;
  alsoAt: { source: Source; url: string }[];
  site?: string;
  note?: string;
  featured: boolean;
  placeholder: boolean;
  /** Only in `next dev`: a draft or planned note, shown so it can be checked before publishing. */
  draft: boolean;
};

/** Two node ids; undirected. */
export type MapEdge = [string, string];
