---
name: Building Integrity
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f3'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1a1c1c'
  on-surface-variant: '#43474d'
  inverse-surface: '#2f3131'
  inverse-on-surface: '#f0f1f1'
  outline: '#73777e'
  outline-variant: '#c3c7ce'
  surface-tint: '#426180'
  primary: '#002743'
  on-primary: '#ffffff'
  primary-container: '#1c3d5a'
  on-primary-container: '#89a8ca'
  inverse-primary: '#aacaed'
  secondary: '#0061a5'
  on-secondary: '#ffffff'
  secondary-container: '#6fb2fd'
  on-secondary-container: '#004375'
  tertiary: '#312300'
  on-tertiary: '#ffffff'
  tertiary-container: '#4b3800'
  on-tertiary-container: '#c99f2f'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#cfe5ff'
  primary-fixed-dim: '#aacaed'
  on-primary-fixed: '#001d34'
  on-primary-fixed-variant: '#294967'
  secondary-fixed: '#d2e4ff'
  secondary-fixed-dim: '#a0caff'
  on-secondary-fixed: '#001c37'
  on-secondary-fixed-variant: '#00497e'
  tertiary-fixed: '#ffdf97'
  tertiary-fixed-dim: '#eec14e'
  on-tertiary-fixed: '#251a00'
  on-tertiary-fixed-variant: '#5a4300'
  background: '#f9f9f9'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e2'
  ink: '#333333'
  muted: '#777777'
  border: '#cccccc'
  instrument-bg: '#eef2f6'
  instrument-border: '#ccd6e0'
  sticky-note-fill: '#f2e8c9'
  pending-amber: '#a67c00'
  warning-red: '#c0392b'
  standard-panel: '#d9c9a3'
  column-panel: '#4a90a4'
  corner-panel: '#8a8a8a'
  braced-panel: '#b06fc9'
  safety-gap: '#e08a3c'
  window-panel: '#8fc7e8'
  door-panel: '#7a4a2b'
  header-pink: '#e85d9c'
  header-gold: '#c9a63f'
  sill-green: '#6fa87a'
  gable-blue: '#9fb8e0'
typography:
  display-h1:
    fontFamily: Geist
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-md:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-xs:
    fontFamily: Geist
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
  caption-tiny:
    fontFamily: Geist
    fontSize: 9px
    fontWeight: '400'
    lineHeight: 12px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  topbar-height: 56px
  sidebar-width: 240px
  tray-width: 170px
  stack-xs: 4px
  stack-sm: 8px
  stack-md: 12px
  stack-lg: 16px
  canvas-padding: 24px
---

## Brand & Style
The design system for Building Integrity embodies the "performance of modern construction, integrity of natural materials." It positions the product as a high-precision CAD-adjacent tool that remains approachable and grounded through its material-inspired palette.

The visual style is **Tactile-Technical Modernism**. It blends the clean, functional aesthetics of an "Instrument Panel" (software precision) with the warm, "Sticky Note" materiality of the construction site. 

### Key Principles:
- **Authority through Transparency:** Real-world disclaimers and data provenance (confirmed vs. pending) are designed as core UI features, not fine print.
- **Spatial Navigation:** Navigation follows the building's physical logic (Wall > Foundation > Floor > Roof) and the viewer's physical position (2D > Elevation > 3D).
- **Role-Based Fidelity:** 
    - **Public Users:** Simplified view focusing on pricing and layout ease.
    - **Fabricators:** High-density technical views and manufacturing status.
    - **Architects:** Full transparency with engineering and certification workflows.

## Colors
The color strategy uses two distinct families to separate "The Work" from "The Reference."

