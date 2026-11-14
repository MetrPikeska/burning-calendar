---
title: External audit round 3 of commit 0a3dcea (Czech, 4 reports)
updated: 2026-11-14
verified_by: BC3-001 to BC3-008 checked against main 3dbb123 on 14 Nov 2026; fixes and limits on branch audit-r3, see docs/TECHNICAL_AUDIT.md
sources: [BURNING_CALENDAR_REDTEAM_AUDIT_2026-11-14.zip]
---

Verbatim copy of the four Markdown reports from BURNING_CALENDAR_REDTEAM_AUDIT_2026-11-14.zip (red-team audit of main 0a3dcea, production MCP, all 16 tools called, 14 Nov 2026). Self-assessed score 7.2/10 on the auditor's own weights, not NASA's. Findings BC3-001 to BC3-008; the auditor ran no local tests, no pipeline and no browser end-to-end.


<!-- EXECUTIVE_REVIEW.md -->

# Burning Calendar — nezávislý red-team audit (HEAD 0a3dcea)

**Datum auditu:** 2026-11-14 (UTC)  
**Repozitář:** `MetrPikeska/burning-calendar` (soukromý, přečten připojeným GitHub konektorem)  
**Auditovaný HEAD:** `0a3dceac7922be4630831d9307efd67fa5391cbc`, commit 2026-11-14 18:21:17 UTC; předchůdce `d93826b54ef78f8596d6f9fa73a73d1406240f8d`.  
**Produkce:** https://burning-calendar.vercel.app/ ; funkční připojené produkční MCP, skutečná volání všech 16 nástrojů. **Neproběhl plnohodnotný browser E2E ani lokální spuštění test suite či pipeline.** Pokus o nezávislé webové otevření stránky skončil chybou cache miss; dostupnost webového UI nelze prohlásit za ověřenou prohlížečem. Vercel commit status pro HEAD je `success`, to však nenahrazuje E2E.

## Verdikt

**7,2/10 — silný hackathonový prototyp, vědecká harmonizace zatím není plně obhájena.** Implementace je skutečná, analytické MCP nástroje fungují a podstatné cross-tool kontroly vyšly. Kritické zbývající body: při konstrukci validačního sezónního okna se používá klimatologie zahrnující validační roky; některé regiony mají výrazné out-of-time chyby; intervaly nejistoty nemají doloženou nezávislou coverage; AOI nedělá geodetické sjednocení ploch a převádí NUTS2 faktory na nevalidované menší celky. Jeden produkční MCP výstup pro VIIRS mimo jeho pokrytí vrací zavádějící roční součty jiných senzorů a nulové `backcast_months` navzdory `src=backcast`.

**Nezaměňovat** počet satelitních aktivních detekcí za počet požárů, skutečnou spálenou plochu, míru rizika ani přesnou aktivitu bez ohledu na cloud cover/overpass. VIIRS-equivalent není fyzikální převod mezi pixely, ale empirická statistická škála měsíčních počtů.

## Skóre podle požadovaných, nikoli oficiálních NASA vah

| Kategorie | Váha | Známka /10 | Důkaz / penalizace |
|---|---:|---:|---|
| Scientific accuracy & validation | 30 % | **5,8** | LOYO + time split + day/night kalibrace existují; ale únik do volby sezónního okna, bez nezávislé kalibrace intervalu a AOI, holdout EL64 v roce 2021 -35,3 % |
| Challenge compliance | 25 % | **8,3** | MODIS/VIIRS, 2000–2026, mapový kalendář, historické anomálie a AOI v Řecku; Argentina nemá hotspotové AOI |
| Technical implementation | 20 % | **8,1** | Skutečně otestováno 16 MCP metod a řada chybových větví, součty odpovídají, read-only; plocha AOI je přičítaná při překryvu, E2E/CI test lokálně neproveden |
| Innovation | 15 % | **7,5** | Spojení dlouhého backcastu, validace, sezón a AI nástrojů; empirický factor-ratio není nový výzkumný algoritmus |
| UX & presentation | 10 % | **6,0** | Ve zdrojích existuje mapa, interakce AOI a MCP kalendář; bez browser E2E nedoloženo mobilní a bezbariérové chování |
| **Vážený výsledek** | **100 %** | **7,2/10** | 0,30×5,8 + 0,25×8,3 + 0,20×8,1 + 0,15×7,5 + 0,10×6,0 = **7,16**, zaokrouhleně **7,2/10** |

## Skutečně ověřené silné stránky

1. **16/16 MCP nástrojů skutečně zavoláno** s platnými argumenty. Testy nestojí na README ani pouhém inventáři.
2. `EL64`, rok 2021: 12 měsíčních `harm` sečteno na **4 382**; `compare_regions(year_total)` i `aggregate` **4 382**. Samostatný sezónní total **4 384** je správně odlišný: okno prosinec 2020 – listopad 2021.
3. `EL64`, srpen 2021: **4 235 detekcí**, medián **63,1**, p90 **212,5**, percentil **100**, poměr **67,1×**. Vypočteno nezávisle z 10 historických měsíčních hodnot; souhlasí s `get_anomalies` a `investigate_month`.
4. Kontrola s obdobnými výsledky také pro `EL52` červenec 2021 a Corrientes (`18`) únor 2022.
5. Negativní případy odmítnuté: neexistující `EL99`, inverzní interval, `GR` plus `EL64` při agregaci, `EL62` ve `series=harm`, `country=AR` plus `region_id=EL64`, datum `2026-02-30`.
6. `aggregate` smíšených harmonizovaných a relativních regionů konzistentně přešlo na **raw MODIS** a odebralo anomálie vypočítané na jiné škále. `show_calendar` při zobrazení MODIS nezachovalo anomálie vlastní harmonizované řady.
7. Zdrojový kód obsahuje unit mapping, source provenance, rozlišení `observed/backcast/backcast_terra`, nouzové označení 2026 NRT a validaci měsíců; `get_recent_detections` v reálném volání vrátil živé údaje.

## Kritická zjištění

| ID | Stav | Závažnost | Zjištění |
|---|---|---|---|
| BC3-001 | **CONFIRMED (code + aritmetika)** | P0 | `web/src/aoi/geojson.ts:132–135` sčítá plochy bez union; dva totožné 5km point buffery ukazují cca **157,08 km²**, skutečná sjednocená plocha cca **78,54 km²**. `contains()` používá logické OR, takže počet detekcí se přitom nemusí zdvojit. |
| BC3-002 | **CONFIRMED (source code + test citlivosti)** | P0 | `build.py:31–32` určí `start_month` pomocí `raw_start_month(m)` **před** LOYO, přičemž klimatologie sahá do 2025 (`validate.py`, `harmonize.py`). Pro `EL52` při vynechání 2016 vyjde klimatologické minimum **prosinec**, zatímco z celé kalibrace do 2019 **duben**. LOYO sezonních metrik používá předem určené okno. |
| BC3-003 | **SCIENTIFIC LIMITATION** | P0 | AOI používá NUTS2 koeficienty bez AOI-specific validace (`web/src/aoi/compute.ts:7–9`, `:236`). Pro velmi malé AOI je takový backcast potenciálně silně zavádějící. |
| BC3-004 | **SCIENTIFIC LIMITATION** | P0 | Band `harm_lo..harm_hi`: 10./90. percentil obs/pred z LOYO, sezonní pooling (`pipeline/validate.py:48+`), **není ověřena empirická coverage na 2020–2025** ani po velikostních třídách. |
| BC3-005 | **CONFIRMED (MCP)** | P1 | `show_calendar(EL64,2003-01..2003-02,series=viirs)` zobrazí `v=null`, avšak `totals` uvádí `harm=6.7` a `modis=2`, `backcast_months=0`; buňky mají `src=backcast`, přitom chybí informace o chybějícím VIIRS pokrytí v explicitním per-series caveatu. |
| BC3-006 | **SCIENTIFIC LIMITATION** | P1 | Pro Řecko nezávislá jednoduchá ablace (konstantní poměr 2012–2019) dosahuje v roční holdout MdAPE **6,0 %**, zatímco publikovaný komplexní model **7,1 %**; pro `EL52` **11,7 % vs 11,8 %**. Vyšší komplexita není systematicky lepší. |
| BC3-007 | **CONFIRMED (MCP, vysvětlitelný)** | P2 | `GR` součet VIIRS 2021 **9 578**, součet 13 NUTS2 **9 576**, rozdíl **2**. MODIS sedí **2 387 vs 2 387**. Pipeline záměrně připouští `unassigned` hotspoty a nearest assignment; reportovat výjimku, ne bezdůvodně označit za bug. |
| BC3-008 | **LIKELY (source)** | P1 | Import GeoJSON ověřuje souřadnice a min. 4 uzly, ale neuzavřený ring nebo samopřekryv neodmítá (`web/src/aoi/geojson.ts:31–34`). Geometricky nevalidní AOI může vracet zdánlivě přesné metriky. |

