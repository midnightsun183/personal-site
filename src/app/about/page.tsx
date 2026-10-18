import type { Metadata } from "next";
import Link from "next/link";
import PageTitle from "@/components/margins/PageTitle";
import s from "@/components/margins/margins.module.css";

export const metadata: Metadata = {
  title: "About",
  description: "The Navy, finance, Mallorca, Maryland, and where I'm headed.",
};

// Placeholder copy: confirm the details before launch. Keep it true for a year; no "currently" or "these days".
export default function AboutPage() {
  return (
    <>
      <PageTitle>About</PageTitle>
      <div className={s.about}>
        <p>
          I started out on nuclear reactors in the Navy, then spent years around investment firms making the numbers
          behave. I&apos;ve lived in Mallorca and taught at a bilingual school, where the kids were braver with languages
          than I was. Now I&apos;m back on the East Coast, in Maryland.
        </p>
        <p>
          Outside of work I build computers I don&apos;t strictly need, read slower than I&apos;d like, and keep a running
          list of words that don&apos;t translate.
        </p>
        <h2 className={s.sec}>Where I&apos;m going</h2>
        <p>Placeholder: a few sentences on what I&apos;m working toward over the next few years.</p>
        <p>
          If something here is useful, or wrong, <Link href="/contact">write to me</Link>.
        </p>
      </div>
    </>
  );
}
