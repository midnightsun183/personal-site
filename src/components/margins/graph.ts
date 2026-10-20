// The home map's rules, with no React, DOM or Pixi, so they can be tested (test/graph.test.ts). MapGraph.tsx wires
// browser events to them and draws; HomeMap.tsx uses the mode and KIND_LABEL. See docs/design/home-graph-plan.md.
//
//   geometry:     radius ── seed ── labelAlpha ── hit          (sizes, start positions, label fade, pointer lookup)
//   press:        down ──moved ≤ 4 px──▶ click ─▶ clickAction  (push | assign | new tab | nothing)
//                   └────moved > 4 px──▶ drag (no click on release)
//   card:         hover dot ──1.5 s──▶ card ──leave dot and card, 200 ms──▶ closed
//                 touch tap ─▶ card; tap the same dot again ─▶ open it
//   mode:         loading ──ready──▶ graph ⇄ list;  loading | graph ──fail──▶ failed

import type { MapEdge } from "@/content/schema";
import type { MapViewNode } from "@/lib/mapView";

// ---------- Geometry ----------

/** Extra radius for pieces marked `weight: heavy`, on top of the link-count size. */
export const HEAVY_BONUS = 2;
/** How far outside a dot (in screen pixels) a pointer still counts as on it. */
export const HIT_SLOP = 5;
/** Labels are fully shown at this zoom and above, and fade out to nothing at LABEL_GONE. */
export const LABEL_FULL = 0.6;
export const LABEL_GONE = 0.35;

/** A dot's radius: Obsidian's 2 + sqrt(links), plus HEAVY_BONUS for heavy pieces. */
export function radius(degree: number, weight: MapViewNode["weight"]): number {
  return 2 + Math.sqrt(degree) + (weight === "heavy" ? HEAVY_BONUS : 0);
}

/** A stable number in [0, 1] from a string (FNV-1a). */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

/** A node's starting position, the same on every visit: somewhere in a disc of radius `spread` around 0, 0. */
export function seed(id: string, spread: number): { x: number; y: number } {
  const angle = hash(id) * Math.PI * 2;
  const r = spread * Math.sqrt(hash(`${id}r`));
  return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
}

/** Label opacity at zoom `k`: full from LABEL_FULL up, fading linearly to 0 at LABEL_GONE. */
export function labelAlpha(k: number): number {
  return Math.min(1, Math.max(0, (k - LABEL_GONE) / (LABEL_FULL - LABEL_GONE)));
}

type Dot = { id: string; x: number; y: number; r: number };

/**
 * The dot under a point (both in graph coordinates) at zoom `k`, or null. A dot counts within its radius plus
 * HIT_SLOP screen pixels. The closest wins; on a tie, the later dot (drawn on top).
 */
export function hit(dots: readonly Dot[], x: number, y: number, k: number): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const d of dots) {
    const dist = Math.hypot(x - d.x, y - d.y);
    if (dist <= d.r + HIT_SLOP / k && dist <= bestD) {
      best = d.id;
      bestD = dist;
    }
  }
  return best;
}

/** Each node's neighbors, undirected, once each. */
export function neighborsOf(edges: readonly MapEdge[]): Map<string, string[]> {
  const out = new Map<string, Set<string>>();
  const add = (a: string, b: string) => out.set(a, (out.get(a) ?? new Set()).add(b));
  for (const [a, b] of edges) {
    add(a, b);
    add(b, a);
  }
  return new Map([...out].map(([id, set]) => [id, [...set]]));
}

export const KIND_LABEL: Record<MapViewNode["kind"], string> = {
  essay: "essay",
  explainer: "explainer",
  tool: "tool",
  "case study": "case study",
  venture: "venture",
  book: "book",
  project: "project",
  download: "download",
  hub: "everything written",
  theme: "theme",
};

// ---------- Press: click or drag ----------

/** Movement before a press counts as a drag rather than a click. */
export const DRAG_THRESHOLD = 4;

export type Press = { x0: number; y0: number; moved: boolean };

export function press(x: number, y: number): Press {
  return { x0: x, y0: y, moved: false };
}

/**
 * Records a pointer move. Returns true once, on the move that turns the press into a drag (more than DRAG_THRESHOLD
 * pixels from the start). d3-drag and d3-zoom use the same distance as their clickDistance, so a press is exactly one
 * of a click or a drag.
 */
