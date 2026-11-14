# Research 14 Nov 2026: layout of a map + detail app for the early warning analyst

Research for the layout decision after the UX test ([../../notes/2026-11-14-ux-test.md](../../notes/2026-11-14-ux-test.md)) and the first sketch ([../../notes/2026-11-14-web-layout.md](../../notes/2026-11-14-web-layout.md)). Primary sources only: first-party design systems, MapLibre docs, WCAG, NN/g research articles. Fire-tool observations come from headless Chrome DOM measurements taken on 14 Nov 2026 at 1280x720 and 390x844, without screenshots, and are marked **[observed]**. Claims from documentation are marked **[docs]**. Research done by Claude Code (logged in `docs/si-use.md`).

## Verdict

Answer first on both layouts: the critical period plus the "month vs median" sentence, then the calendar, method collapsed. The map stays on screen but is never in the way.

- **Desktop:** keep a docked supporting pane (map left, panel right) and move the median card to the top of the panel.
- **Phone:** one page scroll in the order region, small map with side gutters, answer card, heatmap, options. No bottom sheet.

### Desktop (≥ 900 px CSS; also check 1024x576, which is 1280x720 at 125 % browser zoom)

```
+----------------------------------------------------------------------------------+
| Burning Calendar  harmonized MODIS+VIIRS 2000-2025 | [GR|AR] [Region  v] [lat,lon][Find] |  ~52px
+-------------------------------------+--------------------------------------------+
| MAP (fills height, docked)          | PANEL clamp(440px,42vw,620px), own scroll  |
|                                     | 1 Entre Ríos                               |
|                                     | 2 Critical period Feb to Oct, peak Aug     |
|                                     |   [J F M A M J J A S O N D strip]          |
|                                     | 3 +- Aug 2020  [<] [>] ------------------+ |
|                                     |   | 16,492 detections, 26x the median    | |
|                                     |   | of Aug 2010-2019 (634)  [mini bars]  | |
|                                     |   +--------------------------------------+ |
|                                     | 4 [Harmonized|MODIS|VIIRS]  [Download CSV]|
|                                     |   From [   ] To [   ]                      |
| [legend, bottom-left]               | 5 heatmap 26 years x 12 months (~370px)    |
|                                     | 6 > How well the harmonization holds here  |
+-------------------------------------+--------------------------------------------+
```

- **Docked side pane, not an overlay.** Android's supporting-pane layout puts supporting content beside the main content at expanded width, with roughly 70/30 or two thirds for the main pane [docs, A1]. Calcite's default `dock` mode pushes the centre content aside [docs, A3]. We go wider than 30 % because the 12-column heatmap needs about 440 px. A docked panel covers no map, so MapLibre padding offsets are not needed [docs, M2].
- **Region and lat/lon in the header row.** Saves about 90 px of panel height; the region picker is the persona's first step [P1].
- **Rows 1 to 3 follow the inverted pyramid:** the conclusion first [docs, N7]. In 2018 users spent 57 % of viewing time above the fold, and NN/g advises keeping high-priority content there [docs, N4]. GFW's fire dashboard opens each widget with this kind of sentence [observed, section 2].
- **Month stepper `[<] [>]`.** The projector demo works without precise cell clicks. On a phone it is the equivalent control that WCAG 2.5.8 accepts for heatmap cells smaller than 24 px [docs, W1].
- **The panel keeps its own scroll.** Every map viewer inspected scrolls inside a fixed-height panel [observed, section 2]. The current problem is the order of the content, not the nested scroll: with the answer on top, the demo path needs no scrolling.
- **Validation in a closed `<details>`.** NN/g: defer secondary features, make the path to them obvious, at most two levels [docs, N5]. Accordions suit content most users do not need [docs, N8].

### Phone (390x844)

