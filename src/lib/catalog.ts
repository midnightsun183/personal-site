// The only way pages read content. Merges hand-written entries with the feed snapshot, validates both,
// and hides drafts. Runs at build time; a schema error fails the build and the last deploy stays live.
import { curated } from "@/content/catalog";
import { mapEdges, mapNodes, themeLabels } from "@/content/map";
import { Entry, MapEdge, MapNode, Snapshot, Theme, type Kind } from "@/content/schema";
import { dedupeAcrossSources } from "@/content/text";
import snapshotJson from "@/content/snapshot.json";

const WORK_KINDS: Kind[] = ["venture", "project", "repo"];

function load(): Entry[] {
  const fromFeeds = Object.values(Snapshot.parse(snapshotJson).sources).flatMap((s) => s.entries);
  const fromHand = curated.map((e) => Entry.parse(e));

  // Hand-written entries win over feed entries with the same URL.
  const byUrl = new Map<string, Entry>();
  for (const e of [...fromFeeds, ...fromHand]) byUrl.set(e.url, e);

  // A piece on Substack and Medium becomes one entry with "also on" links.
  const all = dedupeAcrossSources([...byUrl.values()]);
  const ids = new Set<string>();
  for (const e of all) {
    if (ids.has(e.id)) throw new Error(`Catalog: duplicate id "${e.id}"`);
    ids.add(e.id);
  }
  return all.filter((e) => e.status === "published").sort((a, b) => b.date.localeCompare(a.date));
}

const entries = load();

export function writing(): Entry[] {
  return entries.filter((e) => e.kind === "essay");
}

export function work(): Entry[] {
  return entries.filter((e) => WORK_KINDS.includes(e.kind));
}

export function featuredWork(): Entry[] {
  return work().filter((e) => e.featured);
}

/** Entries with a page on this site under `section` (e.g. "/work"), for generateStaticParams. */
export function hosted(section: "/work" | "/writing"): Entry[] {
  return entries.filter((e) => e.source === "here" && e.url.startsWith(`${section}/`));
}

export function bySlug(section: "/work" | "/writing", slug: string): Entry | undefined {
  return hosted(section).find((e) => e.url === `${section}/${slug}`);
}

export function isExternal(url: string): boolean {
  return url.startsWith("https://");
}

const SOURCE_LABEL: Record<Entry["source"], string> = {
  here: "Here",
  substack: "Substack",
  medium: "Medium",
  github: "GitHub",
  telos: "Telos Brothers",
  other: "Elsewhere",
};

export function sourceLabel(source: Entry["source"]): string {
  return SOURCE_LABEL[source];
}

// ---------- Home page map (docs/design/home-map.md) ----------

/** Newest feed essays attached to the Writing hub, so the map never fills up with posts. */
const FEED_NODES = 5;
const HUB_ID = "writing";

/**
 * Preview builds (NEXT_PUBLIC_MAP_PREVIEW=1, never set on Cloudflare) include planned nodes, so the map can be
 * judged with its full inventory before the pieces exist.
 */
const PREVIEW = process.env.NEXT_PUBLIC_MAP_PREVIEW === "1";