## Soutěžní připravenost

**Ano pro technologické demo, podmíněně pro vědecké tvrzení.** Bezpečná formulace: „Na regionální úrovni empiricky sjednocujeme měsíční počty aktivních detekcí a validujeme je vůči období pozorování VIIRS; u starších období jde o odhad.” Neříkat „stejný počet požárů”, „spálená plocha”, „vědecky validovaný AOI backcast”, „80% predikční interval” nebo „globálně přesný časový trend”.

### Co projekt skutečně prokázal

- Převod MODIS na historický měsíční **VIIRS-equivalent** podle regionu, kalendářního měsíce a day/night faktorů (ověřeno v Python pipeline a měsíčních výstupech).
- Regionální LOYO a time-split existují, regionální úspěch však kolísá. Např. časový holdout MDAPE: GR **7,1 %**, EL64 **13,0 %**, EL52 **11,8 %**, Corrientes **4,7 %**, relativní EL62 **40,5 %**.
- Interoperabilní read-only MCP a konzistentní běžné analytické výsledky.
- AOI frontend přijímá Polygon, Point, LineString, MultiPolygon a díry; **neprokázal** vědeckou validitu místního backcastu, topologickou validitu geometrie ani přesnou sjednocenou plochu.

## Rozdíl proti předchozím commitům

Aktuální HEAD `0a3dcea` přidal především opravy show_calendar a GeoJSON roundtrip, validaci `country`/`region_id` v `get_fire_alerts`, legendu mapy a regresní testy. Předchozí `d93826b` opravoval chyby BC-001..BC-005 (anomaly series, relativní `src`, označení `*_mad_months`, datum). Tyto commity jsou **doklady změn**, nikoli automaticky průchodem test suite. `0a3dcea` proti `d93826b`: 15 změněných/přidaných souborů z GitHub compare.

## Ověřená soutěžní zadání / kritéria

- Zadání: https://www.spaceappschallenge.org/2026/challenges/harmonization-of-modis-and-viirs-hot-spots/
- V roce 2026 lokální oficiální stránky NASA Space Apps uvádějí kritéria **Impact, Creativity, Validity, Relevance, Presentation**, nikoli váhy použité v tomto zadání: https://www.spaceappschallenge.org/2026/local-events/ajmer/ . Vlastní vážené skóre v tomto reportu není oficiální skóre NASA.
- Evidence v privátním repu (uživatel s přístupem): https://github.com/MetrPikeska/burning-calendar/tree/0a3dceac7922be4630831d9307efd67fa5391cbc

**Metodická poctivost:** Produkční MCP dotazy ano; přečtení aktuálního zdrojového kódu ano; nezávislý přepočet anomálií a ablace ano; spuštění Python pipeline, unit testů, browser E2E, skutečný Roundtrip přes browser, přesná geodetická AOI union a nezávislá coverage bandu **ne**. Pro každé zjištění je uvedena úroveň důkazu.

<!-- MCP_TEST_REPORT.md -->

# Burning Calendar — MCP red-team test report

**Audit:** 2026-11-14; HEAD GitHub `0a3dceac7922be4630831d9307efd67fa5391cbc`; zdroj produkčních volání: **připojený Burning Calendar MCP server**, nikoli mock. Všechna volání read-only. Testovací regiony `GR`, `AR`, `EL64`, `EL52`, `EL62`, `18`, `EL99`. Odpovědi níže jsou doslovné vybrané klíče a hodnoty `structuredContent`, pokud není uvedeno jinak. Kompletní raw payload nebyl persistován; report je auditní záznam vybraných skutečných odpovědí. `PASS` znamená úspěch **konkrétního** testu, nikoli neexistenci dalších bugů.

## Inventář a základní testy — 16/16 voláno

| Nástroj | Skutečný vstup | Pozorovaná odpověď | Výsledek |
|---|---|---|---|
| `search_regions` | `{limit:2,caveats:"codes"}` | `count:2`, `GR harmonized`, `EL30 harmonized`, coverage `2000-11..2026-10` | PASS |
| `get_region_series` | `{region_id:"EL64",from:"2021-01",to:"2021-12",fields:["harm","modis","viirs","src"]}` | 12 `records`, `totals[0].total=4382`, Aug harm=4235, `src=observed` | PASS |
| `get_season_calendar` | `{region_id:"EL64",year:2021}` | `season_window={from:"2020-12",to:"2021-11"}`, `total=4384`, onset=end=8 | PASS |
| `get_anomalies` | `{region_id:"EL64",year:2021}` | `2021-08`: `value:4235`, `baseline_median:63.1`, `baseline_p90:212.5`, `anom:true`, `anom_pct:100` | PASS |
| `compare_regions` | `{region_ids:["EL64","EL52"],metric:"year_total",year:2021}` | `EL64=4382`, `EL52=514`, `ranking_allowed=true` | PASS |
| `aggregate` | `{region_ids:["EL64","EL52"],from:"2021-01",to:"2021-12",top:2}` | `total=4896`, region sums 4382+514, top Aug=4265 | PASS |
| `rank_regions` | `{country:"GR",level:"nuts2",metric:"year_total",year:2021,top:3}` | `EL64=4382` #1; `EL30=1473` #2; `EL65=1424` #3; relative EL62 excluded | PASS |
| `find_region_at` | `{lat:38.54,lon:23.9}` | `found:true,id:"EL64"`; `area_km2=15564.4`, data/hotspot URLs | PASS |
| `get_validation` | `{region_id:"EL64"}` | LOYO MDAPE=16.3 %, time-split MDAPE=13.0 %, metadata v1 | PASS (API) |
| `get_methodology` | `{topic:"units"}` | správně rozlišuje `harm`, `modis`, `viirs`, percentil a relativní region | PASS |
| `show_calendar` | `{region_id:"EL64",from:"2021-07",to:"2021-09",series:"harm"}` | `totals` obsahuje `harm=4257`, `modis=812`, `viirs=4257`; `anomaly_months=["2021-08"]` | PASS |
| `get_fire_alerts` | `{country:"GR",days:1}` | `count=0, events=[]`, přiloženy source/caveats; 0 alertů není selhání | PASS (odpověď; dostupnost obou upstreamů samostatně neověřena) |
| `get_fire_weather` | `{region_id:"EL64",from:"2026-11-11",to:"2026-11-12"}` | dny 11/11 a 12/11, max T 22 °C, srážky celkem 1.2 mm; modelová data správně označena | PASS (API) |
| `get_weather_stations` | `{region_id:"EL64",from:"2026-10-30",to:"2026-11-02",max_stations:1}` | `Skyros Airport`, 4 dny, `model_fields:["precip_mm"]` u jednotlivých dnů | PASS (API; stanice není nezávisle validovaná) |
| `get_recent_detections` | `{region_id:"EL64",days:1}` | `configured:true`, `totals:{viirs_noaa20:11,viirs_noaa21:5,modis:0}`; `nrt_not_harmonized` | PASS |
| `investigate_month` | `{region_id:"EL64",ym:"2021-08"}` | `history.month={modis:807,viirs:4235,harm:4235,ratio_to_median:67.1,rank_among_years:1}` | PASS (historická větev) |

## Negativní a mezní testy — vybrané skutečné výsledky

