// Fails (exit 1) when the snapshot is invalid, or when a configured feed has never synced or is older than
// STALE_AFTER_DAYS. Runs before every build (npm "prebuild") and weekly in .github/workflows/sync.yml, so a
// sync that quietly stopped running turns into a failed build and an email instead of a stale site.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { STALE_AFTER_DAYS, Snapshot } from "../../src/content/schema.ts";
import { configured, type FeedSource } from "./sources.ts";

/** Problems with the snapshot, as messages. Empty means healthy. `now` is a parameter so it can be tested. */
export function staleness(snapshot: Snapshot, sources: FeedSource[], now: Date): string[] {
  const problems: string[] = [];
  for (const s of sources) {
    const block = snapshot.sources[s.id];
    if (!block) {
      problems.push(`${s.id}: configured but never synced. Run "npm run sync" or the Sync feeds workflow.`);
      continue;
    }
    const days = (now.getTime() - Date.parse(block.fetchedAt)) / 86_400_000;
    if (days > STALE_AFTER_DAYS) {
      problems.push(`${s.id}: last synced ${Math.floor(days)} days ago (limit ${STALE_AFTER_DAYS}). Check the Sync feeds workflow.`);
    }
  }
  return problems;
}

// Run as a script (not when imported for its function).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const parsed = Snapshot.safeParse(JSON.parse(readFileSync(new URL("../../src/content/snapshot.json", import.meta.url), "utf8")));
  if (!parsed.success) {
    console.error(`snapshot.json is invalid:\n${parsed.error.message}`);
    process.exit(1);
  }
  const problems = staleness(parsed.data, configured(), new Date());
  if (problems.length) {
    console.error(`Feed snapshot check failed:\n- ${problems.join("\n- ")}`);
    process.exit(1);
  }
  console.log(`Feed snapshot OK (${configured().length} configured source${configured().length === 1 ? "" : "s"}).`);
}
