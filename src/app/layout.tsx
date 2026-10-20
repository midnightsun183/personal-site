// src/app/layout.tsx
import type { Metadata } from "next";
import { Literata } from "next/font/google";
import SiteHeader from "@/components/margins/SiteHeader";
import SiteFooter from "@/components/margins/SiteFooter";
import s from "@/components/margins/margins.module.css";
import "./globals.css";

const literata = Literata({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-literata",
});

export const metadata: Metadata = {
  title: { default: "Corey MacDonald", template: "%s | Corey MacDonald" },
  description: "Essays, notes, and the occasional chart.",
};

// Before first paint: applies a saved theme (with nothing saved, the CSS follows the system), and sets data-js so the
// home map can hold the graph's space instead of flashing its list (map.module.css). If the map is still loading 4 s
// later (JS that never ran, or a Pixi download that hung), it marks the map failed, which shows the list.
const themeScript = `(function(){var d=document.documentElement;d.setAttribute("data-js","");try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")d.setAttribute("data-theme",t)}catch(e){}setTimeout(function(){var m=d.getAttribute("data-map");if((!m||m==="loading")&&document.querySelector("[data-home-map]"))d.setAttribute("data-map","failed")},4000)})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-US" className={literata.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <div className={s.page}>
          <SiteHeader />
          <main id="content" className={s.page}>
            {children}
          </main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
