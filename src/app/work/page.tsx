import type { Metadata } from "next";
import EntryList from "@/components/margins/EntryList";
import PageTitle from "@/components/margins/PageTitle";
import { work } from "@/lib/catalog";
import s from "@/components/margins/margins.module.css";

export const metadata: Metadata = {
  title: "Work",
  description: "Ventures and projects, with what each one was for.",
};

export default function WorkIndex() {
  const entries = work();
  return (
    <>
      <PageTitle dek="Ventures and projects, with what each one was for and what came of it.">Work</PageTitle>
      {entries.length ? <EntryList entries={entries} /> : <p className={s.lede}>Nothing here yet.</p>}
    </>
  );
}
