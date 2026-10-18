import type { Metadata } from "next";
import HostedPage from "@/components/margins/HostedPage";
import { bySlug, hosted } from "@/lib/catalog";

type Params = { slug: string };

// Static export: every case study is known at build time, and nothing else exists.
export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return hosted("/work").map((e) => ({ slug: e.url.slice("/work/".length) }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const entry = bySlug("/work", (await params).slug);
  return entry ? { title: entry.title, description: entry.summary } : {};
}

export default async function WorkPage({ params }: { params: Promise<Params> }) {
  return <HostedPage section="/work" slug={(await params).slug} />;
}
