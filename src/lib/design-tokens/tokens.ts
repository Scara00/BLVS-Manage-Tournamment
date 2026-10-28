/**
 * BLVS Court design tokens: the single source of truth.
 *
 * Every value here is mirrored by a CSS variable in `src/app/globals.css`
 * (see `css-vars.ts` for the naming rules). `tokens-css.test.ts` fails when
 * the two drift apart, so change both together.
 *
 * Brand values come from beachlifevolleysoul.it; the functional and
 * registration colours are proposals awaiting client approval.
 */

const neutral = {
  0: "#ffffff",
  50: "#fbfbfc",
  100: "#f2f2f3",
  200: "#e3e3e4",
  300: "#c9caca",
  400: "#b1b2b2",
  500: "#6b6c6c",
  600: "#4a4a4c",
  700: "#333333",
  800: "#282828",
  900: "#000000",
} as const;

const error = { fg: "#b3261e", bg: "#fbe9e7" } as const;

export const color = {
  /** Menu bar and primary actions. */
  primary: "#000000",
  primaryForeground: "#ffffff",
  /** Site `--yellow`: surface or decoration only, never text on white. */
  tape: "#ffcc00",
  tapeStrong: "#febe10",
  tapeSoft: "#fff3b7",
  /** Secondary brand blue. */
  accent: "#536dab",
  neutral,
  success: { fg: "#0f5c2e", bg: "#e3f4e8" },
  error,
  warning: { fg: "#7a4100", bg: "#fff3b7" },
  info: { fg: "#1f3a7a", bg: "#e6ebf6" },
  /** Always paired with a visible "LIVE" label: colour is never the only cue. */
  live: { fg: "#ffffff", bg: "#a3001b" },
  /** Registration status badges. */
  reg: {
    draft: { fg: neutral[800], bg: neutral[200] },
    open: { fg: "#000000", bg: "#ffcc00" },
    closed: { fg: "#ffffff", bg: neutral[800] },
    cancelled: error,
  },
  /** Page background and default body text (site body colour). */
  background: neutral[0],
  foreground: neutral[800],
  /** Secondary text: AA on background and on `neutral.100`. */
  mutedForeground: neutral[500],
  /** Decorative dividers only (exempt from WCAG 1.4.11). */
  border: neutral[200],
  /** Form control borders: they carry meaning, so ≥ 3:1. */
  input: neutral[500],
  /** Focus ring. */
  ring: "#000000",
} as const;

export const font = {
  family: {
    heading: { name: "Outfit", cssVar: "--font-outfit" },
    body: { name: "Figtree", cssVar: "--font-figtree" },
    mono: { name: "Geist Mono", cssVar: "--font-mono-blvs" },
  },
  bodySize: "16px",
  /** Scores, standings and times always use tabular figures. */
  numeric: "tabular-nums",
  scale: {
    xs: { size: "0.75rem", lineHeight: "1rem" },
    sm: { size: "0.875rem", lineHeight: "1.25rem" },
    base: { size: "1rem", lineHeight: "1.5rem" },
    lg: { size: "1.125rem", lineHeight: "1.75rem" },
    xl: { size: "1.25rem", lineHeight: "1.75rem" },
    "2xl": { size: "1.5rem", lineHeight: "2rem" },
    "3xl": { size: "2rem", lineHeight: "2.5rem" },
    "4xl": { size: "2.5rem", lineHeight: "3rem" },
  },
} as const;

/** Square corners everywhere; `full` only for pills and avatars. */
export const radius = {
  none: "0px",
  full: "9999px",
} as const;

/** Spacious scale on a 4 px base, plus semantic densities. */
export const space = {
  1: "0.25rem",
  2: "0.5rem",
  3: "0.75rem",
  4: "1rem",
  5: "1.5rem",
  6: "2rem",
  7: "3rem",
  8: "4rem",
  9: "6rem",
  /** Padding inside components. */
  inset: { sm: "0.75rem", default: "1rem", lg: "1.5rem" },
  /** Vertical rhythm between stacked blocks. */
  stack: { sm: "0.5rem", default: "1rem", lg: "2rem" },
} as const;

/**
 * Widths of the page frame. `frame` is shared by the bars, the content
 * column and the footer, so the content lines up with the logo; wide enough
 * for the admin tables, capped so rows stay scannable on large monitors.
 */
export const container = {
  frame: "100rem",
} as const;

export type ContrastKind = "score" | "text" | "graphic";

export type ContrastPair = {
  name: string;
  fg: string;
  bg: string;
  kind: ContrastKind;
};

