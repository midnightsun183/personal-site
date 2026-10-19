// Reads the notes vault (notes/, opened in Obsidian) and turns it into checked themes and pieces. Build time only.
// Every problem throws with the note's path, which fails the build; the last deploy stays live.
// Read only through src/lib/catalog.ts. The format is docs/design/obsidian-content-pipeline-spec.md.
//
//   notes/**/*.md  (skips dot and _ files and folders)
//        │
//        ├─ split frontmatter (CRLF and BOM normalized) ─▶ YAML 1.2 core ─▶ zod (schema.ts)
//        └─ body ─▶ mdast (remark + gfm)
//                          │
//   pass 1: ids, names and aliases ─▶ name index (case-insensitive; a clash fails)
//                          │
//   pass 2: resolve themes / connects ─▶ check bodies against the allowlist and prepare them:
//           wikilinks become `wikiLink` nodes, footnotes get numbers, [!quote] is marked,
//           ```graphic blocks become `graphic` nodes with checked props
//                          │
//                          ▼
//   Vault { themes (with facts), pieces (with an Entry when they have a body or a url) }
import fs from "node:fs";
import path from "node:path";
import type {
  Blockquote,
  Code,
  FootnoteDefinition,
  Link,
  Literal,
  Node,
  Paragraph,
  PhrasingContent,
  Root,
  RootContent,
  Text,
} from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { parse as parseYaml } from "yaml";
import type { z } from "zod";
import { graphics } from "@/content/graphics";
import { PieceFrontmatter, ThemeFrontmatter, type Entry, type PieceKind, type Source } from "@/content/schema";
import { slugify } from "@/content/text";

/** `[[Note]]` in a body, resolved. `value` is the text shown. */
export interface WikiLink extends Literal {
  type: "wikiLink";
  id: string;
}

/** A ```graphic block, checked against src/content/graphics.ts. */
export interface Graphic extends Node {
  type: "graphic";
  name: string;
  props: Record<string, unknown>;
  wide: boolean;
  caption?: string;
  captionAt: "below" | "margin";
}

declare module "mdast" {
  interface PhrasingContentMap {
    wikiLink: WikiLink;
  }
  interface BlockContentMap {
    graphic: Graphic;
  }
  interface RootContentMap {
    wikiLink: WikiLink;
    graphic: Graphic;
  }
  interface FootnoteReferenceData {
    /** Display number, in order of first reference. */
    n?: number;
  }
  interface BlockquoteData {
    /** A `> [!quote]` callout: rendered as a pull quote. */
    pull?: boolean;
  }
}

export type Fact = { text: string; source: string; url: string };

export type ThemeNote = {
  /** Slugified filename: Places.md is "places". */
  id: string;
  file: string;
  label: string;
  order: number;
  facts: Fact[];
};

export type PieceNote = {
  id: string;
  file: string;
  kind: PieceKind;
  status: "published" | "planned" | "draft";
  title: string;
  /** The map label. */
  label: string;
  summary: string;
  weight: "heavy" | "normal";
  /** Theme ids, in the order written. */
  themes: string[];
  /** Map node ids (a piece's id, or themeNodeId for a theme), from `connects`. */
  connects: string[];
  url?: string;
  linkLabel?: string;
  placeholder: boolean;
  /** Prepared body, for notes that are pages here. */
  body?: Root;
  /** Set when the note has a body or a url (never for hubs). */
  entry?: Entry;
};

export type Vault = { themes: ThemeNote[]; pieces: PieceNote[] };

export const themeNodeId = (themeId: string) => `theme-${themeId}`;

const THEMES_DIR = "themes";

function fail(file: string, message: string): never {
  throw new Error(`${file}: ${message}`);
}

// ---------- Files and frontmatter ----------