| ID | Volání (nezobrazené argumenty default) | Očekáváno | Skutečně | Výsledek |
|---|---|---|---|---|
| N01 | `get_region_series(EL64,2022-12,2021-01)` | odmítnout obrácené období | `INVALID_ARGUMENT: from must not be after to` | PASS |
| N02 | `get_region_series(EL99,2021-01,2021-02)` | odmítnout neznámý region | `INVALID_ARGUMENT: Unknown region_id "EL99"` | PASS |
| N03 | `get_region_series(EL64,1999-01,2000-10)` | prázdný rozsah, caveat | `records=[]`, `out_of_coverage` (u podobného budoucího dotazu ověřen detail; u tohoto zjištěna odpověď bez exception) | PASS s omezením |
| N04 | `get_region_series(EL64,2026-11,2026-12)` | explicitně nezaměnit s 0 detekcí | `returned:null`, `records:[]`, `out_of_coverage` | PASS |
| N05 | `get_season_calendar(EL99,2021)` | error | `INVALID_ARGUMENT: Unknown region_id "EL99"` | PASS |
| N06 | `get_anomalies(EL64,2099)` | žádná historie | `months:[]`, coverage 2000-11..2026-10; forma může být čitelnější | PASS |
| N07 | `compare_regions([GR,EL64],year_total,2021)` | lze porovnat, ale ne sčítat | `ranking_allowed:true`, 9578 a 4382 — nejsou agregovány | PASS |
| N08 | `compare_regions([EL62,EL64],year_total,2021)` | zakázat ranking různých škál | `ranking_allowed:false`, `EL62 value_modis=22`, `EL64 value=4382` | PASS |
| N09 | `aggregate([GR,EL64],2021-01,2021-12)` | odmítnout dvojí započtení | `INVALID_ARGUMENT: GR already contains its regions...` | PASS |
| N10 | `aggregate([EL64],2021-12,2021-01)` | error | `INVALID_ARGUMENT: from must not be after to` | PASS |
| N11 | `rank_regions(season_total,country=GR,level=nuts2)` | year required | `INVALID_ARGUMENT: season_total needs a year` | PASS |
| N12 | `find_region_at(lat=0,lon=0)` | nenalézt region | `found:false` | PASS |
| N13 | `get_validation(EL99)` | error | `INVALID_ARGUMENT: Unknown region_id "EL99"` | PASS |
| N14 | `get_methodology(topic=caveats)` | dokumentace omezení | vrátil `topic,caveats,source,coverage` | PASS |
| N15 | `show_calendar(EL62,2021-01,2021-02,series=harm)` | odmítnout neexistující harmonizaci | `INVALID_ARGUMENT: Region EL62 is in relative mode ...` | PASS |
| N16 | `get_fire_alerts(country=AR,region_id=EL64,days=1)` | odmítnout rozpor | `INVALID_ARGUMENT: region EL64 belongs to GR, not AR` | PASS, oprava z HEAD |
| N17 | `get_fire_weather(EL64,2026-02-30,2026-03-02)` | neplatný gregoriánský den | `INVALID_ARGUMENT: from: invalid calendar date` | PASS |
| N18 | `get_weather_stations(EL64,2026-11-12,2026-11-11)` | obrácené období | `INVALID_ARGUMENT: from must not be after to.` | PASS |
| N19 | `get_recent_detections(EL99,days=1)` | neexistující region | `INVALID_ARGUMENT: Unknown region_id "EL99"` | PASS |
| N20 | `investigate_month(EL64,1999-09)` | historická část nedostupná, bez vymyšlených požárů | `history.found:false`, `out_of_coverage`; weather vrací samostatnou historickou klimatologickou asociaci | PASS s interpretační opatrností |
| N21 | `get_fire_weather(EL64,2026-01-01,2026-03-01)` | limit 31 dní | `INVALID_ARGUMENT: At most 31 days per call.` | PASS |
| N22 | `get_weather_stations(EL64,2026-02-30,2026-03-01)` | neplatné datum | `INVALID_ARGUMENT: from: invalid calendar date` | PASS |
| N23 | `get_recent_detections(EL64,days=10)` | horní hranice | vráceno `totals:{viirs_noaa20:16,viirs_noaa21:12,modis:6}` | PASS |
| N24 | `investigate_month(EL64,2026-11)` | bez kalendářní hodnoty 2026-11 | `history.found:false`, `out_of_coverage`, živé reporty oddělené | PASS |
| N25 | `get_fire_weather(region_id=EL64,lat=0,lon=0,2026-11-10..11)` | kontradikci explicitně odmítnout, nebo stanovit a sdělit prioritu | `point={lat:38.6545,lon:22.8029}` (region přebije souřadnice bez chyby) | **LIKELY UX/API ambiguity**, P2 |
| N26 | `compare_regions([EL64,EL64],year_total,2021)` | žádné dvojí započtení | `rows` pouze 1× `EL64=4382` | PASS |
| N27 | `aggregate([EL64,EL64],2021-01..12)` | deduplikace | `total=4382`, region jen 1× | PASS |
| N28 | `aggregate([GR,GR],2021-01..12)` | deduplikace | `total=9578` | PASS |
| N29 | `search_regions(limit=0)` | odmítnout | schema error minimum=1 | PASS |
| N30 | `get_methodology(topic=nonsense)` | odmítnout | schema enum error | PASS |
| N31 | `find_region_at(lat=95,lon=22)` | odmítnout | schema maximum=90 | PASS |
| N32 | `get_fire_alerts(days=0)` | odmítnout | schema minimum=1 | PASS |
| N33 | `get_recent_detections(EL64,days=11)` | odmítnout | schema maximum=10 | PASS |
| N34 | `get_weather_stations(EL64,max_stations=6)` | odmítnout | schema maximum=5 | PASS |
| N35 | `get_fire_weather(lat=38.5,2026-11-11..12)` | vyžadovat lon | `INVALID_ARGUMENT: Give region_id, or lat and lon.` | PASS |
| N36 | `get_season_calendar(EL64,year=2100)` | nevyrábět budoucí data | `years:[]` | PASS |

## Cross-tool consistency — konkrétní aritmetika

### X01: měsíc → rok → agregace

`get_region_series(region_id=EL64,from=2021-01,to=2021-12,fields=[harm,modis,viirs,src])` vrátil po měsících harm:

`5, 17, 29, 11, 11, 6, 19, 4235, 3, 10, 34, 2`

Součet **4382**. `compare_regions([EL64,EL52],year_total,2021)` = EL64 **4382**, EL52 **514**. `aggregate([EL64,EL52],2021-01..2021-12)` = **4896**; aritmeticky 4382 + 514 = 4896. **PASS**.

### X02: sezónní rok není kalendářní rok

`get_season_calendar(EL64,2021)` = **4384** pro **2020-12..2021-11**; `year_total` = **4382** pro **2021-01..2021-12**. Zdánlivý rozpor **není bug**. **PASS**.

### X03: národní součet vs podregiony

Všech 13 řeckých NUTS2 2021, získané z `get_region_series`, dávají MODIS **2387**, VIIRS **9576**. Řecko `GR` má MODIS **2387**, VIIRS **9578**. Rozdíl VIIRS **2**. Pipeline reportuje `unassigned` body a zahrnuje další geografické přiřazení; **nevysvětlený rozdíl nelze bez primárních souřadnic definitivně připsat konkrétním dvěma bodům**. Odpověď označit **SCIENTIFIC LIMITATION / NOT VERIFIED ROOT CAUSE**. Výstupy jsou přibližně konzistentní, ne exaktně aditivní. Pro plně auditovatelnou bilanci přidejte `unassigned/nearest` reconciliation.

### X04: relativní regiony nesmí být aditivní s harm

`compare_regions([EL62,EL64],year_total,2021)` => `ranking_allowed=false`, EL62 `value_modis=22`, EL64 `value=4382`. `aggregate([EL64,EL62],2021-01..12)` => `series=modis,total=873`, části **851+22**. EL64 harm anomálie správně vypuštěna. **PASS**.

### X05: anomálie ze skutečných historických měsíců

- EL64 2021-08, baseline 2011..2020: `[74.3,207,94,52,28,142,15,15,262,31]`; medián = **63.15 → 63.1**, p90 **212.5**, hit **4235**, percentil **100**. MCP stejné.
- EL52 2021-07: `[39.5,71,19,33,18,32,29,8,12,12]`; medián **24**, p90 **42.65 → 42.6**, hit **58**, percentil **90**. MCP stejné.
- Corrientes (18) 2022-02: `[3248,719,2913,423,212,174,905,454,1758,428]`; medián **586.5**, p90 **2946.5**, hit **26213**, percentil **100**. MCP stejné.

**PASS** (malé odchylky pouze při desetinném zaokrouhlení).

## Nová skutečná chyba MCP — BC3-005

**CONFIRMED (produkční volání).** Vstup:

```json
{"region_id":"EL64","from":"2003-01","to":"2003-02","series":"viirs","caveats":"codes"}
```

Skutečně vráceno (výběr):

```json
{
  "series":"viirs",
  "unit":"raw VIIRS S-NPP active fire detections (375 m; record starts 20 Jan 2012) per month",
  "months":[{"ym":"2003-01","v":null,"src":"backcast"},{"ym":"2003-02","v":null,"src":"backcast"}],
  "totals":[{"year":2003,"n_months":2,"partial":true,"harm":6.7,"modis":2,"backcast_months":2}],
  "backcast_months":0,
  "caveat_codes":["detections_not_fires","coverage"]
}
```

**Očekávání:** explicitní `series_out_of_coverage`/`no_viirs_data` při zvoleném `viirs` před lednem 2012; pokud `totals` obsahují jiné série, jasně pojmenovat jejich jinou škálu a zachovat konzistenci `backcast_months` (nulový pouze pro *zobrazenou* sérii, pak jej pojmenovat `displayed_backcast_months`). Nynější odpověď může agenta vést k citování `harm=6.7` jako roční VIIRS hodnoty. Druhá reprodukce: série pro `2000-11..2001-02` ukazuje `src=backcast_terra`, neprázdný `harm`; vybraná viirs série v raném roce vrací `null`. Nesrovnalost je reálná v metadatech zobrazení, ne v historických datech.

Zdroj k opravě: `web/api/_lib/widget.ts`, `web/api/_lib/widget-html.ts`, `web/test/mcp-endpoint.test.ts`.

## Opravy předchozího kola — nezávislá regrese

