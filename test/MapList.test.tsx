// The home map's server render (HomeMap before hydration = MapList), from the sample vault.
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HomeMap from "@/components/margins/HomeMap";
import { buildMapView } from "@/lib/mapView";
import { loadVault } from "@/lib/notes";

const vault = loadVault(path.join(import.meta.dirname, "fixtures", "notes"), "2026-10-18");
const html = renderToStaticMarkup(<HomeMap view={buildMapView(vault, { planned: false, drafts: false })} />);

/** The list item for `id`, from its opening tag to the next item. */
function item(id: string): string {
  const start = html.indexOf(`id="map-${id}"`);
  expect(start, `missing item ${id}`).toBeGreaterThanOrEqual(0);
  const next = html.indexOf('id="map-', start + 1);
  return html.slice(start, next < 0 ? undefined : next);
}

describe("HomeMap server render", () => {
  it("renders the list, marked for the CSS, with no graph yet", () => {
    expect(html).toContain("data-home-map");
    expect(html).not.toContain("<canvas");
    expect(html).toContain("View as a list");
  });

  it("names body-wikilink neighbors in 'Connects to'", () => {
    // Book page's body links to Venture and (in a footnote) On GitHub; it's listed under Craft.
    expect(item("book-page")).toMatch(/Connects to .*href="#map-venture".*href="#map-on-github"/);
    // Hosted essay's body links to Link out.
    expect(item("hosted-essay")).toContain('href="#map-link-out"');
  });

  it("doesn't link a piece to itself or to hidden notes", () => {
    expect(item("book-page")).not.toContain('href="#map-book-page"');
    expect(html).not.toContain("map-planned-piece");
  });
});
