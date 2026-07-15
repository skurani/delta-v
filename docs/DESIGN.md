# Delta-V — Design Reference

*Combines the Dashboard Design Handoff (v1.0, Jul 7 2026) and the Brand Guidelines. This is the full design spec — implemented tokens live in `src/app/styles.css`; this file is the source of truth for anything not yet built or needing verification.*

---

## Part 1 — Dashboard Design Handoff v1.0

**Sources:** Delta-V Brand Sheet, Delta-V Dashboard Hi-Fi

### 01 Overview

Delta-V is an AI spend control plane: a dashboard that monitors, attributes, and forecasts LLM API spend, with an always-on copilot for investigation. This spec covers the shipped hi-fi design — the left-rail chat dock layout.

Canvas: 1440 × 940 desktop. Chat dock is a fixed 320px left column; the canvas takes the remainder. Chat and canvas are visible simultaneously — answers from the copilot can be pinned to the canvas as live cards.

### 02 Foundations

**Typography**

| Role | Font | Size / Weight / Tracking |
|---|---|---|
| Wordmark / product name | Schibsted Grotesk | 18px · 500 · -0.015em |
| KPI value | Schibsted Grotesk | 30px · 500 · -0.02em |
| Panel title | Schibsted Grotesk | 15px · 500 |
| Body / chat | Schibsted Grotesk | 13px · 400 · lh 1.55 |
| Section label (eyebrow) | IBM Plex Mono | 9px · 400 · +0.2em · UPPERCASE |
| Data annotation / axis | IBM Plex Mono | 9–10px · 400 · +0.06–0.1em |

**Rule:** Schibsted Grotesk for everything a human reads; IBM Plex Mono for everything a machine emits (labels, values in tables, axes, timestamps, provenance).

**Color tokens**

| Token | Hex | Use |
|---|---|---|
| bg/page | #0E0E0E | App background |
| bg/rail | #121212 | Chat dock background |
| bg/panel | #191919 | Cards, panels |
| border/hairline | #2E2E2E | Panel borders, dividers |
| text/primary | #F2F2F2 | Values, titles |
| text/secondary | #8A8A8A | Chat body, captions |
| text/tertiary | #787878 | Eyebrows, axes, hints |
| signal/positive | #8CC3F2 | Savings, healthy utilization |
| signal/negative | #F2968C | Overage, anomalies, alerts |

Signal colors are reserved for semantic state only — never decoration. Everything else stays on the monochrome ramp.

Heatmap cells use `rgba(140,195,242, α)` where α scales linearly with cell value (0.05–0.95); text flips to #0E0E0E when α ≥ 0.4.

A film-grain overlay sits above the whole app at 14% opacity (SVG fractal noise, 240px tile, pointer-events none). *(Implemented at 5.5% per the Stage 2a readability pass — see CLAUDE.md.)*

### 03 Layout & spacing

- **Top bar** — 64px tall, hairline bottom border. Logo lockup left; as-of time scrubber and role switcher (FINOPS / ENG) right.
- **Chat dock** — fixed 320px column, full height, right hairline border, one shade darker than canvas (bg/rail). Header eyebrow, scrolling thread, suggestion chips + input pinned at bottom.
- **Canvas** — 24px padding, three stacked grid rows with 16–20px gaps: KPI row `repeat(4, 1fr)`; charts row `1fr 380px`; bottom row `300px 1fr 340px`. *(Implemented as a 12-column auto-flow grid with per-card spans approximating these proportions, to support rearrange/pin — see CLAUDE.md Stage 2a notes.)*
- **Radii** — 6px panels/cards, 3px buttons, 2px bars and heatmap cells, 999px chips. Panel padding — 18–20px.

### 04 Components & behavior

