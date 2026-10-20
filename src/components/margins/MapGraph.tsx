"use client";

// The home map as an Obsidian-style graph (docs/design/home-graph-plan.md), drawn with PixiJS on one canvas.
// HomeMap loads it with next/dynamic on wide screens only; phones, no-JS visitors and keyboard users get MapList.
//
// Adapted from Quartz's graph view (github.com/quartz-community/graph, src/components/scripts/graph.inline.ts):
// its forces, the 2 + sqrt(links) dot size, hover focus that fades everything unconnected, d3-zoom and d3-drag.
//   MIT License. Copyright (c) 2026 Quartz Community. Permission is hereby granted, free of charge, to any person
//   obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software
//   without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute,
//   sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so,
//   subject to the following conditions: The above copyright notice and this permission notice shall be included in
//   all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY
//   KIND, EXPRESS OR IMPLIED.
//
//   mount ─▶ Pixi init (async; unmounted meanwhile ─▶ destroy) ─▶ fonts.ready ─▶ labels ─▶ presettle ─▶ fit ─▶ onReady
//     init throws or WebGL context lost ─▶ onFail (HomeMap shows the list)
//
//   draw() ◀── simulation tick | zoom | hover | theme change | resize   (one per frame at most; idle when settled)
//
//   canvas events (d3-drag is bound before d3-zoom, so a press on a dot drags it and anywhere else pans):
//     press on a dot, moved > 4 px ─▶ drag (neighbors follow)     click ─▶ graph.ts clickAction ─▶ navigate
//     wheel / pinch / drag background ─▶ zoom and pan               pointer move ─▶ hit ─▶ hover ─▶ CardTimer
//
// Positions never go through React. React holds the hovered dot, the card and its fact.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { drag } from "d3-drag";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import { useRouter } from "next/navigation";
import type { Application, Container, Graphics, Text } from "pixi.js";
import { EntryLink } from "./EntryList";
import {
  CardTimer,
  clickAction,
  DRAG_THRESHOLD,
  hit,
  KIND_LABEL,
  labelAlpha,
  neighborsOf,
  press,
  pressMove,
  radius,
  seed,
  type ClickAction,
  type Press,
} from "./graph";
import type { MapView, MapViewNode } from "@/lib/mapView";
import m from "./map.module.css";

// The feel of the graph. Obsidian's names: link distance, repel force, center force.
const LINK_DISTANCE = 60;
const REPEL = -180;
const REPEL_REACH = 400;
const CENTER = 0.06;
/** Space kept around each dot by the collision force. */
const COLLIDE_PAD = 6;
/** Ticks run before the first frame; the rest of the settle is animated (or run at once with reduced motion). */
const PRESETTLE_TICKS = 150;
const SETTLE_TICKS = 300;
/** How hot the simulation runs while a dot is dragged. */
const DRAG_HEAT = 0.3;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;
/** Fitting never zooms in past this, so a small graph doesn't load huge. */
const FIT_MAX = 1.6;
const FIT_PAD = 48;
/** What unconnected dots and lines fade to while something is hovered, and how long the fade takes. */
const DIM_ALPHA = 0.2;
const DIM_MS = 200;
const LABEL_SIZE = 13;
const LABEL_GAP = 4;
const LINE = 1;
const LINE_ACTIVE = 1.75;

type SimNode = SimulationNodeDatum & { id: string; r: number; node: MapViewNode };
type SimLink = SimulationLinkDatum<SimNode>;
type Colors = { paper: string; ink: string; pencil: string; pen: string; rule: string };

function readColors(): Colors {
  const css = getComputedStyle(document.documentElement);
  const get = (name: string) => css.getPropertyValue(name).trim();
  return { paper: get("--paper"), ink: get("--ink"), pencil: get("--pencil"), pen: get("--pen"), rule: get("--rule") };
}

