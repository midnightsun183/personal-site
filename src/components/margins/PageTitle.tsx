import type { ReactNode } from "react";
import s from "./margins.module.css";

/** A page's h1 and the line under it. */
export default function PageTitle({ children, dek }: { children: ReactNode; dek?: ReactNode }) {
  return (
    <>
      <h1 className={`${s.postTitle} ${s.indexTitle}`}>{children}</h1>
      {dek && <p className={s.postDek}>{dek}</p>}
    </>
  );
}