function listNotes(root: string, dir = ""): string[] {
  const out: string[] = [];
  for (const d of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    if (d.name.startsWith(".") || d.name.startsWith("_")) continue;
    const rel = dir ? `${dir}/${d.name}` : d.name;
    if (d.isDirectory()) out.push(...listNotes(root, rel));
    else if (d.isFile() && d.name.endsWith(".md")) out.push(rel);
  }
  return out.sort();
}

/** Splits `---` frontmatter from the body. Frontmatter is optional; a note without it gets `{}`. */
export function splitFrontmatter(file: string, raw: string): { data: Record<string, unknown>; body: string } {
  const text = raw.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  if (!/^---[ \t]*\n/.test(text)) return { data: {}, body: text };
  const m = /^---[ \t]*\n(?:([\s\S]*?)\n)?---[ \t]*(?:\n|$)/.exec(text);
  if (!m) fail(file, "the frontmatter starts with --- but never closes");
  let data: unknown;
  try {
    // YAML 1.2 core schema: `date: 2026-10-17` stays a string.
    data = parseYaml(m[1] ?? "", { schema: "core" });
  } catch (e) {
    fail(file, `the frontmatter isn't valid YAML: ${(e as Error).message}`);
  }
  if (data == null) data = {};
  if (typeof data !== "object" || Array.isArray(data)) fail(file, "the frontmatter must be a list of properties");
  return { data: data as Record<string, unknown>, body: text.slice(m[0].length) };
}

function parseWith<T>(file: string, schema: z.ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) fail(file, r.error.issues.map((i) => `${i.path.join(".") || "frontmatter"}: ${i.message}`).join("; "));
  return r.data;
}

const markdown = unified().use(remarkParse).use(remarkGfm);

function parseMarkdown(body: string): Root {
  return coalesce(markdown.parse(body));
}

/** Merges adjacent text nodes, so wikilinks and callout markers are never split across nodes. */
function coalesce<T extends Node>(node: T): T {
  const parent = node as unknown as { children?: Node[] };
  if (!parent.children) return node;
  const merged: Node[] = [];
  for (const child of parent.children.map(coalesce)) {
    const prev = merged[merged.length - 1];
    if (prev?.type === "text" && child.type === "text") (prev as Text).value += (child as Text).value;
    else merged.push(child.type === "text" ? { ...child } : child);
  }
  parent.children = merged;
  return node;
}

/** The text of inline nodes, without markup. */
function plain(nodes: Node[]): string {
  return nodes
    .map((n) => ("value" in n ? String(n.value) : "children" in n ? plain(n.children as Node[]) : ""))
    .join("");
}

/** `"[[Note|shown]]"`, `"[[Note#Heading]]"` and `"Note"` all name "Note". */
function linkTarget(raw: string): string {
  const inner = /^\[\[([^\]]*)\]\]$/.exec(raw.trim())?.[1] ?? raw.trim();
  return inner.split("|")[0].split("#")[0].trim();
}

// ---------- Themes ----------

/** Each top-level list item is one fact. The last link in it is the source; the rest is the fact. */
function parseFacts(file: string, body: string): Fact[] {
  const facts: Fact[] = [];
  for (const block of parseMarkdown(body).children) {
    if (block.type !== "list") fail(file, "a theme note holds only a list of facts, one per item");
    for (const item of block.children) {
      const [para, ...rest] = item.children;
      if (para?.type !== "paragraph" || rest.length) fail(file, "each fact is one line of text ending in a link to its source");
      const at = para.children.findLastIndex((n) => n.type === "link");
      if (at < 0) fail(file, `this fact has no source link: "${plain(para.children)}"`);
      const link = para.children[at] as Link;
      if (!/^https:\/\/\S+$/.test(link.url)) fail(file, `a fact's source must be an https link (found "${link.url}")`);
      const text = plain(para.children.filter((_, i) => i !== at)).replace(/\s+/g, " ").trim();
      if (!text) fail(file, `the fact citing "${link.url}" has no text`);
      facts.push({ text, source: plain(link.children), url: link.url });
    }
  }
  return facts;
}