export type MapViewNode = {
  id: string;
  label: string;
  /** "theme" nodes are generated from the themes pieces use; everything else comes from map.ts or the feeds. */
  kind: MapNode["kind"] | "theme";
  weight: "theme" | "heavy" | "normal" | "light";
  summary: string;
  /** The theme this node is listed under in the list version (a theme lists under itself; hubs have none). */
  group?: Theme;
  href?: string;
  linkLabel?: string;
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
function linkFor(node: MapNode, entry: Entry | undefined): { href?: string; linkLabel?: string } {
  if (entry) {
    const href = entry.site ?? entry.url;
    const label = entry.site
      ? `Go to ${hostOf(entry.site)}`
      : isExternal(entry.url)
        ? `Read it on ${sourceLabel(entry.source)}`
        : entry.url.startsWith("/work/")
          ? "Read the case study"
          : "Read it";
    return { href, linkLabel: node.linkLabel ?? label };
  }
  if (node.href) return { href: node.href, linkLabel: node.linkLabel ?? (isExternal(node.href) ? `Go to ${hostOf(node.href)}` : "Read it") };
  // No link yet: the label, if any, is shown as plain text (e.g. "In progress.").
  return node.linkLabel ? { linkLabel: node.linkLabel } : {};
}

const themeNodeId = (t: Theme) => `theme-${t}`;

/**
 * Validates the hand-written map and turns it into what the home page renders: the shown pieces, a node for each
 * theme they use, a link from every piece to each of its themes, and the direct links from map.ts.
 * Throws (failing the build) on a duplicate id, a link to a node that doesn't exist, an unknown or unpublished
 * entryId, a published piece with no themes, or a published hub with no links.
 */
export function mapData(): MapView {
  const nodes = mapNodes.map((n) => MapNode.parse(n));
  const edges = mapEdges.map((e) => MapEdge.parse(e));
  const byId = new Map<string, MapNode>();
  for (const n of nodes) {
    if (byId.has(n.id)) throw new Error(`Map: duplicate node id "${n.id}"`);
    byId.set(n.id, n);
  }
  const degree = new Map<string, number>();
  for (const [a, b] of edges) {
    for (const id of [a, b]) {
      if (!byId.has(id)) throw new Error(`Map: the link from ${a} to ${b} points at unknown node "${id}"`);
      degree.set(id, (degree.get(id) ?? 0) + 1);
    }
  }
  const entryById = new Map(entries.map((e) => [e.id, e]));
  for (const n of nodes) {
    if (n.status !== "published") continue;
    if (n.entryId && !entryById.has(n.entryId)) {
      throw new Error(`Map: node "${n.id}" points at entry "${n.entryId}", which doesn't exist or isn't published`);
    }
    if (n.kind !== "hub" && n.themes.length === 0) throw new Error(`Map: published node "${n.id}" has no themes`);
    if (n.kind === "hub" && !degree.get(n.id)) throw new Error(`Map: published hub "${n.id}" has no links`);
  }

  const shown = nodes.filter((n) => n.status === "published" || PREVIEW);
  const shownIds = new Set(shown.map((n) => n.id));
  const view: MapViewNode[] = shown.map((n) => {
    const entry = n.entryId ? entryById.get(n.entryId) : undefined;
    return {
      id: n.id,
      label: n.label || entry?.title || n.id,
      kind: n.kind,
      weight: n.weight,
      summary: n.summary,
      group: n.themes[0],
      ...(n.status === "planned" ? {} : linkFor(n, entry)),
      placeholder: n.placeholder,
      planned: n.status === "planned",
    };
  });
  const viewEdges: MapEdge[] = edges.filter(([a, b]) => shownIds.has(a) && shownIds.has(b));

  // A node for every theme a shown piece uses, linked to each of those pieces.
  const used = Theme.options.filter((t) => shown.some((n) => n.themes.includes(t)));
  for (const t of used) {
    const members = shown.filter((n) => n.themes.includes(t));
    view.push({
      id: themeNodeId(t),
      label: themeLabels[t],
      kind: "theme",
      weight: "theme",
      summary: members.length === 1 ? "One piece so far." : `${members.length} pieces connect here.`,
      group: t,
      placeholder: false,
      planned: false,
    });
    for (const n of members) viewEdges.push([themeNodeId(t), n.id]);
  }

  // Feed essays hang off the Writing hub, unless a hand-written node already stands for them.
  const claimed = new Set(nodes.map((n) => n.entryId).filter(Boolean));
  if (shownIds.has(HUB_ID)) {
    for (const e of writing().filter((e) => e.source !== "here" && !claimed.has(e.id)).slice(0, FEED_NODES)) {
      const id = `feed-${e.id}`;
      view.push({
        id,
        label: e.title,
        kind: "essay",
        weight: "light",
        summary: e.summary,
        href: e.url,
        linkLabel: `Read it on ${sourceLabel(e.source)}`,
        placeholder: false,
        planned: false,
      });
      viewEdges.push([HUB_ID, id]);
    }
  }

  // Reading order: theme by theme (the theme first, then its heavy pieces, then the rest), then hubs and feeds.
  const groupRank = (n: MapViewNode) => (n.group ? Theme.options.indexOf(n.group) : Theme.options.length);
  const weightRank = { theme: 0, heavy: 1, normal: 2, light: 3 } as const;
  view.sort((a, b) => groupRank(a) - groupRank(b) || weightRank[a.weight] - weightRank[b.weight]);

  return { nodes: view, edges: viewEdges, showField: view.length > 0 };
}
