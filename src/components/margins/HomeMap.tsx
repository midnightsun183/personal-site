"use client";

// The home page map (docs/design/home-map.md).
//
//   server render / no JS / under 720px ──▶ MapList (grouped by theme, crawlable)
//   wide screen after hydration          ──▶ MapField (d3-force, drag, panels)
//
// Like an Obsidian graph: themes are nodes, pieces link to their themes, and the layout comes from the links.
// Pieces that share a theme form one web; a theme on its own is its own small web. A gentle pull toward the
// middle keeps separate webs from drifting apart.
//
// Interaction: hovering (or focusing) a piece draws the pen loop around it and shows its card; clicking it goes
// to the piece. Clicking a theme pins a card with a "Did you know?" fact from Wikipedia; each click shows the next.
// On touch, the first tap shows the card and the second follows the link.
//
// MapField keeps positions out of React: d3-force ticks write `transform` and line endpoints straight to the DOM.
// React state holds only hover, focus, the open panel, and the container size.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type Ref,
} from "react";
import {
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { useRouter } from "next/navigation";
import { EntryLink } from "./EntryList";
import { PEN_LOOP } from "./Marks";
import type { MapView, MapViewNode } from "@/lib/catalog";
import m from "./map.module.css";
import s from "./margins.module.css";

const WIDE = "(min-width: 720px)";
/** Slow ambient drift. Set false to make the map sit still until it's touched. */
const DRIFT = true;
const DRIFT_ALPHA = 0.02;
const DRIFT_PUSH = 0.025;
/** How long a preview card lingers after the pointer or focus leaves, so it can be reached. */
const PREVIEW_LINGER_MS = 200;
/** Movement before a press counts as a drag rather than a click. */
const DRAG_THRESHOLD = 4;
/** Ticks run before the first paint, so the map appears already settled (a web of ~30 nodes needs a few hundred). */
const PRESETTLE_TICKS = 300;
/** Repulsion between nodes, and how far it reaches, so separate webs don't shove each other off the field. */
const CHARGE = -320;
const CHARGE_REACH = 520;
/** Space kept between a node and the field's edge. */
const EDGE = 12;
/** Pull toward the middle of the field, so separate webs stay in view. */
const CENTER_PULL = 0.025;
/** Link lengths: a piece sits close to its theme; direct links between pieces run longer. */
const THEME_LINK = 110;
const PIECE_LINK = 170;
/** d3-force's default friction, named so the edge clamp can predict the next position. */
const VELOCITY_DECAY = 0.4;

type SimNode = SimulationNodeDatum & { id: string; theme: boolean; phase: number; w: number; h: number };
type SimLink = SimulationLinkDatum<SimNode>;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

/** Space kept between two labels. */
const LABEL_GAP = 8;

/**
 * Keeps label boxes from overlapping. d3's forceCollide uses circles, which fit wide, short labels badly; this
 * compares the actual rectangles (where each node is about to be) and pushes overlapping pairs apart along the
 * shallower axis. About 30 nodes means a few hundred pairs per tick, which is cheap.
 */
function rectCollide(nodes: SimNode[], strength = 0.7) {
  return () => {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = (b.x ?? 0) + (b.vx ?? 0) - ((a.x ?? 0) + (a.vx ?? 0));
        const dy = (b.y ?? 0) + (b.vy ?? 0) - ((a.y ?? 0) + (a.vy ?? 0));
        const ox = (a.w + b.w) / 2 + LABEL_GAP - Math.abs(dx);
        const oy = (a.h + b.h) / 2 + LABEL_GAP - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue;
        // A pinned node (being dragged) stays put; the other one takes the whole push.
        const shareA = a.fx != null ? 0 : b.fx != null ? 1 : 0.5;
        const shareB = 1 - shareA;
        if (ox < oy) {
          const push = ox * strength * (dx < 0 ? -1 : 1);
          a.vx = (a.vx ?? 0) - push * shareA;
          b.vx = (b.vx ?? 0) + push * shareB;
        } else {
          const push = oy * strength * (dy < 0 ? -1 : 1);
          a.vy = (a.vy ?? 0) - push * shareA;
          b.vy = (b.vy ?? 0) + push * shareB;
        }
      }
    }
  };
}

function neighborsOf(edges: MapView["edges"]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [a, b] of edges) {
    out.set(a, [...(out.get(a) ?? []), b]);
    out.set(b, [...(out.get(b) ?? []), a]);
  }
  return out;
}

