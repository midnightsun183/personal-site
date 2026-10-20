import type { ReactNode } from "react";
import s from "./margins.module.css";

/** The pen loop's path, in a 100 x 30 box stretched to fit whatever it circles. */
const PEN_LOOP = "M4 18 C 20 2, 80 0, 97 12 C 104 20, 70 30, 40 28 C 14 26, 0 22, 9 10";

/** A pen loop drawn around a phrase. */
export function Scribble({ children }: { children: ReactNode }) {
  return (
    <span className={s.scribble}>
      {children}
      <svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
        <path d={PEN_LOOP} />
      </svg>
    </span>
  );
}

/** A highlighter stroke. */
export function Mark({ children }: { children: ReactNode }) {
  return <span className={s.mark}>{children}</span>;
}

/** A small hand-drawn arrow pointing back at the text. */
export function PenArrow() {
  return (
    <svg className={s.penArrow} viewBox="0 0 48 24" aria-hidden="true">
      <path d="M46 4 C 30 2, 14 6, 4 18 M4 18 L 12 16 M4 18 L 6 10" />
    </svg>
  );
}