// ---------- Bodies ----------

const SAFE_HREF = /^(https:\/\/\S+|\/(?!\/)\S*|mailto:\S+)$/;

/**
 * Checks a body against the allowlist and prepares it for NoteBody. Allowed: paragraphs, ## and ###, emphasis,
 * strong, links (https, /path, mailto), lists, inline code, code blocks, rules, footnotes, `> [!quote]`, plain
 * quotes, wikilinks, and ```graphic blocks. Anything else fails, naming the note.
 */
function prepareBody(file: string, tree: Root, resolve: (name: string) => string): Root {
  const defs = new Map<string, FootnoteDefinition>();
  const numbers = new Map<string, number>();
  let inFootnote = false;

  for (const node of tree.children) {
    if (node.type !== "footnoteDefinition") continue;
    if (defs.has(node.identifier)) fail(file, `footnote [^${node.label}] is defined twice`);
    if (node.children.length !== 1 || node.children[0].type !== "paragraph") {
      fail(file, `footnote [^${node.label}] must be a single paragraph`);
    }
    defs.set(node.identifier, node);
  }

  function text(value: string, inLink: boolean): PhrasingContent[] {
    if (value.includes("%%")) fail(file, "Obsidian comments (%%...%%) aren't supported in notes");
    const ref = /\[\^[^\]\s]+\]/.exec(value);
    if (ref) fail(file, `footnote ${ref[0]} has no definition`);
    if (/!\[\[/.test(value)) fail(file, "embeds (![[...]]) aren't supported yet");
    if (inLink) return [{ type: "text", value }];
    const out: PhrasingContent[] = [];
    let last = 0;
    for (const m of value.matchAll(/\[\[([^\]]+)\]\]/g)) {
      if (m.index > last) out.push({ type: "text", value: value.slice(last, m.index) });
      const [target, alias] = m[1].split("|");
      out.push({ type: "wikiLink", id: resolve(linkTarget(target)), value: (alias ?? target.split("#")[0]).trim() });
      last = m.index + m[0].length;
    }
    if (last < value.length) out.push({ type: "text", value: value.slice(last) });
    return out;
  }

  function inline(nodes: PhrasingContent[], inLink = false): PhrasingContent[] {
    return nodes.flatMap((node): PhrasingContent[] => {
      switch (node.type) {
        case "text":
          return text(node.value, inLink);
        case "emphasis":
        case "strong":
          return [{ ...node, children: inline(node.children, inLink) }];
        case "inlineCode":
        case "break":
          return [node];
        case "link":
          if (!SAFE_HREF.test(node.url)) fail(file, `links must be https, a /path here, or mailto: (found "${node.url}")`);
          return [{ ...node, children: inline(node.children, true) }];
        case "footnoteReference": {
          if (inFootnote) fail(file, "a footnote can't reference another footnote");
          if (numbers.has(node.identifier)) fail(file, `footnote [^${node.label}] is referenced more than once`);
          numbers.set(node.identifier, numbers.size + 1);
          return [{ ...node, data: { ...node.data, n: numbers.size } }];
        }
        case "image":
        case "imageReference":
          return fail(file, "images aren't supported yet");
        case "html":
          return fail(file, "raw HTML isn't allowed in notes");
        case "linkReference":
          return fail(file, "reference-style links aren't supported; write [text](url)");
        default:
          return fail(file, `unsupported Markdown: ${node.type}`);
      }
    });
  }

  function quote(node: Blockquote): Blockquote {
    const first = node.children[0];
    const lead = first?.type === "paragraph" ? first.children[0] : undefined;
    const m = lead?.type === "text" ? /^\[!([^\]]+)\]([+-]?)([^\n]*)(?:\n|$)/.exec(lead.value) : null;
    if (!m) return { ...node, children: blocks(node.children) as Blockquote["children"] };
    if (m[1].toLowerCase() !== "quote") fail(file, `only the [!quote] callout is supported (found [!${m[1]}])`);
    if (m[3].trim()) fail(file, "a [!quote] callout takes no title");
    const para = first as Paragraph;
    const rest = (lead as Text).value.slice(m[0].length);
    const leadChildren: PhrasingContent[] = [...(rest ? [{ type: "text" as const, value: rest }] : []), ...para.children.slice(1)];
    const children = [...(leadChildren.length ? [{ ...para, children: leadChildren }] : []), ...node.children.slice(1)];
    if (!children.length) fail(file, "this [!quote] callout is empty");
    return { ...node, data: { ...node.data, pull: true }, children: blocks(children) as Blockquote["children"] };
  }

  function graphic(node: Code): Graphic {
    const [name, ...lines] = node.value.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!name) fail(file, "this graphic block is empty; its first line is the graphic's name");
    const g = graphics[name];
    if (!g) fail(file, `unknown graphic "${name}" (known: ${Object.keys(graphics).join(", ")})`);
    const raw = new Map<string, string>();
    for (const line of lines) {
      const at = line.indexOf(":");
      if (at < 1) fail(file, `graphic ${name}: expected "key: value", found "${line}"`);
      const key = line.slice(0, at).trim();
      if (raw.has(key)) fail(file, `graphic ${name}: "${key}" is set twice`);
      raw.set(key, line.slice(at + 1).trim());
    }
    const wide = raw.get("wide") ?? "false";
    const captionAt = raw.get("caption-at") ?? "margin";
    if (wide !== "true" && wide !== "false") fail(file, `graphic ${name}: wide must be true or false`);
    if (captionAt !== "below" && captionAt !== "margin") fail(file, `graphic ${name}: caption-at must be below or margin`);
    const props: Record<string, unknown> = {};
    for (const [key, value] of raw) {
      if (key === "wide" || key === "caption" || key === "caption-at") continue;
      props[key] = value === "true" ? true : value === "false" ? false : /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : value;
    }
    const checked = g.props.safeParse(props);
    if (!checked.success) {
      fail(file, `graphic ${name}: ${checked.error.issues.map((i) => `${i.path.join(".") || "props"}: ${i.message}`).join("; ")}`);
    }
    return {
      type: "graphic",
      name,
      props: checked.data as Record<string, unknown>,
      wide: wide === "true",
      caption: raw.get("caption") || undefined,
      captionAt,
      position: node.position,
    };
  }

  function blocks(nodes: RootContent[]): RootContent[] {
    return nodes.map((node): RootContent => {
      switch (node.type) {
        case "paragraph":
          return { ...node, children: inline(node.children) };
        case "heading":
          if (node.depth !== 2 && node.depth !== 3) {
            fail(file, `use ## or ### for headings (found ${"#".repeat(node.depth)}); the page title comes from the note`);
          }
          return { ...node, children: inline(node.children) };
        case "list":
          return {
            ...node,
            children: node.children.map((item) => {
              if (item.checked != null) fail(file, "task lists ([ ] and [x]) aren't supported");
              return { ...item, children: blocks(item.children) as typeof item.children };
            }),
          };
        case "blockquote":
          return quote(node);
        case "code":
          return node.lang === "graphic" ? graphic(node) : node;
        case "thematicBreak":
          return node;
        case "footnoteDefinition": {
          inFootnote = true;
          const children = blocks(node.children) as typeof node.children;
          inFootnote = false;
          return { ...node, children };
        }
        case "html":
          return fail(file, "raw HTML isn't allowed in notes");
        case "table":
          return fail(file, "tables aren't supported yet");
        case "definition":
          return fail(file, "reference-style links aren't supported; write [text](url)");
        default:
          return fail(file, `unsupported Markdown: ${node.type}`);
      }
    });
  }

  const prepared: Root = { ...tree, children: blocks(tree.children) };
  for (const def of defs.values()) {
    if (!numbers.has(def.identifier)) fail(file, `footnote [^${def.label}] is defined but never used`);
  }
  return prepared;
}

