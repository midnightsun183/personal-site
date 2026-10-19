import type { ReactNode } from "react";
import Link from "next/link";
import type { FootnoteDefinition, FootnoteReference, Node, Paragraph, PhrasingContent, Root, RootContent } from "mdast";
import Note, { Aside } from "./Note";
import NoteRef from "./NoteRef";
import { graphics } from "@/content/graphics";
import s from "./margins.module.css";

type HrefFor = (id: string) => string | undefined;

/**
 * A note's body, already checked and prepared by src/lib/notes.ts, as the Margins markup the posts used by hand:
 *
 *   block ─▶ element ─▶ <Note> for each footnote it references (so the note sits beside its paragraph)
 *   > [!quote]    ─▶ <blockquote className={s.pull}>
 *   ```graphic    ─▶ <figure> with its caption below (figcaption) or in the margin (<Aside> after it)
 *   [[Note]]      ─▶ a link if the target has a page or url, otherwise plain text
 */
export default function NoteBody({ tree, hrefFor }: { tree: Root; hrefFor: HrefFor }) {
  const defs = new Map<string, FootnoteDefinition>();
  for (const node of tree.children) if (node.type === "footnoteDefinition") defs.set(node.identifier, node);

  const out: ReactNode[] = [];
  tree.children.forEach((node, i) => {
    if (node.type === "footnoteDefinition") return;
    out.push(block(node, `b${i}`, hrefFor));
    for (const ref of footnoteRefs(node)) {
      const n = ref.data?.n ?? 0;
      const para = defs.get(ref.identifier)?.children[0] as Paragraph;
      out.push(
        <Note key={`n${n}`} n={n}>
          {inline(para.children, hrefFor)}
        </Note>,
      );
    }
  });
  return <>{out}</>;
}

function footnoteRefs(node: Node): FootnoteReference[] {
  if (node.type === "footnoteReference") return [node as FootnoteReference];
  return "children" in node ? (node.children as Node[]).flatMap(footnoteRefs) : [];
}

function href(url: string, children: ReactNode, key: string): ReactNode {
  return url.startsWith("/") ? (
    <Link key={key} href={url}>
      {children}
    </Link>
  ) : (
    <a key={key} href={url}>
      {children}
    </a>
  );
}

function blocks(nodes: RootContent[], hrefFor: HrefFor): ReactNode[] {
  return nodes.map((node, i) => block(node, `b${i}`, hrefFor));
}

function block(node: RootContent, key: string, hrefFor: HrefFor): ReactNode {
  switch (node.type) {
    case "paragraph":
      return <p key={key}>{inline(node.children, hrefFor)}</p>;
    case "heading": {
      const H = node.depth === 2 ? "h2" : "h3";
      return <H key={key}>{inline(node.children, hrefFor)}</H>;
    }
    case "list": {
      const items = node.children.map((item, i) => (
        <li key={i}>
          {node.spread || item.spread
            ? blocks(item.children, hrefFor)
            : item.children.map((c, j) => (c.type === "paragraph" ? inline(c.children, hrefFor) : block(c, `c${j}`, hrefFor)))}
        </li>
      ));
      return node.ordered ? (
        <ol key={key} start={node.start != null && node.start !== 1 ? node.start : undefined}>
          {items}
        </ol>
      ) : (
        <ul key={key}>{items}</ul>
      );
    }
    case "blockquote": {
      const only = node.children.length === 1 && node.children[0].type === "paragraph" ? node.children[0] : undefined;
      const children = only ? inline(only.children, hrefFor) : blocks(node.children, hrefFor);
      return node.data?.pull ? (
        <blockquote key={key} className={s.pull}>
          {children}
        </blockquote>
      ) : (
        <blockquote key={key}>{only ? <p>{children}</p> : children}</blockquote>
      );
    }
    case "code":
      return (
        <pre key={key}>
          <code>{node.value}</code>
        </pre>
      );
    case "thematicBreak":
      return <hr key={key} />;
    case "graphic": {
      const g = graphics[node.name];
      const className = [g.figureClass, node.wide && s.wide].filter(Boolean).join(" ") || undefined;
      const figure = (
        <figure key={key} className={className}>
          {g.render(node.props)}
          {node.caption && node.captionAt === "below" && <figcaption className={`${s.cap} ${s.capBelow}`}>{node.caption}</figcaption>}
        </figure>
      );
      if (!node.caption || node.captionAt === "below") return figure;
      return [
        figure,
        <Aside key={`${key}c`} className={s.cap}>
          {node.caption}
        </Aside>,
      ];
    }
    default:
      // notes.ts lets nothing else through.
      throw new Error(`NoteBody: unexpected ${node.type}`);
  }
}

function inline(nodes: PhrasingContent[], hrefFor: HrefFor): ReactNode[] {
  return nodes.map((node, i) => {
    const key = `i${i}`;
    switch (node.type) {
      case "text":
        return node.value;
      case "emphasis":
        return <em key={key}>{inline(node.children, hrefFor)}</em>;
      case "strong":
        return <strong key={key}>{inline(node.children, hrefFor)}</strong>;
      case "inlineCode":
        return <code key={key}>{node.value}</code>;
      case "break":
        return <br key={key} />;
      case "link":
        return href(node.url, inline(node.children, hrefFor), key);
      case "footnoteReference":
        return <NoteRef key={key} n={node.data?.n ?? 0} />;
      case "wikiLink": {
        const to = hrefFor(node.id);
        return to ? href(to, node.value, key) : node.value;
      }
      default:
        throw new Error(`NoteBody: unexpected ${node.type}`);
    }
  });
}
