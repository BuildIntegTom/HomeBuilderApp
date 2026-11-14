import type { MetadataRoute } from "next";

/**
 * ⚠ **THE WEB APP MANIFEST — added 2026-11-13 so the home-screen tile stops
 * being a small mark in a big white circle.**
 *
 * > *"can we make the favicon/thumbnail bigger? I would like straw panels
 * > too. Pretty entirely fill the space there. Similar to tip for your
 * > time."* — Tommy, with a screenshot of his home screen
 *
 * Raising the fill numbers alone could not have fixed it. **Android wraps a
 * non-maskable icon in its own white circle, with its own padding**, and
 * nothing inside the PNG changes that. The only way to fill the tile is to
 * declare an icon `purpose: "maskable"`, which tells the launcher the image
 * is full-bleed and safe to crop to whatever shape it uses. That is why
 * Tip4urTime fills its tile and this did not.
 *
 * ⚠ **BOTH purposes are listed, and both are needed.** A manifest that
 * declares only a maskable icon gets that icon used *unmasked* in places that
 * expect a plain one — the install prompt, the task switcher — where the
 * full-bleed background reads as a blunt square. `"any"` and `"maskable"` are
 * separate files here precisely because the safe-zone padding that makes one
 * correct makes the other look shrunken.
 *
 * ⚠ **`icon-maskable.png` is served from `public/`, not `app/`.** Next's file
 * conventions serve `app/icon.png` and `app/apple-icon.png` by exact name;
 * `app/icon-maskable.png` matches nothing and would 404 behind a manifest
 * entry that looks right. See `brand/generate-brand-assets.mjs`, which writes
 * it there deliberately.
 *
 * ⚠ **`display: "standalone"` changes how an installed copy opens** — no URL
 * bar, no browser back button — which is a real behaviour change rather than
 * a cosmetic one. It is the normal choice for something kept on a home screen
 * and used as an app, which is how he is using it, but it is his to reverse:
 * `"browser"` keeps the tab chrome.
 *
 * ⚠ Every asset here comes from `brand/generate-brand-assets.mjs` and the one
 * master mark. Change the mark, re-run the script, commit what it writes —
 * never hand-edit an output.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Building Integrity — Fabricator App",
    short_name: "Straw Panels",
    description: "Draw a straw-panel building, panel by panel, and get its shop drawings and its price.",
    start_url: "/",
    display: "standalone",
    /* The card stock the link thumbnail already uses, so a splash screen and
       an unfurl are the same colour rather than two near-whites. */
    background_color: "#F7F2E7",
    theme_color: "#4C75BF",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
