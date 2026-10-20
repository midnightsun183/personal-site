"use client";

// The home page map (docs/design/home-map.md, docs/design/home-graph-plan.md).
//
//   server render / no JS / under 720px ──▶ MapList (grouped by theme, crawlable)
//   wide screen with JS                  ──▶ MapGraph (Pixi, loaded on demand), with "View as a list" before it
//
//   mode (graph.ts):  loading ──ready──▶ graph ⇄ list        loading | graph ──fail──▶ failed (the list)
//
// The mode is mirrored to <html data-map>, which map.module.css reads, so the server-rendered list can hide and the
// graph's height can be held before any of this runs:
//   <html data-js> (inline script in layout.tsx), no data-map or "loading" ─▶ list hidden, space reserved
//   data-map="graph" ─▶ graph shown      "list" | "failed" ─▶ list shown
//   The inline script sets "failed" after 4 s if the map is still loading, so a page whose JS never runs, or a Pixi
//   download that hangs, still shows the list.

import dynamic from "next/dynamic";
import { useEffect, useMemo, useReducer, useState, type CSSProperties } from "react";
import { EntryLink } from "./EntryList";
import { KIND_LABEL, neighborsOf, nextMode, type Mode } from "./graph";
import type { MapView, MapViewNode } from "@/lib/mapView";
import m from "./map.module.css";

const WIDE = "(min-width: 720px)";

const MapGraph = dynamic(() => import("./MapGraph"), { ssr: false });

/** The graph's height: a small web doesn't need the full height; it grows with the map, up to a cap. */
function graphHeight(nodes: number): string {
  return `${Math.min(760, Math.max(480, 240 + nodes * 24))}px`;
}

export default function HomeMap({ view }: { view: MapView }) {
  const [wide, setWide] = useState(false);
  const [mode, dispatch] = useReducer(nextMode, "loading" as Mode);
  const graphable = view.showField;

  useEffect(() => {
    const mq = matchMedia(WIDE);
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Mirror the mode to <html> for the CSS. React's dev remount clears attributes on <html>, so data-js is set here
  // too (the inline script sets it first in production). A "failed" set by the inline script's timeout stays until
  // the graph is actually ready.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-js", "");
    const value = graphable ? mode : "list";
    if (value !== "loading" || root.getAttribute("data-map") !== "failed") root.setAttribute("data-map", value);
  }, [mode, graphable]);
  useEffect(() => () => document.documentElement.removeAttribute("data-map"), []);

  const showGraph = graphable && wide && (mode === "loading" || mode === "graph");

  return (
    <div className={m.map} data-home-map="" style={{ "--graph-h": graphHeight(view.nodes.length) } as CSSProperties}>
      {graphable && (
        <p className={m.viewToggle}>
          <button type="button" className={m.walk} onClick={() => dispatch(mode === "list" ? "toGraph" : "toList")}>
            {mode === "list" ? "View as a graph" : "View as a list"}
          </button>
        </p>
      )}
      <div className={m.stage}>
        {showGraph && (
          <MapGraph
            view={view}
            onReady={() => dispatch("ready")}
            onFail={(reason) => {
              console.warn(`Home map: showing the list instead of the graph (${reason}).`);
              dispatch("fail");
            }}
          />
        )}
      </div>
      <MapList view={view} />
    </div>
  );
}

/** The map as a list, grouped by theme. The server renders this, and it's what phones and no-JS visitors get. */
function MapList({ view }: { view: MapView }) {
  const neighbors = useMemo(() => neighborsOf(view.edges), [view.edges]);
  const labelOf = useMemo(() => new Map(view.nodes.map((n) => [n.id, n.label])), [view.nodes]);
  const byId = useMemo(() => new Map(view.nodes.map((n) => [n.id, n])), [view.nodes]);
  const themes = view.nodes.filter((n) => n.kind === "theme");
  const ungrouped = view.nodes.filter((n) => !n.group);

  const item = (n: MapViewNode, inTheme?: string) => {
    // The theme a piece is listed under is its heading; "Connects to" names everything else.
    const others = (neighbors.get(n.id) ?? []).filter((id) => id !== inTheme);
    return (
      <div key={n.id} id={`map-${n.id}`} className={m.listItem}>
        <h3 className={m.listTitle}>{n.href ? <EntryLink href={n.href}>{n.label}</EntryLink> : n.label}</h3>
        <p className={m.kind}>
          {KIND_LABEL[n.kind]}
          {n.placeholder && ". Placeholder"}
          {n.planned && ". Not written yet"}
        </p>
        <p className={m.listSummary}>{n.summary}</p>
        {!n.href && n.linkLabel && <p className={m.connects}>{n.linkLabel}</p>}
        {others.length > 0 && (
          <p className={m.connects}>
            Connects to{" "}
            {others.map((id, i) => (
              <span key={id}>
                <a href={`#map-${id}`}>{labelOf.get(id)}</a>
                {i < others.length - 1 ? ", " : "."}
              </span>
            ))}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className={m.list}>
      {themes.map((theme) => (
        <section key={theme.id} id={`map-${theme.id}`} className={m.listTheme} aria-labelledby={`map-${theme.id}-h`}>
          <h2 className={m.listThemeTitle} id={`map-${theme.id}-h`}>
            {theme.label}
          </h2>
          {theme.facts?.[0] && (
            <p className={m.listFact}>
              <span className={m.factLead}>Did you know?</span> {theme.facts[0].text}{" "}
              <span className={m.factSource}>
                (<a href={theme.facts[0].url}>Wikipedia</a>)
              </span>
            </p>
          )}
          {view.nodes.filter((n) => n.group === theme.group && n.kind !== "theme").map((n) => item(n, theme.id))}
          {(() => {
            // Pieces listed in full under another theme: name them here and link to that entry.
            const elsewhere = (neighbors.get(theme.id) ?? []).filter((id) => byId.get(id)?.group !== theme.group);
            return elsewhere.length > 0 ? (
              <p className={m.connects}>
                {theme.group && view.nodes.some((n) => n.group === theme.group && n.kind !== "theme") ? "Also here: " : "Here: "}
                {elsewhere.map((id, i) => (
                  <span key={id}>
                    <a href={`#map-${id}`}>{labelOf.get(id)}</a>
                    {i < elsewhere.length - 1 ? ", " : "."}
                  </span>
                ))}
              </p>
            ) : null;
          })()}
        </section>
      ))}
      {ungrouped.length > 0 && <section className={m.listTheme}>{ungrouped.map((n) => item(n))}</section>}
    </div>
  );
}
