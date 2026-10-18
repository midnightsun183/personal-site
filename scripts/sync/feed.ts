// Fetching and parsing one RSS feed. Substack and Medium both publish RSS 2.0, so one parser covers both.
import { XMLParser } from "fast-xml-parser";

export class FeedHttpError extends Error {
  status: number;
  constructor(status: number, url: string) {
    super(`HTTP ${status} from ${url}`);
    this.status = status;
  }
}

export class FeedParseError extends Error {}

export type RawItem = { title: string; link: string; pubDate: string; description: string; content: string };

const TIMEOUT_MS = 15_000;
const RETRIES = 2;

function retryable(err: unknown): boolean {
  if (err instanceof FeedHttpError) return err.status === 429 || err.status >= 500;
  return true; // network errors and timeouts
}

/** GET a feed as text. Retries twice with backoff on network errors, timeouts, 429 and 5xx. */
export async function fetchFeed(url: string): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 2000 * attempt));
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "user-agent": "coreymacdonald.com feed sync" },
      });
      if (!res.ok) throw new FeedHttpError(res.status, url);
      return await res.text();
    } catch (err) {
      lastErr = err;
      if (!retryable(err)) break;
    }
  }
  throw lastErr;
}

const parser = new XMLParser({ ignoreAttributes: true, processEntities: true, htmlEntities: true });

function text(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return "";
}

/** RSS 2.0 items. Throws FeedParseError when the body isn't an RSS feed (e.g. an HTML error page sent with 200). */
export function parseFeed(xml: string): RawItem[] {
  let doc: unknown;
  try {
    doc = parser.parse(xml);
  } catch (err) {
    throw new FeedParseError(`Not XML: ${(err as Error).message}`);
  }
  const channel = (doc as { rss?: { channel?: { item?: unknown } } })?.rss?.channel;
  if (!channel) throw new FeedParseError("No <rss><channel> in the response");
  const items = channel.item === undefined ? [] : Array.isArray(channel.item) ? channel.item : [channel.item];
  return items.map((raw) => {
    const i = raw as Record<string, unknown>;
    return {
      title: text(i.title),
      link: text(i.link),
      pubDate: text(i.pubDate),
      description: text(i.description),
      content: text(i["content:encoded"]),
    };
  });
}
