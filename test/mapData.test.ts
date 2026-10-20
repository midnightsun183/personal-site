// The home map's data (src/lib/mapView.ts) from the sample vault (test/fixtures/notes).
//
//   Edges in the vault, and what each test expects to see:
//     themes:   Craft ─ Book page, Venture, Hosted essay, On GitHub;  Places ─ Hosted essay, Link out
//     connects: Hub ─ Link out;  Hosted essay ─ Venture;  Planned piece ─ Hosted essay
//     bodies:   Hosted essay ─ Link out (twice), Planned piece, Places (also a theme edge)
//               Book page ─ itself, Venture, On GitHub (in a footnote)
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildMapView, type MapView } from "@/lib/mapView";
import { loadVault } from "@/lib/notes";

const vault = loadVault(path.join(import.meta.dirname, "fixtures", "notes"), "2026-10-18");
const live = buildMapView(vault, { planned: false, drafts: false });
const preview = buildMapView(vault, { planned: true, drafts: false });
const dev = buildMapView(vault, { planned: true, drafts: true });

const key = (a: string, b: string) => [a, b].sort().join(" ");
const edgeKeys = (v: MapView) => v.edges.map(([a, b]) => key(a, b));
const count = (v: MapView, a: string, b: string) => edgeKeys(v).filter((k) => k === key(a, b)).length;
const node = (v: MapView, id: string) => v.nodes.find((n) => n.id === id);

describe("buildMapView", () => {
  it("shows published pieces and the themes they use; planned in preview; drafts only in dev", () => {
    const ids = (v: MapView) => v.nodes.map((n) => n.id).sort();
    expect(ids(live)).toEqual(
      ["book-page", "hosted-essay", "hub", "link-out", "on-github", "theme-craft", "theme-places", "venture"].sort(),
    );
    expect(ids(preview)).toEqual([...ids(live), "planned-piece"].sort());
    expect(ids(dev)).toEqual([...ids(preview), "draft-piece"].sort());
    expect(node(live, "theme-unordered")).toBeUndefined();
  });

  it("draws an edge for a body wikilink between two shown pieces", () => {
    expect(count(live, "hosted-essay", "link-out")).toBe(1);
    expect(count(live, "book-page", "venture")).toBe(1);
  });

  it("counts wikilinks in footnotes", () => {
    expect(count(live, "book-page", "on-github")).toBe(1);
  });

  it("draws one edge for a pair linked more than one way", () => {
    // Places is both a theme of Hosted essay and a wikilink in its body.
    expect(count(live, "theme-places", "hosted-essay")).toBe(1);
    // Planned piece connects to Hosted essay, and Hosted essay's body links to Planned piece.
    expect(count(preview, "planned-piece", "hosted-essay")).toBe(1);
    expect(new Set(edgeKeys(dev)).size).toBe(dev.edges.length);
  });

  it("drops edges to hidden notes", () => {
    expect(count(live, "hosted-essay", "planned-piece")).toBe(0);
    for (const [a, b] of live.edges) {
      expect(node(live, a)).toBeDefined();
      expect(node(live, b)).toBeDefined();
    }
  });

  it("never links a note to itself", () => {
    expect(count(live, "book-page", "book-page")).toBe(0);
    expect(dev.edges.every(([a, b]) => a !== b)).toBe(true);
  });

  it("keeps theme and connects edges", () => {
    for (const p of ["book-page", "venture", "hosted-essay", "on-github"]) expect(count(live, "theme-craft", p)).toBe(1);
    expect(count(live, "theme-places", "link-out")).toBe(1);
    expect(count(live, "hub", "link-out")).toBe(1);
    expect(count(live, "hosted-essay", "venture")).toBe(1);
  });

  it("gives each node its degree, counting every edge once", () => {
    for (const v of [live, preview, dev]) {
      for (const n of v.nodes) expect(n.degree).toBe(v.edges.filter(([a, b]) => a === n.id || b === n.id).length);
    }
    // Craft, Places, Venture, Link out, Planned piece (preview only).
    expect(node(live, "hosted-essay")?.degree).toBe(4);
    expect(node(preview, "hosted-essay")?.degree).toBe(5);
  });

  it("carries weight through, so heavy pieces can draw larger", () => {
    expect(node(live, "venture")?.weight).toBe("heavy");
    expect(node(live, "link-out")?.weight).toBe("normal");
    expect(node(live, "theme-craft")?.weight).toBe("theme");
  });

  it("marks planned and draft pieces, and gives planned pieces no link", () => {
    expect(node(preview, "planned-piece")?.planned).toBe(true);
    expect(node(preview, "planned-piece")?.href).toBeUndefined();
    expect(node(dev, "draft-piece")?.planned).toBe(true);
    expect(node(live, "hosted-essay")?.planned).toBe(false);
  });

  it("is the same every time it's built", () => {
    expect(buildMapView(vault, { planned: false, drafts: false })).toEqual(live);
  });
});