```
+--------------------------------+
| Burning Calendar      [GR|AR]  |  ~52
| [Region                    v]  |  ~52 (44px control)
| > Find a point (lat, lon)      |  collapsed
|  +--------------------------+  |
|  | MAP 26vh (~220px)        |  |  16px gutters, 2-finger pan
|  | [legend one line]        |  |
|  +--------------------------+  |
| Entre Ríos                     |
| Feb to Oct, peak Aug  [strip]  |
| Aug 2020 [<][>]                |
| 16,492, 26x the median (634)   |  <- ends around y=620-700
| [Harm|MODIS|VIIRS]   [CSV]     |
| heatmap full width, 26 rows    |
|   x ~16px = ~420px, no h-scroll|
| > Date range                   |
| > How well harmonization holds |
+--------------------------------+
```

- **Page scroll, not a bottom sheet.** NN/g calls sheets a transient UI element for short interactions, not suited to always-needed information, and warns about swipe ambiguity [docs, N2]. Our panel is about 1,500 px long. Android allows "below the main content or inside a bottom sheet" at compact width [docs, A1]. Apple's medium detent is for progressive disclosure of short content [docs, H1]. A drag sheet with an inner scroll is also not a one-day vanilla job.
- **Small map with gutters and cooperative gestures.** NN/g observed users panning an embedded map when they meant to scroll the page and recommends side gutters or a way to collapse the map [docs, N3]. Two-finger map panning solves the swipe ambiguity [docs, N6]. MapLibre 6.18 `cooperativeGestures` shows "Use two fingers to move the map" on touch [verified in the installed `node_modules`, M1]. NN/g even suggests mobile location pages can omit the map [N3]; we keep it small because the jury expects one.
- **Heatmap with years as rows, months as columns, no horizontal scroll.** At 390 px a cell is about 26 px wide, so all 12 months fit. NN/g: never put essential content behind horizontal scroll [docs, N9]; on mobile tables horizontal scrolling is only "somewhat acceptable", better cut columns or lock the leftmost one [docs, N10]. INPE Queimadas uses the same year x month orientation [observed, section 2].

## 1. Layout patterns in first-party design systems

- **Window size classes [docs, A2].** Compact < 600 dp covers 99.96 % of phones in portrait. Expanded is 840 to 1200 dp. A compact height (< 480 dp) makes two-pane layouts impractical. Our 900 px breakpoint sits inside expanded.
- **Supporting pane vs list-detail [docs, A1].** Supporting-pane content is meaningful only in relation to the primary content. Our regional data stand on their own, closer to list-detail, where compact widths show the detail in place of the list. Both lead to the same phone answer: content first, map secondary.
- **Standard (non-modal) sheets** co-exist with the main UI and are used when the main content is frequently scrolled or panned [docs, A4].
- **Apple HIG [docs, H1, H2].** Detents large and medium (about half). Non-modal sheet for supplementary items that affect the main task; for complex or prolonged flows, consider alternatives to sheets. For maps, the muted style suits information-rich content that should stand out (our choropleth on a grey basemap). Clearly identify selected elements.
- **Calcite [docs, A3].** Panel modes `dock`, `overlay`, `float-*`; switch dock to overlay on small viewports.
- **MapLibre [docs, M1, M2].** `PaddingOptions` applies to `fitBounds`, `fitScreenCoordinates` and `setPadding` and should match the space a floating element covers. `trackResize` follows window resizes only.
- **Not checked:** GOV.UK, USWDS and Mapbox design docs. m3.material.io did not load (JS only), so developer.android.com and the material-components docs were used instead.

## 2. How fire and EO tools lay this out [all observed 14 Nov 2026]

| Tool | Desktop 1280x720 | Phone 390x844 |
|---|---|---|
| FIRMS map | Full-bleed map, floating 360 px menu on the right with inner scroll, disclaimer modal on first load | Menu covers the whole map (390x794) by default |
| EFFIS (v1 retired, redirects to `effis.csv`) | Full-bleed map, floating left (304 px) and right (280 px) panels, onboarding tour | Map only, panels hidden, 296 px cookie banner |
| GWIS current situation | 145 px header, 290 px sidebar of stacked panels | Same 290 px sidebar covers 74 % of the width |
| GFW / Global Nature Watch map | 76 px icon rail, 290 px floating legend with inner scroll | 261 px header, 533 px map, bottom tab bar |
| GFW country dashboard (fires) | 864 px content column scrolling with the page, 416 px map on the right that scrolls away | No map, one column |
| Worldview | Full-bleed map, 286 px layer panel with inner scroll, 67 px timeline at the bottom | Layer panel covers 611 of 844 px |
| INPE Queimadas statistics | No map. Year x month table (1998 to 2026 + Total) with Mínimo/Média/Máximo rows, then charts | Table 701 px wide in a 351 px box, horizontal scroll |

