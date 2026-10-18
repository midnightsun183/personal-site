"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV, isCurrent } from "./nav";

/** Nav items with the current section marked. Needs a Suspense boundary: on a post, the pathname isn't known at build time. */
export default function NavLinks() {
  const pathname = usePathname();
  return NAV.map(({ href, label }) => (
    <li key={href}>
      <Link href={href} aria-current={isCurrent(pathname, href) ? "page" : undefined}>
        {label}
      </Link>
    </li>
  ));
}

/** The same items with nothing marked. Used as the Suspense fallback and in the footer. */
export function PlainNavLinks() {
  return NAV.map(({ href, label }) => (
    <li key={href}>
      <Link href={href}>{label}</Link>
    </li>
  ));
}
