// The home map's data (docs/design/home-map.md), shaped from the vault. Pure: no disk, no env, so it's testable;
// catalog.ts calls it with the loaded vault and decides what's shown.
import type { MapEdge } from "@/content/schema";
import { themeNodeId, type Fact, type PieceNote, type Vault } from "./notes";
import { isExternal, sourceLabel } from "./sources";

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
  /** How many edges touch this node; the graph sizes dots by it. */
  degree: number;
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
 * What the home page renders: the shown pieces, a node for each theme they use, and the edges, Obsidian-style: every
 * piece to each of its themes, `connects`, and wikilinks in bodies. Edges are undirected, once each, never to the node
 * itself, and only between shown nodes. `show` says whether planned and draft pieces are included.
 */
export function buildMapView(vault: Vault, show: { planned: boolean; drafts: boolean }): MapView {
  const shown = vault.pieces.filter(
    (p) => p.status === "published" || (p.status === "planned" && show.planned) || (p.status === "draft" && show.drafts),
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
    degree: 0,
  }));

  // A node for every theme a shown piece uses.
  for (const t of vault.themes) {
    const members = shown.filter((p) => p.themes.includes(t.id)).length;
    if (!members) continue;
    view.push({
      id: themeNodeId(t.id),
      label: t.label,
      kind: "theme",
      weight: "theme",
      summary: members === 1 ? "One piece so far." : `${members} pieces connect here.`,
      group: t.id,
      facts: t.facts,
      placeholder: false,
      planned: false,
      degree: 0,
    });
  }

  // One pass over every kind of link: themes first (so a theme's pieces read in order), then connects, then bodies.
  const byId = new Map(view.map((n) => [n.id, n]));
  const edges: MapEdge[] = [];
  const seen = new Set<string>();
  const link = (a: string, b: string) => {
    const key = [a, b].sort().join(" ");
    if (a === b || !byId.has(a) || !byId.has(b) || seen.has(key)) return;
    seen.add(key);
    edges.push([a, b]);
    byId.get(a)!.degree++;
    byId.get(b)!.degree++;
  };
  for (const t of vault.themes) for (const p of shown) if (p.themes.includes(t.id)) link(themeNodeId(t.id), p.id);
  for (const p of shown) for (const to of p.connects) link(p.id, to);
  for (const p of shown) for (const to of p.links) link(p.id, to);

  // Reading order: theme by theme (the theme first, then heavy pieces, then the rest, by label), then hubs.
  const themeRank = new Map(vault.themes.map((t, i) => [t.id, i]));
  const groupRank = (n: MapViewNode) => (n.group ? (themeRank.get(n.group) ?? Infinity) : Infinity);
  const weightRank = { theme: 0, heavy: 1, normal: 2 } as const;
  view.sort((a, b) => groupRank(a) - groupRank(b) || weightRank[a.weight] - weightRank[b.weight] || a.label.localeCompare(b.label));

  return { nodes: view, edges, showField: view.length > 0 };
}
