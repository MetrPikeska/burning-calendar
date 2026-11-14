# Agent v pitchi: 20 s naživo, jeden slajd (sobota 14. 11. 2026)

**Verdikt:** naživo jeden dotaz v claude.ai na Evii 2021. Odpověď přijde z jednoho volání `get_anomalies` a ukáže stejné číslo jako mapa: 4,235 detekcí, 67× medián srpna 2011-2020 (63.1). Klik na `view_url` otevře mapu na tom samém měsíci. Záloha: hotový chat z generálky v druhém tabu, pak video.

Všechna čísla níže jsou z produkčního MCP (`https://burning-calendar.vercel.app/api/mcp`, JSON-RPC `tools/call`, 14. 11. 2026 kolem 14:20, `npm run smoke:mcp`: all 14 checks passed). Data končí 2025-12.

## Proč Evia

- Porota je v Soluni, požár na Evii v srpnu 2021 zná každý. Webové demo začíná na Paraná (persona CONAE), agent tak přidá druhý příběh a neopakuje první.
- Odpověď potřebuje jeden nástroj (region je v promptu jako `EL64`), takže stihne doběhnout do 10 s.
- EL64 je NUTS2 Sterea Elláda, Evia je její část. Prompt to říká, aby Claude netvrdil, že jde jen o ostrov.

## Live segment (20 s)

Prompt (stejný jako první příklad v panelu „Use with AI“ na webu, je předem vložený v poli chatu, neodeslaný):

> Was August 2021 abnormal in Sterea Ellada (EL64), the Greek region with Evia? Compare it with the median of the preceding years and give me the map link.

| Čas | Akce | Řeč (EN, asi 50 slov) |
|---|---|---|
| 0 s | Enter v tabu 2 | "Analysts don't even have to open our map. Any AI assistant can ask it." |
| 3-10 s | Claude volá `get_anomalies`, odpověď se vypisuje | "Was August 2021 abnormal on Evia?" |
| 10-15 s | ukázat čísla a caveat v odpovědi | "4,235 detections, 67 times the median of the ten years before. And it says these are detections, not fires." |
| 15-20 s | klik na `view_url`, mapa s panelem mediánu | "One click and we are back on the map, same number." |

Co odpověď musí obsahovat (ověřeno, `get_anomalies {region_id: "EL64", year: 2021}`):

- srpen 2021: **4,235** detekcí (`src: observed`, VIIRS S-NPP, harmonizovaná škála)
- medián srpna za `baseline_years` **2011-2020**: **63.1**, `ratio_to_median` **67.1**
- `baseline_p90` 212.5, `anom_pct` 100, srpen je jediný `flagged` měsíc roku 2021
- caveaty `detections_not_fires` („one fire can give many detections“) a `coverage` (data 2000-11 až 2025-12, bez NOAA-20)
- `view_url`: https://burning-calendar.vercel.app/?country=gr&region=EL64&from=2021-01&to=2021-12

Po kliku panel na webu píše „4,235 harmonized detections, 67× the median of August 2011-2020 (63.1)“ (ověřeno v headless Chrome proti `npm run dev`).

Když Claude vynechá caveat nebo odkaz, nic nedoplňovat a nepsat druhý dotaz: na 20 s to nestačí. Ukázat čísla a kliknout na mapu ručně z tabu 4.

### Záložní prompty (ověřená čísla, pro Q&A nebo kdyby se porota ptala dál)

1. **Harmonizace před 2012:** "Was August 2007 abnormal in Peloponnisos (EL65)? Give the range, not only the number."
   `get_anomalies` / `get_region_series`: 3,674.9 detekcí, `src: backcast`, interval `harm_lo`..`harm_hi` **2,649.6 až 10,021.5**, medián 51.4 (baseline „2002-2011 without 2007“), 71.5×. Ukazuje, že back-cast nese nejistotu. `view_url` `/?country=gr&region=EL65&from=2007-01&to=2007-12`.
2. **Argentina, hustota:** "Which Argentine province has the most fire detections per 1000 km² a year? Show the top 5."
   `rank_regions {metric: density_per_1000km2, country: AR}`: Formosa 394.21, Tucumán 263.77, Misiones 261.03, Corrientes 252.78, Chaco 243.32 (průměr za season year na 1000 km²). Tři relativní provincie (Ciudad de Buenos Aires, Neuquén, Tierra del Fuego) jsou mimo pořadí v `excluded_relative`, caveat `relative_mode`.
3. **Paraná 2020 (navazuje na webové demo):** "Show the 2020 fire season in Entre Ríos (Paraná Delta) month by month against the median."
   `get_anomalies {region_id: "30", year: 2020}`: srpen 16,492 proti mediánu 634.4 (2010-2019), 26×; nad p90 je každý měsíc únor až prosinec (11 z 12); červenec 6,772 (20.9×). `get_season_calendar`: season year 2020 celkem 39,311, onset červen, konec říjen, peak srpen.

