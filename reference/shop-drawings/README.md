# Shop drawing reference

## `2026-09-15-cut-list-reference.pdf`

**Reference only. Not produced by this app, and not a target to diff against.**
Tommy deposited it on 2026-10-11 as an example of a cut-list document whose
*shape* he wants our exported shop drawings to move toward. It is a
third-party document; nothing in it is an authority on straw-bale panel
construction and none of its numbers should be copied into the app as
building values.

Its text is a subsetted CID font with no `ToUnicode` map, so it does not
extract as text — open it in a viewer to read it.

### What Tommy likes about it, in his words (2026-10-11)

> they're one page, very clear and large view of the panel with labels
> (although I don't like how the labels are small font here), info at the top
> regarding that panels details, and a cut list. The cut list is great here as
> far as formatting but it could be organized, labeled, and detailed better.
> For example, using common denominational names for dimensional lumber like
> 2x4 as materials and then length(s) and angles where appropriate (for any
> inclined panel and with a note that clearly details how to cut it for the
> shop crew to be able to determine how to cut it

So: **keep** one page per panel, the large panel view, the details header, and
the cut list's table formatting. **Change** the label font up, and rebuild the
cut list around dimensional-lumber names, lengths, angles, and a cutting note
written for the person at the saw.

### The other half of the ask

> Basically the shop drawing image of each panel should be what that panel
> looks like from the exterior up and left tilted as it would appear when
> isolated in the 3D view

That is a camera change in `apps/web/app/StandardPanel3DView.tsx`, which today
renders at `ELEVATION_DEG = 25` / `AZIMUTH_DEG = 35`.