| Component | Spec & behavior |
|---|---|
| Chat message (user) | Right-aligned, max 240px, #252525 fill on #363636 border, radius 8 8 2 8. |
| Inline answer card | Chart + PIN action in header. On hover border lightens one step. PIN moves a live copy of the card onto the canvas (see Pinned card); button inverts to white fill on hover. |
| Suggestion chips | Pill, mono 10px, border only. Hover: text and border lighten. Click submits the query. |
| KPI card | Eyebrow → 30px value → mono footnote or 3px progress bar. Value/footnote takes signal color when state is semantic (over budget, alerts). |
| Forecast chart | Actual = solid white 2px; forecast = dashed grey 1.5px, switching to dashed signal/negative where the projection crosses budget; budget = solid 1.5px #484848 rule. "Today" marked with a 3.5px dot. |
| Daily spend bars | Grey ramp; anomalous day takes signal/negative fill and axis label. |
| Attribution heatmap | Team × model grid, 6px gap, 30px min cell height. Alpha-scaled signal/positive fills per the gradient rule in §02. *(Implemented as feature × model, LLM-scoped — see CLAUDE.md Stage 2b notes for why.)* |
| Pinned card | Distinguished from native panels by 1px dashed border (#484848, lightens on hover), darker fill (#161616), drag handle (⠿, cursor grab), dismiss (✕), and a mono provenance line quoting the originating chat query. Stays live-updating after pin. |

### 05 Assets & references

- **Delta-V Brand Sheet** — logo lockups (primary, stacked, on-light, mark-only + small-size ramp), full type & usage rules. (See Part 2 below.)
- **Delta-V Dashboard Hi-Fi** — the implemented reference screen; all values in this doc are measured from it.
- **Logo mark SVG** — triangle: `M48 12 L86 82 L10 82 Z`, stroke 6, round joins; limit bar: x 28–68, y 60, stroke 8 (96×96 viewBox). Scale strokes up at small sizes per the brand sheet ramp.
- **Fonts** — Google Fonts: Schibsted Grotesk 400/500/600, IBM Plex Mono 400/500.

**Open questions (as of handoff v1.0) — resolved status:**
- Pinned-card persistence model (per user? per workspace?) — **resolved for M1: session-only, no persistence.** Real persistence is an M2 backlog item.
- Heatmap drill-down target — **resolved: modal showing filtered underlying events for the clicked cell.**
- Role-switcher scope (view filter vs. permission boundary) — **resolved: permission boundary** (FinOps/Eng maps to the guardrail's role gate, not a view filter).

---

## Part 2 — Brand Guidelines

*GOV ΔV · 01 · 2026*

**Tagline:** Delta-V → governs your AI spend

### 01 Logo

- **Primary lockup · horizontal:** △ Delta-V
- **Stacked · with descriptor:** △ / Delta-V / AI SPEND CONTROL PLANE
- **Positive · on light:** same lockup, dark text on light background
- **Mark · app icon & small sizes:** triangle mark alone at 32 / 20 / 14px

### 02 Typography

- **Primary — Schibsted Grotesk:** wordmark weight 500, tracking −1.5%. Headlines: 400–500, tracking −2%. Body: 400. **Never use bold 600+ in the wordmark.**
- **Technical — IBM Plex Mono:** annotations, descriptors, labels, data. Always uppercase for labels, tracking +8% to +28%. Sizes 9–12px in UI, never for body copy.

### 03 Color (brand-sheet monochrome ramp)

| Token | Hex |
|---|---|
| Void | #000000 |
| Panel | #0A0A0A |
| Signal White | #F2F2F2 |
| Trace Grey | #8A8A8A |
| Annotation | #5C5C5C |

Monochrome only. The mark and wordmark render in Signal White on dark, near-black (#0C0C0C) on light. **No accent colors, no gradients** — hierarchy comes from grey steps and line weight.

*(Note: the product UI's signal/positive and signal/negative tokens from Part 1 are the one sanctioned exception to "no accent colors" — reserved strictly for semantic state in the dashboard, per §02 above. The brand mark itself stays monochrome.)*

### 04 Rules

**Do:**
- Keep clear space around the lockup equal to the mark's height.
- Use the mark alone at 32px and below (favicon, app icon, avatars).
- Reserve the arrow + tagline masthead for marketing surfaces only.
- Keep the limit bar horizontal — it is the "governor."

**Don't:**
- No color fills, gradients, or glows on the mark.
- Don't rotate, outline-only-thin, or detach the limit bar.
- Don't set the wordmark in any typeface but Schibsted Grotesk.
- Don't use the tagline at small sizes.
