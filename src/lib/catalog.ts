// The only way pages read content. Everything comes from the notes vault (notes/, read by src/lib/notes.ts), which is
// checked as it loads; a bad note fails the build and the last deploy stays live. Server-only: it reads the disk.
// Client components import link helpers from ./sources and types from here, never values.
import "server-only";
import path from "node:path";
import type { Root } from "mdast";
import type { Entry } from "@/content/schema";
import { buildMapView, type MapView } from "./mapView";
import { loadVault, type PieceNote, type Vault } from "./notes";

export type { MapView, MapViewNode } from "./mapView";

const NOTES_DIR = path.join(process.cwd(), "notes");

/** `next dev` also shows draft and planned notes, marked, so they can be checked before publishing. */
const DEV = process.env.NODE_ENV === "development";

type Catalog = { vault: Vault; entries: Entry[]; byId: Map<string, PieceNote> };
let memo: Catalog | undefined;

const visible = (p: PieceNote) => p.status === "published" || DEV;

/** Memoized in production. In dev the vault is re-read on every call, so an edited note shows on refresh. */
function catalog(): Catalog {
  if (memo) return memo;
  const vault = loadVault(NOTES_DIR);
  const entries = vault.pieces
    .filter(visible)
    .flatMap((p) => (p.entry ? [p.entry] : []))
    .sort((a, b) => b.date.localeCompare(a.date));
  const c = { vault, entries, byId: new Map(vault.pieces.map((p) => [p.id, p])) };
  if (!DEV) memo = c;
  return c;
}

export function writing(): Entry[] {
  return catalog().entries.filter((e) => e.kind === "essay");
}

export function work(): Entry[] {
  return catalog().entries.filter((e) => e.kind !== "essay");
}

export function featuredWork(): Entry[] {
  return work().filter((e) => e.featured);
}

/** Entries with a page on this site under `section` (e.g. "/work"), for generateStaticParams. */
export function hosted(section: "/work" | "/writing"): Entry[] {
  return catalog().entries.filter((e) => e.source === "here" && e.url.startsWith(`${section}/`));
}

export function bySlug(section: "/work" | "/writing", slug: string): Entry | undefined {
  return hosted(section).find((e) => e.url === `${section}/${slug}`);
}

/** The prepared body of a page hosted here, for NoteBody. */
export function pageBody(id: string): Root | undefined {
  const p = catalog().byId.get(id);
  return p && visible(p) ? p.body : undefined;
}

/** Where a body wikilink to `id` goes: its page or url, or nothing (plain text) if it has neither or isn't out. */
export function hrefFor(id: string): string | undefined {
  const p = catalog().byId.get(id);
  return p && visible(p) ? (p.entry?.url ?? p.url) : undefined;
}

// ---------- Home page map (docs/design/home-map.md) ----------

/**
 * Preview builds (NEXT_PUBLIC_MAP_PREVIEW=1, never set on Cloudflare) include planned nodes, so the map can be
 * judged with its full inventory before the pieces exist. `next dev` shows them too, plus drafts.
 */
const PREVIEW = process.env.NEXT_PUBLIC_MAP_PREVIEW === "1";

/** The home map: published pieces, plus planned ones in preview builds and dev, plus drafts in dev. */
export function mapData(): MapView {
  return buildMapView(catalog().vault, { planned: PREVIEW || DEV, drafts: DEV });
}
