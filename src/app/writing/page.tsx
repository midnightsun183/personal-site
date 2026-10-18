import type { Metadata } from "next";
import EntryList from "@/components/margins/EntryList";
import PageTitle from "@/components/margins/PageTitle";
import { writing } from "@/lib/catalog";
import s from "@/components/margins/margins.module.css";

export const metadata: Metadata = {
  title: "Writing",
  description: "Everything I've written, wherever it was published.",
};

export default function WritingIndex() {
  const entries = writing();
  return (
    <>
      <PageTitle dek="Everything I've written, newest first. Most of it lives on Substack and Medium; the margin says where.">
        Writing
      </PageTitle>
      {entries.length ? <EntryList entries={entries} /> : <p className={s.lede}>Nothing here yet.</p>}
    </>
  );
}
