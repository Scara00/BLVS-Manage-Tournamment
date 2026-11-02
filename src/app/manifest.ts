import type { MetadataRoute } from "next";

/**
 * Web app manifest: name and icon when the site is added to a phone's
 * home screen (Android; iOS reads `apple-icon.png`). The icons are the
 * BLVS logo, white on black like the top bar, kept inside the maskable
 * safe zone so the same file serves round and square launchers.
 * `display: "browser"`: the shortcut opens the site in the browser as usual.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BLVS – Manage Tournament",
    short_name: "BLVS",
    description:
      "Gestisci tornei, squadre, calendari e risultati in un unico posto.",
    lang: "it",
    start_url: "/",
    display: "browser",
    background_color: "#ffffff",
    theme_color: "#000000",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
