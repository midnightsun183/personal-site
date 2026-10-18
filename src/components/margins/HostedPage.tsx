import Link from "next/link";
import { notFound } from "next/navigation";
import { bySlug } from "@/lib/catalog";
import { longDate } from "@/lib/dates";
import { hostedBody } from "@/content/hosted";
import s from "./margins.module.css";

type Section = "/work" | "/writing";

const ALL_LABEL: Record<Section, string> = { "/work": "All work", "/writing": "All writing" };

/** A page hosted on this site (a case study or an interactive essay): title, date in the gutter, body, way out. */
export default function HostedPage({ section, slug }: { section: Section; slug: string }) {
  const entry = bySlug(section, slug);
  const body = entry && hostedBody(entry.url);
  if (!entry || !body) notFound();

  return (
    <>
      <h1 className={s.postTitle}>{entry.title}</h1>
      {entry.summary && <p className={s.postDek}>{entry.summary}</p>}
      <p className={`${s.gutter} ${s.meta}`}>{longDate(entry.date)}</p>

      <article className={`${s.page} ${s.article}`}>
        {body}
        <div className={s.end}>
          {entry.site && (
            <p>
              <a href={entry.site}>Visit {entry.title}</a>
            </p>
          )}
          <p>
            Thoughts on this? <Link href="/contact">Write to me</Link>.
          </p>
          <p>
            <Link href={section}>{ALL_LABEL[section]}</Link>
          </p>
        </div>
      </article>
    </>
  );
}