- `show_calendar(EL64,2021-07..09,series=modis)` => `unit=raw MODIS`, bez `anomaly_months`, s `anomaly_months_omitted`, `totals[0]` bez `anomaly_months`. **PASS**, oprava R2-001.
- `get_fire_alerts(country=AR,region_id=EL64,days=1)` => `INVALID_ARGUMENT` s explicitním nesouladem. **PASS**, oprava R2-003.
- `get_fire_weather(EL64,2026-02-30..2026-03-02)` => schema reject. **PASS**, oprava BC-005.
- `get_region_series(EL62,2000-11..2001-02,fields=[modis,src])` => `src=observed`, žádný backcast relativního režimu. **PASS**, oprava BC-003.
- AOI roundtrip fix R2-002 **zjištěn v kódu a test case**, **NOT VERIFIED browser execution**.
- Web heatmap-key/legend R2-004 **zjištěna změna testu a zdrojů**, **NOT VERIFIED browser execution**.

## Co nebylo provedeno

- Nezávislé volání raw HTTP JSON-RPC `/api/mcp` přes několik různých MCP transportů, handshake a fuzzování hlaviček; funkčnost byla ověřena připojeným klientem.
- Penetrační test XSS, SSRF, rate limiting a reálné zatížení; pouze revize vybraného kódu.
- Běžící frontend E2E přes Playwright/Chrome/Firefox ani test klávesnice/screen-readeru.
- Ověření všech 39 regionů ve všech letech, všech hladin filtrování a masivních 20k-vertex AOI.
- Přesné porovnání každého raw hotspotu s NASA FIRMS 2026 upstream v tomto běhu.

## Regresní testy k přidání

1. `show_calendar` `viirs` před rokem 2012: explicitní `no_coverage`; žádná nejednoznačná `totals` škála a správné `src`/`backcast_months`.
2. Všechny kombinace vlastních a jiných sérií: `harm`, `modis`, `viirs`, relativní `EL62` a 2001/2011/2012/2026.
3. V každém roce `sum(records[k]) == totals[year][k]` pro všechny číselné škály; tolerance pouze 0.1 při backcast zaokrouhlování.
4. `aggregate(GR)` ≟ `sum(NUTS2)` plus explicitní nerozdělená část s odkazem na assignment stat.
5. Cross-tool: `get_anomalies` vs `investigate_month` vs `get_region_series` pro anomálie a baseline.
6. `get_fire_weather` `region_id` současně s `lat/lon`: buď hard reject, nebo explicitní `ignored_coordinates`.
7. Origin/auth/security testy z `web/test/mcp-endpoint.test.ts` spustit v CI na HEAD a logovat verzi produkčního deploymentu.

## Zdroje

- Zdrojový kód: https://github.com/MetrPikeska/burning-calendar/tree/0a3dceac7922be4630831d9307efd67fa5391cbc
- MCP server: https://burning-calendar.vercel.app/api/mcp
- API data: https://burning-calendar.vercel.app/data/v1/gr/regions/EL64.json
- Mapa: https://burning-calendar.vercel.app/?country=gr&region=EL64

<!-- SCIENTIFIC_REVIEW.md -->

# Burning Calendar — vědecký a geoinformatický audit

**HEAD:** `0a3dceac7922be4630831d9307efd67fa5391cbc` · **Datum:** 2026-11-14 · **Typ důkazů:** aktuální zdrojový kód připojeného GitHubu + skutečná volání MCP + samostatná aritmetika z měsíčních počtů. **Nepodařilo se lokálně spustit pipeline ani úplný výpočet Python LOYO; výsledky LOYO proto nebyly nezávisle replikovány.**

## 1. Co se fyzikálně a statisticky harmonizuje

Vstupem jsou *jednotlivé detekce aktivních tepelných anomálií*, ne jedinečné požáry či burnt area. MODIS Terra a Aqua mají přibližně 1km produkt, VIIRS S-NPP 375m fire produkt. Počty různých produktů se nedají prostě přičíst. Pipeline `pipeline/harmonize.py` staví měsíční `modis_D/N`, `viirs_D/N` a empirické faktory:

\[
F_{r,m,dn}= \frac{\sum_{y=2012}^{2019}VIIRS_{r,m,dn,y}}{\sum_{y=2012}^{2019}MODIS_{r,m,dn,y}}
\]

Základní stratum `region_month_dn` vyžaduje aspoň 30 MODIS detekcí v okně a průměrně pět ročně (`_accept(den_total,n_years)`); fallback na `region_season_dn`, `region_dn`, `national_dn`. Popis API „5 per year“ je **nepřesná zkratka**: kód nevyžaduje pět **v každém jednotlivém roce**, ale `den_total/n_years >= 5`. To může propustit stratum s několika nulovými roky. **CONFIRMED (code)**, `pipeline/harmonize.py:63+`.

Pro listopad 2000 – červen 2002 (pouze Terra) používá kaskádu `G=(Terra+Aqua)/Terra` z 2003–2011 a poté `F*G*Terra`. Úplný VIIRS měsíc začíná únorem 2012; leden 2012 je v `harm` backcast a `viirs` má jen částečný pozorovaný počet. Po únoru 2012 `harm=VIIRS` pozorování, nikoliv výsledek modelu. To je nutné výslovně zdůraznit při prezentaci validačních výsledků: úspěch modelu neznamená, že kalendář 2012–2025 byl modelově přesný — je prostě ukotven pozorovaným VIIRS.

### Co pipeline ošetřuje dobře

- Sezonnost a day/night stratifikace, vzácné strata fallbacky, Terra-only chained backcast.
- Rozlišování regionů `harmonized` a `relative`; `EL62`, `AR 02` a `AR 94` zůstávají MODIS-only.
- Filtr potenciálních stálých zdrojů a atributy nezapojených bodů.
- `observed`, `backcast`, `backcast_terra`, `provisional`, outages a jednotky dostupné ve výstupech.
- 2020–2025 je oddělený časový holdout; LOYO na fit letech 2012–2019.

### Neověřená část vědecké interpretace

- Stabilita koeficientů po 2019 a v extrémních letech; rozdílné geometrie overpass, detection threshold, coverage a FRP.
- Vliv rozdílné standard processing vs NRT (zejména 2026-08 až 2026-10). Bez společného reprocessingu a kontrolního průniku nelze řadu automaticky pokládat za homogenní.
- Jednotky jsou počty detekcí na referenční škále; není to burned-area index, pravděpodobnost vzniku požáru ani incidence unikátních událostí.

## 2. Cross-sectional holdout v odlišných regionech

Skutečné MCP `get_validation`, regionální hodnoty:

| Region | Charakter | LOYO MdAPE | Time-split MdAPE | Konkrétní holdout chyby |
|---|---|---:|---:|---|
| GR | celé Řecko, heterogenní | 5,4 % | 7,1 % | 2023 **+22,9 %**, 2025 +17,9 % |
| EL64 | Sterea Elláda, extrém Evia 2021 | 16,3 % | 13,0 % | 2021 **−35,3 %**, 2025 **−35,8 %** |
| EL52 | Kentriki Makedonia, sezónní variabilita | 4,0 % | 11,8 % | 2023 **−27,4 %** |
| 18 | Corrientes, Argentina, vysoké počty | 7,2 % | 4,7 % | 2024 **+25,8 %** |
| EL62 | Ionian Islands, velmi nízké počty, relative | 32,0 % | 40,5 % | 2022 **−84,3 %** |
| AR | celá Argentina | 1,5 % | 6,7 % | 2022 **−14,8 %** |

**Není přípustné** odvozovat z nízké národní chyby obdobnou přesnost konkrétního malého území. `EL54` z národního přehledu uvádí time-split MdAPE **31,9 %**, `EL53` **30,5 %** a přesto zůstávají `harmonized`, protože mode rule je postaven primárně na fit LOYO.

### Extrémní požární rok 2021 (Sterea Elláda)

- Měsíční observed VIIRS v srpnu 2021: **4235**; MODIS **807**. Celý kalendářní rok: **4382** VIIRS/harm.
- Baseline August 2011–2020: `[74.3,207,94,52,28,142,15,15,262,31]` (harm = u pre-2012 modelovaný backcast). Vlastní přepočet: median **63.15 → 63.1**, 90. percentil **212.5**, `4235/63.1 ≈ 67.1`.
- Samotný srpen představuje **96,65 %** pozorovaných harmonizovaných detekcí kalendářního roku (`4235/4382`). Jednorázový extrém je tedy přesně případ, na kterém může regionální ratio vypadat špatně.
- `get_validation` na roce 2021 uvádí modelové roční podhodnocení **−35,3 %**. Tuto hodnotu přímo z `harm` 2021 **nelze přepočítat**, neboť `harm` po 2012 ukládá pozorovaný VIIRS, ne out-of-sample predikci. Je nutno exportovat holdout `pred`, `obs`, `modis`, F a fold metadata.

## 3. Nezávislá ablační kontrola: naivní konstantní faktor

