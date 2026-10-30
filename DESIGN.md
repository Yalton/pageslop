---
name: Pageslop
description: A card catalogue for saved links, graphite or off-white with one ink-blue accent.
colors:
  ink-blue: "hsl(222 70% 54%)"
  ink-blue-text: "hsl(221 100% 78%)"
  graphite-ground: "hsl(216 11% 9%)"
  rail-graphite: "hsl(210 12% 6%)"
  graphite-card: "hsl(214 10% 14%)"
  graphite-raised: "hsl(213 11% 17%)"
  graphite-hover: "hsl(213 11% 19%)"
  card-stock-text: "hsl(40 19% 91%)"
  graphite-muted-text: "hsl(215 7% 68%)"
  graphite-hairline: "hsl(213 10% 21%)"
  graphite-input-line: "hsl(214 9% 26%)"
  graphite-line-strong: "hsl(214 9% 29%)"
  signal-red: "hsl(4 72% 52%)"
  ink-blue-light: "hsl(223 69% 45%)"
  off-white-ground: "hsl(48 17% 94%)"
  card-white: "hsl(0 0% 100%)"
  off-white-raised: "hsl(45 14% 89%)"
  graphite-text: "hsl(216 9% 11%)"
  off-white-muted-text: "hsl(214 7% 38%)"
  off-white-hairline: "hsl(42 11% 83%)"
  off-white-input-line: "hsl(42 9% 76%)"
  off-white-line-strong: "hsl(42 9% 72%)"
  signal-red-light: "hsl(5 64% 48%)"
  cat-technology: "#5b95f7"
  cat-news: "#e2a83b"
  cat-reference: "#3fb8a8"
  cat-entertainment: "#ec6b8f"
  cat-shopping: "#e6884d"
  cat-social: "#a58af3"
  cat-education: "#86c552"
  cat-finance: "#bccb4f"
  cat-health: "#ee8a63"
  cat-creative: "#cf86e0"
  cat-other: "#959ca5"
  cat-technology-light: "#2559c9"
  cat-news-light: "#8a5a00"
  cat-reference-light: "#0f7366"
  cat-entertainment-light: "#b02a55"
  cat-shopping-light: "#a3460f"
  cat-social-light: "#6a44d4"
  cat-education-light: "#3d7414"
  cat-finance-light: "#5c6b0c"
  cat-health-light: "#a8401a"
  cat-creative-light: "#9339a8"
  cat-other-light: "#5f666f"
typography:
  display:
    fontFamily: "Zilla Slab, Rockwell, serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  wordmark:
    fontFamily: "Zilla Slab, Rockwell, serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Zilla Slab, Rockwell, serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.4
  title:
    fontFamily: "Zilla Slab, Rockwell, serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "Source Sans 3, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  body-small:
    fontFamily: "Source Sans 3, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.375
  control:
    fontFamily: "Source Sans 3, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.43
  label:
    fontFamily: "Source Sans 3, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.33
  micro:
    fontFamily: "Source Sans 3, system-ui, sans-serif"
    fontSize: "9px"
    fontWeight: 700
  hero-sm:
    fontFamily: "Zilla Slab, Rockwell, serif"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.02em"
  hero-md:
    fontFamily: "Zilla Slab, Rockwell, serif"
    fontSize: "56px"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.02em"
  hero:
    fontFamily: "Zilla Slab, Rockwell, serif"
    fontSize: "64px"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.02em"
  section:
    fontFamily: "Zilla Slab, Rockwell, serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1.1
  feature-title:
    fontFamily: "Zilla Slab, Rockwell, serif"
    fontSize: "21px"
    fontWeight: 700
  lede:
    fontFamily: "Source Sans 3, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 400
rounded:
  sm: "2px"
  md: "4px"
  lg: "6px"
  xl: "10px"
  full: "9999px"
spacing:
  nav-gap: "4px"
  card-stack: "6px"
  card-inset: "12px"
  grid-column: "16px"
  page: "24px"
  grid-row: "26px"