// ---------- Entries ----------

function sourceOf(url: string): Source {
  const host = new URL(url).hostname.replace(/^www\./, "");
  if (host === "substack.com" || host.endsWith(".substack.com")) return "substack";
  if (host === "medium.com" || host.endsWith(".medium.com")) return "medium";
  if (host === "github.com") return "github";
  if (host === "telosbrothers.com") return "telos";
  return "other";
}

/**
 * Body, no url: a page here. url, no body: a link out. Neither, or a hub: map only (no entry).
 * Section: `section` if set, else essay and explainer go to writing and everything else to work.
 */
function toEntry(id: string, title: string, fm: PieceFrontmatter, hasBody: boolean, today: string): Entry | undefined {
  if (fm.kind === "hub" || (!hasBody && !fm.url)) return undefined;
  const section = fm.section ?? (fm.kind === "essay" || fm.kind === "explainer" ? "writing" : "work");
  return {
    id,
    kind: section === "writing" ? "essay" : fm.kind === "venture" ? "venture" : "project",
    title,
    summary: fm.summary,
    // Only unpublished notes may lack a date (checked in loadVault); they show in `next dev` dated today.
    date: fm.date ?? today,
    source: fm.url ? sourceOf(fm.url) : "here",
    url: fm.url ?? `/${section}/${id}`,
    alsoAt: fm["also-at"].map((url) => ({ source: sourceOf(url), url })),
    site: fm.site,
    note: fm.note,
    featured: fm.featured,
    placeholder: fm.placeholder,
    draft: fm.status !== "published",
  };
}

