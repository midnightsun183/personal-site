import { Suspense } from "react";
import Link from "next/link";
import NavLinks, { PlainNavLinks } from "./NavLinks";
import s from "./margins.module.css";

export default function SiteHeader() {
  return (
    <header className={s.top}>
      <a className={s.skip} href="#content">
        Skip to content
      </a>
      <Link className={s.name} href="/">
        Corey MacDonald
      </Link>
      <nav aria-label="Main">
        <ul className={s.nav}>
          <Suspense fallback={<PlainNavLinks />}>
            <NavLinks />
          </Suspense>
        </ul>
      </nav>
    </header>
  );
}
