// src/app/page.tsx
// One line, the map of everything (docs/design/home-map.md), then the latest writing.
import Link from "next/link";
import EntryList from "@/components/margins/EntryList";
import HomeMap from "@/components/margins/HomeMap";
import { mapData, writing } from "@/lib/catalog";
import s from "@/components/margins/margins.module.css";

export default function Home() {
  const map = mapData();
  const latest = writing().slice(0, 4);

  return (
    <>
      <h1 className="sr-only">Corey MacDonald</h1>

      {/* Placeholder: one line in Corey's voice. Keep it true for a year, no "currently". */}
      <p className={s.mapLine}>Placeholder: one line about what ties all of this together.</p>

      <HomeMap view={map} />

      {latest.length > 0 && (
        <section className={s.page} aria-labelledby="writing-h">
          <h2 className={s.sec} id="writing-h">
            Latest writing
          </h2>
          <EntryList entries={latest} headingLevel={3} />
          <p className={s.moreLink}>
            <Link href="/writing">All writing</Link>
          </p>
        </section>
      )}
    </>
  );
}