export function pressMove(p: Press, x: number, y: number): boolean {
  if (p.moved || Math.hypot(x - p.x0, y - p.y0) <= DRAG_THRESHOLD) return false;
  p.moved = true;
  return true;
}

export type ClickAction = { kind: "push" | "assign" | "tab"; href: string } | null;

/**
 * What a click on a dot does. Pages here go through the router, other sites load in place, and Cmd, Ctrl or the
 * middle button open a new tab. Themes, planned pieces and pieces with nowhere to go do nothing.
 */
export function clickAction(node: Pick<MapViewNode, "kind" | "href" | "planned">, newTab: boolean): ClickAction {
  if (node.kind === "theme" || node.planned || !node.href) return null;
  if (newTab) return { kind: "tab", href: node.href };
  return { kind: node.href.startsWith("/") ? "push" : "assign", href: node.href };
}

// ---------- The card beside a dot ----------

/** How long a dot is hovered before its card appears. */
export const CARD_DWELL_MS = 1500;
/** How long a card stays after the pointer leaves the dot and card, so the pointer can cross the gap. */
export const CARD_LINGER_MS = 200;

/**
 * When the card shows. Hovering a dot for CARD_DWELL_MS opens its card; leaving both the dot and the card closes it
 * after CARD_LINGER_MS. On touch, the first tap on a dot shows its card and a second tap on the same dot opens it.
 * Dragging or zooming cancels a pending card. `onChange` gets the card's dot id, or null when it closes.
 */
export class CardTimer {
  card: string | null = null;
  private hovered: string | null = null;
  private onCard = false;
  private dwell: ReturnType<typeof setTimeout> | undefined;
  private linger: ReturnType<typeof setTimeout> | undefined;

  constructor(private onChange: (card: string | null) => void) {}

  /** The pointer is over this dot now, or over no dot (null). */
  hover(id: string | null) {
    if (id === this.hovered) return;
    this.hovered = id;
    clearTimeout(this.dwell);
    if (id === this.card) {
      clearTimeout(this.linger);
      return;
    }
    if (this.card && !this.onCard) this.closeSoon();
    if (id) this.dwell = setTimeout(() => this.show(id), CARD_DWELL_MS);
  }

  /** The pointer or focus entered (true) or left (false) the card. */
  cardHover(on: boolean) {
    this.onCard = on;
    if (on) clearTimeout(this.linger);
    else if (this.hovered !== this.card) this.closeSoon();
  }

  /** A tap on a dot. Returns "open" when it's the second tap on the dot whose card is showing. */
  tap(id: string): "show" | "open" {
    if (this.card === id) return "open";
    clearTimeout(this.dwell);
    this.show(id);
    return "show";
  }

  /** Dragging or zooming started: forget any card that was about to appear. */
  cancel() {
    clearTimeout(this.dwell);
  }

  /** Esc, the Close button, a tap on the background, or a drag. */
  close() {
    clearTimeout(this.dwell);
    clearTimeout(this.linger);
    this.onCard = false;
    this.set(null);
  }

  dispose() {
    clearTimeout(this.dwell);
    clearTimeout(this.linger);
  }

  private show(id: string) {
    clearTimeout(this.linger);
    this.onCard = false;
    this.set(id);
  }

  private closeSoon() {
    clearTimeout(this.linger);
    this.linger = setTimeout(() => this.set(null), CARD_LINGER_MS);
  }

  private set(card: string | null) {
    if (card === this.card) return;
    this.card = card;
    this.onChange(card);
  }
}

// ---------- HomeMap's mode ----------

/**
 * loading: Pixi is on its way; the list is hidden and the graph's space reserved (wide screens with JS).
 * graph: drawn. list: the visitor chose the list. failed: Pixi couldn't start (no WebGL, lost context); the list shows.
 */
export type Mode = "loading" | "graph" | "list" | "failed";
export type ModeEvent = "ready" | "fail" | "toList" | "toGraph";

export function nextMode(mode: Mode, event: ModeEvent): Mode {
  switch (event) {
    case "ready":
      return mode === "loading" ? "graph" : mode;
    case "fail":
      return mode === "loading" || mode === "graph" ? "failed" : mode;
    case "toList":
      return mode === "graph" ? "list" : mode;
    case "toGraph":
      // The graph mounts again; the same seed gives the same layout.
      return mode === "list" ? "loading" : mode;
  }
}
