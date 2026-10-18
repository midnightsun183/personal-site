import Link from "next/link";
import { PlainNavLinks } from "./NavLinks";
import ThemeToggle from "./ThemeToggle";
import s from "./margins.module.css";

export default function SiteFooter() {
  return (
    <footer className={s.siteFoot}>
      <div className={s.footAbout}>
        <Link className={s.name} href="/">
          Corey MacDonald
        </Link>
        <p>Written in Maryland. Set in Literata.</p>
      </div>
      <nav aria-label="Footer">
        <ul className={s.footNav}>
          <PlainNavLinks />
        </ul>
      </nav>
      <p className={s.footTheme}>
        <ThemeToggle />
      </p>
    </footer>
  );
}
