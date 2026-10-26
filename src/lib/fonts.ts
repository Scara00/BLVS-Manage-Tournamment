import { Figtree, Geist_Mono, Outfit } from "next/font/google";

/** Headings. */
export const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

/** Body text (16 px). */
export const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

/** Scores and times, always with tabular figures (see globals.css). */
export const mono = Geist_Mono({
  variable: "--font-mono-blvs",
  subsets: ["latin"],
});

/** Classes that define the font CSS variables on an element. */
export const fontVariables = [outfit.variable, figtree.variable, mono.variable];
