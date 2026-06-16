# LittleLoop — Design System

---

## Fonts

Import once in `index.html`:

```html
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
```

| Role | Family | Weight | Usage |
|---|---|---|---|
| Display / headings | DM Sans | 600 | Hero text, screen titles |
| Body | DM Sans | 400 | All prose, labels, nav |
| Medium | DM Sans | 500 | Buttons, pills, eyebrows |
| Data | DM Mono | 400–500 | Scores, prices, garment IDs, stats |

**Rules:**
- Sentence case everywhere. Never ALL CAPS, never Title Case in body copy.
- Eyebrows (section labels above headings): 10px, 500 weight, 0.12em letter-spacing, text-transform uppercase.
- Numeric data always uses DM Mono — scores, prices, IDs, sustainability numbers.

---

## Color Palette

All six values. Use nothing else.

| Name | Hex | Usage |
|---|---|---|
| Carter's Blue | `#00ABE1` | Primary CTAs, links, active states, timeline line |
| Loop Green | `#7DC242` | Sustainability accent, Excellent grade, approve button |
| Deep Navy | `#1A3A5C` | Headings, passport hero bg, dashboard banner, role badges |
| Sky Tint | `#E3F6FD` | Card backgrounds, filter pills, impact chips |
| Cream | `#F7F8FA` | Page background, table headers, scan zone bg |
| Mint Tint | `#EEF7E3` | Success state backgrounds, impact receipt bg |

