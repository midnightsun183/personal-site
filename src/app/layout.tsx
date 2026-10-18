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

// Applies a saved theme before first paint. With nothing saved, the CSS follows the system.
const themeScript = `(function(){try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

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
