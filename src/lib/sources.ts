// Link helpers safe for client components. Kept out of catalog.ts, which reads notes from disk and is server-only.
import type { Source } from "@/content/schema";

export function isExternal(url: string): boolean {
  return url.startsWith("https://");
}

const SOURCE_LABEL: Record<Source, string> = {
  here: "Here",
  substack: "Substack",
  medium: "Medium",
  github: "GitHub",
  telos: "Telos Brothers",
  other: "Elsewhere",
};

export function sourceLabel(source: Source): string {
  return SOURCE_LABEL[source];
}
