/**
 * Draws every brand asset the app serves from the ONE master mark, so the tab
 * icon and the link card cannot drift apart.
 *
 *   node apps/web/brand/generate-brand-assets.mjs
 *
 * Run it from the repo root. It uses the `sharp` that Next already installs —
 * there is no extra dependency to add, and nothing in the build runs this: the
 * outputs are committed files. Re-run it when `building-integrity-mark.png`
 * changes, and commit what it writes.
 *
 * The master is Tommy's own simplified Building Integrity mark (the blue house
 * pointing up, the wheat stalk, the field pointing down), supplied 2026-11-13.
 * Its three colours are read off that file rather than guessed:
 */
import { Buffer } from "node:buffer";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const BLUE = "#4C75BF"; // the house
const WHEAT = "#BD7A32"; // the field and the stalk
const DEEP = "#375283"; // the shadow side
const PAPER = "#F7F2E7"; // not from the mark — a warm card background

const here = path.dirname(fileURLToPath(import.meta.url));
const MASTER = path.join(here, "building-integrity-mark.png");
const appDir = path.resolve(here, "..", "app");
const out = (name) => path.join(appDir, name);

/** The mark's own proportions, so nothing below hard-codes 521x778. */
const master = sharp(MASTER);
const { width: MW, height: MH } = await master.metadata();
const markWidthAt = (heightPx) => Math.round((heightPx * MW) / MH);

/** The mark, resized to a given height, as RGBA PNG bytes. */
async function markAtHeight(heightPx) {
  return sharp(MASTER)
    .resize({ height: heightPx, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

/**
 * A square icon: the mark centred on a transparent (or solid) canvas, filling
 * `fill` of the side. The mark is TALLER than it is wide, so height is what
 * binds — a square icon of a portrait mark is mostly empty on the sides and
 * that is correct, not a bug to crop away.
 */
async function squareIcon(side, { fill, background }) {
  const markH = Math.round(side * fill);
  const mark = await markAtHeight(markH);
  return sharp({
    create: { width: side, height: side, channels: 4, background },
  })
    .composite([{ input: mark, gravity: "centre" }])
    .png()
    .toBuffer();
}

/** A multi-size .ico, so a direct /favicon.ico request still gets the mark. */
function icoFromPngs(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(entries.length, 4);

  let offset = 6 + entries.length * 16;
  const dir = [];
  for (const { size, png } of entries) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2); // palette size: none
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    dir.push(entry);
  }
  return Buffer.concat([header, ...dir, ...entries.map((e) => e.png)]);
}

/**
 * The 1200x630 link card. One line of each: who, what, where.
 *
 * ⚠ The second line is the only sentence here aimed at someone who has never
 * seen the app. It is deliberately NOT `layout.tsx`'s description, which says
 * "Reference-only ...", a note to ourselves.
 */
async function linkCard() {
  const W = 1200;
  const H = 630;
  const BAND = 16; // wheat strip along the bottom edge
  const markH = 430;
  const markW = markWidthAt(markH);
  const markX = 112;
  const markY = Math.round((H - BAND - markH) / 2);
  const textX = markX + markW + 88;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${PAPER}"/>
  <rect x="0" y="${H - BAND}" width="${W}" height="${BAND}" fill="${WHEAT}"/>
  <text x="${textX}" y="250" font-family="Segoe UI, Helvetica, Arial, sans-serif"
        font-size="68" font-weight="700" fill="${DEEP}">Building Integrity</text>
  <text x="${textX}" y="312" font-family="Segoe UI, Helvetica, Arial, sans-serif"
        font-size="30" fill="${BLUE}">Draw a straw-panel building, panel by panel,</text>
  <text x="${textX}" y="352" font-family="Segoe UI, Helvetica, Arial, sans-serif"
        font-size="30" fill="${BLUE}">and get its shop drawings and its price.</text>
  <text x="${textX}" y="420" font-family="Segoe UI, Helvetica, Arial, sans-serif"
        font-size="26" font-weight="600" letter-spacing="2" fill="${WHEAT}">strawpanels.com</text>
</svg>`;

  const mark = await markAtHeight(markH);
  return sharp(Buffer.from(svg))
    .composite([{ input: mark, left: markX, top: markY }])
    .png()
    .toBuffer();
}

const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
const paper = { r: 0xf7, g: 0xf2, b: 0xe7, alpha: 1 };

// The tab icon. Transparent, so it reads on a light or a dark tab strip.
writeFileSync(out("icon.png"), await squareIcon(512, { fill: 0.9, background: transparent }));

// iOS composites a home-screen icon onto BLACK, so this one needs a background.
writeFileSync(out("apple-icon.png"), await squareIcon(180, { fill: 0.76, background: paper }));

// 16/32/48 for a direct /favicon.ico hit. Less padding: at 16px every pixel counts.
writeFileSync(
  out("favicon.ico"),
  icoFromPngs(
    await Promise.all(
      [16, 32, 48].map(async (size) => ({
        size,
        png: await squareIcon(size, { fill: 0.96, background: transparent }),
      })),
    ),
  ),
);

const card = await linkCard();
writeFileSync(out("opengraph-image.png"), card);
writeFileSync(out("twitter-image.png"), card);

console.log(`mark ${MW}x${MH} -> icon.png, apple-icon.png, favicon.ico, opengraph-image.png, twitter-image.png`);
