// The home map's pure rules (src/components/margins/graph.ts): geometry, click vs drag, the card timer, and the mode.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CARD_DWELL_MS,
  CARD_LINGER_MS,
  CardTimer,
  clickAction,
  DRAG_THRESHOLD,
  HEAVY_BONUS,
  HIT_SLOP,
  hash,
  hit,
  LABEL_FULL,
  LABEL_GONE,
  labelAlpha,
  neighborsOf,
  nextMode,
  press,
  pressMove,
  radius,
  seed,
  type Mode,
  type ModeEvent,
} from "@/components/margins/graph";

describe("geometry", () => {
  it("sizes dots like Obsidian, 2 + sqrt(links), with a bonus for heavy pieces only", () => {
    expect(radius(0, "normal")).toBe(2);
    expect(radius(4, "normal")).toBe(4);
    expect(radius(9, "normal")).toBeGreaterThan(radius(4, "normal"));
    expect(radius(4, "heavy")).toBe(4 + HEAVY_BONUS);
    expect(radius(4, "theme")).toBe(4);
  });

  it("seeds the same id to the same place, different ids apart, inside the disc", () => {
    expect(seed("a", 100)).toEqual(seed("a", 100));
    expect(seed("a", 100)).not.toEqual(seed("b", 100));
    for (const id of ["a", "b", "theme-places", "same-latitude-different-ocean", ""]) {
      const { x, y } = seed(id, 100);
      expect(Math.hypot(x, y)).toBeLessThanOrEqual(100);
    }
    expect(hash("x")).toBeGreaterThanOrEqual(0);
    expect(hash("x")).toBeLessThanOrEqual(1);
  });

  it("shows labels fully down to LABEL_FULL, fading to nothing at LABEL_GONE", () => {
    expect(labelAlpha(4)).toBe(1);
    expect(labelAlpha(1)).toBe(1);
    expect(labelAlpha(LABEL_FULL)).toBe(1);
    expect(labelAlpha((LABEL_FULL + LABEL_GONE) / 2)).toBeCloseTo(0.5);
    expect(labelAlpha(LABEL_GONE)).toBe(0);
    expect(labelAlpha(0.1)).toBe(0);
  });

  describe("hit", () => {
    const dots = [
      { id: "a", x: 0, y: 0, r: 4 },
      { id: "b", x: 20, y: 0, r: 4 },
      { id: "c", x: 20, y: 0, r: 4 },
    ];

    it("finds the dot under the point, with HIT_SLOP screen pixels to spare", () => {
      expect(hit(dots, 1, 1, 1)).toBe("a");
      expect(hit(dots, 4 + HIT_SLOP, 0, 1)).toBe("a");
      expect(hit(dots, 4 + HIT_SLOP + 0.5, 0, 1)).toBeNull();
    });

    it("scales the slop with zoom, so small dots stay easy to hit zoomed out", () => {
      const a = [dots[0]];
      expect(hit(a, 4 + HIT_SLOP * 2, 0, 0.5)).toBe("a");
      expect(hit(a, 4 + HIT_SLOP, 0, 2)).toBeNull();
    });

    it("returns null on the background", () => {
      expect(hit(dots, 10, 50, 1)).toBeNull();
      expect(hit([], 0, 0, 1)).toBeNull();
    });

    it("prefers the closest dot, and the later (top) one on a tie", () => {
      expect(hit([{ id: "a", x: 0, y: 0, r: 10 }, { id: "b", x: 6, y: 0, r: 10 }], 4, 0, 1)).toBe("b");
      expect(hit([{ id: "a", x: 0, y: 0, r: 10 }, { id: "b", x: 6, y: 0, r: 10 }], 2, 0, 1)).toBe("a");
      expect(hit(dots, 20, 0, 1)).toBe("c");
    });
  });

  it("lists neighbors both ways, once each", () => {
    const n = neighborsOf([
      ["a", "b"],
      ["b", "c"],
      ["b", "a"],
    ]);
    expect(n.get("a")).toEqual(["b"]);
    expect(n.get("b")).toEqual(["a", "c"]);
    expect(n.get("c")).toEqual(["b"]);
    expect(n.get("d")).toBeUndefined();
  });
});

describe("click or drag", () => {
  it("stays a click up to DRAG_THRESHOLD pixels, and becomes a drag once past it", () => {
    const p = press(10, 10);
    expect(pressMove(p, 10 + DRAG_THRESHOLD, 10)).toBe(false);
    expect(p.moved).toBe(false);
    expect(pressMove(p, 10 + DRAG_THRESHOLD + 1, 10)).toBe(true);
    expect(p.moved).toBe(true);
    // Only the move that starts the drag reports it.
    expect(pressMove(p, 50, 50)).toBe(false);
    expect(p.moved).toBe(true);
  });

  it("measures distance, not a single axis", () => {
    const p = press(0, 0);
    expect(pressMove(p, 3, 3)).toBe(true);
  });

  it("sends pages here through the router, other sites in place, and modifier clicks to a new tab", () => {
    const piece = { kind: "essay" as const, planned: false };
    expect(clickAction({ ...piece, href: "/writing/x" }, false)).toEqual({ kind: "push", href: "/writing/x" });
    expect(clickAction({ ...piece, href: "https://x.substack.com/p/y" }, false)).toEqual({ kind: "assign", href: "https://x.substack.com/p/y" });
    expect(clickAction({ ...piece, href: "/writing/x" }, true)).toEqual({ kind: "tab", href: "/writing/x" });
  });

  it("does nothing for themes, planned pieces, and pieces with nowhere to go", () => {
    expect(clickAction({ kind: "theme", planned: false }, false)).toBeNull();
    expect(clickAction({ kind: "essay", planned: true, href: "/writing/x" }, false)).toBeNull();
    expect(clickAction({ kind: "project", planned: false }, false)).toBeNull();
  });
});

