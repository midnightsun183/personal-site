import type { ComponentType, ReactNode } from "react";
import SameLatitudeDifferentOcean from "./posts/same-latitude-different-ocean";
import TelosBrothers from "./work/telos-brothers";

// Page bodies for entries hosted on this site, keyed by the entry's url. Metadata lives in catalog.ts.
const bodies: Record<string, ComponentType> = {
  "/writing/same-latitude-different-ocean": SameLatitudeDifferentOcean,
  "/work/telos-brothers": TelosBrothers,
};

/** The rendered body for a hosted entry, or undefined when there isn't one. */
export function hostedBody(url: string): ReactNode | undefined {
  const Body = bodies[url];
  return Body ? <Body /> : undefined;
}
