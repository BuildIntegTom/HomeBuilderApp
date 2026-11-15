import type { CatalogValue } from "./types";

/**
 * ⚠ **THE FIRST COST DATA THIS APP HAS EVER HAD, and that is a bigger change
 * than the numbers in it.**
 *
 * Every price in `priceRates` carries the same warning: *"IT IS A PRICE, NOT A
 * COST. There is no cost data anywhere in this app: not material, not labour,
 * not overhead."* That was true until 2026-11-15, when Tommy asked for shop
 * items to be priced off what they are made of:
 *
 * > *"lets research some prices and set some prices where the price we come up
 * > with the app is somewhere roughly 2.2x the raw materials cost of lumber
 * > and nails for each beam/column/truss plate/safety gap."*
 *
 * ⚠ **IT IS STILL NOT A FULL COST MODEL.** It covers the stock a shop buys —
 * lumber, sheet goods, fasteners — and nothing else. No labour, no shop
 * overhead, no waste factor, no delivery, no straw, no plaster. So "2.2x
 * materials" is a MARKUP ON STOCK, not a margin: whatever is left over has to
 * pay for the people who cut it. Do not read any of these numbers as telling
 * you whether a job is profitable.
 *
 * ⚠ **EVERY FIGURE HERE IS RESEARCHED MARKET PRICE, NOT BUILDING INTEGRITY'S
 * OWN.** They are retail-yard midpoints from November 2026 listings, which is
 * the best a web search can do and is not what a fabricator buying by the
 * truckload pays. Every one carries `pending-BI-confirmation` for that reason,
 * and they are the numbers most worth replacing with real supplier quotes —
 * a 20% error in the stock price is a 20% error in the sell price, straight
 * through the 2.2.
 *
 * ⚠ **PANELS DO NOT READ ANY OF THIS.** A straw panel is still
 * `priceRates.coveragePerSqFt` by its standing face. See
 * `shopItemPrice.ts`' header for why the two are deliberately different
 * methods rather than an inconsistency.
 */

/**
 * ⚠ **Tommy's own multiplier, 2026-11-15: "roughly 2.2x the raw materials
 * cost of lumber and nails".**
 *
 * `confirmed`, because it is his number rather than a researched one — what
 * is provisional is everything it multiplies, not the 2.2 itself.
 */
export const shopItemMaterialsMarkup: CatalogValue<number> = {
  value: 2.2,
  status: "confirmed",
  note:
    "Tommy, 2026-11-15: \"the price we come up with the app is somewhere roughly 2.2x the raw materials cost of " +
    "lumber and nails for each beam/column/truss plate/safety gap.\" His figure. It multiplies STOCK COST ONLY - " +
    "no labour, overhead, waste or delivery is in the base - so it is a markup on materials, not a margin.",
};

/**
 * Dimensional softwood framing lumber, by the board foot.
 *
 * Derived from November 2026 retail listings, which agree closely once put on
 * a common unit: a 2x4 at $4.15–$4.65 per 8ft stick is $0.78–$0.87/bf, an 8ft
 * 2x6 at $7.52 is $0.94/bf, and a 12ft 2x12 at $23.82 is $0.99/bf. The larger
 * sections run slightly dearer per board foot, which is ordinary.
 *
 * ⚠ **One rate across every size, deliberately.** The spread above is about
 * 20%, and inventing a per-size table out of three data points would dress a
 * guess up as precision. One honest average, clearly flagged, is easier to
 * replace with a real price list than five invented ones.
 */
export const dimensionalLumberCostPerBoardFoot: CatalogValue<number> = {
  value: 0.95,
  status: "pending-BI-confirmation",
  note:
    "RESEARCHED RETAIL MIDPOINT, November 2026 - not a Building Integrity supplier price. SPF/SYP #2 framing " +
    "lumber across 2x4 through 2x12, which price at $0.78-$0.99/board foot at retail. A fabricator buying by the " +
    "unit pays less. Board feet are computed from NOMINAL dimensions per industry convention (see boardFeet.ts).",
};