/** Literata's family as next/font named it, plus its fallbacks, from the page's computed font. */
function fontFamilies(): string[] {
  return getComputedStyle(document.body)
    .fontFamily.split(",")
    .map((f) => f.trim().replace(/^["']|["']$/g, ""));
}

type Props = { view: MapView; onReady: () => void; onFail: (reason: string) => void };

export default function MapGraph({ view, onReady, onFail }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [card, setCard] = useState<string | null>(null);
  const [factIndex, setFactIndex] = useState<Record<string, number>>({});
  const cards = useMemo(() => new CardTimer(setCard), []);
  const neighbors = useMemo(() => neighborsOf(view.edges), [view.edges]);
  const byId = useMemo(() => new Map(view.nodes.map((n) => [n.id, n])), [view.nodes]);
  /** Set by the Pixi effect: places the card beside its dot, and pans to a dot (from the card's "Connects to"). */
  const api = useRef<{ placeCard: () => void; panTo: (id: string) => void } | null>(null);
  const callbacks = useRef({ onReady, onFail, router, cards });
  useLayoutEffect(() => {
    callbacks.current = { onReady, onFail, router, cards };
  });

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    let cancelled = false;
    let teardown = () => {};
    start(box, view, neighbors, callbacks, api, () => cancelled)
      .then((stop) => {
        if (cancelled) stop();
        else teardown = stop;
      })
      .catch((err: unknown) => {
        if (!cancelled) callbacks.current.onFail(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
      teardown();
    };
  }, [view, neighbors]);

  useEffect(() => () => cards.dispose(), [cards]);

  // Place the card as it opens, and close it on Esc.
  useLayoutEffect(() => {
    api.current?.placeCard();
    if (!card) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cards.close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [card, cards]);

  const cardNode = card ? byId.get(card) : undefined;
  return (
    <div ref={boxRef} className={m.graph} data-card={card ?? undefined}>
      {cardNode && (
        <Panel
          node={cardNode}
          factIndex={factIndex[cardNode.id] ?? 0}
          onNextFact={() =>
            setFactIndex((f) => ({ ...f, [cardNode.id]: ((f[cardNode.id] ?? 0) + 1) % (cardNode.facts?.length || 1) }))
          }
          neighbors={(neighbors.get(cardNode.id) ?? []).flatMap((id) => byId.get(id) ?? [])}
          onWalk={(id) => {
            api.current?.panTo(id);
            cards.tap(id);
          }}
          onHover={(on) => cards.cardHover(on)}
          onClose={() => cards.close()}
        />
      )}
    </div>
  );
}

type Callbacks = { current: { onReady: () => void; onFail: (reason: string) => void; router: ReturnType<typeof useRouter>; cards: CardTimer } };
type Api = { current: { placeCard: () => void; panTo: (id: string) => void } | null };

/** Builds the Pixi app, simulation and listeners in `box`. Resolves to a function that tears it all down. */
async function start(
  box: HTMLDivElement,
  view: MapView,
  neighbors: Map<string, string[]>,
  callbacks: Callbacks,
  api: Api,
  cancelled: () => boolean,
): Promise<() => void> {
  const PIXI = await import("pixi.js");
  const app: Application = new PIXI.Application();
  await app.init({
    width: box.clientWidth,
    height: box.clientHeight,
    preference: "webgl",
    antialias: true,
    backgroundAlpha: 0,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    autoStart: false,
  });
  if (cancelled()) {
    app.destroy(true, { children: true });
    return () => {};
  }
  await document.fonts?.ready;
  if (cancelled()) {
    app.destroy(true, { children: true });
    return () => {};
  }

  const canvas = app.canvas;
  canvas.setAttribute("aria-hidden", "true");
  canvas.className = m.canvas;
  box.prepend(canvas);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let colors = readColors();
  const families = fontFamilies();

  // ----- Scene: lines and dots scale with zoom (world); labels stay the same size on screen. -----
  const world: Container = new PIXI.Container();
  const lines: Graphics = new PIXI.Graphics();
  const dots: Graphics = new PIXI.Graphics();
  const labelLayer: Container = new PIXI.Container();
  world.addChild(lines, dots);
  app.stage.addChild(world, labelLayer);

  const spread = Math.sqrt(view.nodes.length) * LINK_DISTANCE * 0.6;
  const nodes: SimNode[] = view.nodes.map((n) => ({ id: n.id, r: radius(n.degree, n.weight), node: n, ...seed(n.id, spread) }));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const links: SimLink[] = view.edges.map(([source, target]) => ({ source, target }));
  const labels = new Map<string, Text>(
    nodes.map((n) => {
      const t = new PIXI.Text({
        text: n.node.label,
        style: {
          fontFamily: families,
          fontSize: LABEL_SIZE,
          fontStyle: n.node.kind === "theme" ? "italic" : "normal",
          fill: 0xffffff,
        },
        resolution: (window.devicePixelRatio || 1) * 1.5,
      });
      t.anchor.set(0.5, 0);
      labelLayer.addChild(t);
      return [n.id, t];
    }),
  );

  const sim: Simulation<SimNode, SimLink> = forceSimulation(nodes)
    .force("link", forceLink<SimNode, SimLink>(links).id((d) => d.id).distance(LINK_DISTANCE))
    .force("charge", forceManyBody<SimNode>().strength(REPEL).distanceMax(REPEL_REACH))
    .force("x", forceX<SimNode>(0).strength(CENTER))
    .force("y", forceY<SimNode>(0).strength(CENTER))
    .force("collide", forceCollide<SimNode>((d) => d.r + COLLIDE_PAD).iterations(3))
    .stop();
  sim.tick(reduced ? SETTLE_TICKS : PRESETTLE_TICKS);

  // ----- State outside React -----
  let transform: ZoomTransform = zoomIdentity;
  let userZoomed = false;
  let hovered: string | null = null;
  let dragging: SimNode | null = null;
  let pressState: Press | null = null;
  let dragOffset = { x: 0, y: 0 };
  /** 0 = nothing hovered, 1 = fully focused on `focus`; tweened over DIM_MS. */
  let dim = 0;
  let dimTarget = 0;
  let focus: string | null = null;
  /** When the current fade step started. */
  let lastFrame = 0;
  let frame = 0;

  const lit = () => (focus ? new Set([focus, ...(neighbors.get(focus) ?? [])]) : null);

  function draw(now: number) {
    frame = 0;
    if (dim !== dimTarget) {
      const step = reduced ? 1 : Math.max(0, now - lastFrame) / DIM_MS;
      dim = dimTarget > dim ? Math.min(dimTarget, dim + step) : Math.max(dimTarget, dim - step);
      if (dim === 0) focus = hovered;
    }
    lastFrame = now;
    const on = lit();
    const fade = 1 - (1 - DIM_ALPHA) * dim;
    const k = transform.k;

    world.position.set(transform.x, transform.y);
    world.scale.set(k);

    lines.clear();
    for (const l of links) {
      const a = l.source as SimNode;
      const b = l.target as SimNode;
      const active = focus !== null && (a.id === focus || b.id === focus);
      lines
        .moveTo(a.x ?? 0, a.y ?? 0)
        .lineTo(b.x ?? 0, b.y ?? 0)
        .stroke(
          active
            ? { width: LINE_ACTIVE / k, color: colors.pen, alpha: 1 }
            : { width: LINE / k, color: colors.rule, alpha: on ? fade : 1 },
        );
    }

    dots.clear();
    const labelBase = labelAlpha(k);
    for (const n of nodes) {
      const isLit = !on || on.has(n.id);
      const alpha = isLit ? 1 : fade;
      const color = n.id === focus && dim > 0 ? colors.pen : colors.pencil;
      dots.circle(n.x ?? 0, n.y ?? 0, n.r);
      // Planned pieces are hollow: on the map, not written yet.
      if (n.node.planned) dots.stroke({ width: 1.25 / k, color, alpha });
      else dots.fill({ color, alpha });

      const label = labels.get(n.id)!;
      const [sx, sy] = transform.apply([n.x ?? 0, n.y ?? 0]);
      label.position.set(sx, sy + n.r * k + LABEL_GAP);
      label.tint = n.id === focus && dim > 0 ? colors.ink : colors.pencil;
      label.alpha = on && on.has(n.id) && dim > 0 ? 1 : labelBase * alpha;
    }

    app.render();
    api.current?.placeCard();
    if (dim !== dimTarget) schedule();
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(draw);
  }

  function setHover(id: string | null) {
    if (id === hovered) return;
    hovered = id;
    if (id) focus = id;
    if (!frame) lastFrame = performance.now();
    dimTarget = id ? 1 : 0;
    schedule();
    canvas.style.cursor = dragging ? "grabbing" : id ? (clickAction(byId.get(id)!.node, false) ? "pointer" : "grab") : "";
  }

  sim.on("tick", schedule);
  if (!reduced) sim.alpha(0.3).restart();

  // ----- Zoom and pan -----
  const zoomer: ZoomBehavior<HTMLCanvasElement, unknown> = zoom<HTMLCanvasElement, unknown>()
    .scaleExtent([ZOOM_MIN, ZOOM_MAX])
    .clickDistance(DRAG_THRESHOLD)
    .on("start", () => callbacks.current.cards.cancel())
    .on("zoom", (e) => {
      transform = e.transform;
      if (e.sourceEvent) userZoomed = true;
      schedule();
    });

  function fit() {
    const w = box.clientWidth;
    const h = box.clientHeight;
    if (!w || !h) return;
    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const n of nodes) {
      x0 = Math.min(x0, (n.x ?? 0) - n.r);
      y0 = Math.min(y0, (n.y ?? 0) - n.r);
      x1 = Math.max(x1, (n.x ?? 0) + n.r);
      y1 = Math.max(y1, (n.y ?? 0) + n.r + LABEL_SIZE * 2);
    }
    if (!nodes.length) [x0, y0, x1, y1] = [0, 0, 0, 0];
    const k = Math.max(ZOOM_MIN, Math.min(FIT_MAX, (w - FIT_PAD * 2) / (x1 - x0 || 1), (h - FIT_PAD * 2) / (y1 - y0 || 1)));
    const t = zoomIdentity.translate(w / 2 - ((x0 + x1) / 2) * k, h / 2 - ((y0 + y1) / 2) * k).scale(k);
    select(canvas).call(zoomer.transform, t);
  }

  // ----- Drag a dot (bound before zoom, so it gets the press first) -----
  const toWorld = (x: number, y: number) => transform.invert([x, y]);
  const dragger = drag<HTMLCanvasElement, unknown, SimNode | undefined>()
    .container(canvas)
    .clickDistance(DRAG_THRESHOLD)
    .subject((e) => {
      const [x, y] = toWorld(e.x, e.y);
      const id = hit(nodes.map((n) => ({ id: n.id, x: n.x ?? 0, y: n.y ?? 0, r: n.r })), x, y, transform.k);
      return id ? byId.get(id) : undefined;
    })
    .on("start", (e) => {
      pressState = press(e.x, e.y);
      const [x, y] = toWorld(e.x, e.y);
      dragOffset = { x: x - (e.subject!.x ?? 0), y: y - (e.subject!.y ?? 0) };
    })
    .on("drag", (e) => {
      const n = e.subject as SimNode;
      if (!pressState) return;
      if (pressMove(pressState, e.x, e.y)) {
        dragging = n;
        callbacks.current.cards.cancel();
        callbacks.current.cards.close();
        setHover(n.id);
        canvas.style.cursor = "grabbing";
        if (!reduced) sim.alphaTarget(DRAG_HEAT).restart();
      }
      if (!pressState.moved) return;
      const [x, y] = toWorld(e.x, e.y);
      n.fx = x - dragOffset.x;
      n.fy = y - dragOffset.y;
      if (reduced) {
        sim.tick(2);
        schedule();
      }
    })
    .on("end", (e) => {
      const n = e.subject as SimNode;
      const wasDrag = pressState?.moved;
      pressState = null;
      if (!wasDrag) return;
      dragging = null;
      n.fx = null;
      n.fy = null;
      if (reduced) {
        sim.tick(SETTLE_TICKS);
        schedule();
      } else sim.alphaTarget(0);
      canvas.style.cursor = "grab";
    });

  select(canvas).call(dragger).call(zoomer).on("dblclick.zoom", null);

  // ----- Hover, clicks, taps -----
  const dotAt = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect();
    const [x, y] = toWorld(clientX - rect.left, clientY - rect.top);
    return hit(nodes.map((n) => ({ id: n.id, x: n.x ?? 0, y: n.y ?? 0, r: n.r })), x, y, transform.k);
  };

  function follow(action: ClickAction) {
    if (!action) return;
    if (action.kind === "tab") window.open(action.href, "_blank", "noopener");
    else if (action.kind === "push") callbacks.current.router.push(action.href);
    else window.location.assign(action.href);
  }

  const onMove = (e: PointerEvent) => {
    if (e.pointerType === "touch" || dragging) return;
    const id = dotAt(e.clientX, e.clientY);
    setHover(id);
    callbacks.current.cards.hover(id);
  };
  const onLeave = (e: PointerEvent) => {
    if (e.pointerType === "touch" || dragging) return;
    setHover(null);
    callbacks.current.cards.hover(null);
  };
  // d3-drag and d3-zoom swallow the click after a press that moved more than 4 px, so these are real clicks.
  const onClick = (e: MouseEvent) => {
    const id = dotAt(e.clientX, e.clientY);
    const { cards } = callbacks.current;
    if (!id) {
      cards.close();
      return;
    }
    const node = byId.get(id)!.node;
    if ((e as PointerEvent).pointerType === "touch") {
      if (cards.tap(id) === "open") follow(clickAction(node, false));
      return;
    }
    follow(clickAction(node, e.metaKey || e.ctrlKey));
  };
  const onAuxClick = (e: MouseEvent) => {
    if (e.button !== 1) return;
    const id = dotAt(e.clientX, e.clientY);
    if (id) follow(clickAction(byId.get(id)!.node, true));
  };
  const onContextLost = (e: Event) => {
    e.preventDefault();
    callbacks.current.onFail("WebGL context lost");
  };
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("click", onClick);
  canvas.addEventListener("auxclick", onAuxClick);
  canvas.addEventListener("webglcontextlost", onContextLost);

  // ----- The card: beside its dot, flipped or nudged to stay inside the box -----
  api.current = {
    placeCard() {
      const panel = box.querySelector<HTMLElement>(`.${m.panel}`);
      const id = box.dataset.card;
      const n = id ? byId.get(id) : undefined;
      if (!panel || !n) return;
      const [x, y] = transform.apply([n.x ?? 0, n.y ?? 0]);
      const gap = n.r * transform.k + 14;
      const [w, h, pw, ph] = [box.clientWidth, box.clientHeight, panel.offsetWidth, panel.offsetHeight];
      let left = x + gap;
      if (left + pw > w - 8) left = x - gap - pw;
      left = Math.max(8, Math.min(left, w - pw - 8));
      const top = Math.max(8, Math.min(y - 24, h - ph - 8));
      panel.style.transform = `translate(${left}px, ${top}px)`;
    },
    panTo(id) {
      const n = byId.get(id);
      if (!n) return;
      const [x, y] = transform.apply([n.x ?? 0, n.y ?? 0]);
      const margin = 80;
      if (x < margin || x > box.clientWidth - margin || y < margin || y > box.clientHeight - margin) {
        select(canvas).call(zoomer.translateTo, n.x ?? 0, n.y ?? 0);
      }
    },
  };

  // ----- Theme, size -----
  const recolor = () => {
    colors = readColors();
    schedule();
  };
  const themeWatch = new MutationObserver(recolor);
  themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const scheme = matchMedia("(prefers-color-scheme: dark)");
  scheme.addEventListener("change", recolor);

  const resize = new ResizeObserver(() => {
    const [w, h] = [box.clientWidth, box.clientHeight];
    if (!w || !h) return;
    app.renderer.resize(w, h);
    if (!userZoomed) fit();
    schedule();
  });
  resize.observe(box);

  fit();
  draw(performance.now());
  callbacks.current.onReady();

  return () => {
    sim.stop();
    sim.on("tick", null);
    if (frame) cancelAnimationFrame(frame);
    select(canvas).on(".drag", null).on(".zoom", null);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerleave", onLeave);
    canvas.removeEventListener("click", onClick);
    canvas.removeEventListener("auxclick", onAuxClick);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    themeWatch.disconnect();
    scheme.removeEventListener("change", recolor);
    resize.disconnect();
    api.current = null;
    app.destroy(true, { children: true });
  };
}

type PanelProps = {
  node: MapViewNode;
  factIndex: number;
  onNextFact: () => void;
  neighbors: MapViewNode[];
  onWalk: (id: string) => void;
  /** The pointer or focus entered (true) or left (false) the card. */
  onHover: (on: boolean) => void;
  onClose: () => void;
};

/**
 * The card beside a dot. A piece's card says what it is, what it connects to, and where it leads. A theme's card
 * shows one "Did you know?" fact with its Wikipedia source.
 */
function Panel({ node, factIndex, onNextFact, neighbors, onWalk, onHover, onClose }: PanelProps) {
  const titleId = `map-panel-${node.id}`;
  const fact = node.facts?.[factIndex];
  return (
    <div
      className={m.panel}
      role="dialog"
      aria-labelledby={`${titleId}-title`}
      id={titleId}
      onPointerEnter={() => onHover(true)}
      onPointerLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onHover(false);
      }}
    >
      <button type="button" className={m.close} aria-label="Close" onClick={onClose}>
        Close
      </button>
      <h2 className={m.panelTitle} id={`${titleId}-title`}>
        {node.label}
      </h2>
      <p className={m.kind}>
        {KIND_LABEL[node.kind]}
        {node.placeholder && ". Placeholder"}
      </p>
      {fact ? (
        <div className={m.fact}>
          <p className={m.factLead}>Did you know?</p>
          <p className={m.panelSummary} aria-live="polite">
            {fact.text}
          </p>
          <p className={m.factSource}>
            From Wikipedia: <a href={fact.url}>{fact.source}</a>
            {(node.facts?.length ?? 0) > 1 && (
              <>
                {" "}
                <button type="button" className={m.walk} onClick={onNextFact}>
                  Another fact
                </button>
              </>
            )}
          </p>
        </div>
      ) : (
        <p className={m.panelSummary}>{node.summary}</p>
      )}
      {neighbors.length > 0 && (
        <div className={m.panelConnects}>
          <p className={m.connectsLabel}>Connects to</p>
          <ul>
            {neighbors.map((n) => (
              <li key={n.id}>
                <button type="button" className={m.walk} onClick={() => onWalk(n.id)}>
                  {n.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {node.kind !== "theme" && (
        <p className={m.panelLink}>
          {node.planned ? (
            <span className={m.muted}>Not written yet.</span>
          ) : node.href ? (
            <EntryLink href={node.href}>{node.linkLabel ?? "Read it"}</EntryLink>
          ) : (
            node.linkLabel && <span className={m.muted}>{node.linkLabel}</span>
          )}
        </p>
      )}
    </div>
  );
}
