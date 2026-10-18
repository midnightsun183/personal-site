import type { CSSProperties, ReactNode } from "react";
import s from "./margins.module.css";

/** A numbered sidenote. Sits in the margin on wide screens; folds behind its NoteRef on narrow ones. */
export default function Note({ n, children }: { n: number; children: ReactNode }) {
  return (
    <aside id={`note-${n}`} className={`${s.note} ${s.fold}`}>
      <span className={s.n}>{n}</span>
      {children}
    </aside>
  );
}

/** An unnumbered margin note (captions, asides). Always visible. */
export function Aside({ children, className = "", style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <aside className={`${s.note} ${className}`} style={style}>
      {children}
    </aside>
  );
}
