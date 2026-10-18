// The site's sections, in nav order. Header and footer both read from here.
export const NAV = [
  { href: "/work", label: "Work" },
  { href: "/writing", label: "Writing" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Write to me" },
] as const;

/** True when `pathname` is the section at `href` or a page inside it (a case study counts as Work). */
export function isCurrent(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