### Volitelně: widget `show_calendar`

Paralelně vzniká MCP Apps widget s kalendářem v chatu. Do live segmentu jen pokud bude nasazený na produkci a na demo notebooku projde generálkou; pak k promptu přidat "and show the calendar". Jinak zůstává u odkazu na mapu.

## Slajd (návrh obsahu)

Název: **Ask the calendar from any AI assistant**

- Vlevo screenshot odpovědi z generálky (claude.ai, zoom 125 %), zvýrazněné 4,235, 67× a caveat.
- Vpravo tři řádky:
  - MCP server, 15 read-only tools, no key: `burning-calendar.vercel.app/api/mcp`
  - Every answer carries caveats and a `view_url` back to the map
  - Same numbers as the map: Evia, Aug 2021: 4,235 detections, 67× the 2011-2020 median
- Dole QR kód na https://burning-calendar.vercel.app (tlačítko „Use with AI“ v hlavičce, URL a kroky pro claude.ai) a řádek "Claude (Anthropic) as MCP client".

Slajd se počítá do limitu 7 slajdů, pokud deck půjde i jako Demo na stránku projektu ([space-apps-rules.md](../wiki/space-apps-rules.md)).

## Pre-flight

Večer a ráno před pitchem:

- [ ] `cd web && npm run smoke:mcp` hlásí `all 14 checks passed` (14. 11.: `tools/list` 502 ms, ostatní nástroje 170-300 ms).
- [ ] claude.ai na demo notebooku: přihlášený účet, Customize > Connectors > Add custom connector, název Burning Calendar, URL výše. Free plán unese jen jeden custom connector, takže použít účet, kde je slot volný.
- [ ] Generálka: jeden běh promptu, při dotazu na oprávnění nástroje zvolit Always allow, aby se naživo nic neptalo. Změřit čas od Enteru po `view_url` (cíl pod 12 s).
- [ ] Zoom prohlížeče 125-150 % pro projektor, vypnuté notifikace (GNOME Do Not Disturb), zavřené ostatní taby.
- [ ] Taby v pořadí: 1 slajdy, 2 nový chat s vloženým promptem, 3 hotový chat z generálky, 4 web na `/?country=gr&region=EL64&from=2021-01&to=2021-12`, 5 video lokálně.

Na místě, 5 minut před:

- [ ] Wi-Fi: připojit, otevřít tab 4 (zahřeje Vercel CDN) a spustit `npm run smoke:mcp` ještě jednou.
- [ ] Hotspot z telefonu předem spárovaný s notebookem. Když hlavní Wi-Fi neprojde smoke testem, přepnout na hotspot a test zopakovat.
- [ ] Bez internetu jde jen mapa lokálně (`cd web && npm run dev`, `http://localhost:5173/?country=gr&region=EL64&from=2021-01&to=2021-12&basemap=local`), claude.ai ne: agent jen z videa.

## Fallback

Rozhodovací pravidlo naživo:

1. Do 8 s se v chatu neobjeví volání nástroje: přepnout na tab 3 (hotový chat z generálky) a říct "here is the same question from this morning". Pokračovat klikem na `view_url`.
2. Nefunguje internet nebo claude.ai: pustit video z tabu 5 a mluvit přes něj stejný text.

Nahrání videa (ráno po generálce, stejný notebook):

1. Okno prohlížeče na 1920x1080, zoom 125 %, nový chat s promptem.
2. Nahrát: GNOME Print Screen > ikona kamery > Screencast (nebo Ctrl+Shift+Alt+R), výstup `~/Videos/Screencasts/*.webm`. Alternativa OBS.
3. Celý běh: Enter, odpověď, klik na `view_url`, panel mediánu na mapě. Asi 30-40 s.
4. Zkrátit na 20 s a přidat viditelný popisek (pravidla SI chtějí u videa s výstupem SI viditelné označení):

   ```sh
   ffmpeg -i ~/Videos/Screencasts/rec.webm -ss 1 -t 36 \
     -vf "setpts=PTS/1.8,drawtext=text='Recorded run 14 Nov 2026, Claude + Burning Calendar MCP, 1.8x speed':fontcolor=white:fontsize=26:box=1:boxcolor=black@0.6:boxborderw=8:x=20:y=h-50" \
     -an -c:v libx264 -crf 22 -pix_fmt yuv420p ~/Videos/burncal-agent-demo.mp4
   ```

5. Kopie na USB a do Google Drive. Do repa ne (velikost); video pro stránku projektu má hosting jinde.