const KIND_LABEL: Record<MapViewNode["kind"], string> = {
  essay: "essay",
  explainer: "explainer",
  tool: "tool",
  "case study": "case study",
  venture: "venture",
  book: "book",
  project: "project",
  download: "download",
  hub: "everything written",
  theme: "theme",
};

export default function HomeMap({ view }: { view: MapView }) {
  const [field, setField] = useState(false);

  useEffect(() => {
    if (!view.showField) return;
    const mq = matchMedia(WIDE);
    const update = () => setField(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [view.showField]);

  return field ? <MapField view={view} /> : <MapList view={view} />;
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

type Drag = { kind: "node" | "pan"; id?: string; x0: number; y0: number; panX0: number; panY0: number; moved: boolean; pointerId: number };

/** The interactive field: nodes you can point at, drag, and open. */
function MapField({ view }: { view: MapView }) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const nodeEls = useRef(new Map<string, HTMLElement>());
  const lineEls = useRef<(SVGLineElement | null)[]>([]);
  const sim = useRef<Simulation<SimNode, SimLink> | null>(null);
  const simNodes = useRef(new Map<string, SimNode>());
  const pan = useRef({ x: 0, y: 0 });
  const sizeRef = useRef({ w: 0, h: 0 });
  const drag = useRef<Drag | null>(null);
  const reduced = useRef(false);
  /** The node whose card is showing, for placePanel and the drift, which run outside React. */
  const cardRef = useRef<string | null>(null);
  const lingerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Set while we move focus back to a node after closing its card, so that focus doesn't reopen it. */
  const quietFocus = useRef(false);
  const router = useRouter();

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  /** A card shown because a piece is hovered or focused. Closes shortly after both leave the node and the card. */
  const [preview, setPreview] = useState<string | null>(null);
  /** A card that stays until closed: a theme's fact card, or a piece with nowhere to link to. */
  const [pinned, setPinned] = useState<string | null>(null);
  /** Which fact each theme is showing. */
  const [factIndex, setFactIndex] = useState<Record<string, number>>({});
  const [dragging, setDragging] = useState<string | null>(null);

  const neighbors = useMemo(() => neighborsOf(view.edges), [view.edges]);
  const byId = useMemo(() => new Map(view.nodes.map((n) => [n.id, n])), [view.nodes]);
  const card = preview ?? pinned;
  const active = hover ?? focus ?? card;
  const lit = useMemo(() => (active ? new Set([active, ...(neighbors.get(active) ?? [])]) : null), [active, neighbors]);

  /** Write every position to the DOM. Called on each simulation tick and after pans. */
  const paint = useCallback(() => {
    for (const [id, n] of simNodes.current) {
      const el = nodeEls.current.get(id);
      if (el) el.style.transform = `translate(${(n.x ?? 0) - n.w / 2}px, ${(n.y ?? 0) - n.h / 2}px)`;
    }
    view.edges.forEach(([a, b], i) => {
      const line = lineEls.current[i];
      const na = simNodes.current.get(a);
      const nb = simNodes.current.get(b);
      if (!line || !na || !nb) return;
      line.setAttribute("x1", String(na.x ?? 0));
      line.setAttribute("y1", String(na.y ?? 0));
      line.setAttribute("x2", String(nb.x ?? 0));
      line.setAttribute("y2", String(nb.y ?? 0));
    });
    if (worldRef.current) worldRef.current.style.transform = `translate(${pan.current.x}px, ${pan.current.y}px)`;
    placePanel();
  }, [view.edges]);

  /** Put the open panel beside its node, flipping to the other side or up near the edges. */
  function placePanel() {
    const panel = panelRef.current;
    const id = cardRef.current;
    const field = fieldRef.current;
    if (!panel || !id || !field) return;
    const n = simNodes.current.get(id);
    if (!n) return;
    const fw = field.clientWidth;
    const fh = field.clientHeight;
    const pw = panel.offsetWidth;
    const ph = panel.offsetHeight;
    const x = (n.x ?? 0) + pan.current.x;
    const y = (n.y ?? 0) + pan.current.y;
    let left = x + n.w / 2 + 14;
    if (left + pw > fw - 8) left = x - n.w / 2 - 14 - pw;
    left = Math.max(8, Math.min(left, fw - pw - 8));
    const top = Math.max(8, Math.min(y - 24, fh - ph - 8));
    panel.style.transform = `translate(${left - pan.current.x}px, ${top - pan.current.y}px)`;
  }

  /** Drift runs only while nothing is open, the tab is visible, and motion is welcome. */
  const updateDrift = useCallback(() => {
    const s = sim.current;
    if (!s || drag.current) return;
    const on = DRIFT && !reduced.current && !document.hidden && !cardRef.current;
    s.alphaTarget(on ? DRIFT_ALPHA : 0);
    if (on) s.restart();
  }, []);

  // Measure the field, and re-anchor gently when it resizes.
  useLayoutEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    const measure = () => {
      sizeRef.current = { w: el.clientWidth, h: el.clientHeight };
      setSize(sizeRef.current);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Build the simulation once the field has a size.
  useLayoutEffect(() => {
    if (!size.w || sim.current) return;
    reduced.current = matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Deterministic start: each theme's web begins in its own direction from the middle, so webs separate cleanly
    // and the settled layout is the same on every visit.
    const groups = [...new Set(view.nodes.map((n) => n.group ?? "none"))];
    const nodes: SimNode[] = view.nodes.map((n) => {
      const el = nodeEls.current.get(n.id);
      const g = groups.indexOf(n.group ?? "none");
      const angle = (g / groups.length) * Math.PI * 2 + (hash(n.id) - 0.5) * 0.6;
      const reach = Math.min(size.w, size.h) * (n.kind === "theme" ? 0.22 : 0.32 + hash(`${n.id}r`) * 0.08);
      return {
        id: n.id,
        theme: n.kind === "theme",
        phase: hash(`${n.id}p`) * Math.PI * 2,
        w: el?.offsetWidth ?? 80,
        h: el?.offsetHeight ?? 32,
        x: size.w / 2 + Math.cos(angle) * reach * 1.6,
        y: size.h / 2 + Math.sin(angle) * reach,
      };
    });
    simNodes.current = new Map(nodes.map((n) => [n.id, n]));
    const links: SimLink[] = view.edges.map(([source, target]) => ({ source, target }));

    const drift = () => {
      if (!DRIFT || reduced.current || cardRef.current || drag.current) return;
      const t = performance.now() / 1000;
      for (const n of nodes) {
        n.vx = (n.vx ?? 0) + Math.sin(t * 0.3 + n.phase) * DRIFT_PUSH;
        n.vy = (n.vy ?? 0) + Math.cos(t * 0.23 + n.phase) * DRIFT_PUSH;
      }
    };

    // Keep every label inside the field. Runs last, and clamps where the node is about to be (d3 moves each node
    // by vx * (1 - velocityDecay) after the forces), so labels never leave the field even mid-motion.
    const keep = 1 - VELOCITY_DECAY;
    const clamp = (pos: number, v: number, min: number, max: number) => {
      const next = pos + v * keep;
      if (next < min) return (min - pos) / keep;
      if (next > max) return (max - pos) / keep;
      return v;
    };
    const contain = () => {
      const { w, h } = sizeRef.current;
      for (const n of nodes) {
        if (n.fx != null) continue;
        n.vx = clamp(n.x ?? 0, n.vx ?? 0, n.w / 2 + EDGE, w - n.w / 2 - EDGE);
        n.vy = clamp(n.y ?? 0, n.vy ?? 0, n.h / 2 + EDGE, h - n.h / 2 - EDGE);
      }
    };

    const s = forceSimulation<SimNode, SimLink>(nodes)
      .force(
        "link",
        forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance((l) => ((l.source as SimNode).theme || (l.target as SimNode).theme ? THEME_LINK : PIECE_LINK)),
      )
      .force("charge", forceManyBody().strength(CHARGE).distanceMax(CHARGE_REACH))
      .force("collide", rectCollide(nodes))
      .force("x", forceX<SimNode>(size.w / 2).strength(CENTER_PULL))
      // Pulled harder vertically than across, since the field is much wider than it is tall.
      .force("y", forceY<SimNode>(size.h / 2).strength(CENTER_PULL * 2.5))
      .force("drift", drift)
      .force("contain", contain)
      .velocityDecay(VELOCITY_DECAY)
      .stop();
    sim.current = s;

    // Lay the map out before anyone sees it; the load moment is the threads drawing in (CSS), then the drift.
    s.tick(PRESETTLE_TICKS);
    paint();
    s.on("tick", paint);
    if (!reduced.current) updateDrift();

    // Labels were measured before Literata loaded; measure again once it has, so nothing overflows its box.
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (cancelled || sim.current !== s) return;
      for (const n of nodes) {
        const el = nodeEls.current.get(n.id);
        if (el) [n.w, n.h] = [el.offsetWidth, el.offsetHeight];
      }
      if (reduced.current) {
        s.tick(120);
        paint();
      } else s.alpha(0.3).restart();
    });
    return () => {
      cancelled = true;
    };
    // Built once; later size changes go through the re-center effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w > 0]);

  // Re-center on resize.
  useEffect(() => {
    const s = sim.current;
    if (!s || !size.w) return;
    (s.force("x") as ReturnType<typeof forceX<SimNode>>).x(size.w / 2);
    (s.force("y") as ReturnType<typeof forceY<SimNode>>).y(size.h / 2);
    if (reduced.current) {
      s.tick(120);
      paint();
    } else s.alpha(0.3).restart();
  }, [size, paint]);

  // Stop on unmount; pause drift while the tab is hidden.
  useEffect(() => {
    document.addEventListener("visibilitychange", updateDrift);
    return () => {
      document.removeEventListener("visibilitychange", updateDrift);
      sim.current?.stop();
      sim.current = null;
    };
  }, [updateDrift]);

  // Keep the card's ref in sync, pause drift while a card shows, and close it on Esc.
  useEffect(() => {
    cardRef.current = card;
    updateDrift();
    requestAnimationFrame(placePanel);
    if (!card) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const id = cardRef.current;
      closeCards();
      if (id) refocus(id);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // closeCards only sets state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card, updateDrift]);

  useEffect(() => () => clearLinger(), []);

  function clearLinger() {
    if (lingerTimer.current) clearTimeout(lingerTimer.current);
    lingerTimer.current = null;
  }

  /** Show a piece's card now (themes show theirs on click only). */
  function showPreview(id: string) {
    clearLinger();
    if (byId.get(id)?.kind !== "theme") setPreview(id);
  }

  /** Let the preview linger briefly, so the pointer or focus can move onto the card. */
  function hidePreviewSoon() {
    clearLinger();
    lingerTimer.current = setTimeout(() => setPreview(null), PREVIEW_LINGER_MS);
  }

  function closeCards() {
    clearLinger();
    setPreview(null);
    setPinned(null);
  }

  /** Return focus to a node after closing its card, without the focus reopening it. */
  function refocus(id: string) {
    quietFocus.current = true;
    nodeEls.current.get(id)?.focus();
    quietFocus.current = false;
  }

  /** Go to a piece: the same tab, or a new one with Cmd, Ctrl or the middle button. */
  function follow(href: string, newTab: boolean) {
    if (newTab) window.open(href, "_blank", "noopener");
    else if (href.startsWith("/")) router.push(href);
    else window.location.assign(href);
  }

  /**
   * A click (or tap, or Enter on a button) on a node. Pieces with a link go there; on touch, the first tap only
   * shows the card. Themes pin their fact card, and each further click shows the next fact. Anything else pins its
   * card, or unpins it if it's already pinned.
   */
  function activate(id: string, opts: { touch?: boolean; newTab?: boolean } = {}) {
    const n = byId.get(id);
    if (!n) return;
    if (n.kind === "theme") {
      if (pinned === id) setFactIndex((f) => ({ ...f, [id]: ((f[id] ?? 0) + 1) % (n.facts?.length || 1) }));
      clearLinger();
      setPreview(null);
      setPinned(id);
      return;
    }
    if (n.href && !n.planned) {
      if (opts.touch && card !== id) {
        showPreview(id);
        return;
      }
      follow(n.href, !!opts.newTab);
      return;
    }
    clearLinger();
    setPreview(null);
    setPinned((cur) => (cur === id ? null : id));
  }

  function toWorld(e: PointerEvent | ReactPointerEvent) {
    const rect = fieldRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left - pan.current.x, y: e.clientY - rect.top - pan.current.y };
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest(`.${m.panel}`)) return;
    const nodeEl = target.closest<HTMLElement>("[data-node]");
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // The pointer is already gone (or isn't a real one); the drag still works while it stays over the field.
    }
    drag.current = {
      kind: nodeEl ? "node" : "pan",
      id: nodeEl?.dataset.node,
      x0: e.clientX,
      y0: e.clientY,
      panX0: pan.current.x,
      panY0: pan.current.y,
      moved: false,
      pointerId: e.pointerId,
    };
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!d.moved) {
      d.moved = true;
      if (d.kind === "node") setDragging(d.id ?? null);
    }
    const s = sim.current;
    if (d.kind === "pan") {
      const field = fieldRef.current!;
      const maxX = field.clientWidth * 0.6;
      const maxY = field.clientHeight * 0.6;
      pan.current = {
        x: Math.max(-maxX, Math.min(maxX, d.panX0 + dx)),
        y: Math.max(-maxY, Math.min(maxY, d.panY0 + dy)),
      };
      paint();
      return;
    }
    const n = d.id ? simNodes.current.get(d.id) : undefined;
    if (!n || !s) return;
    const p = toWorld(e);
    n.fx = p.x;
    n.fy = p.y;
    if (reduced.current) {
      s.tick(2);
      paint();
    } else s.alphaTarget(0.3).restart();
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    setDragging(null);
    if (d.moved) {
      if (d.kind === "node" && d.id) {
        const n = simNodes.current.get(d.id);
        if (n) {
          n.fx = null;
          n.fy = null;
        }
        const s = sim.current;
        if (reduced.current && s) {
          s.tick(120);
          paint();
        } else {
          s?.alphaTarget(0);
          updateDrift();
        }
      }
      return;
    }
    // A press that didn't move is a click. The field holds pointer capture, so the browser sends the click event
    // to the field, not the node; handle it here instead.
    if (d.kind === "node" && d.id) activate(d.id, { touch: e.pointerType === "touch", newTab: e.metaKey || e.ctrlKey || e.button === 1 });
    else closeCards(); // the background closes any card
  }

  /** From a card's "Connects to": show the neighbor's card, focus it, and pan it into view. */
  function walkTo(id: string) {
    const n = simNodes.current.get(id);
    const field = fieldRef.current;
    if (n && field) {
      const x = (n.x ?? 0) + pan.current.x;
      const y = (n.y ?? 0) + pan.current.y;
      const margin = 80;
      if (x < margin || x > field.clientWidth - margin || y < margin || y > field.clientHeight - margin) {
        pan.current = { x: field.clientWidth / 2 - (n.x ?? 0), y: field.clientHeight / 2 - (n.y ?? 0) };
        paint();
      }
    }
    clearLinger();
    setPreview(null);
    setPinned(id);
    nodeEls.current.get(id)?.focus();
  }

  const cardNode = card ? byId.get(card) : undefined;

  return (
    <div
      ref={fieldRef}
      className={`${m.field} ${s.fullBleed} ${dragging ? m.isDragging : ""}`}
      // A small web doesn't need the full height; it grows with the map, up to the cap in map.module.css.
      style={{ ["--map-h" as string]: `${Math.min(760, Math.max(480, 240 + view.nodes.length * 36))}px` }}
      role="group"
      aria-label="Map of my work. Each piece connects to its themes and to related work. Open a theme for a fact about it."
      onDragStart={(e) => e.preventDefault()}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div ref={worldRef} className={m.world}>
        <svg className={m.threads} aria-hidden="true" width={size.w} height={size.h}>
          {view.edges.map(([a, b], i) => {
            const on = active && (a === active || b === active);
            const dim = lit && !on;
            return (
              <line
                key={`${a}-${b}`}
                ref={(el) => {
                  lineEls.current[i] = el;
                }}
                pathLength={1}
                className={`${m.thread} ${on ? m.threadOn : ""} ${on && b === active ? m.flowBack : ""} ${dim ? m.threadDim : ""}`}
                style={{ animationDelay: `${i * 40}ms` }}
              />
            );
          })}
        </svg>

        {view.nodes.map((n) => {
          const dim = lit && !lit.has(n.id);
          return (
            <FieldNode
              key={n.id}
              node={n}
              hasCard={card === n.id}
              isPinned={pinned === n.id}
              marked={hover === n.id || focus === n.id || card === n.id}
              isActive={active === n.id}
              dim={!!dim}
              setRef={(el) => {
                if (el) nodeEls.current.set(n.id, el);
                else nodeEls.current.delete(n.id);
              }}
              onKeyboardClick={() => activate(n.id)}
              onEnter={() => {
                setHover(n.id);
                showPreview(n.id);
              }}
              onLeave={() => {
                setHover((h) => (h === n.id ? null : h));
                hidePreviewSoon();
              }}
              onFocus={() => {
                setFocus(n.id);
                if (!quietFocus.current) showPreview(n.id);
              }}
              onBlur={() => {
                setFocus((f) => (f === n.id ? null : f));
                hidePreviewSoon();
              }}
              panel={
                card === n.id && cardNode ? (
                  <Panel
                    ref={panelRef}
                    node={cardNode}
                    factIndex={factIndex[cardNode.id] ?? 0}
                    onNextFact={() => activate(cardNode.id)}
                    neighbors={(neighbors.get(cardNode.id) ?? []).map((id) => byId.get(id)!).filter(Boolean)}
                    onWalk={walkTo}
                    onStay={clearLinger}
                    onLeave={() => {
                      if (!pinned || pinned !== cardNode.id) hidePreviewSoon();
                    }}
                    onClose={() => {
                      closeCards();
                      refocus(cardNode.id);
                    }}
                  />
                ) : null
              }
            />
          );
        })}
      </div>
    </div>
  );
}

type FieldNodeProps = {
  node: MapViewNode;
  hasCard: boolean;
  isPinned: boolean;
  /** Hovered, focused, or showing its card: gets the pen loop. */
  marked: boolean;
  isActive: boolean;
  dim: boolean;
  setRef: (el: HTMLElement | null) => void;
  /** Enter (or Space on a button). Pointer clicks are handled by the field (see onPointerUp). */
  onKeyboardClick: () => void;
  onEnter: () => void;
  onLeave: () => void;
  onFocus: () => void;
  onBlur: () => void;
  /** Rendered right after the node, so Tab goes from a node into its card. */
  panel: ReactNode;
};

function FieldNode({ node, hasCard, isPinned, marked, isActive, dim, setRef, onKeyboardClick, onEnter, onLeave, onFocus, onBlur, panel }: FieldNodeProps) {
  // The pen loop is drawn around the whole node (label and kind), so it fits labels of any length or line count.
  const inner = (
    <>
      <span className={m.nodeLabel}>{node.label}</span>
      <span className={m.kind}>{KIND_LABEL[node.kind]}</span>
      {marked && (
        <svg className={m.loop} viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
          <path d={PEN_LOOP} />
        </svg>
      )}
    </>
  );
  const className = `${m.node} ${m[node.weight]} ${isActive ? m.nodeActive : ""} ${dim ? m.nodeDim : ""} ${node.planned ? m.nodePlanned : ""}`;
  const events = { onPointerEnter: onEnter, onPointerLeave: onLeave, onFocus, onBlur };
  // A piece with somewhere to go is a real link: Enter follows it, and the browser shows where it leads.
  const isLink = node.kind !== "theme" && !!node.href && !node.planned;
  return (
    <>
      {isLink ? (
        <a
          ref={setRef}
          href={node.href}
          data-node={node.id}
          className={className}
          draggable={false}
          aria-describedby={hasCard ? `map-panel-${node.id}` : undefined}
          onClick={(e) => {
            // Pointer clicks are handled by the field; Enter (detail 0) goes through the same path, so internal
            // pages use client-side navigation and nothing ever navigates twice.
            e.preventDefault();
            if (e.detail === 0) onKeyboardClick();
          }}
          {...events}
        >
          {inner}
        </a>
      ) : (
        <button
          ref={setRef}
          type="button"
          data-node={node.id}
          className={className}
          aria-expanded={isPinned}
          onClick={(e) => {
            if (e.detail === 0) onKeyboardClick();
          }}
          {...events}
        >
          {inner}
        </button>
      )}
      {panel}
    </>
  );
}

type PanelProps = {
  ref: Ref<HTMLDivElement>;
  node: MapViewNode;
  factIndex: number;
  onNextFact: () => void;
  neighbors: MapViewNode[];
  onWalk: (id: string) => void;
  /** The pointer or focus arrived on the card: keep it open. */
  onStay: () => void;
  /** The pointer or focus left the card. */
  onLeave: () => void;
  onClose: () => void;
};

/**
 * The card beside a node. A piece's card says what it is, what it connects to, and where it leads. A theme's card
 * shows one "Did you know?" fact with its Wikipedia source.
 */
function Panel({ ref, node, factIndex, onNextFact, neighbors, onWalk, onStay, onLeave, onClose }: PanelProps) {
  const titleId = `map-panel-${node.id}`;
  const fact = node.facts?.[factIndex];
  return (
    <div
      ref={ref}
      className={m.panel}
      role="dialog"
      aria-labelledby={`${titleId}-title`}
      id={titleId}
      onPointerEnter={onStay}
      onPointerLeave={onLeave}
      onFocus={onStay}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onLeave();
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