Pro každou oblast jsme nezávisle z MCP měsíčních dat 2012-02..2019-12 vypočítali jediný regionální poměr `k=sum(VIIRS)/sum(MODIS)`. Pro každý rok 2020–2025 pak `pred_y=k*MODIS_y`, `err_y=100*(pred_y/VIIRS_y−1)`, median `abs(err_y)`. Výpočet nezávislý od publikované validační tabulky, **nejde** o replikaci původního modelu ani o test jeho měsíčního bias/seasonality.

| Region | Naivní faktor `k` | Naivní holdout MdAPE | Projektový time-split MdAPE | Výsledek |
|---|---:|---:|---:|---|
| GR | 3,500 | **6,0 %** | 7,1 % | Jednoduchý model v této metrice lepší |
| EL64 | 2,483 | 18,0 % | **13,0 %** | Kompletní model lepší |
| EL52 | 3,633 | **11,7 %** | 11,8 % | Prakticky remíza |
| 18 | 3,054 | 18,4 % | **4,7 %** | Kompletní model výrazně lepší |
| AR | 3,298 | 7,5 % | **6,7 %** | Kompletní model mírně lepší |
| EL62 | 2,794 | 41,0 % | **40,5 %** | Ani jedna metoda spolehlivá |

Příklady naivní rekonstrukce ze skutečných měsíčních součtů: EL64 2021 `851*2.483≈2113` proti pozorovaným `4382` → **−51,8 %**; GR 2023 `3185*3.500≈11147` proti `9878` → **+12,8 %**. Takto vypadá validní, obtížnějšímu modelu konkurenční baseline; vyžaduje se experiment s intervaly a sezonní metrikou, ne jen roční MdAPE.

## 4. Vědecký problém: volba sezónního okna před LOYO

**CONFIRMED (kód):**

- `pipeline/build.py:31`: `start = raw_start_month(m)`; `:32`: `val, band = validate(m, national, start)`.
- `pipeline/validate.py`: `raw_start_month` počítá climatology z MODIS do `CLIM_END` = **2025-12** (`pipeline/harmonize.py`).
- `loyo` dále v jednotlivých letech vynechá daný rok při fitování faktorů, ale `_season_compare(...,start_month)` dostane **stejný předem zvolený** start.

**Nezávislý test citlivosti:** z měsíčních MODIS hodnot `EL52` jsme přepočítali průměr podle kalendářních měsíců. Minimum za data do 2019: **duben (4)**. Po vynechání roku 2016: **prosinec (12)**. Řecko a EL64 zůstaly prosinec ve stejném testu. Tento test neprokazuje přesné nové LOYO MDAPE; prokazuje, že volba sezónní definice **není invariantní vůči vynechávanému roku**. Uváděná validační přesnost peak/onset/end/length tedy není čistě out-of-sample pro celou proceduru.

**Oprava:** při každém LOYO foldu spočítat start month jen na trénovacích datech, pak definovat peak/onset/end pro predikci a referenční VIIRS stejným fold-specifickým oknem. Pro časový split určit start jen do 2019. Publikovat rozdíl původního a corrected backtestu i počet foldů, kde se okno změní. Definici srovnání sezón zafixovat před vyhodnocením.

## 5. Band a nulové denominator cases

`pipeline/validate.py:48+`: z LOYO měsíčních dvojic vezme `obs/pred` jen pro `pred>0` a vypočítá 10./90. percentil v meteorologické sezóně. `harm_lo=harm* q_lo`, `harm_hi=harm*q_hi` pro historický backcast. **To je empirický interval poměru, nikoliv automaticky 80% out-of-sample predikční interval.**

- Není zveřejněná coverage na nezávislých 2020–2025 holdout měsících pro `obs in [lo,hi]`.
- Nulová predikce: `pred=0` se z výpočtu rozptylu zcela vyloučí; `0 * q10=q90 * 0=0`. V situaci, kde MODIS=0 ale VIIRS>0, by **obě meze byly 0**, tedy falešná jistota. Taková situace po 2012 existuje přímo v datech: EL64 prosinec 2021 `modis=0,viirs=2`. V pre-2012 úseku skutečný VIIRS není, proto jde o strukturální kontra-příklad (nikoli o historicky pozorovanou nulu).
- Sezonní pooling může překrýt day/night, regionální velikost, malé a extrémní měsíce.

**Požadované experimenty:** holdout coverage v letech 2020–2025 pro nominálních 80 %, rozpad podle regionu, měsíců, den/noc a velikosti `0`, `1–19`, `20–99`, `100+`; srovnat coverage s block bootstrap / Poisson-negative-binomial predictive distribution. Zvlášť ukázat coverage extrémních měsíců.

## 6. Regionální režimy a post-hoc decision rule

`pipeline/validate.py` používá `relative` pro fit-window LOYO MdAPE >25 % nebo pokud harmonizovaný peak-hit počet je horší o více než 1 sezonní rok proti raw MODIS. V aktuálním kódu je zaznamenáno, že peak pravidlo bylo **po zhlédnutí výsledků upraveno 14. 11. 2026**. Tato informace je vědecky relevantní: post-hoc úprava výběru regionů může optimisticky zkreslit rozhodovací kvalitu režimů. Dále `EL42` hlásí LOYO MdAPE **25,0 %** a zůstává harmonized; threshold přirozeně prudce přepíná režim na hranici.

**Návrh:** oddělit výběr pravidla (2012–2019 nebo nested folds) od jeho otestování na 2020–2025 a reportovat citlivost 15/20/25/30/35 %, včetně malých počtů a „relative” alternativy. Výsledky rozhodovacího prahu publikovat jako designovou volbu, ne jako nezávislý důkaz přesnosti.

## 7. Statické zdroje, outages a 2026

`pipeline/filters.py` označuje jako statickou buňku `(sensor,year,cell)` s alespoň **16 různými dny detekce** a vyřadí **celou** její sadu detekcí. Nejsou zde ověřeny položky proti referenčnímu seznamu průmyslových zdrojů nebo vulkánů. Pravidlo může odstranit také skutečnou častou sezonní aktivitu (opakované zemědělské pálení nebo velmi dlouhotrvající požár). **SCIENTIFIC LIMITATION**. Je potřeba confusion matrix nebo aspoň audit náhodných vyloučených buněk v GIS.

`data/outages.csv` a `outage_days` evidují známé výpadky; nejsou to však globální metriky detekovatelnosti, coverage/oblačnosti a variabilní swath sampling. NRT v pozdější části roku 2026 se ve zdroji správně označuje `provisional`; bez overlap harmonization nesloučit s historickým SP do trendového závěru. Metodika uvádí konec aktuálního S-NPP rekordu 2. 11. 2026 a absenci NOAA-20 splice; detail mise se zde nezávisle proti NASA telemetrii neověřoval.

## 8. AOI hlubší audit

### Geometrie a hranice

Implementováno (`web/src/aoi/`): `parseGeoJson`, `contains`, `areaKm2`, kreslení polygonu/point/line, export, využití regionálních CSV, port harmonizace do TS. V kódu jsou testy pro Polygon, MultiPolygon, díru, Point/Line, limit 5 MB / 20 000 vertexů, export-import-export a porovnání celého regionu. **Jsou to existující unit testy, ne lokálně spuštěné testy.**

**BC3-001 — CONFIRMED (source-code proof).** `areaKm2()` v `web/src/aoi/geojson.ts:132–135` vrací součet ploch dílů, explicitně komentář „overlaps between parts are counted twice”. Např. dvě totožné bodové geometrie s `radius_km=5`: `2*π*25=157.08 km²`, ale plocha union stejných dvou disků je `π*25=78.54 km²`. Přitom `contains()` používa `some()`/OR a detekci nepočítá dvakrát. Věcný nesoulad plochy s počty detekcí vyřazuje **všechny na této ploše normalizované hustoty** z vědeckého použití. Tento výpočet je explicitní matematická reprodukce funkce z kódu; nešlo o spuštění originálního TypeScriptu.

**BC3-008 — LIKELY (code).** Ring parser kontroluje `length>=4` a číselnou lon/lat validitu; neověřuje uzavření, self-intersection, obsah díry v exteriéru nebo polygon validity. `areaKm2` počítá shoelace v lokální equirektangulární aproximaci podle průměrné latitude, nikoliv EPSG:6933 ani geodetickou plochu. Pro velké polygony a pobřeží to není přesná vědecká metrika.

**Roundtrip:** import vlastního exportu teď filtruje `role=point-buffer` a respektuje `radius_km` u vlastních bodů/čar. Dřívější zdvojení kruhu je podle kódu opraveno. Ale původní `Aoi` drží jeden společný radius pro všechny body/čáry; import cizího GeoJSON s rozdílnými radii na prvcích není zachován. Geometrický roundtrip přes prohlížeč neproveden; reportovat **NOT VERIFIED LIVE UI**, jen code-path/naměřenou strukturální vlastnost.