For our persona:

- **Real-time viewers do not answer the persona's question.** FIRMS, EFFIS, GWIS and Worldview are map-first with floating panels and answer "where is it burning now". On phones their panels become full-screen pages anyway.
- **GFW is the closest precedent.** Its widget text: "In Argentina the peak fire season typically begins in mid-July and lasts around 24 weeks … This is low compared to previous years going back to 2012", above a "Normal Range" chart. That is our headline plus median sentence. Our edge: their record starts in 2012.
- **Queimadas is the table form CONAE-region analysts likely know**, but on a phone it forces horizontal scroll.
- **Not inspected:** the BDQueimadas map.

## 3. Mobile maps, scrolling and gestures

- **Swipe ambiguity is the documented failure** [N3, N2]. Fix: gutters, a small map, a collapse option or two-finger pan [N3, N6, M1].
- **Scrolljacking** produces more user pain than benefit and is worse on mobile [docs, N11]. Avoid scroll-snap and custom sheet physics.
- **Nested scroll on desktop:** no primary study found. The current desktop pain is the hidden punchline (burncal-3f6), not the nesting. On the phone `#panel` is already `overflow: visible`, so there is one scroll.

## 4. Information hierarchy for the persona

- **Above the fold:** region, critical period, month vs median with the number and ratio [P1, N4, N7].
- **Calendar next:** it is the evidence and the month picker in one.
- **One level of progressive disclosure** [N5]: lat/lon, date range and validation in `<details>`. CSV and the series toggle stay visible: CSV is a persona need and the toggle carries the harmonization story.
- **Long heatmap on a phone:** keep all 26 rows at a row height of about 16 px (about 420 px). Do not transpose (26 columns of about 12 px) and do not drop years (the baseline is the point). For tap size, rely on the stepper as the WCAG "equivalent" exception [W1].

## 5. Projector

- **No first-party web guidance** on font sizes for projected screens.
- **Closest primary sources.** Microsoft's accessibility guidance for presentations: 18 pt or larger [docs, X1], which is 24 CSS px. AVIXA DISCAS (ANSI/INFOCOMM V202.01) sizes a display from viewing distance and element height [X2]; its table values were not retrieved (**unverified**).
- **Practical:** 11 px axes and legend (burncal-bqt) to 13 px or more; median number 28 px or more, sentence 18 px or more; test at 1024x576 in case the presenter zooms to 125 %.

## Concrete changes (smallest, highest impact first)

Filed as beads with label `layout` (see `docs/wiki/log.md`, 14 Nov). None of them touches `lib/`, the inferno ramp, the local basemap fallback or the deep-link format.

1. `web/src/main.ts` `renderPanel`: move `<section id="median">` right after `.region-head`, before `.controls` (burncal-3f6).
2. `web/src/main.ts`: wrap `#method` in `<details><summary>How well the harmonization holds here</summary>…</details>`, closed.
3. `web/src/main.ts`: `[<] [>]` buttons in the median header, reusing the `onChartKey` step logic (±1 month).
4. `web/src/style.css`: `.median strong { font-size: 1.75rem }`, `.median p { font-size: var(--fs-lg) }`, panel column `clamp(440px, 42vw, 620px)`; `charts/heatmap.ts` `fontSize` 11 to 13 px.
5. `web/src/map.ts`: `cooperativeGestures: matchMedia("(pointer: coarse)").matches`; legend bottom-left; `fitBounds(bbox, { padding: { top: 24, left: 24, right: 24, bottom: legendH + 24 }, duration: 0 })`, which also fixes Evros at the top edge (burncal-4dr).
6. `web/src/style.css` (phone): `#map { height: 26vh; min-height: 200px; margin: 0 var(--s4); border-radius: var(--radius) }`, legend as one line inside the map; `charts/heatmap.ts` narrow `rowH` 20 to 16.
7. `web/index.html` + `style.css`: `#area` into `<header>` (one row on desktop, row 2 on the phone); lat/lon form as `<details><summary>Find a point (lat, lon)</summary>`; date range in `<details>` on the phone (deep links still set it).