components:
  button-primary:
    backgroundColor: "{colors.ink-blue}"
    textColor: "{colors.card-white}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-ghost-hover:
    backgroundColor: "{colors.graphite-hover}"
    textColor: "{colors.card-stock-text}"
    rounded: "{rounded.md}"
  button-link:
    textColor: "{colors.ink-blue-text}"
    typography: "{typography.control}"
  input:
    textColor: "{colors.card-stock-text}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "36px"
  index-card:
    backgroundColor: "{colors.graphite-card}"
    textColor: "{colors.card-stock-text}"
    rounded: "{rounded.md}"
    padding: "10px 12px 12px"
  index-card-tab:
    backgroundColor: "{colors.graphite-card}"
    textColor: "{colors.graphite-muted-text}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "27px"
  tag-pill:
    textColor: "{colors.graphite-muted-text}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  category-label:
    textColor: "{colors.cat-technology}"
    typography: "{typography.label}"
  nav-item:
    textColor: "{colors.card-stock-text}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    height: "36px"
  nav-item-active:
    backgroundColor: "{colors.graphite-card}"
    textColor: "{colors.card-stock-text}"
  nav-unread-count:
    textColor: "{colors.ink-blue-text}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
---

# Design System: Pageslop

## Overview

**Creative North Star: "The Card Catalogue"**

Pageslop files the web like a library card drawer. Every saved link is an index card with a real tab, and the tabs stagger across the drawer by category so the eye can run down a row and sort it before reading a word. The world lends type, palette, density and that one signature move; navigation, layout and controls stay plain and standard, because the job is triage and retrieval, and scanning speed beats expression.

The chrome is quiet on purpose. A graphite ground (dark, the default) or a warm off-white (light) carries one ink-blue accent and nothing else. The colour on screen comes from the saved sites themselves: their preview images, a flat panel tinted by the domain's hue when a site has no image, and the category colour on each tab. Density is high and even: about five cards to a row at 1440px wide, big preview images, small solid labels.

The slab face names things (pages, cards, groups, tags, the wordmark) and a sturdy humanist sans does all the rest. Depth is one soft card shadow and a two-pixel hover lift; there is no glow, no decorative blur, no colour wash behind content.

**Key Characteristics:**
- Index cards with a physical tab: favicon, uptime dot and domain on the tab, category colour on its top edge.
- Tabs at three staggered offsets chosen by category.
- Graphite or off-white chrome, one ink-blue accent split into a fill role and a text role.
- Colour comes from the sites' own images, domain hues and category colours, never from the chrome.
- Zilla Slab for names, Source Sans 3 for everything else.
- Dense, even grid; big 16:9.5 preview images.

## Colors

A neutral graphite (or warm off-white) instrument with a single ink-blue accent; all other colour belongs to the content.

### Primary
- **Ink Blue** (ink-blue; ink-blue-light in the light theme): the accent as a *fill*. Primary buttons, text selection, the native `accent-color` on checkboxes, the selected-card border and ring, and the collapsed rail's unread dot.
- **Ink Blue Text** (ink-blue-text; the light theme reuses ink-blue-light): the accent as *text and focus*. Link buttons, active nav icons, the unread count, tag-pill hover text, the caret, and every focus ring.

### Tertiary
- **Category Colours** (cat-technology through cat-other, with a `-light` twin per theme): one per auto-assigned category. They appear only on the index-card tab's top edge and in the category label (text plus a small square marker). The dark set is bright enough for text on graphite cards; the light set is darkened for text on white cards.

### Neutral
- **Graphite Ground** (graphite-ground) / **Off-White Ground** (off-white-ground): the page.
- **Rail Graphite** (rail-graphite) / **Off-White Raised** (off-white-raised): the side rail, a step darker than the page in dark and a step deeper than the page in light.
- **Graphite Card** (graphite-card) / **Card White** (card-white): index cards and tabs, popovers in light, and the active nav item's fill.
- **Graphite Raised** (graphite-raised) / **Off-White Raised**: secondary and muted fills: popovers, secondary buttons, count pills, image placeholders.
- **Graphite Hover** (graphite-hover): ghost-button and menu hover fills.
- **Card-Stock Text** (card-stock-text) / **Graphite Text** (graphite-text): primary text, a warm off-white on dark and a near-black graphite on light.
- **Muted Text** (graphite-muted-text / off-white-muted-text): descriptions, tab text at rest, tag text, counts.
- **Hairline** (graphite-hairline / off-white-hairline): every default border and separator.
- **Input Line** (graphite-input-line / off-white-input-line): input and outline-button strokes.
- **Line Strong** (graphite-line-strong / off-white-line-strong): the card border on hover, and the scrollbar thumb.
- **Signal Red** (signal-red / signal-red-light): destructive actions and invalid fields only.

### Named Rules
**The Two Inks Rule.** Ink Blue is a fill; Ink Blue Text is text, icons and focus. Never set text in the fill blue on graphite, and never fill a surface with the text blue.