### Umístění detekcí a nesrovnalost hranic

`runAoi()` nejdříve vybere NUTS2 **průnikem bounding boxes**, pak stáhne soubory a `contains()` testuje jednotlivé body. Bbox je přehnaný výběr zdrojových souborů, ne rozhodnutí o skutečném polygon průniku. Regionální `.csv` vzniká z assign procesu s hranicemi 1:1M a v pobřeží nearest do 5 km, zatímco web mapové regiony jsou zjednodušené 1:20M. **Proto polygon nakreslený podle viditelné regionální hrany nemusí reprodukovat původní statistiku.** Test `aoiOf([id])` prochází *všechna data vybraného regionu přímo*, nikoliv přes skutečnou geometrii nakresleného polygonu.

- Při shodě AOI přesně s regionem testovat skutečný polygon z **assignment** hranic, nikoli jen `aoiOf([id])` s předvybranými CSV.
- Na pobřeží odděleně ověřit assigned-by-nearest body a konzistenci s `find_region_at`.
- Reprojekce: akceptován WGS84 lon/lat, projekce `EPSG:2100` s deklarovaným CRS odmítnuta; uživatelsky matoucí tiché pořadí souřadnic `lat/lon` místo `lon/lat` může být formálně v rozsahu a nezachytí se.
- Překryv dvou AOI polygonů nesmí navýšit plochu; jednotlivé body jsou díky `contains()` jen jednou, pokud regionální CSV neobsahuje duplicity (raw uniqueness neověřena).

### AOI harmonizace

`compute.ts:236` používá pro každou detekci `region_id` a kalibrační faktory celého NUTS2. Pro malé AOI chybí vlastní fit a LOYO; výrazná dominance několika pixelů, odlišný land cover a výpadky může vést k neidentifikovatelnému biasu. Přenášet regionální band na AOI je neopodstatněné bez modelu prostorové závislosti. Pokud AOI zasáhne jakýkoliv relativní region s detekcemi, celá AOI přepne na MODIS: konzervativní, ale potřebuje vysvětlení návštěvníkovi.

**Nejmenší přijatelný výstup:** AOI = „exploratory estimate (unvalidated)” v UI i exportu, náhled pokrytí/počet detekcí v kalibraci, odmítnout nebo neuvádět band/hustotu u velmi malých AOI, dokud nebude AOI validation. Řecko má dostupné hotspot CSV; Argentina zatím jen vyznačení dotčených provincií.

## 9. Návrh vědeckých experimentů (řazeno přínosem)

1. **Frozen time-split ablation:** stejné 2020–2025 testovací roky, modely `k` konstantní, region×month, region×month×DN, fallback, Terra-chain. Roční i měsíční MdAPE/MAE, median log error, peak/onset/length; měřítka podle regionu a 0-count strat.
2. **Nested year-fold:** v každém LOYO foldu přepočítat pouze trénovací `season_start_month` a fallback factors; vyloučit všechny cílové roky ze zjištění sezóny.
3. **Empirická coverage:** uložit pred/obs a intervaly pro 2020–2025, uvést nominálních 80 % vs skutečnou coverage a šířku, highlight 2021 Evia a 2022 Corrientes.
4. **Spatial cross-validation AOI:** několik desítek stratifikovaných AOI podle rozlohy (1, 10, 100, 1000 km²), různých land covers a hranic; fit NUTS2, test mimo kalibrační subregiony, měřit bias a season performance.
5. **Static filter sensitivity:** 8/16/24/32 dní + ref. průmyslové/vulkanické zdroje; ruční fotointerpretace vyřazených buněk a false positive rate.
6. **SP/NRT splice experiment:** stejné překryvné měsíce, raw vs revised FIRMS, rozdíly po dnech a regionech. Neslučovat bez provenance.
7. **Srovnání s externím produktem:** nezávislé VIIRS burned-area/EFFIS/požární registry pouze jako kontext k charakteru požáru, ne jako přímé počty hotspotů.

## 10. Odpověď na hlavní vědeckou otázku

Projekt **není pouze vizualizace**: prokazatelně implementuje věcnou regionálně stratifikovanou harmonizaci a objektivně kontroluje část jejího výkonu mimo fit období. Ale **dosud neprokazuje spolehlivou historickou aktivitu pro libovolné AOI ani statisticky kalibrované historické intervaly**. Před nezávislou vědeckou recenzí by nestačil; pro hackathon má reálný experimentální přínos při transparentním označení limitů.

### Primární zdroje ke kontrole

- Kód: https://github.com/MetrPikeska/burning-calendar/blob/0a3dceac7922be4630831d9307efd67fa5391cbc/pipeline/harmonize.py
- Validace: https://github.com/MetrPikeska/burning-calendar/blob/0a3dceac7922be4630831d9307efd67fa5391cbc/pipeline/validate.py
- AOI: https://github.com/MetrPikeska/burning-calendar/blob/0a3dceac7922be4630831d9307efd67fa5391cbc/web/src/aoi/geojson.ts
- NASA FIRMS: https://firms.modaps.eosdis.nasa.gov/
- NASA VIIRS active fire product: https://www.earthdata.nasa.gov/data/instruments/viirs
- NASA Space Apps challenge: https://www.spaceappschallenge.org/2026/challenges/harmonization-of-modis-and-viirs-hot-spots/

<!-- ROADMAP_TO_10.md -->

# Burning Calendar — Roadmap to 10/10

**Audit HEAD:** `0a3dceac7922be4630831d9307efd67fa5391cbc`, 2026-11-14.  
**Výchozí přísné skóre:** **7,2/10** podle požadovaných vah (scientific 30 %, compliance 25 %, technical 20 %, innovation 15 %, UX 10 %). Odhady přínosu jsou **orientační horní meze možného zvýšení hodnocení**, **nejsou** garantovanou změnou skóre ani aditivními body. Následující soubory existují na HEAD, pokud není explicitně napsáno *nový soubor*. Editace zde **nebyly provedeny**.

## P0 — vědecká důvěryhodnost (před submission/pitch)

### P0-01: Validace bez úniku do výběru sezonního okna

- **Problém:** `raw_start_month(m)` je spočten před LOYO z celé MODIS klimatologie do 2025-12, tedy i z validačních let. U `EL52` po vynechání roku 2016 změní minimum z dubna na prosinec.
- **Dopad:** scientific validity, riziko optimistické season onset/peak validation; zásadní otázka pro EO porotce.
- **Implementace:** refaktorovat `loyo()` a `time_split()`, aby v každém fold/training splitu měly samostatný `start_month` získaný **jen z training MODIS**. Predikci i observed VIIRS v testovacím roce měřit ve shodném fold-specifickém season window. Uložit původní a corrected metriky vedle sebe.
- **Soubory:** `pipeline/validate.py`, `pipeline/build.py`, `pipeline/calendar_metrics.py`, `pipeline/harmonize.py`, `tests/test_harmonize.py` (ověřit cestu testu); výstup `web/public/data/v1/**/validation.json` přegenerovat pipeline.
- **Akceptace:** žádná informace testovacího roku nevstupuje do definice season; každá LOYO složka obsahuje `train_years`, `season_start_month`; test `EL52` bez 2016 přepíná start 4→12 nebo je změna explicitně vysvětlena odlišným, předem zafixovaným oknem.
- **Test:** unit `fold-start-month-no-leakage` + end-to-end rebuild/holdout; porovnat peak/onset/end/length MdAPE před/po.
- **Odhad přínosu:** **+0,2 až +0,4 bodu**, hlavně důvěryhodnost.

### P0-02: Dokázat, že harmonizace překonává jednoduchý faktor

- **Problém:** nezávislá ablace odhalila GR `k` MdAPE=6,0 % proti projektové 7,1 %; EL52 11,7 % vs 11,8 %. Nestačí prohlašovat úspěch složitého modelu.
- **Dopad:** scientific validity + relevance; bez baseline porota nepozná, zda složitost přináší skutečnou hodnotu.
- **Implementace:** implementovat `constant_ratio`, `month_ratio`, `month_dn`, full fallback a Terra-chain varianty na **identickém** train 2012–2019/test 2020–2025. Uložit per-year/per-month holdout preds a scorecards v JSON/CSV, přidat transparentní graf i negativní výsledky.
- **Soubory:** `pipeline/harmonize.py`, `pipeline/validate.py`, **nový** `pipeline/ablation.py`, **nový** `web/public/data/v1/{gr,ar}/ablation.json`, `web/src/charts/` nebo stávající validační panel.
- **Akceptace:** všech 39 regionů má baseline + full model s přesnými tréninkovými/testovacími roky; u každého vidět roční MdAPE, měsíční bias/RMSE a season quality; neukrývat regiony, kde baseline vyhraje.
- **Test:** shoda publikovaného `k` s přepočtem `ΣVIIRS/ΣMODIS`; např. GR≈3,500, EL64≈2,483; automatický výpočet holdout ročních error procent z uložených preds.
- **Odhad přínosu:** **+0,25 až +0,5 bodu**.

