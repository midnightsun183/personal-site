// Interactive graphics a note can place with a ```graphic block (docs/design/obsidian-content-pipeline-spec.md).
// Adding one: write the component in src/components/margins/, then add one line here.
import { createElement, type ComponentType, type ReactNode } from "react";
import { z } from "zod";
import DaylightChart from "@/components/margins/DaylightChart";
import ParallelMap from "@/components/margins/ParallelMap";
import s from "@/components/margins/margins.module.css";

export type Graphic = {
  /** Validates the block's non-reserved keys. Unknown keys fail the build. */
  props: z.ZodType;
  render: (props: unknown) => ReactNode;
  /** Extra classes on the wrapping figure, before `wide`. */
  figureClass?: string;
};

function graphic<P extends object>(component: ComponentType<P>, props: z.ZodType<P>, figureClass?: string): Graphic {
  return { props, render: (p) => createElement(component, p as P), figureClass };
}

export const graphics: Record<string, Graphic> = {
  "daylight-chart": graphic(DaylightChart, z.strictObject({ compact: z.boolean().optional() })),
  "parallel-map": graphic(ParallelMap, z.strictObject({}), s.map),
};
