// The home page map (docs/design/home-map.md). Read only through src/lib/catalog.ts.
//
// It works like an Obsidian graph: themes are nodes, every piece links to the themes it touches, and pieces that
// share a theme end up in one web. A theme only appears once a published piece uses it, and a theme with one piece
// is its own small web.
//
// Rules for everything in this file:
// - High-level only: no figures, no client names, no identifying project details, even if cleared elsewhere.
// - Never name the school. "A bilingual school" at most.
// - The forecasting system stays off the site entirely.
// - Platforms (Snowflake, ServiceNow, Python...) are never nodes or themes.
//
// `planned` nodes and their links don't render. Every summary, and every theme assignment, is a first pass for
// Corey to rewrite.
import type { MapEdge, MapNodeInput, Theme } from "./schema.ts";

export const themeLabels: Record<Theme, string> = {
  reporting: "Reporting",
  data: "Data",
  operations: "Operations",
  building: "Building things",
  teaching: "Teaching",
  language: "Language",
  expertise: "Expertise",
  places: "Places",
};

export const mapNodes: MapNodeInput[] = [
  {
    id: "telos-brothers",
    kind: "venture",
    themes: ["reporting"],
    weight: "heavy",
    entryId: "telos-brothers",
    summary: "Placeholder: what Telos Brothers is, in a sentence or two.",
    status: "published",
    placeholder: true,
  },
  { id: "reporting-overhaul", label: "Automating a global manager's client reporting", kind: "case study", themes: ["reporting"], weight: "normal", summary: "Placeholder: replacing a manual reporting process with one that runs itself.", status: "planned", placeholder: true },
  { id: "stalled-implementation", label: "Getting a stalled implementation moving", kind: "case study", themes: ["reporting"], weight: "normal", summary: "Placeholder: what it took to restart a project that had stopped.", status: "planned", placeholder: true },
  { id: "factsheet", label: "How a factsheet gets built", kind: "explainer", themes: ["reporting", "data"], weight: "normal", summary: "Placeholder: the steps between raw data and a finished factsheet.", status: "planned", placeholder: true },
  { id: "manual-cost", label: "What manual reporting costs", kind: "tool", themes: ["reporting"], weight: "normal", summary: "Placeholder: a way to see the time a manual process really takes.", status: "planned", placeholder: true },
  { id: "data-blocks", label: "Data blocks", kind: "explainer", themes: ["reporting", "data"], weight: "normal", summary: "Placeholder: building reports from small, checked pieces of data.", status: "planned", placeholder: true },

  { id: "procedures", label: "Procedures, written by the people who run them", kind: "essay", themes: ["operations", "teaching"], weight: "normal", summary: "Placeholder: why the best procedures come from the people doing the work.", status: "planned", placeholder: true },
  { id: "reactor-chemistry", label: "What reactor chemistry taught me about data", kind: "essay", themes: ["operations", "data"], weight: "normal", summary: "Placeholder: sampling and specs in a reactor plant, and why they look like validating data.", status: "planned", placeholder: true },
  { id: "plant-monitoring", label: "Running plants from a screen away", kind: "essay", themes: ["operations"], weight: "normal", summary: "Placeholder: watching physical systems through numbers.", status: "planned", placeholder: true },

  { id: "maker-projects", label: "Arduino and Raspberry Pi projects", kind: "project", themes: ["building"], weight: "normal", summary: "Placeholder: small hardware projects, built for the fun of it.", status: "planned", placeholder: true },
  { id: "image-generation", label: "Image generation experiments", kind: "project", themes: ["building"], weight: "normal", summary: "Placeholder: what I tried, and what I learned from it.", status: "planned", placeholder: true },
  { id: "vault-skills", label: "Obsidian vault skills", kind: "download", themes: ["building"], weight: "normal", summary: "Placeholder: tools for keeping a notes vault useful.", status: "planned", placeholder: true },

  {
    id: "experts",
    label: "Experts",
    kind: "book",
    themes: ["expertise"],
    weight: "heavy",
    summary: "Placeholder: what the book is about.",
    linkLabel: "In progress.",
    status: "published",
    placeholder: true,
  },
  { id: "unrecorded", label: "Unrecorded isn't absent", kind: "essay", themes: ["expertise"], weight: "normal", summary: "Placeholder: knowledge that never got written down still exists.", status: "planned", placeholder: true },
  { id: "credential-vs-record", label: "Credential vs. track record", kind: "explainer", themes: ["expertise"], weight: "normal", summary: "Placeholder: what a credential says, and what a record of work says.", status: "planned", placeholder: true },

  {
    id: "second-lengua",
    label: "Second Lengua",
    kind: "venture",
    themes: ["language"],
    weight: "heavy",
    summary: "Placeholder: what Second Lengua is, in a sentence or two.",
    status: "published",
    placeholder: true,
  },
  { id: "learning-spanish", label: "Learning Spanish as an adult", kind: "essay", themes: ["language"], weight: "normal", summary: "Placeholder: learning a language late, on purpose.", status: "planned", placeholder: true },
  { id: "bilingual-classroom", label: "Teaching in a bilingual classroom", kind: "essay", themes: ["teaching", "language"], weight: "normal", summary: "Placeholder: teaching at a bilingual school, and mostly being taught.", status: "planned", placeholder: true },

  {
    id: "same-latitude",
    kind: "essay",
    themes: ["places"],
    weight: "normal",
    entryId: "same-latitude-different-ocean",
    summary: "Mallorca and Maryland sit on almost the same line around the globe. It took moving to notice.",
    status: "published",
    placeholder: true,
  },
  {
    id: "writing",
    label: "Writing",
    kind: "hub",
    weight: "normal",
    href: "/writing",
    linkLabel: "All writing",
    summary: "Everything I've written, wherever it was published.",
    status: "published",
  },
];

// Direct links between pieces, for connections that cross themes. Pieces that share a theme are already joined
// through it, so they don't need a link here.
export const mapEdges: MapEdge[] = [
  ["procedures", "reporting-overhaul"], // written procedures, and the runbooks clients now operate from
  ["plant-monitoring", "manual-cost"],
  ["procedures", "experts"],
  ["bilingual-classroom", "experts"],
  ["learning-spanish", "same-latitude"],
  ["vault-skills", "unrecorded"],
  ["maker-projects", "plant-monitoring"],
  ["writing", "experts"],
  ["writing", "same-latitude"],
];