### P0-03: Nevyvolávat dojem kalibrovaných 80% intervalů

- **Problém:** band `q10..q90(obs/pred)` pooled by season postrádá nezávislou coverage; nulový modelovaný měsíc implikuje `[0,0]` i při reálných VIIRS>0 (EL64 2021-12: MODIS=0, VIIRS=2).
- **Dopad:** scientific validity, potenciálně nejzávažnější neoprávněné tvrzení o nejistotě.
- **Implementace:** uložit holdout pred/obs, publikovat empirical coverage na 2020–2025; zavést zero-count residual handling (např. bootstrap/NB predictive nebo explicitní `interval_unavailable` pro nízký count), rozpad podle count, DN, sezóny, regionu.
- **Soubory:** `pipeline/validate.py`, `pipeline/harmonize.py`, `pipeline/export.py`, `web/api/_lib/tools.ts`, `web/src/aoi/compute.ts`, UI detail a legenda.
- **Akceptace:** přesně uvedená nominální vs realizovaná coverage; nulový pred neimplikuje automaticky neodůvodněnou `lo=hi=0`; alespoň 2020–2025 holdout coverage report pro 3 velikostní třídy.
- **Test:** ručně vytvořit 12 měsíců `modis=0`, `viirs>0`; očekávat nenulovou horní mez nebo explicitní `unquantified_uncertainty` a správnou caveat.
- **Odhad přínosu:** **+0,25 až +0,5 bodu**.

### P0-04: AOI plochy vypočítat jako skutečnou union

- **Problém:** `areaKm2()` přičítá překryvy dílů a používá plochou projekci; dva totožné 5km buffery dávají cca 157,08 místo 78,54 km². Počty detekcí jsou podle `contains` na union, plocha nikoli.
- **Dopad:** technická a vědecká korektnost AOI, možné 2× zkreslení hustoty; vysoké riziko při přímé porotcovské demonstraci.
- **Implementace:** pro area polygonů, punktových a liniových bufferů vytvořit robustní geometrie v adekvátní projekci, provést skutečné polygonové `union` (např. robustní JSTS nebo clipping knihovna), plochu spočíst equal-area pro danou oblast/geodesic. Nezahrnovat `role=point-buffer` dvakrát při importu.
- **Soubory:** `web/src/aoi/geojson.ts`, `web/src/aoi/run.ts`, `web/test/aoi.test.ts`, příp. `web/package.json` (nová knihovna).
- **Akceptace:** dva identické 5km point buffery = plocha **~78,54 km²**, nikoliv 157,08; překryv polygon+buffer nezvětší plochu přes union; díry zůstanou odečtené; area within ≤1 % nezávislého EPSG:6933/GEOS reference na testovacích tvarech.
- **Test:** identical-discs, partially-overlapping-discs, nested-polygons, hole, coastal multipolygon, 50km point buffer a cross-region polygon; test vůči Shapely/pyproj referenci.
- **Odhad přínosu:** **+0,3 až +0,55 bodu**.

### P0-05: Neprodávat NUTS2 AOI backcast jako validovanou hodnotu

- **Problém:** `computeAoi` násobí malé AOI regionálními faktory; kalibrační reprezentativnost uvnitř regionu není známá. Měřítkové rozdíly mohou dominovat.
- **Dopad:** challenge compliance + validity. AOI je explicitní součást zadání, pouze technické ořezání nestačí pro vědecky přesný výstup.
- **Implementace:** ihned AOI jasně označit **exploratory / not AOI validated** u backcast měsíců, v tooltipu, CSV i legendě. Vedle uvést počet kalibračních MODIS detekcí v AOI a rozsah převzatých regionů. Pro seriózní produkci přidat spatial CV podle sub-AOI 1/10/100/1000 km² a případně area-specific fit nebo blokovat výstup pro nulový/minimální calibration support.
- **Soubory:** `web/src/aoi/compute.ts`, `web/src/aoi/run.ts`, `web/src/main.ts`, `web/test/aoi.test.ts`, `docs/TECHNICAL_AUDIT.md`.
- **Akceptace:** žádný AOI historický výstup se netváří jako regionálně validovaná časová řada; pre-2012 na AOI označen `src=estimated_unvalidated_aoi` či explicitní metadata/caveat; existuje reprodukovatelný plán spatial holdout.
- **Test:** malý 1km kruh a oblast hranice dvou NUTS2; kontrola disclaimers v kartě, CSV, exportovaných JSON a instrukcích MCP.
- **Odhad přínosu:** **+0,25 až +0,45 bodu**.

## P1 — chyby API, provenance a prostorová QA

### P1-01: `show_calendar` ve VIIRS sérii před 2012

- **Problém (CONFIRMED production):** `show_calendar(EL64,2003-01..2003-02,series=viirs)` vrátí `months.v=null`, `src=backcast`, `totals.harm=6.7`, `totals.modis=2`, `totals.backcast_months=2`, top-level `backcast_months=0`; série není explicitně `out_of_coverage`.
- **Dopad:** vědecká interpretace MCP odpovědi agentem.
- **Implementace:** zavést `series_coverage` podle senzoru, u neexistující zvolené série explicitní `no_data_for_selected_series`, oddělit `totals` do `all_series_totals` od `selected_series_total`; `backcast_months` jednoznačně na zvolené škále.
- **Soubory:** `web/api/_lib/widget.ts`, `web/api/_lib/widget-html.ts`, `web/test/mcp-endpoint.test.ts`.
- **Akceptace:** pro 2003 `viirs` zobrazené období nemá kladné total VIIRS, caveat jasně říká start S-NPP leden 2012; hodnoty jiné škály nikdy bez názvu nepřebírají titul zvolené série.
- **Test:** roky 2003, 2011, Jan 2012, Feb 2012, Aug 2021, 2026; 3 `series`.
- **Odhad přínosu:** **+0,05 až +0,15 bodu**.

### P1-02: GeoJSON topologie, různé radiusy, přesný roundtrip

- **Problém:** `ring()` validuje jen počet a rozsah souřadnic, nikoliv closure/self-crossing; export point-buffer je mapová geometrie, která musí být bezpečně ignorována při opětovném importu; pro všechny bod/line buffery je jednotný radius.
- **Dopad:** GIS odborná důvěryhodnost, potenciální nesoulad exportu/importu cizích souborů.
- **Implementace:** topologická validace po importu a validní GeoJSON normalization, `polygon-clipping`/JSTS predicate, kontrola ring closure a orientace; buď podporovat per-feature radius nebo heterogenní radii odmítat s vysvětlením; role v namespacovaném metadata objectu.
- **Soubory:** `web/src/aoi/geojson.ts`, `web/src/aoi/draw.ts`, `web/test/aoi.test.ts`.
- **Akceptace:** export → import → export geometrií má stejnou union footprint podle GEOS tolerance ≤0,1 %, stejný počet detekcí, radius a souřadnicový systém; nevalidní bowtie polygon se nepočítá.
- **Test:** bowtie, open-ring, wrong CRS, antimeridian, MultiPolygon with holes, mixed buffers 2/10km, polygon duplicated by FeatureCollection.
- **Odhad přínosu:** **+0,1 až +0,25 bodu**.

### P1-03: Výběr skutečně dotčených regionů a pobřeží

- **Problém:** `touchedRegions()` používá bbox mapových regionů; vizualizační hranice 1:20M jsou jiné než 1:1M assignment. Některé nearest-offshore hot spots v samostatném regionálním exportu nelze reprodukovat polygonem podle mapy.
- **Dopad:** nesoulad AOI=whole region vůči publikované regionální řadě, přebytečné CSV downloady.
- **Implementace:** stage-1 bbox pouze jako prefilter, stage-2 polygon intersection / prepared geometry z assignment boundary; volitelná geomet. maska pro 5km nearest; uvést reference boundary version a tolerance.
- **Soubory:** `web/src/aoi/run.ts`, `web/src/aoi/geojson.ts`, `web/src/lib/geo.ts`, `pipeline/mcp_geometry.py`, `web/test/aoi.test.ts`.
- **Akceptace:** test přesné assignment boundary = identické měsíční `modis/viirs/harm` s regionem, výjimky vyčísleny a vysvětleny pro nearest 5km coastal points.
- **Test:** EL64, EL52, EL62, malé ostrovy, AOI těsně u hranic a na moři.
- **Odhad přínosu:** **+0,15 až +0,35 bodu**.

### P1-04: Jasně vysvětlit dvoubodový rozdíl country/regions

