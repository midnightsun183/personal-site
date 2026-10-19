// The notes loader (src/lib/notes.ts). The good vault lives in test/fixtures/notes/ (one note per branch); each broken
// case is written inline to a temp vault next to the error it must produce, so the failing input is easy to read.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Paragraph, Root } from "mdast";
import { afterAll, describe, expect, it } from "vitest";
import { loadVault, splitFrontmatter, type PieceNote } from "@/lib/notes";

const FIXTURE = path.join(import.meta.dirname, "fixtures", "notes");
const TODAY = "2026-10-18";
const vault = loadVault(FIXTURE, TODAY);
const piece = (id: string) => vault.pieces.find((p) => p.id === id) as PieceNote;

// ---------- Temp vaults for broken notes ----------

const temps: string[] = [];
afterAll(() => temps.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

const PLACES = "---\norder: 1\n---\n\n- A fact. [Source](https://en.wikipedia.org/wiki/X)\n";

/** Writes `files` (path → content) into a fresh vault folder named notes/, with a Places theme unless given. */
function tempVault(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "notes-test-"));
  temps.push(dir);
  const root = path.join(dir, "notes");
  for (const [rel, content] of Object.entries({ "themes/Places.md": PLACES, ...files })) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), content);
  }
  return root;
}

/** A piece note's text from frontmatter lines and an optional body. */
function note(frontmatter: string, body = ""): string {
  return `---\n${frontmatter.trim()}\n---\n${body}`;
}

const PUBLISHED = 'kind: essay\nstatus: published\nthemes: ["[[Places]]"]\ndate: 2026-01-01';

