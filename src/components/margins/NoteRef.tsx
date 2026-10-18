"use client";

import { useState } from "react";
import s from "./margins.module.css";

/**
 * The marker for a Note. Wide screens show a plain superscript, since the note sits beside the paragraph.
 * Narrow screens show a button that opens the note under the paragraph. CSS hides whichever doesn't apply.
 */
export default function NoteRef({ n }: { n: number }) {
  const [open, setOpen] = useState(false);
  const id = `note-${n}`;

  function toggle() {
    const next = !open;
    setOpen(next);
    document.getElementById(id)?.classList.toggle(s.open, next);
  }

  return (
    <>
      <sup className={s.refMark}>{n}</sup>
      <button type="button" className={s.ref} aria-expanded={open} aria-controls={id} aria-label={`Note ${n}`} onClick={toggle}>
        {n}
      </button>
    </>
  );
}