- **Brand Navy (#1c3d5a) & Blue (#4a90d9):** Used for primary chrome, active states, and structural UI elements.
- **The Instrument Family:** A neutral blue-gray palette (`instrument-bg`, `instrument-border`) for active editing tools and toolbars.
- **The Sticky Note Family:** Warm gold and cream tones (`tertiary_color_hex`, `sticky-note-fill`) specifically reserved for reference documents, help guides, and output summaries.
- **Semantic Panel Colors:** These are non-negotiable technical identifiers. They must be used consistently across 2D, 3D, and Legend views to identify specific construction components.
- **Confidence States:** Use `pending-amber` for data requiring Building Integrity confirmation.

## Typography
The system uses Geist Sans exclusively to maintain a modern, engineered feel. The scale is intentionally compact to maximize canvas space for technical drawings.

- **Display H1:** Reserved for page titles and major document headers.
- **Headline MD:** Used for section headers within toolbars and cards.
- **Body & Labels:** The primary interface relies on the 11px-13px range. Weights should be used sparingly (Bold/600 for labels, Regular/400 for data).
- **Legal/Disclaimers:** Should never fall below 11px to ensure the "Reference-only" posture remains legible and load-bearing.

## Layout & Spacing
The layout uses a **Persistent Canvas Model**. The drawing area is the primary focus, with controls docked or floating around it.

- **Dual-Axis Navigation:** The TopBar handles the "System Scope" (Project levels), while a secondary control (the "Dial") handles "Viewpoints" (Perspective).
- **The Tray:** A 170px reserved area on the right edge hosts the `SectionCarousel` (Sticky Note family cards).
- **Floating Layer:** Contextual info (Selected Panel details) uses draggable, floating cards to prevent layout shift during intensive editing.
- **Grid:** Use a 4px base unit for internal component spacing, scaling to 12px/16px for container margins.

## Elevation & Depth
Depth is used to distinguish between "Fixed UI," "Reference Material," and "The Canvas."

- **Canvas (Level 0):** The bottom-most layer. No shadows.
- **Toolbars & Legends (Level 1):** Flat surfaces with `1px` borders (`instrument-border`). 
- **Sticky Note Cards (Level 2):** Use a subtle ambient shadow (4px blur, 10% opacity) to indicate they are "placed" on the tray.
- **Floating Panels (Level 3):** Highest elevation. Use a distinct shadow to show they are draggable and can overlap the canvas or toolbars.
- **Disclaimers:** Persistent banner in the TopBar or footer area, styled with high contrast to remain at the top of the information hierarchy.

## Shapes
The shape language follows a "Soft Industrial" approach.

- **Containers:** 8px rounded corners for most toolbars and cards.
- **Sticky Notes:** Slightly larger 12px radius to emphasize their "paper" metaphor.
- **Controls:** Buttons and input fields use a consistent 6px radius.
- **Panel Legend:** Color swatches should remain sharp or minimally rounded (2px) to reflect the rigid nature of construction materials.

## Components

### Buttons & Interaction
- **Primary:** Filled `brand-blue` with white text.
- **Secondary (Drawing Tools):** Outline `border` style, switching to filled `brand-blue` when active.
- **Instrument Controls:** Compact, low-profile buttons within the `instrument-bg` panels.

### Sticky Notes & Document Cards
- **Style:** `sticky-note-fill` background with a `tertiary_color_hex` top border (2px).
- **Usage:** Used for `Detail Guide`, `Shop Drawings`, and `Review Logs`. These should feel like a physical stack of reference materials.

### Data Provenance Chips
- **Confirmed:** Subtle green check or border.
- **Pending:** `pending-amber` background with a "BI Confirmation Required" label. These must be visible "inline throughout" for Admin and Fabricator roles.

### The Role Switcher
- A prominent toggle in the TopBar that reflows the UI:
    - **Public:** Hides technical toolbars, shows "Pricing Summary."
    - **Fabricator:** Enables "Shop Drawing" cards and "Cut Lists."
    - **Architect:** Shows "Engineering Stamp" status and "Active" project visibility.

### Legal Banner
- High-visibility strip (Red/Navy) that dynamically updates based on the `viewerRole` disclaimer strings. It is a permanent fixture of the viewport.