describe("CardTimer", () => {
  let changes: (string | null)[];
  let cards: CardTimer;

  beforeEach(() => {
    vi.useFakeTimers();
    changes = [];
    cards = new CardTimer((c) => changes.push(c));
  });
  afterEach(() => {
    cards.dispose();
    vi.useRealTimers();
  });

  it("opens a card only after a dot is hovered for CARD_DWELL_MS", () => {
    cards.hover("a");
    vi.advanceTimersByTime(CARD_DWELL_MS - 1);
    expect(cards.card).toBeNull();
    vi.advanceTimersByTime(1);
    expect(cards.card).toBe("a");
    expect(changes).toEqual(["a"]);
  });

  it("forgets a pending card when the pointer leaves first", () => {
    cards.hover("a");
    vi.advanceTimersByTime(CARD_DWELL_MS - 100);
    cards.hover(null);
    vi.advanceTimersByTime(CARD_DWELL_MS);
    expect(changes).toEqual([]);
  });

  it("restarts the wait when the pointer moves to another dot", () => {
    cards.hover("a");
    vi.advanceTimersByTime(1000);
    cards.hover("b");
    vi.advanceTimersByTime(1000);
    expect(cards.card).toBeNull();
    vi.advanceTimersByTime(CARD_DWELL_MS - 1000);
    expect(cards.card).toBe("b");
  });

  it("keeps the card while the pointer crosses from the dot onto it, and closes when it leaves both", () => {
    cards.hover("a");
    vi.advanceTimersByTime(CARD_DWELL_MS);
    cards.hover(null);
    vi.advanceTimersByTime(CARD_LINGER_MS - 1);
    cards.cardHover(true);
    vi.advanceTimersByTime(CARD_LINGER_MS * 5);
    expect(cards.card).toBe("a");
    cards.cardHover(false);
    vi.advanceTimersByTime(CARD_LINGER_MS);
    expect(cards.card).toBeNull();
    expect(changes).toEqual(["a", null]);
  });

  it("keeps the card when the pointer goes back to its dot", () => {
    cards.hover("a");
    vi.advanceTimersByTime(CARD_DWELL_MS);
    cards.hover(null);
    vi.advanceTimersByTime(CARD_LINGER_MS / 2);
    cards.hover("a");
    vi.advanceTimersByTime(CARD_LINGER_MS * 5);
    expect(cards.card).toBe("a");
  });

  it("closes a card after the linger when another dot is hovered, then opens that dot's card", () => {
    cards.hover("a");
    vi.advanceTimersByTime(CARD_DWELL_MS);
    cards.hover("b");
    vi.advanceTimersByTime(CARD_LINGER_MS);
    expect(cards.card).toBeNull();
    vi.advanceTimersByTime(CARD_DWELL_MS);
    expect(cards.card).toBe("b");
    expect(changes).toEqual(["a", null, "b"]);
  });

  it("cancels a pending card when a drag or zoom starts", () => {
    cards.hover("a");
    vi.advanceTimersByTime(1000);
    cards.cancel();
    vi.advanceTimersByTime(CARD_DWELL_MS);
    expect(cards.card).toBeNull();
  });

  it("closes at once on Esc or Close, with nothing left pending", () => {
    cards.hover("a");
    vi.advanceTimersByTime(CARD_DWELL_MS);
    cards.close();
    expect(cards.card).toBeNull();
    vi.advanceTimersByTime(CARD_DWELL_MS * 2);
    expect(changes).toEqual(["a", null]);
  });

  it("on touch: the first tap shows the card, a second tap on the same dot opens it", () => {
    expect(cards.tap("a")).toBe("show");
    expect(cards.card).toBe("a");
    expect(cards.tap("a")).toBe("open");
    expect(cards.tap("b")).toBe("show");
    expect(cards.card).toBe("b");
    expect(changes).toEqual(["a", "b"]);
  });

  it("doesn't report a change when nothing changed", () => {
    cards.close();
    cards.hover(null);
    expect(changes).toEqual([]);
  });
});

describe("mode", () => {
  const run = (start: Mode, ...events: ModeEvent[]) => events.reduce(nextMode, start);

  it("goes from loading to the graph when Pixi is ready, or to failed when it can't start", () => {
    expect(run("loading", "ready")).toBe("graph");
    expect(run("loading", "fail")).toBe("failed");
  });

  it("swaps between the graph and the list, reloading the graph on the way back", () => {
    expect(run("graph", "toList")).toBe("list");
    expect(run("list", "toGraph")).toBe("loading");
    expect(run("graph", "toList", "toGraph", "ready")).toBe("graph");
  });

  it("fails from the graph when the WebGL context is lost", () => {
    expect(run("graph", "fail")).toBe("failed");
  });

  it("ignores events that don't apply", () => {
    expect(run("list", "ready")).toBe("list");
    expect(run("list", "fail")).toBe("list");
    expect(run("failed", "ready")).toBe("failed");
    expect(run("failed", "toGraph")).toBe("failed");
    expect(run("failed", "toList")).toBe("failed");
    expect(run("loading", "toList")).toBe("loading");
    expect(run("graph", "ready")).toBe("graph");
  });
});
