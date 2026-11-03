import { Newsreader, Public_Sans } from "next/font/google";

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  variable: "--lp-font-display",
});

const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--lp-font-body",
});

/** Class names that define the landing page font variables. Apply on the page root and on portalled content. */
export const lpFontClass = `${newsreader.variable} ${publicSans.variable}`;