/** Every fg/bg combination the UI is allowed to use, with its WCAG level. */
export const contrastPairs: readonly ContrastPair[] = [
  {
    name: "Testo su sfondo",
    fg: color.foreground,
    bg: color.background,
    kind: "text",
  },
  {
    name: "Testo secondario su sfondo",
    fg: color.mutedForeground,
    bg: color.background,
    kind: "text",
  },
  {
    name: "Testo secondario su neutro 100",
    fg: color.mutedForeground,
    bg: neutral[100],
    kind: "text",
  },
  {
    name: "Primario: testo su nero",
    fg: color.primaryForeground,
    bg: color.primary,
    kind: "text",
  },
  { name: "Nero su tape", fg: color.primary, bg: color.tape, kind: "score" },
  {
    name: "Nero su tape intenso",
    fg: color.primary,
    bg: color.tapeStrong,
    kind: "score",
  },
  {
    name: "Nero su tape tenue",
    fg: color.primary,
    bg: color.tapeSoft,
    kind: "score",
  },
  {
    name: "Accento blu su sfondo",
    fg: color.accent,
    bg: color.background,
    kind: "text",
  },
  {
    name: "Successo",
    fg: color.success.fg,
    bg: color.success.bg,
    kind: "text",
  },
  { name: "Errore", fg: color.error.fg, bg: color.error.bg, kind: "text" },
  {
    name: "Errore su sfondo",
    fg: color.error.fg,
    bg: color.background,
    kind: "text",
  },
  {
    name: "Testo bianco su errore",
    fg: color.primaryForeground,
    bg: color.error.fg,
    kind: "text",
  },
  { name: "Avviso", fg: color.warning.fg, bg: color.warning.bg, kind: "text" },
  { name: "Informazione", fg: color.info.fg, bg: color.info.bg, kind: "text" },
  { name: "Live", fg: color.live.fg, bg: color.live.bg, kind: "score" },
  {
    name: "Punteggio su sfondo",
    fg: color.primary,
    bg: color.background,
    kind: "score",
  },
  {
    name: "FlipDigits: cifra su nero",
    fg: color.primaryForeground,
    bg: color.primary,
    kind: "score",
  },
  {
    name: "Fase Silver",
    fg: neutral[800],
    bg: neutral[100],
    kind: "text",
  },
  {
    name: "Fase Silver: bordo",
    fg: color.input,
    bg: neutral[100],
    kind: "graphic",
  },
  {
    name: "Iscrizioni: bozza",
    fg: color.reg.draft.fg,
    bg: color.reg.draft.bg,
    kind: "text",
  },
  {
    name: "Iscrizioni: aperte",
    fg: color.reg.open.fg,
    bg: color.reg.open.bg,
    kind: "text",
  },
  {
    name: "Iscrizioni: chiuse",
    fg: color.reg.closed.fg,
    bg: color.reg.closed.bg,
    kind: "text",
  },
  {
    name: "Iscrizioni: annullate",
    fg: color.reg.cancelled.fg,
    bg: color.reg.cancelled.bg,
    kind: "text",
  },
  {
    name: "Anello di focus su sfondo",
    fg: color.ring,
    bg: color.background,
    kind: "graphic",
  },
  {
    name: "Anello di focus su tape",
    fg: color.ring,
    bg: color.tape,
    kind: "graphic",
  },
  {
    name: "Anello di focus su primario",
    fg: color.primaryForeground,
    bg: color.primary,
    kind: "graphic",
  },
  {
    name: "Bordo input su sfondo",
    fg: color.input,
    bg: color.background,
    kind: "graphic",
  },
  {
    name: "Anello di focus su nero",
    fg: color.primaryForeground,
    bg: color.primary,
    kind: "graphic",
  },
  {
    name: "Tape su nero (voce attiva)",
    fg: color.tape,
    bg: color.primary,
    kind: "graphic",
  },
  {
    name: "Nero su tape (voce attiva)",
    fg: color.primary,
    bg: color.tape,
    kind: "text",
  },
  {
    name: "Testo su neutro 50 (barra menu)",
    fg: color.foreground,
    bg: neutral[50],
    kind: "text",
  },
  {
    name: "Bordo input su neutro 50",
    fg: color.input,
    bg: neutral[50],
    kind: "graphic",
  },
  {
    name: "Bianco su neutro 800 (hover sidebar)",
    fg: color.primaryForeground,
    bg: neutral[800],
    kind: "text",
  },
  {
    name: "Live su sfondo (badge)",
    fg: color.live.bg,
    bg: color.background,
    kind: "graphic",
  },
  {
    name: "Anello di focus chiaro su nero",
    fg: color.background,
    bg: color.primary,
    kind: "graphic",
  },
  {
    name: "Distruttivo: testo bianco su errore",
    fg: color.primaryForeground,
    bg: color.error.fg,
    kind: "text",
  },
  {
    name: "Distruttivo hover: testo bianco su rosso scuro",
    fg: color.primaryForeground,
    bg: color.live.bg,
    kind: "text",
  },
  {
    name: "Primario hover: testo su neutro 700",
    fg: color.primaryForeground,
    bg: neutral[700],
    kind: "text",
  },
  {
    name: "Secondario hover: nero su neutro 100",
    fg: color.primary,
    bg: neutral[100],
    kind: "text",
  },
  {
    name: "Badge neutro",
    fg: neutral[800],
    bg: neutral[100],
    kind: "text",
  },
  {
    name: "Bordo errore su sfondo",
    fg: color.error.fg,
    bg: color.background,
    kind: "graphic",
  },
  {
    name: "Successo su sfondo",
    fg: color.success.fg,
    bg: color.background,
    kind: "text",
  },
  {
    name: "Bordo selezionato su sfondo",
    fg: color.primary,
    bg: color.background,
    kind: "graphic",
  },
  {
    name: "Riga live aggiornata: testo su tape tenue",
    fg: color.foreground,
    bg: color.tapeSoft,
    kind: "text",
  },
  {
    name: "Riga live aggiornata: testo secondario su tape tenue",
    fg: color.mutedForeground,
    bg: color.tapeSoft,
    kind: "text",
  },
  {
    name: "LiveBar: dati non aggiornati",
    fg: color.warning.fg,
    bg: color.warning.bg,
    kind: "score",
  },
];
