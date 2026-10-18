// Pulls every configured feed into src/content/snapshot.json. Run by .github/workflows/sync.yml, or `npm run sync`.
//
//   for each source:  fetch ─▶ parse ─▶ toEntries ─▶ sanity checks ─┬─▶ replace that source's block
//                       │        │                     │             │
//                       └────────┴──── any error ──────┘             └─ unchanged and recent? leave it alone
//                                         │
//                                         ▼
//                         keep last good block, mark the run failed
//
// Sources that worked are written even when another failed; the run then exits 1 so GitHub emails the failure.
// fetchedAt is refreshed when data changes, or every HEARTBEAT_DAYS otherwise. That heartbeat keeps the
// staleness check honest, and its commits keep GitHub from disabling the schedule on a quiet repo.
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { Snapshot, type Entry } from "../../src/content/schema.ts";
import { fetchFeed, parseFeed } from "./feed.ts";
import { toEntries, type Dropped } from "./normalize.ts";
import { SOURCES, configured } from "./sources.ts";

const SNAPSHOT_PATH = new URL("../../src/content/snapshot.json", import.meta.url);
const HEARTBEAT_DAYS = 3;
const MAX_SHRINK = 0.5;

class EmptyFeedError extends Error {}
class SuspiciousShrinkError extends Error {}

type Row = { id: string; result: string; fetched?: number; added?: number; removed?: number; dropped: Dropped[] };

function byDateDesc(a: Entry, b: Entry) {
  return b.date.localeCompare(a.date) || a.id.localeCompare(b.id);
}

async function main() {
  const now = new Date();
  const raw = readFileSync(SNAPSHOT_PATH, "utf8");
  const prev = Snapshot.parse(JSON.parse(raw));
  const next: Snapshot = { sources: {} };
  const rows: Row[] = [];
  let failed = false;

  // Blocks for sources that are no longer in the config are dropped; blocks for configured ones start as last good.
  for (const s of SOURCES) if (s.feed && prev.sources[s.id]) next.sources[s.id] = prev.sources[s.id];

  for (const src of configured()) {
    const before = prev.sources[src.id];
    try {
      const items = parseFeed(await fetchFeed(src.feed));
      const { entries, dropped } = toEntries(items, src.source);
      entries.sort(byDateDesc);

      if (entries.length === 0) throw new EmptyFeedError(`0 usable items (${items.length} in the feed)`);
      const prevCount = before?.entries.length ?? 0;
      if (prevCount > 0 && entries.length < prevCount * (1 - MAX_SHRINK)) {
        throw new SuspiciousShrinkError(`${entries.length} items, down from ${prevCount}`);
      }

      const changed = JSON.stringify(entries) !== JSON.stringify(before?.entries ?? []);
      const ageDays = before ? (now.getTime() - Date.parse(before.fetchedAt)) / 86_400_000 : Infinity;
      if (changed || ageDays >= HEARTBEAT_DAYS) next.sources[src.id] = { fetchedAt: now.toISOString(), entries };

      const oldUrls = new Set(before?.entries.map((e) => e.url));
      const newUrls = new Set(entries.map((e) => e.url));
      rows.push({
        id: src.id,
        result: changed ? "updated" : ageDays >= HEARTBEAT_DAYS ? "unchanged (heartbeat)" : "unchanged",
        fetched: items.length,
        added: entries.filter((e) => !oldUrls.has(e.url)).length,
        removed: [...oldUrls].filter((u) => !newUrls.has(u)).length,
        dropped,
      });
    } catch (err) {
      failed = true;
      const e = err as Error;
      rows.push({ id: src.id, result: `FAILED, kept last good data: ${e.constructor.name}: ${e.message}`, dropped: [] });
    }
  }

  const out = `${JSON.stringify(next, null, 2)}\n`;
  if (out !== raw) writeFileSync(SNAPSHOT_PATH, out);

  report(rows, out !== raw);
  if (configured().length === 0) console.log("No feeds configured in scripts/sync/sources.ts. Nothing to do.");
  process.exitCode = failed ? 1 : 0;
}

/** A markdown summary on the GitHub run page (or stdout locally): what each source did and why items were dropped. */
function report(rows: Row[], wrote: boolean) {
  const lines = [
    "## Feed sync",
    "",
    "| Source | Result | In feed | Added | Removed | Dropped |",
    "|---|---|---|---|---|---|",
    ...rows.map((r) => `| ${r.id} | ${r.result} | ${r.fetched ?? "-"} | ${r.added ?? "-"} | ${r.removed ?? "-"} | ${r.dropped.length} |`),
    "",
    wrote ? "snapshot.json changed." : "snapshot.json unchanged.",
  ];
  for (const r of rows) for (const d of r.dropped) lines.push(`- Dropped from ${r.id}: "${d.title}" (${d.reason})`);
  const md = lines.join("\n");
  console.log(md);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${md}\n`);
}

await main();
