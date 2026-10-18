import Note, { Aside } from "@/components/margins/Note";
import NoteRef from "@/components/margins/NoteRef";
import DaylightChart from "@/components/margins/DaylightChart";
import ParallelMap from "@/components/margins/ParallelMap";
import s from "@/components/margins/margins.module.css";

// Sample post. The copy is placeholder written for the design; rewrite in your own words.
export default function SameLatitudeDifferentOcean() {
  return (
    <>
      <p>
        Before the move I pulled up a map to see how far I was really going, and noticed something I&apos;d never
        bothered to check. Palma sits at 39.57° north. Laurel, Maryland, sits at 39.10°. If you walked due west from
        the cathedral in Palma and somehow kept your feet dry, you&apos;d pass about thirty miles north of where
        I&apos;m unpacking now.
        <NoteRef n={1} />
      </p>
      <Note n={1}>A degree of latitude is roughly 69 miles, so half a degree is a long afternoon&apos;s drive.</Note>

      <figure className={`${s.map} ${s.wide}`}>
        <ParallelMap />
        <figcaption className={`${s.cap} ${s.capBelow}`}>
          Not to scale. Drawn freehand, like most of my maps.
        </figcaption>
      </figure>

      <p>
        Same latitude means the same sun. The longest day of the year is the same length in both places, within a few
        minutes. Winter afternoons go dark at the same point in the season. On paper, nothing about the light should
        feel different.
      </p>
      <p>
        It does, though. Mallorca&apos;s light comes off limestone and the Mediterranean, which is clear and salty and
        has almost no tide.
        <NoteRef n={2} /> Maryland&apos;s comes through humidity and trees, off a bay that&apos;s brackish,
        brown-green, and moves twice a day.
      </p>
      <Note n={2}>A few inches, most days. The Chesapeake moves about a foot.</Note>

      <blockquote className={s.pull}>&ldquo;Same angle of sun, completely different material for it to land on.&rdquo;</blockquote>

      <h2>Six hours</h2>
      <p>
        The bigger change is the clock. Palma runs six hours ahead of the East Coast, and for years my working day was
        split around that gap: mornings for Spain, afternoons and evenings for clients in New York.
        <NoteRef n={3} /> Now the gap runs the other way. The people I call before breakfast are the ones I used to
        call after dinner.
      </p>
      <Note n={3}>
        Except for a week or two each spring and fall, when Europe and the US change their clocks on different dates
        and the gap shrinks to five hours.
      </Note>

      <figure>
        <DaylightChart />
      </figure>
      <Aside className={s.cap}>
        Hours of daylight through the year. Solid line Palma, dashed Laurel. Drag to see how little they disagree.
      </Aside>

      <p>
        I spent years in the Navy standing watches, where the day is cut into four-hour pieces and nobody much cares
        whether it&apos;s light outside. It made me bad at noticing seasons. Moving along a line of latitude, instead
        of across it, turns out to be a good way to start noticing again.
      </p>

      <figure>
        <div className={s.photo}>Photo slot, harbor at golden hour</div>
      </figure>
      <Aside className={`${s.cap} ${s.capEnd}`}>
        Captions sit in the margin on wide screens and under the photo on phones.
      </Aside>

      <p>So: same sun, different ocean, six hours. I&apos;ll write more as the boxes get emptied.</p>
    </>
  );
}
