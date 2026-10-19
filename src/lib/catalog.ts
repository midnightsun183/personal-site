// The only way pages read content. Everything comes from the notes vault (notes/, read by src/lib/notes.ts), which is
// checked as it loads; a bad note fails the build and the last deploy stays live. Server-only: it reads the disk.
// Client components import link helpers from ./sources and types from here, never values.
import "server-only";
import path from "node:path";
import type { Root } from "mdast";
import type { Entry, MapEdge } from "@/content/schema";
import { loadVault, themeNodeId, type Fact, type PieceNote, type Vault } from "./notes";
import { isExternal, sourceLabel } from "./sources";

const NOTES_DIR = path.join(process.cwd(), "notes");

/** `next dev` also shows draft and planned notes, marked, so they can be checked before publishing. */
const DEV = process.env.NODE_ENV === "development";

type Catalog = { vault: Vault; entries: Entry[]; byId: Map<string, PieceNote> };
let memo: Catalog | undefined;

const visible = (p: PieceNote) => p.status === "published" || DEV;

/** Memoized in production. In dev the vault is re-read on every call, so an edited note shows on refresh. */
function catalog(): Catalog {
  if (memo) return memo;
  const vault = loadVault(NOTES_DIR);
  const entries = vault.pieces
    .filter(visible)
    .flatMap((p) => (p.entry ? [p.entry] : []))
    .sort((a, b) => b.date.localeCompare(a.date));
  const c = { vault, entries, byId: new Map(vault.pieces.map((p) => [p.id, p])) };
  if (!DEV) memo = c;
  return c;
}

export function writing(): Entry[] {
  return catalog().entries.filter((e) => e.kind === "essay");
}

export function work(): Entry[] {
  return catalog().entries.filter((e) => e.kind !== "essay");
}

export function featuredWork(): Entry[] {
  return work().filter((e) => e.featured);
}

/** Entries with a page on this site under `section` (e.g. "/work"), for generateStaticParams. */
export function hosted(section: "/work" | "/writing"): Entry[] {
  return catalog().entries.filter((e) => e.source === "here" && e.url.startsWith(`${section}/`));
}

export function bySlug(section: "/work" | "/writing", slug: string): Entry | undefined {
  return hosted(section).find((e) => e.url === `${section}/${slug}`);
}

/** The prepared body of a page hosted here, for NoteBody. */
export function pageBody(id: string): Root | undefined {
  const p = catalog().byId.get(id);
  return p && visible(p) ? p.body : undefined;
}

/** Where a body wikilink to `id` goes: its page or url, or nothing (plain text) if it has neither or isn't out. */
export function hrefFor(id: string): string | undefined {
  const p = catalog().byId.get(id);
  return p && visible(p) ? (p.entry?.url ?? p.url) : undefined;
}

// ---------- Home page map (docs/design/home-map.md) ----------

/**
 * Preview builds (NEXT_PUBLIC_MAP_PREVIEW=1, never set on Cloudflare) include planned nodes, so the map can be
 * judged with its full inventory before the pieces exist. `next dev` shows them too, plus drafts.
 */
const PREVIEW = process.env.NEXT_PUBLIC_MAP_PREVIEW === "1";

export type MapViewNode = {
  id: string;
  label: string;
  /** "theme" nodes come from theme notes; everything else is a piece note. */
  kind: PieceNote["kind"] | "theme";
  weight: "theme" | "heavy" | "normal";
  summary: string;
  /** The theme id this node is listed under in the list version (a theme lists under itself; hubs have none). */
  group?: string;
  href?: string;
  linkLabel?: string;
  /** Theme nodes only: "Did you know?" facts, shown one per click. */
  facts?: Fact[];
  placeholder: boolean;
  planned: boolean;
};

export type MapView = {
  nodes: MapViewNode[];
  edges: MapEdge[];
  /** Whether there's anything to show as a field. Phones and no-JS visitors get the list regardless. */
  showField: boolean;
};

function hostOf(url: string): string {
  return url.replace(/^https:\/\/(www\.)?/, "").replace(/\/.*$/, "");
}

/** The link a node opens and what it says. Entries with their own site (a venture) link there. */
function linkFor(p: PieceNote): { href?: string; linkLabel?: string } {
  const entry = p.entry;
  if (entry) {
    const href = entry.site ?? entry.url;
    const label = entry.site
      ? `Go to ${hostOf(entry.site)}`
      : isExternal(entry.url)
        ? `Read it on ${sourceLabel(entry.source)}`
        : entry.url.startsWith("/work/")
          ? "Read the case study"
          : "Read it";
    return { href, linkLabel: p.linkLabel ?? label };
  }
  if (p.url) return { href: p.url, linkLabel: p.linkLabel ?? (isExternal(p.url) ? `Go to ${hostOf(p.url)}` : "Read it") };
  // No link yet: the label, if any, is shown as plain text (e.g. "In progress.").
  return p.linkLabel ? { linkLabel: p.linkLabel } : {};
}

/**
 * What the home page renders: the shown pieces, a node for each theme they use, a link from every piece to each of
 * its themes, and the `connects` links. Drafts never show outside `next dev`.
 */
export function mapData(): MapView {
  const { vault } = catalog();
  const shown = vault.pieces.filter(
    (p) => p.status === "published" || (p.status === "planned" && (PREVIEW || DEV)) || (p.status === "draft" && DEV),
  );
  const view: MapViewNode[] = shown.map((p) => ({
    id: p.id,
    label: p.label,
    kind: p.kind,
    weight: p.weight,
    summary: p.summary,
    group: p.themes[0],
    ...(p.status === "planned" ? {} : linkFor(p)),
    placeholder: p.placeholder,
    planned: p.status !== "published",
  }));
  const edges: MapEdge[] = [];

  // A node for every theme a shown piece uses, linked to each of those pieces.
  for (const t of vault.themes) {
    const members = shown.filter((p) => p.themes.includes(t.id));
    if (!members.length) continue;
    view.push({
      id: themeNodeId(t.id),
      label: t.label,
      kind: "theme",
      weight: "theme",
      summary: members.length === 1 ? "One piece so far." : `${members.length} pieces connect here.`,
      group: t.id,
      facts: t.facts,
      placeholder: false,
      planned: false,
    });
    for (const p of members) edges.push([themeNodeId(t.id), p.id]);
  }

  // `connects` links, undirected, once each, between nodes that are shown.
  const shownIds = new Set(view.map((n) => n.id));
  const seen = new Set<string>();
  for (const p of shown) {
    for (const to of p.connects) {
      const key = [p.id, to].sort().join(" ");
      if (!shownIds.has(to) || seen.has(key)) continue;
      seen.add(key);
      edges.push([p.id, to]);
    }
  }

  // Reading order: theme by theme (the theme first, then heavy pieces, then the rest, by label), then hubs.
  const themeRank = new Map(vault.themes.map((t, i) => [t.id, i]));
  const groupRank = (n: MapViewNode) => (n.group ? (themeRank.get(n.group) ?? Infinity) : Infinity);
  const weightRank = { theme: 0, heavy: 1, normal: 2 } as const;
  view.sort((a, b) => groupRank(a) - groupRank(b) || weightRank[a.weight] - weightRank[b.weight] || a.label.localeCompare(b.label));

  return { nodes: view, edges, showField: view.length > 0 };
}