**Derived values** (use these, don't invent others):

| Name | Hex | Derived from |
|---|---|---|
| Blue mid | `#B3E5F7` | Sky Tint border, timeline dashes |
| Blue dark | `#006E99` | Data text on Sky Tint backgrounds |
| Green dark | `#4E8A1E` | Text on Mint Tint backgrounds |
| Text muted | `#6B7A8D` | Secondary labels, nav links, table headers |
| Border | `rgba(0,0,0,0.08)` | All card and input borders |
| Warning | `#E8A020` | Fair grade badge bg |
| Warning bg | `#FEF3E2` | Defect tags, Fair state chips |
| Warning text | `#92610C` | Text on warning bg |
| Danger | `#C0392B` | Reject button text, Rejected grade |
| Danger bg | `#FADBD8` | Reject button border |

---

## Spacing & Radius

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | `8px` | Buttons, pills, small chips |
| `--radius-md` | `12px` | KPI cards, table, filter pills |
| `--radius-lg` | `14–16px` | Panels, marketplace cards, passport card |
| `--radius-xl` | `20px` | Passport card top, hero sections |
| Page padding | `20px` | Outer padding on all screens |
| Card padding | `16–20px` | Inner padding on white panels |
| Gap (grid) | `8–12px` | Between cards, KPIs, pills |
| Gap (inline) | `6–8px` | Between icon and label, badge and score |

---

## Components

### Nav bar
- White background, `0.5px solid rgba(0,0,0,0.08)` border, `16px` radius, `14px 20px` padding.
- Logo mark: `28×28px`, `#00ABE1` background, `8px` radius, white circular icon inside.
- Logo text: `14px / 600`, navy. The word "loop" in Carter's Blue.
- Nav links: `12px / 500`, muted by default, navy when active.
- Primary CTA: `#00ABE1` background, white text, `100px` radius (pill), `7px 16px` padding, `12px / 500`.

### Buttons
| Type | Background | Text | Border | Radius |
|---|---|---|---|---|
| Primary | `#00ABE1` | White | None | 100px pill |
| Approve | `#7DC242` | White | None | `10px` |
| Reject | White | `#C0392B` | `1.5px solid #FADBD8` | `10px` |
| Pill / filter | White (inactive) / `#E3F6FD` (active) | Muted / `#006E99` | `1.5px solid` border/`#00ABE1` | 100px pill |

### Grade badges
Pill shape, `100px` radius, `11px / 600`, white text. Always a colored pill — never plain text.

| Grade | Background |
|---|---|
| Excellent | `#7DC242` |
| Good | `#4E8A1E` |
| Fair | `#E8A020` |
| Rejected | `#C0392B` |

### Cards
- Background: white
- Border: `0.5px solid rgba(0,0,0,0.08)`
- Radius: `14px` (marketplace, panels) / `20px` (passport)
- No drop shadows anywhere.

### KPI / metric cards
- Background: white, border as above, `12px` radius, `12px` padding.
- Label: `9px`, uppercase, `0.08em` letter-spacing, muted text.
- Value: `20px / 600`, DM Mono, Deep Navy.
- Delta: `10px`, Loop Green dark.

### Impact chips
- Background: `#E3F6FD`, `12px` radius, centered text.
- Value: DM Mono `15px / 500`, `#006E99`.
- Label: `9px`, uppercase, `0.06em` letter-spacing, `#006E99` at 70% opacity.
- Use in groups of 3 in a 3-column grid.

### Defect tags
- Background: `#FEF3E2`, border: `1px solid #F0C97E`, `100px` radius.
- Text: `10px`, `#92610C`.

### Scan zone
- Border: `2px dashed #B3E5F7`, `12px` radius.
- Background: Cream.
- Icon: Tabler `ti-qrcode`, `28px`, Carter's Blue.
- Label: `11px`, muted.

### Sustainability banner (dashboard only)
- Background: Deep Navy (`#1A3A5C`), `14px` radius, `16px 20px` padding.
- 3-column grid.
- Value: DM Mono `18px / 500`, Carter's Blue.
- Label: `9px`, uppercase, `rgba(255,255,255,0.4)`.

---

## Lifecycle Timeline

The signature component. Mimics a stitched seam rather than a generic dot-connector line.

- Container: `padding-left: 24px`, relative positioning.
- Thread line: `2px` wide, positioned at `left: 7px`, rendered as a repeating dashed CSS gradient (4px dash / 4px gap) in `#B3E5F7`. Not a solid line.
- Dots: `10px` circle, `2px` border, white fill (pending) or filled (complete).
  - Completed: filled `#00ABE1`.
  - Final/green event (sanitized/resold): filled `#7DC242`, border `#7DC242`.
- Event cards: Cream background, `0.5px` border, `10px` radius, `8px 12px` padding.
  - Event type: `11px / 500`, Deep Navy.
  - Date + score: `10px`, DM Mono, muted.

---

## Screen-Specific Notes

### Digital Passport (hero screen — highest design priority)
- Hero section: Deep Navy background with a subtle diagonal crosshatch texture at `rgba(255,255,255,0.025)` — fabric texture reference, not a gradient.
- Eyebrow above title: `9px`, `0.15em` letter-spacing, Carter's Blue.
- Score chip: `rgba(255,255,255,0.1)` background, `rgba(255,255,255,0.15)` border, pill shape.
- Grade badge sits inline in the score row.
- Impact chips below the timeline in a 3-column grid.
- QR code image displayed below impact chips, served from `/static/qr/<garment_id>.png`.

### Marketplace
- Page subtitle: garment count in muted text, right-aligned.
- Card image area: `90px` tall. Shows the garment's real product photo (`thumbnail_url`) — the locked palette and "no colors outside the palette" rule govern UI chrome only, not product photography. If a card has no photo, fall back to a colored tint background (rotate: Sky Tint, Mint Tint, Warning bg, light purple `#F0EBF8`).
- Condition flag: absolute positioned top-right of image, pill badge.
- "View" button: Carter's Blue, `10px`, `8px` radius, `5px 10px` padding.

### Employee Trade-In
- Two-column layout: left = scan + garment info, right = AI assessment result.
- Score bar: `6px` track, `#E3F6FD` background, `#7DC242` fill, `100px` radius.
- Role indicator: Deep Navy pill badge in nav replacing the CTA.

### Corporate Dashboard
- Role indicator: same as employee.
- KPI grid: 4 columns.
- Sustainability banner: full width, below KPIs.
- Durability table: inline bar charts in the condition column (4px track, Carter's Blue fill).

---

## What Not To Do

- No gradients anywhere.
- No drop shadows.
- No pure black (`#000000`) — use Deep Navy for dark text.
- No pure white page backgrounds — always Cream (`#F7F8FA`).
- No colors outside the palette above.
- No font other than DM Sans and DM Mono.
- No font weights other than 300, 400, 500, 600.
- No ALL CAPS except eyebrow labels (10px, 500wt, letter-spaced).
- No generic dot-and-line timelines — always use the stitched seam style.
- No numbered step markers (01/02/03) — they are decorative and meaningless here.