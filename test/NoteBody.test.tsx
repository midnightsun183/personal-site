// NoteBody renders the fixture essay (test/fixtures/notes/writing/Hosted essay.md) to static HTML.
import path from "node:path";
import type { Root } from "mdast";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import NoteBody from "@/components/margins/NoteBody";
import { loadVault } from "@/lib/notes";

const vault = loadVault(path.join(import.meta.dirname, "fixtures", "notes"));
const body = vault.pieces.find((p) => p.id === "hosted-essay")?.body as Root;
// Published pieces with a page or url get links; the planned piece and themes don't.
const hrefs: Record<string, string> = { "link-out": "https://example.substack.com/p/link-out", venture: "/work/venture" };
const html = renderToStaticMarkup(<NoteBody tree={body} hrefFor={(id) => hrefs[id]} />);

/** Index of `needle` in the HTML, failing loudly if it's missing. */
function at(needle: string): number {
  const i = html.indexOf(needle);
  expect(i, `missing: ${needle}`).toBeGreaterThanOrEqual(0);
  return i;
}

describe("NoteBody", () => {
  it("places each footnote's Note right after the paragraph that references it", () => {
    expect(at("First paragraph.")).toBeLessThan(at('id="note-1"'));
    expect(at('id="note-1"')).toBeLessThan(at("Second paragraph."));
    expect(at("Second paragraph.")).toBeLessThan(at('id="note-2"'));
    expect(html).toMatch(/id="note-1"[^>]*>.*?1<\/span>The first note, numbered 1\./);
    expect(html).toMatch(/id="note-2"[^>]*>.*?2<\/span>The second note, numbered 2\./);
  });

  it("renders wikilinks as links when the target has a page or url, else plain text", () => {
    expect(html).toContain('<a href="https://example.substack.com/p/link-out">Link out</a>');
    expect(html).toContain('<a href="https://example.substack.com/p/link-out">an alias</a>');
    expect(html).toContain(" Planned piece and Places.");
  });

  it("renders links: /path, mailto and https", () => {
    expect(html).toContain('<a href="/about">about</a>');
    expect(html).toContain('<a href="mailto:hi@example.com">mail</a>');
    expect(html).toContain('<a href="https://example.com">out</a>');
  });

  it("renders [!quote] as a pull quote and > as a plain quote", () => {
    expect(html).toMatch(/<blockquote class="[^"]*pull[^"]*">“A pull quote\.”<\/blockquote>/);
    expect(html).toContain("<blockquote><p>A plain quote.</p></blockquote>");
  });

  it("renders a wide graphic with its caption below", () => {
    expect(html).toMatch(/<figure class="[^"]*map[^"]* [^"]*wide[^"]*"><svg[\s\S]*?<\/svg><figcaption class="[^"]*cap[^"]* [^"]*capBelow[^"]*">Below: with a colon\.<\/figcaption><\/figure>/);
  });

  it("renders a graphic with its caption in the margin, after the figure", () => {
    expect(html).toMatch(/<figure>[\s\S]*?<\/figure><aside class="[^"]*note[^"]* [^"]*cap[^"]*">In the margin\.<\/aside>/);
  });

  it("renders the allowlisted blocks", () => {
    expect(html).toContain("<h2>A heading</h2>");
    expect(html).toContain("<h3>A smaller heading</h3>");
    expect(html).toContain("<ul><li>one</li><li>two with <code>code</code></li></ul>");
    expect(html).toContain("<ol><li>first</li><li>second</li></ol>");
    expect(html).toContain("<hr/>");
    expect(html).toContain("<pre><code>const x = 1;</code></pre>");
  });
});