## Sources

- A1 Android canonical layouts (supporting pane, list-detail): https://developer.android.com/develop/ui/compose/layouts/adaptive/canonical-layouts
- A2 Android window size classes: https://developer.android.com/develop/ui/compose/layouts/adaptive/use-window-size-classes
- A3 Calcite Shell Panel: https://developers.arcgis.com/calcite-design-system/components/shell-panel/
- A4 Material Components, Bottom Sheet: https://github.com/material-components/material-components-android/blob/master/docs/components/BottomSheet.md
- H1 Apple HIG, Sheets: https://developer.apple.com/design/human-interface-guidelines/sheets
- H2 Apple HIG, Maps: https://developer.apple.com/design/human-interface-guidelines/maps
- M1 MapLibre MapOptions (cooperativeGestures, trackResize): https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapOptions/ ; https://maplibre.org/maplibre-gl-js/docs/API/classes/CooperativeGesturesHandler/ ; touch text from `web/node_modules/maplibre-gl/dist/maplibre-gl-dev.mjs` (6.18.0)
- M2 MapLibre PaddingOptions and the padding example: https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PaddingOptions/ ; https://maplibre.org/maplibre-gl-js/docs/examples/offset-the-vanishing-point-using-padding/
- N2 NN/g, Bottom Sheets (Laubheimer 2023): https://www.nngroup.com/articles/bottom-sheet/
- N3 NN/g, Maps and Location Finders on Mobile (Harley 2014): https://www.nngroup.com/articles/mobile-maps-locations/
- N4 NN/g, Scrolling and Attention (Fessenden 2018): https://www.nngroup.com/articles/scrolling-and-attention/
- N5 NN/g, Progressive Disclosure (Nielsen 2006): https://www.nngroup.com/articles/progressive-disclosure/
- N6 NN/g, State of Mobile UX 2018 (Budiu): https://www.nngroup.com/articles/state-mobile-ux/state-of-mobile-ux-2018/
- N7 NN/g, Inverted Pyramid (Schade 2018): https://www.nngroup.com/articles/inverted-pyramid/
- N8 NN/g, Accordions on Desktop (Wang 2023): https://www.nngroup.com/articles/accordions-on-desktop/
- N9 NN/g, Beware Horizontal Scrolling (Sherwin 2014): https://www.nngroup.com/articles/horizontal-scrolling/
- N10 NN/g, Mobile Tables (Schade 2017): https://www.nngroup.com/articles/mobile-tables/
- N11 NN/g, Scrolljacking 101 (Paul 2023): https://www.nngroup.com/articles/scrolljacking-101/
- W1 WCAG 2.2 SC 2.5.8 Target Size (Minimum): https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- X1 Microsoft, Make your PowerPoint presentations accessible: https://support.microsoft.com/en-us/office/make-your-powerpoint-presentations-accessible-to-people-with-disabilities-6f7772b2-2f33-4bd2-8ca7-dae3b2b3ef25
- X2 AVIXA DISCAS: https://www.avixa.org/resources/standards/display-image-size-for-2d-content
- Observed pages (section 2): https://firms.modaps.eosdis.nasa.gov/map/ ; https://forest-fire.emergency.copernicus.eu/apps/effis.csv/ ; https://gwis.jrc.ec.europa.eu/apps/gwis_current_situation/ ; https://www.globalforestwatch.org/map/ ; https://globalnaturewatch.org/dashboards/country/ARG/?category=fires ; https://worldview.earthdata.nasa.gov/ ; https://data.inpe.br/queimadas/estatisticas/?tipo=estados&item=mato_grosso
- P1 [../personas.md](../personas.md) and [../../notes/2026-11-14-ux-test.md](../../notes/2026-11-14-ux-test.md)
