import type { Metadata } from "next";
import HostedPage from "@/components/margins/HostedPage";
import { bySlug, hosted } from "@/lib/catalog";

type Params = { slug: string };

// Static export: every hosted essay is known at build time, and nothing else exists.
export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return hosted("/writing").map((e) => ({ slug: e.url.slice("/writing/".length) }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const entry = bySlug("/writing", (await params).slug);
  return entry ? { title: entry.title, description: entry.summary } : {};
}

export default async function WritingPost({ params }: { params: Promise<Params> }) {
  return <HostedPage section="/writing" slug={(await params).slug} />;
}
