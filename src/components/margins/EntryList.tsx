import type { ReactNode } from "react";
import Link from "next/link";
import { Aside } from "./Note";
import { isExternal, sourceLabel } from "@/lib/catalog";
import { monthYear } from "@/lib/dates";
import type { Entry } from "@/content/schema";
import s from "./margins.module.css";

/** A link that's a client-side Link for pages here and a plain anchor (same tab) for everything else. */
export function EntryLink({ href, children }: { href: string; children: ReactNode }) {
  return isExternal(href) ? <a href={href}>{children}</a> : <Link href={href}>{children}</Link>;
}

/** What the margin says about an entry: where it lives, anything else Corey noted, and whether it's a placeholder. */
function MarginNote({ entry }: { entry: Entry }) {
  const where = entry.source === "here" ? null : `On ${sourceLabel(entry.source)}.`;
  return (
    <Aside className={s.entryNote}>
      {where}
      {entry.alsoAt.map((a) => (
        <span key={a.url}>
          {" "}
          Also on <a href={a.url}>{sourceLabel(a.source)}</a>.
        </span>
      ))}
      {entry.note && <> {entry.note}</>}
      {entry.site && (
        <>
          {" "}
          <a href={entry.site}>{entry.site.replace(/^https:\/\/(www\.)?/, "").replace(/\/$/, "")}</a>
        </>
      )}
      {entry.placeholder && <> Placeholder.</>}
    </Aside>
  );
}

/** Entries as dated rows: month in the gutter, title and summary in the text column, the note in the margin. */
export default function EntryList({ entries, headingLevel = 2 }: { entries: Entry[]; headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? "h2" : "h3";
  return entries.map((entry) => (
    <div className={s.contents} key={entry.id}>
      <p className={`${s.gutter} ${s.entryWhen}`}>{monthYear(entry.date)}</p>
      <div className={s.entryBody}>
        <H className={s.entryTitle}>
          <EntryLink href={entry.url}>{entry.title}</EntryLink>
        </H>
        {entry.summary && <p className={s.entryDek}>{entry.summary}</p>}
      </div>
      <MarginNote entry={entry} />
    </div>
  ));
}