**The Colour Comes From the Sites Rule.** Chrome is graphite or off-white plus ink blue. Every other hue on screen comes from a preview image, a domain-hue panel or a category colour. No body colour washes, no decorative gradients, no glow.

**The Per-Theme Category Rule.** Category colours are tuned separately for each theme so they read as text on that theme's card. Use the theme's own set; never carry a dark value onto the light card.

## Typography

**Display Font:** Zilla Slab (with Rockwell, serif)
**Body Font:** Source Sans 3 (with system-ui, sans-serif)

**Character:** A bookish, solid slab gives the catalogue its card-drawer labels; a plain, legible humanist sans keeps the controls and metadata out of the way.

### Hierarchy
- **Display** (700, 1.875rem, 1.2): page headings in the dashboard ("All Links", "To Revisit", "Archived", "Tags", "Settings"). All h1 to h3 take the slab and -0.01em tracking.
- **Wordmark** (700, 1.5rem in the rail, 21px in the mobile bar, line-height 1): "Pageslop", set solid in the foreground colour.
- **Headline** (700, 1.125rem): group headings in the by-category and by-site views.
- **Title** (600, 17px, 1.25): index-card titles (clamped to two lines) and tag names on the Tags page.
- **Body** (400, 15px): the base size for the app.
- **Body Small** (400, 13.5px, 1.375): card descriptions, muted, clamped to two lines.
- **Control** (600, 0.875rem): buttons and nav items.
- **Label** (600, 0.75rem): tab domain, category label, tag pills, counts. Sentence case; no tracking, no uppercase.
- **Micro** (700, 9px): the initial letter in a 14px favicon placeholder on a card tab.

The landing page (`src/app/page.tsx`) is a marketing surface and adds larger steps:

- **Hero** (700, 40px on phones, 56px from 640px, 64px from 1024px, line-height 1.02, -0.02em): the one headline.
- **Section** (700, 32px, 1.1): section headings.
- **Feature title** (700, 21px): headings inside the three index-card blocks.
- **Lede** (400, 19px from 640px, 1.125rem below): the paragraph under the hero headline.

### Named Rules
**The Slab Names Things Rule.** Zilla Slab is for names only: page headings, card titles, group headings, tag names and the wordmark. Metadata, controls and body text stay in Source Sans 3.

**The Tabular Count Rule.** Every count (nav counts, unread badge, group counts, link totals) uses tabular figures.

## Layout

A fixed side rail plus a flat catalogue grid. The rail is 240px wide from 1024px up, collapses to a 64px icon rail with tooltips from 768px, and becomes a top bar with a slide-in sheet below 768px. The main area takes 24px padding; page headings sit 24px above content, and the All Links heading carries a muted "N links · N down" summary on its baseline.

The card grid is auto-fill with a 200px minimum column, which gives about five cards per row at 1440px. Rows are 26px apart (exactly one tab height, so the tabs of the next row clear the cards above) and columns 16px apart. The same grid is reused inside each group of the by-category and by-site views. Inside a card the body is inset 12px with 6px between title, description and the metadata row.

## Elevation & Depth

Mostly flat, with one ambient card shadow. Cards and the empty-state icon badge sit on `--card-shadow`; buttons and inputs carry only the hairline `shadow-xs` from the base kit. Hover does not deepen the shadow: the card lifts 2px and its border steps up to Line Strong, while the preview image scales to 1.03 inside its frame. Both motions are gated on `prefers-reduced-motion`.

### Shadow Vocabulary
- **Card, dark** (`box-shadow: 0 1px 2px hsl(0 0% 0% / 0.35), 0 6px 18px -8px hsl(0 0% 0% / 0.6)`): index cards and the empty-state badge on graphite.
- **Card, light** (`box-shadow: 0 1px 2px hsl(40 10% 10% / 0.08), 0 6px 16px -10px hsl(40 10% 10% / 0.25)`): the same on off-white, warm-tinted.

### Named Rules
**The One Shadow Rule.** `--card-shadow` is the only elevation in the system. State is shown by a 2px lift, a stronger border or a ring, never by a bigger or coloured shadow.

## Shapes

Small, firm corners: 4px on cards, tabs, buttons and inputs; 2px on tag pills, favicons (3px) and the category marker; 10px only on the favicon tile inside a blank preview panel and 12px on the empty-state badge. Count and unread pills are fully round. Borders are single 1px hairlines everywhere except the tab's 3px category-coloured top edge. A tab at the left-most offset squares off the card's top-left corner so tab and card read as one piece of card stock.

## Components