/**
 * Sheet goods (plywood, OSB), per square foot **per inch of thickness**.
 *
 * A 3/4in CDX 4x8 sheet lists at roughly $40–$55 in November 2026; $45 over
 * 32 sq ft is $1.41/sq ft, which at 3/4in is $1.88 per sq ft per inch.
 *
 * ⚠ **Thickness scales linearly, and that is an approximation.** A 1/2in
 * sheet is not two thirds the price of a 3/4in one in the real world — thin
 * panels carry more of the mill's fixed cost per sheet. It is close enough
 * across the 1/2in–3/4in range this app actually uses, and wrong if somebody
 * ever specifies 1/8in.
 */
export const sheetGoodsCostPerSqFtPerInch: CatalogValue<number> = {
  value: 1.88,
  status: "pending-BI-confirmation",
  note:
    "RESEARCHED RETAIL MIDPOINT, November 2026 - not a Building Integrity supplier price. A 3/4in CDX 4x8 sheet " +
    "at ~$45 is $1.41/sq ft, i.e. $1.88 per sq ft per inch of thickness. Range seen: $40-$55 a sheet, with " +
    "treated and specialty grades higher. Thickness is assumed to scale linearly, which is approximate.",
};

/**
 * LVL, per square inch of cross-section per linear foot.
 *
 * A 1 3/4in x 9 1/2in LVL runs about $7–$11 per linear foot; $9 over a
 * 16.6 sq in section is $0.54. Putting it on a per-section unit rather than a
 * per-foot one is what lets the catalog's own 2in x 9in and 2in x 11 1/4in
 * webs be priced without a second lookup table.
 *
 * ⚠ **LVL IS DEAR, and the old rate did not know it.** At this figure a 10ft
 * 2x9 web is about $97 of stock — more than ten 2x4s. An LVL priced like
 * framing lumber is the one error in this file that would UNDER-charge.
 */
export const lvlCostPerSectionSqInPerFt: CatalogValue<number> = {
  value: 0.54,
  status: "pending-BI-confirmation",
  note:
    "RESEARCHED RETAIL MIDPOINT, November 2026 - not a Building Integrity supplier price. A 1-3/4 x 9-1/2in LVL " +
    "at ~$9/linear foot over its 16.6 sq in section is $0.54 per sq in of section per foot. Ranges seen: " +
    "$7-$14/LF at 9-1/2in, $8-$18/LF at 11-7/8in. Expressed per section so the catalog's 2x9 and 2x11-1/4 webs " +
    "price without a second table.",
};

/**
 * Nails and screws, as a fraction of a piece's lumber and sheet cost.
 *
 * ⚠ **THE WEAKEST NUMBER IN THIS FILE, and it is in his instruction** —
 * *"lumber and nails"*. Fasteners are a few percent of framing material cost
 * in ordinary construction, and 5% is the middle of the range usually quoted.
 *
 * ⚠ It is a PERCENTAGE rather than a count, although this app knows real
 * fastener schedules (`fastenerSpacingTable`, `fastenerWeight.ts`). Counting
 * them properly is a better answer and a bigger job: the schedules cover
 * panel-to-panel connections rather than the fasteners inside one built-up
 * beam, so a real count would need a schedule per shop item that nobody has
 * written. The percentage is honest about being a placeholder; a precise-
 * looking count derived from the wrong schedule would not be.
 */
export const fastenerAllowanceFraction: CatalogValue<number> = {
  value: 0.05,
  status: "pending-BI-confirmation",
  note:
    "PLACEHOLDER. Fasteners as 5% of a piece's lumber and sheet cost, the middle of the range usually quoted for " +
    "framing. Tommy's instruction says \"lumber and nails\", so they are in the base rather than ignored. This " +
    "app has real fastener schedules but they describe panel-to-panel connections, not the nails inside one " +
    "built-up beam, so counting from them would be precise about the wrong thing.",
};