- **Problém:** Řecko 2021 GR VIIRS =9578, 13 regionů =9576 (rozdíl 2), MODIS=2387 shodně. Jedná se pravděpodobně o body mimo subregionní hranice, přesná příčina těch dvou se neověřila.
- **Dopad:** prověřitelná provenance a věrohodnost agregací.
- **Implementace:** emitovat country reconciliation (`assigned_to_region`, `nearest`, `unassigned`, `country_only`) po jednotlivých měsících a senzorech a v `aggregate` jako bilanci, nebo výslovně popsat neaditivitu.
- **Soubory:** `pipeline/regions.py`, `pipeline/build.py`, `pipeline/export.py`, `web/api/_lib/tools.ts`, testy pipeline.
- **Akceptace:** `country_total == sum(regions)+unassigned_country_only`, včetně 2021 VIIRS rozdílu 2, a auditní seznam dotčených identifikátorů.
- **Test:** parametricky všechny roky/senzory GR/AR, nulová nevysvětlená odchylka.
- **Odhad přínosu:** **+0,05 až +0,15 bodu**.

### P1-05: Citlivost statického filtru a pozorovací výpadky

- **Problém:** 16 dnů v sensor-year-0.01° cell je heuristika, kterou mohou splnit reálné časté ohně. Outage flag nepokrývá weather/sampling bias.
- **Dopad:** možné systematické podhodnocení a regionální bias.
- **Implementace:** audit odstraněných buněk s geolokací, land cover, FRP profile a referencí průmyslových zdrojů; sensitivity 8/16/24/32; per-sensor-year coverage index/report.
- **Soubory:** `pipeline/filters.py`, `pipeline/build.py`, **nový** `pipeline/filter_sensitivity.py`, datové QC dokumenty.
- **Akceptace:** veřejná tabulka vyloučených buněk s důvodem a dopadem na harmonizaci; výsledky stabilní vůči rozumným alternativním prahům, nebo jasná caveat.
- **Test:** rozdíl harmonized totals, fit factors, region LOYO na různých prahách.
- **Odhad přínosu:** **+0,1 až +0,25 bodu**.

### P1-06: NRT/SP splice a časový konec S-NPP

- **Problém:** měsíce od 2026-08 jsou NRT, standard processing historicky může mít jinou distribuci detekcí; NOAA-20 splice zatím chybí.
- **Dopad:** modelová stabilita, současná použitelnost.
- **Implementace:** API i UI ukazují `provisional`; nepřidávat dlouhodobé časové trendy z mixu bez zpracování. Jakmile dostupná SP data, přepočítat rozdíly, versionovat input checksum a release hash. NOAA-20 samostatně překalibrovat na S-NPP overlap bez naivního sečtení.
- **Soubory:** `pipeline/download_firms_api.py`, `pipeline/harmonize.py`, `pipeline/build.py`, `web/api/_lib/live/firms.ts`, metadata export.
- **Akceptace:** jasný end-of-coverage; documented NRT/SP overlap metrics + verzovaný původ vstupů; žádný neoznačený splice.
- **Test:** diff per-month/per-region mezi NRT a SP referencí a roční satelitní audit.
- **Odhad přínosu:** **+0,1 až +0,2 bodu**.

### P1-07: Reprodukovatelnost, testy a release evidence

- **Problém:** repo obsahuje testy a build skripty, ale při tomto auditu nebyly lokálně spuštěny. Vercel `success` není důkaz end-to-end validace.
- **Dopad:** technical + presentation.
- **Implementace:** v CI spustit `npm run typecheck`, `npm test`, `npm run build`, Python testy, `scripts/smoke-mcp.mjs` proti preview a produkční smoke porovnání dataset version; přidat artefakt test logs, checksum inputů a lockfile.
- **Soubory:** `web/package.json`, `web/scripts/smoke-mcp.mjs`, `.github/workflows/` **nová workflow**, `pipeline/build.py`, `README.md`.
- **Akceptace:** jediný odkaz na CI run s green testy aktuálního SHA a public test summary, bez externích tajných tokenů.
- **Test:** negativní fixture (vadný GeoJSON, neplatná data a chybějící region), build from clean checkout.
- **Odhad přínosu:** **+0,15 až +0,3 bodu**.

## P2 — kvalita produktu a soutěžní prezentace

### P2-01: Nejednoznačný `get_fire_weather(region_id,lat,lon)`

- **Problém:** produkční volání s `region_id=EL64,lat=0,lon=0` použilo bez erroru bod regionu `38.6545,22.8029`. Vstup je dvojznačný.
- **Dopad:** důvěra v API při agentic workflow.
- **Implementace:** Zod `superRefine` v `web/api/_lib/live/register.ts` pro přesně jednu variantu souřadnice-vs-region; vysvětlit správný podpis.
- **Akceptace:** při současném zadání obou variant `INVALID_ARGUMENT` s explicitním odkazem na konflikt.
- **Test:** region only, point only, region+one coord, region+both.
- **Odhad přínosu:** **+0,02 až +0,08 bodu**.

### P2-02: UI E2E, keyboard a mobilní viewport

- **Problém:** kód kreslení i widget existuje, ale skutečné interakce nebyly ověřeny browser E2E. Přesun polygonu, drop GeoJSON a ovládání klávesou mohou být jiné než unit test geometrie.
- **Dopad:** UX, porotcovské demo.
- **Implementace:** Playwright scénář 390×844 a 1440×900: načtení mapy, query region, kreslení polygonu, Point 5km/Line 2km, Upload, download/export → reupload, kontrola alertů, čitelná tabulka a klávesnice; přidat aria-live pro výsledky a focus management.
- **Soubory:** `web/src/aoi/draw.ts`, `web/src/main.ts`, `web/src/styles/` (podle skutečné struktury), **nový** `web/e2e/aoi.spec.ts`.
- **Akceptace:** všechny scénáře green, neblokované důležité prvky na mobilu, jasné error stavy a screen-reader descriptions.
- **Test:** Playwright Chromium + WebKit, keyboard-only, axe accessibility scan.
- **Odhad přínosu:** **+0,1 až +0,25 bodu**.

### P2-03: Srovnatelné a nesrovnatelné jednotky vizuálně

- **Problém:** i přes API `unit` mohou uživatelé vnímat počty detekcí jako počty požárů; relativní oblasti nejsou VIIRS-equivalent, density favorizuje určité prostorové situace.
- **Dopad:** presentation + scientific communication.
- **Implementace:** headline „Satellite detections, not individual fires”; u každé hodnoty štítek raw/modelled/observed; explicitní „not comparable” při `relative`; po kliknutí na 2001 měsíce ukázat range a Terra chain.
- **Soubory:** `web/src/main.ts`, `web/src/charts/`, `web/src/lib/contract.ts`, `docs/project-page.md`, `video/`.
- **Akceptace:** laik za 30 s vysvětlí, co znamená 4235 a proč 2001 má interval; žádná karta neříká „4235 fires”.
- **Test:** manuální 5-user usability task, v testu očekávat správnou odpověď detekce vs požáry.
- **Odhad přínosu:** **+0,1 až +0,2 bodu**.

### P2-04: Soutěžní pitch vybudovaný kolem obhajitelného výsledku

- **Problém:** množství funkcí může odvést pozornost od klíčové vědecké otázky a slabiny holdoutu.
- **Dopad:** presentation, relevance.
- **Implementace:** 30–60 s jasně ukázat falešný senzorový skok v 2012, empirickou harmonizaci na části země, Evia 2021 (4235 detekcí / 67× baseline), benchmark + omezující větu o nevalidovaném AOI. Výhradně zdrojované grafy. Demo offline fallback z JSON.
- **Soubory:** `video/`, `docs/project-page.md`, `README.md`.
- **Akceptace:** přímá odpověď na „Jaký problém harmonizace řešíte? Jak jste ji ověřili? Co ještě *nevíte*?” během 90 s; bez zaměňování detekcí za požáry.
- **Test:** nezávislý hodnotitel zopakuje problém-metodu-validaci-limity po jedné prezentaci.
- **Odhad přínosu:** **+0,1 až +0,25 bodu**.

## Doporučená minimální P0 sada při časové tísni

**V pořadí:** (1) přestaňte vydávat AOI za vědecky validované, (2) opravte sčítání překrývajících se ploch, (3) přepočítejte season-fold bez úniku, (4) publikujte jednoduchou ablační tabulku, (5) označte empirickou nejistotu poctivě. To zlepší obhajitelnost více než další přidávání živých nástrojů.

## Kdy bych dal 9–10/10

Teprve po doložení **nezávislého časového testu včetně uncertainty coverage**, výkonu proti jednoduchému baseline a prostorové AOI validace, přesné geometrie, evidence build/CI a reálného E2E. Funkční MCP server je nutná podmínka interoperability, nikoli náhrada vědecké validity.

## Cross-check odkazy

- Výchozí audit: `EXECUTIVE_REVIEW.md`
- Skutečná API volání: `MCP_TEST_REPORT.md`
- Matematická a prostorová odůvodnění: `SCIENTIFIC_REVIEW.md`
- Aktuální zdroj: https://github.com/MetrPikeska/burning-calendar/tree/0a3dceac7922be4630831d9307efd67fa5391cbc