### Buttons
Plain, compact and standard; the world does not restyle controls.
- **Shape:** gently squared (4px radius).
- **Primary:** Ink Blue fill, white text, 600 weight, 36px tall with 16px side padding; hover drops to 90% opacity.
- **Hover / Focus:** focus shows a 3px ring in the focus colour at 50% and a focus-coloured border. Disabled drops to 50% opacity.
- **Ghost:** transparent; hover fills with Graphite Hover. Used for nav items, toolbar toggles and the log-out row.
- **Outline:** Input Line stroke on a faint input-tinted fill.
- **Link:** Ink Blue Text, underlined on hover.
- **Image overlay controls:** on a card, "open" and "actions" are 28px squares on a 70% black scrim with white icons, so they read over any preview image. They are hidden until hover or focus on hover-capable devices and always shown on touch.

### Chips
- **Tag pill:** 2px radius, hairline border, muted 600-weight label text. Hover and focus tint it with Ink Blue at 20%, turn the text Ink Blue Text and the border Ink Blue at 40%. At most three per card, then a "+N" pill.
- **Category label:** the category name in its theme category colour, behind a 7px square marker in the same colour. Hidden for "Other".
- **Status badge:** the "Archived" state uses the secondary fill.

### Cards / Containers
- **Corner Style:** 4px.
- **Background:** Graphite Card (dark) or Card White (light).
- **Shadow Strategy:** the card shadow; see Elevation & Depth.
- **Border:** hairline at rest, Line Strong on hover, Ink Blue plus a 2px Ink Blue ring when selected.
- **Internal Padding:** 10px top, 12px sides and bottom.

### Inputs / Fields
- **Style:** 36px tall, Input Line stroke, transparent fill (a faint input tint in dark), 4px radius, 12px side padding.
- **Focus:** focus-coloured border plus a 3px focus ring at 50%.
- **Error / Disabled:** Signal Red border and a faint red ring; disabled at 50% opacity.

### Navigation
The side rail sits on Rail Graphite with a hairline right edge. The wordmark leads, then six ghost nav items (20px icons, 600-weight labels, 4px apart). The active item takes the card fill, an inset hairline outline and an Ink Blue Text icon. To Revisit shows its unread count as an Ink Blue Text pill on a 15% ink tint; other items show a plain muted count. Collapsed, the count becomes an Ink Blue dot on the icon. The theme toggle, log out and the Privacy and Terms links sit at the foot below a separator.

### Index Card (signature component)
Each link is an index card with a real tab. The 27px tab rises from the card's top edge at one of three offsets (0, 16% or 30%, chosen by category so neighbouring cards stagger like drawer dividers). It carries the favicon (or the title's initial on a hairline square), the uptime dot and the domain in muted label text that brightens on hover; its 3px top edge takes the category colour. Below it, the card holds a 16:9.5 preview image; a site with no image gets a flat panel tinted by its domain hue at the theme's `--blank-panel` lightness, centred with a card-coloured favicon tile. Then the slab title, a two-line muted description and the category, state and tag row. The whole card is one stretched button, so it opens on click or Enter; when that button has keyboard focus, the card body and tab take the focus ring together. The loading skeleton repeats the same tab-and-card silhouette with a shimmer over the image area.

## Do's and Don'ts

### Do:
- **Do** keep chrome to graphite or off-white plus ink blue, and let preview images, domain-hue panels and category colours carry all other colour.
- **Do** use Ink Blue for fills and Ink Blue Text for text, icons and focus.
- **Do** put category colour only on the tab's 3px top edge and in the category label, using the current theme's category set.
- **Do** stagger tabs across the three category offsets (0, 16%, 30%) and square the card's top-left corner when the tab sits at 0.
- **Do** set page headings, card titles, group headings, tag names and the wordmark in Zilla Slab, and everything else in Source Sans 3.
- **Do** show hover as a 2px lift plus a Line Strong border, and gate every motion on `prefers-reduced-motion`.
- **Do** keep the grid at a 200px minimum column with 26px row and 16px column gaps.

### Don't:
- **Don't** add gradients, glows, decorative blur or body colour washes; the loading shimmer is the only gradient.
- **Don't** add a second accent colour or set text in the fill blue on graphite.
- **Don't** add shadows beyond `--card-shadow`, or show state with a bigger or coloured shadow.
- **Don't** theme the controls or navigation into costume; buttons, inputs, menus and the rail stay standard.
- **Don't** trade scanning speed for the catalogue metaphor: no smaller images, no lower density, no extra ornament on the card.