// ---------- The vault ----------

type Parsed = { file: string; name: string; data: Record<string, unknown>; body: string };

/** Reads and checks every note under `root`. `today` dates undated drafts (dev only). */
export function loadVault(root: string, today = new Date().toISOString().slice(0, 10)): Vault {
  const display = (rel: string) => `${path.basename(root)}/${rel}`;
  if (!fs.existsSync(root)) fail(display(""), "the notes folder doesn't exist");

  const parsed: Parsed[] = listNotes(root).map((rel) => {
    const file = display(rel);
    const { data, body } = splitFrontmatter(file, fs.readFileSync(path.join(root, rel), "utf8"));
    return { file, name: path.basename(rel, ".md"), data, body };
  });

  // Pass 1: themes, pieces' frontmatter, and the name index.
  const names = new Map<string, { id: string; file: string; theme: boolean }>();
  function addName(name: string, id: string, file: string, theme: boolean) {
    const key = name.trim().toLowerCase();
    const other = names.get(key);
    if (other) fail(file, `"${name}" is also the name or alias of ${other.file}, so links to it would be ambiguous`);
    names.set(key, { id, file, theme });
  }

  const themes: ThemeNote[] = [];
  const themeIds = new Set<string>();
  const pieceDrafts: { p: Parsed; fm: PieceFrontmatter; id: string; tree?: Root }[] = [];
  const pieceIds = new Map<string, string>();

  for (const p of parsed) {
    if (p.file.startsWith(display(`${THEMES_DIR}/`))) {
      const fm = parseWith(p.file, ThemeFrontmatter, p.data);
      const id = slugify(p.name);
      if (!id) fail(p.file, "can't make an id from this filename");
      if (themeIds.has(id)) fail(p.file, `another theme note also has the id "${id}"`);
      themeIds.add(id);
      themes.push({ id, file: p.file, label: fm.label ?? p.name, order: fm.order ?? Number.MAX_SAFE_INTEGER, facts: parseFacts(p.file, p.body) });
      for (const n of [p.name, ...fm.aliases]) addName(n, themeNodeId(id), p.file, true);
      continue;
    }
    if (!("kind" in p.data) || !("status" in p.data)) fail(p.file, "a piece note needs frontmatter with at least kind and status");
    for (const key of ["themes", "connects"]) {
      const v = p.data[key];
      if (Array.isArray(v) && v.some(Array.isArray)) fail(p.file, `${key}: quote each wikilink, e.g. ${key}: ["[[Places]]"]`);
    }
    const fm = parseWith(p.file, PieceFrontmatter, p.data);
    const hasBody = p.body.trim() !== "";
    const id = fm.slug ?? slugify(fm.title ?? p.name);
    if (!id) fail(p.file, "can't make an id from this name; set slug");
    const published = fm.status === "published";

    if (hasBody && fm.url) fail(p.file, "a note has a body (a page here) or a url (a link out), not both");
    if (fm.kind === "hub" && hasBody) fail(p.file, "a hub has no body; give it a url instead");
    if (fm.url && fm.kind !== "hub" && !fm.url.startsWith("https://")) fail(p.file, "url must be https (only a hub may point at a /path here)");
    if (published && hasBody && !fm.slug) fail(p.file, `a published page needs an explicit slug, since it's the URL (e.g. slug: ${id})`);
    if (published && fm.kind !== "hub" && fm.themes.length === 0) fail(p.file, "a published piece needs at least one theme");
    if (published && fm.kind !== "hub" && (hasBody || fm.url) && !fm.date) fail(p.file, "a published piece with a page or url needs a date");

    const clash = pieceIds.get(id);
    if (clash) fail(p.file, `the id "${id}" is already used by ${clash}; set a different slug`);
    pieceIds.set(id, p.file);
    for (const n of [p.name, ...fm.aliases]) addName(n, id, p.file, false);
    pieceDrafts.push({ p, fm, id, tree: hasBody ? parseMarkdown(p.body) : undefined });
  }

  function resolver(file: string) {
    return (name: string) => {
      const hit = names.get(name.toLowerCase());
      if (!hit) fail(file, `links to "${name}", but no note has that name or alias`);
      return hit.id;
    };
  }

  // Pass 2: links and bodies.
  const urls = new Map<string, string>();
  const pieces: PieceNote[] = pieceDrafts.map(({ p, fm, id, tree }) => {
    const resolve = resolver(p.file);
    const themeLinks = fm.themes.map((raw) => {
      const target = linkTarget(raw);
      const hit = names.get(target.toLowerCase());
      if (!hit) fail(p.file, `themes: no note is named "${target}"`);
      if (!hit.theme) fail(p.file, `themes: "${target}" isn't a theme note (theme notes live in notes/${THEMES_DIR}/)`);
      return hit.id.slice(themeNodeId("").length);
    });
    const connects = fm.connects.map((raw) => resolve(linkTarget(raw)));
    if (connects.includes(id)) fail(p.file, "connects links the note to itself");

    const title = fm.title ?? p.name;
    const entry = toEntry(id, title, fm, tree !== undefined, today);
    if (entry && fm.url) {
      const other = urls.get(fm.url);
      if (other) fail(p.file, `the url ${fm.url} is also used by ${other}`);
      urls.set(fm.url, p.file);
    }
    return {
      id,
      file: p.file,
      kind: fm.kind,
      status: fm.status,
      title,
      label: fm.label ?? title,
      summary: fm.summary,
      weight: fm.weight,
      themes: [...new Set(themeLinks)],
      connects: [...new Set(connects)],
      url: fm.url,
      linkLabel: fm["link-label"],
      placeholder: fm.placeholder,
      body: tree && prepareBody(p.file, tree, resolve),
      entry,
    };
  });

  // A published hub needs at least one link, from either side.
  for (const hub of pieces) {
    if (hub.kind !== "hub" || hub.status !== "published") continue;
    if (!hub.connects.length && !pieces.some((p) => p.connects.includes(hub.id))) fail(hub.file, "a published hub needs at least one link (connects)");
  }

  themes.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
  return { themes, pieces };
}