describe("frontmatter", () => {
  it("normalizes CRLF and a BOM", () => {
    const { data, body } = splitFrontmatter("x.md", "﻿---\r\nkind: essay\r\n---\r\nBody\r\n");
    expect(data).toEqual({ kind: "essay" });
    expect(body).toBe("Body\n");
  });

  it("keeps dates as strings (YAML 1.2 core)", () => {
    expect(splitFrontmatter("x.md", "---\ndate: 2026-10-17\n---\n").data.date).toBe("2026-10-17");
  });

  it("treats empty frontmatter and no frontmatter as no properties", () => {
    expect(splitFrontmatter("x.md", "---\n---\nBody").data).toEqual({});
    expect(splitFrontmatter("x.md", "Just a body").data).toEqual({});
  });

  it("fails on an unclosed fence, invalid YAML, or a non-object", () => {
    expect(() => splitFrontmatter("x.md", "---\nkind: essay\nBody")).toThrow(/x\.md: .*never closes/);
    expect(() => splitFrontmatter("x.md", "---\nkind: [essay\n---\n")).toThrow(/x\.md: .*isn't valid YAML/);
    expect(() => splitFrontmatter("x.md", "---\n- a\n---\n")).toThrow(/list of properties/);
  });
});

describe("the good vault", () => {
  it("skips _ and . files and folders", () => {
    expect(vault.pieces.map((p) => p.file).some((f) => f.includes("Ignored"))).toBe(false);
  });

  it("reads themes, sorted by order then name, with facts (last link is the source)", () => {
    expect(vault.themes.map((t) => [t.id, t.label])).toEqual([
      ["craft", "Craft and tools"],
      ["places", "Places"],
      ["unordered", "Unordered"],
    ]);
    const places = vault.themes[1];
    expect(places.facts).toEqual([
      { text: "The 39th parallel runs through the Chesapeake Bay Bridge.", source: "39th parallel north", url: "https://en.wikipedia.org/wiki/39th_parallel_north" },
      { text: "Text with a first link keeps it, and the last link is the source.", source: "Source title", url: "https://en.wikipedia.org/wiki/Source" },
    ]);
    expect(vault.themes[0].facts).toEqual([]);
  });

  it("resolves themes by filename or alias, and connects to any note", () => {
    expect(piece("hosted-essay").themes).toEqual(["places", "craft"]);
    expect(piece("hosted-essay").connects).toEqual(["venture"]);
    expect(piece("planned-piece").connects).toEqual(["hosted-essay"]);
  });

  it("turns a body with no url into a page here, sectioned by kind", () => {
    expect(piece("hosted-essay").entry).toMatchObject({
      id: "hosted-essay",
      kind: "essay",
      title: "Hosted essay",
      source: "here",
      url: "/writing/hosted-essay",
      note: "6 min.",
      placeholder: true,
      draft: false,
    });
    expect(piece("venture").entry).toMatchObject({ kind: "venture", url: "/work/venture", site: "https://telosbrothers.com", featured: true });
  });

  it("lets `section` override the default", () => {
    expect(piece("book-page").entry).toMatchObject({ kind: "essay", url: "/writing/book-page", title: "The book" });
    expect(piece("book-page").label).toBe("Book");
  });

  it("turns a url with no body into a link out, inferring sources", () => {
    expect(piece("link-out").entry).toMatchObject({
      kind: "essay",
      source: "substack",
      url: "https://example.substack.com/p/link-out",
      alsoAt: [{ source: "medium", url: "https://medium.com/@corey/link-out" }],
    });
    expect(piece("on-github").entry).toMatchObject({ kind: "project", source: "github" });
  });

  it("gives map-only notes and hubs no entry", () => {
    expect(piece("planned-piece").entry).toBeUndefined();
    expect(piece("hub").entry).toBeUndefined();
    expect(piece("hub")).toMatchObject({ url: "/writing", linkLabel: "All writing" });
  });

  it("marks drafts, dates them today, and lets them skip slug, date and themes", () => {
    expect(piece("draft-piece").entry).toMatchObject({ draft: true, date: TODAY, url: "/writing/draft-piece" });
  });

  it("prepares bodies: numbered footnotes, wikilinks, pull quotes, graphics", () => {
    const body = piece("hosted-essay").body as Root;
    const first = body.children[0] as Paragraph;
    expect(first.children.find((n) => n.type === "footnoteReference")?.data?.n).toBe(1);
    expect(first.children.filter((n) => n.type === "wikiLink")).toEqual([
      { type: "wikiLink", id: "link-out", value: "Link out" },
      { type: "wikiLink", id: "link-out", value: "an alias" },
      { type: "wikiLink", id: "planned-piece", value: "Planned piece" },
      { type: "wikiLink", id: "theme-places", value: "Places" },
    ]);
    const graphics = body.children.filter((n) => n.type === "graphic");
    expect(graphics).toMatchObject([
      { name: "parallel-map", wide: true, caption: "Below: with a colon.", captionAt: "below", props: {} },
      { name: "daylight-chart", wide: false, caption: "In the margin.", captionAt: "margin", props: { compact: true } },
    ]);
    expect(body.children.filter((n) => n.type === "blockquote").map((q) => q.data?.pull ?? false)).toEqual([true, false]);
  });

  it("loads the real notes/ folder", () => {
    const real = loadVault(path.join(import.meta.dirname, "..", "notes"));
    expect(real.pieces.filter((p) => p.status === "published").map((p) => p.id).sort()).toEqual(
      ["experts", "same-latitude-different-ocean", "second-lengua", "telos-brothers", "writing"],
    );
  });
});

describe("broken notes fail the build, naming the file", () => {
  const cases: [string, Record<string, string>, RegExp][] = [
    ["a missing kind or status", { "a.md": note("kind: essay") }, /notes\/a\.md: .*kind and status/],
    ["an invalid kind", { "a.md": note("kind: poem\nstatus: draft") }, /notes\/a\.md: kind:/],
    ["an unknown property", { "a.md": note("kind: essay\nstatus: draft\nlinkLabel: x") }, /Unrecognized key/],
    ["a bad date", { "a.md": note(`${PUBLISHED.replace("2026-01-01", "Oct 1")}`) }, /date: expected YYYY-MM-DD/],
    ["an http url", { "a.md": note(`${PUBLISHED}\nurl: http://example.com`) }, /url: expected https/],
    ["a protocol-relative site", { "a.md": note(`${PUBLISHED}\nsite: //evil.example`) }, /site: expected https/],
    ["a /path url on a non-hub", { "a.md": note(`${PUBLISHED}\nurl: /writing`) }, /only a hub may point at a \/path/],
    ["a body and a url", { "a.md": note(`${PUBLISHED}\nslug: a\nurl: https://example.com`, "Body") }, /a body .* or a url .*not both/],
    ["a hub with a body", { "a.md": note("kind: hub\nstatus: draft", "Body") }, /a hub has no body/],
    ["a published page without a slug", { "a.md": note(PUBLISHED, "Body") }, /needs an explicit slug.*slug: a/],
    ["a published piece without themes", { "a.md": note("kind: essay\nstatus: published") }, /needs at least one theme/],
    ["a published page without a date", { "a.md": note('kind: essay\nstatus: published\nthemes: ["[[Places]]"]\nslug: a', "Body") }, /needs a date/],
    ["a published hub without links", { "h.md": note("kind: hub\nstatus: published\nurl: /writing") }, /notes\/h\.md: a published hub needs at least one link/],
    ["unquoted wikilinks", { "a.md": "---\nkind: essay\nstatus: draft\nthemes: [[Places]]\n---\n" }, /quote each wikilink/],
    ["a link to a missing note", { "a.md": note('kind: essay\nstatus: draft\nconnects: ["[[Nope]]"]') }, /links to "Nope", but no note/],
    ["a theme link to a missing note", { "a.md": note('kind: essay\nstatus: draft\nthemes: ["[[Nope]]"]') }, /themes: no note is named "Nope"/],
    ["a theme link to a piece", { "a.md": note("kind: essay\nstatus: draft"), "b.md": note('kind: essay\nstatus: draft\nthemes: ["[[a]]"]') }, /isn't a theme note/],
    ["a connects link to itself", { "a.md": note('kind: essay\nstatus: draft\nconnects: ["[[a]]"]') }, /links the note to itself/],
    ["two notes with one name", { "x/a.md": note("kind: essay\nstatus: draft"), "y/A.md": note("kind: essay\nstatus: draft\nslug: other") }, /"A" is also the name or alias of notes\/x\/a\.md/],
    ["an alias that's another note's name", { "a.md": note("kind: essay\nstatus: draft"), "b.md": note("kind: essay\nstatus: draft\naliases: [A]") }, /ambiguous/],
    ["a duplicate id", { "a.md": note("kind: essay\nstatus: draft\nslug: same"), "b.md": note("kind: essay\nstatus: draft\nslug: same") }, /id "same" is already used/],
    ["a duplicate url", { "a.md": note(`${PUBLISHED}\nurl: https://example.com/x`), "b.md": note(`${PUBLISHED}\nurl: https://example.com/x`) }, /also used by notes\/a\.md/],
    ["a fact without a link", { "themes/Places.md": "- No source here.\n" }, /notes\/themes\/Places\.md: this fact has no source link/],
    ["a fact with an http source", { "themes/Places.md": "- A fact. [Src](http://example.com)\n" }, /must be an https link/],
    ["a theme note with prose", { "themes/Places.md": "Some prose.\n" }, /holds only a list of facts/],
  ];

  const bodyCases: [string, string, RegExp][] = [
    ["an h1", "# Title", /use ## or ###/],
    ["an h4", "#### Deep", /use ## or ###/],
    ["a table", "| a | b |\n| - | - |\n| 1 | 2 |", /tables aren't supported/],
    ["an image", "![alt](https://example.com/x.png)", /images aren't supported/],
    ["an embed", "![[Places]]", /embeds .* aren't supported/],
    ["raw HTML", "<div>hi</div>", /raw HTML/],
    ["inline HTML", "Hi <b>there</b>", /raw HTML/],
    ["a javascript: link", "[x](javascript:alert(1))", /links must be https/],
    ["a reference-style link", "[x][1]\n\n[1]: https://example.com", /reference-style links/],
    ["strikethrough", "~~gone~~", /unsupported Markdown: delete/],
    ["a task list", "- [ ] todo", /task lists/],
    ["an Obsidian comment", "Text %%hidden%%", /Obsidian comments/],
    ["an undefined footnote", "Text.[^1]", /footnote \[\^1\] has no definition/],
    ["an unused footnote", "Text.\n\n[^1]: Unused.", /\[\^1\] is defined but never used/],
    ["a footnote used twice", "A.[^1] B.[^1]\n\n[^1]: Note.", /referenced more than once/],
    ["a footnote defined twice", "A.[^1]\n\n[^1]: One.\n\n[^1]: Again.", /\[\^1\] is defined twice/],
    ["a footnote of two paragraphs", "A.[^1]\n\n[^1]: One.\n\n    Two.", /must be a single paragraph/],
    ["an unknown callout", "> [!note]\n> Hi", /only the \[!quote\] callout/],
    ["a titled pull quote", "> [!quote] Title\n> Hi", /takes no title/],
    ["an empty pull quote", "> [!quote]", /callout is empty/],
    ["a wikilink to a missing note", "See [[Nope]].", /links to "Nope"/],
    ["an unknown graphic", "```graphic\npie-chart\n```", /unknown graphic "pie-chart" \(known: daylight-chart, parallel-map\)/],
    ["an empty graphic", "```graphic\n```", /graphic block is empty/],
    ["a graphic line without a key", "```graphic\nparallel-map\njust words\n```", /expected "key: value"/],
    ["a graphic key set twice", "```graphic\nparallel-map\ncaption: a\ncaption: b\n```", /"caption" is set twice/],
    ["a non-boolean wide", "```graphic\nparallel-map\nwide: yes\n```", /wide must be true or false/],
    ["a bad caption-at", "```graphic\nparallel-map\ncaption-at: left\n```", /caption-at must be below or margin/],
    ["an unknown graphic prop", "```graphic\nparallel-map\ncolor: red\n```", /graphic parallel-map: .*Unrecognized key/],
    ["a wrongly typed graphic prop", "```graphic\ndaylight-chart\ncompact: 3\n```", /graphic daylight-chart: compact:/],
  ];

  it.each(cases)("%s", (_, files, error) => {
    expect(() => loadVault(tempVault(files))).toThrow(error);
  });

  it.each(bodyCases)("a body with %s", (_, body, error) => {
    const root = tempVault({ "a.md": note("kind: essay\nstatus: draft", `\n${body}\n`) });
    expect(() => loadVault(root)).toThrow(new RegExp(`notes/a\\.md: .*${error.source}`));
  });

  it("fails when the notes folder is missing", () => {
    expect(() => loadVault(path.join(os.tmpdir(), "no-such-notes-folder"))).toThrow(/notes folder doesn't exist/);
  });
});
