---
title: External audit round 2 of commit d93826b (Czech, 4 reports)
updated: 2026-11-14
verified_by: R2-001 to R2-004 checked against main d93826b on 14 Nov 2026, all four reproduced in code; fixed on branch audit-r2
sources: [burning_calendar_audit_round2_2026-11-14.zip]
---

Verbatim copy of the four Markdown reports from burning_calendar_audit_round2_2026-11-14.zip (re-test after the round 1 fixes, main d93826b, production MCP, 14 Nov 2026). Self-assessed score 7.3/10 (round 1: 6.8) on the auditor's own weights, not NASA criteria. BC-001 to BC-005 pass. Order: executive review, MCP test report, scientific review, roadmap.


<!-- EXECUTIVE_REVIEW.md -->

## Burning Calendar — nezávislý audit po opravách (Round 2)

**Datum:** 14. 11. 2026 · **Projekt:** NASA Space Apps Challenge 2026 — Harmonization of MODIS and VIIRS Hot Spots  
**Repozitář:** `MetrPikeska/burning-calendar`, `main` = `d93826b54ef78f8596d6f9fa73a73d1406240f8d` (committer 15:16:36 UTC).  
**Předchozí audit:** `b09212a410a22e50edc9271efcdd86e0503ad763`, skóre 6,8/10. **Rozdíl:** 3 commity, nové AOI a opravy BC-001–005.  
**Zdroje:** GitHub connector (zdrojový kód a porovnání commitů), skutečné produkční MCP connector calls, oficiální NASA challenge summary, výpočet dílčích statistik. **Žádné změny kódu/dat/deploye.**

### Verdikt

**Předběžné, přísné skóre: 7,3/10 (dříve 6,8/10).** Dříve hlášených pět chyb BC-001 až BC-005 nyní prošlo **konkrétními regresními testy**. Největší pokrok je oddělení datových stupnic a nová možnost kreslit či importovat vlastní AOI v Řecku. Zároveň přibylo riziko v serializaci AOI: exportované GeoJSON není round-trip kompatibilní. Vědecké problémy harmonizace, především jednotlivé extrémní time-split odchylky, zůstávají nezměněné.

| Kategorie (vlastní váhy, nikoli oficiální NASA) | Váha | Minule | Nyní | Příspěvek |
|---|---:|---:|---:|---:|
| Vědecká správnost | 30 % | 6,5 | 6,5 | 1,950 |
| Soulad se zadáním | 25 % | 6,5 | 7,8 | 1,950 |
| Technická implementace | 20 % | 7,8 | 8,0 | 1,600 |
| Inovace | 15 % | 7,4 | 8,1 | 1,215 |
| UX a prezentace | 10 % | 5,5 | 6,0 | 0,600 |
| **Celkem** | **100 %** | **6,8** | **7,3** | **7,315** |

UX skóre je **pouze odhad na základě kódu/kontraktu**, nikoli měřený browser audit. Vyšší hodnocení by bylo neopodstatněné bez aktuálního testu produkční webové aplikace a AOI v prohlížeči.

### Změny a retest BC-001 až BC-005

| Původní ID | Stav | Důkaz z aktuálního produkčního MCP / kódu |
|---|---|---|
| BC-001: alternativní řada + `anom` a špatná `unit` | **Opraveno v měsíčních záznamech** | `show_calendar(EL52,2024,series=modis)` má správnou MODIS `unit`, `2024-05 v=0` bez `anom`; `anomaly_months_omitted` vysvětluje důvod. **Pozor na zbylé roční `totals[].anomaly_months` (R2-001)**. |
| BC-002: mixed-mode `aggregate` mísí anomálie | **Opraveno** | `aggregate([EL52,EL62],2024)` → `series=modis`, total=209, EL52=205 a `anomaly_months_omitted`; EL62=4 se svými MODIS anomáliemi. |
| BC-003: `relative` má před 2012 `src=backcast` | **Opraveno** | `get_region_series(EL62,2007-07)` → `modis=81,src=observed`; `AR 02,2007-07` také `observed`. Změny jsou i v `pipeline/harmonize.py`, AOI portu a publikovaných datech tří relative regionů. |
| BC-004: měření `mean` popsané jako `median` | **Opraveno** | `get_validation(EL52)` nyní popisuje `onset_mad_months`, `end_mad_months`, `length_mad_months` jako **mean absolute difference**, v souladu s `np.mean`. |
| BC-005: neplatné datum počasí | **Opraveno** | `get_fire_weather(EL52,2026-02-30..2026-03-01)` → `INVALID_ARGUMENT`; také 2025-02-29 a 2026-04-31 odmítnuty, platný 2024-02-29 přijat. |

### Nové/nedokončené nálezy

| ID | Závažnost | Stav | Zjištění |
|---|---|---|---|
| **R2-001** | Medium | **Potvrzeno produkčním MCP** | `show_calendar(series=modis)` zruší `anom` v měsících, ale v `totals[2024].anomaly_months` stále ponechá `[2024-05,2024-06,2024-07,2024-08]` ze série `harm`. Na špatnou sérii navíc zůstává kontextový caveat o malých harmonizovaných anomáliích a VIIRS outage. |
| **R2-002** | **High** | **Potvrzeno statickou kontrolou kódu a nezávislým přepočtem** | `aoiToGeoJson` exportuje bod i kruhový polygon `point-buffer`; `parseGeoJson` při reimportu oba načte jako nezávislé části. Pro bod s poloměrem 5 km se zobrazovaná plocha změní z ~78,54 na ~156,95 km². Při novém importu s jiným radius pickerem se může změnit i vybraná oblast a její detekce. Browser click-path dosud neověřen. |
| **R2-003** | Medium | **Potvrzeno produkčním MCP** | `get_fire_alerts(country="AR",region_id="EL52")` vrátí `countries=["GR"]` bez chyby vstupu nebo `ignored_country` upozornění. Kontrakt dává regionu přednost, ale pro asistenta je kombinace konfliktní. |
| **R2-004** | Low | **Potvrzeno z kódu; vizuálně neověřeno** | Webový heatmap přestane kreslit anomálie v jiné sérii, ale `marksKey()` i dál zobrazuje položku legendy „Anomaly“. Jde o UX nekonzistenci, nikoli chybu čísel. |

Přesné reprodukce a návrhy testů: `MCP_TEST_REPORT.md`; AOI roundtrip také `SCIENTIFIC_REVIEW.md`.

### Co obstálo v nové verzi

- **16 MCP nástrojů** identifikovaných dynamicky a každý **znovu skutečně zavolán** na běžném vstupu. Další negativní testy v omezených dávkách bez zátěžových pokusů.
- **Křížová konzistence** `EL52` v roce 2024: `get_region_series`, `show_calendar`, `aggregate`, `compare_regions(year_total)` souhlasí na **828** harmonizovaných detekcích. `EL61` = **221**, součet **1049**. Sezóna 2024 u EL52 je jiný interval (2024-04 až 2025-03) a dává **868**; není to nesoulad.
- **Nezávislý přepočet** `EL52` srpen 2024: ze stejného měsíce 2014–2023 vychází medián **19**, P90 **33,9** (MCP shodné). GR srpen 2007, baseline 2002–2011 bez roku 2007: medián **781,2**, P90 **2107,8** (shodné).
- **Backcast a intervaly** `GR 2007-08`: MODIS **3137**, harmonizovaná predikce **11943,1**, `harm_lo..harm_hi` **8730,4..15382,7**. Původ správně `backcast`.
- **Chybové stavy**: převrácený rozsah, neznámý region, nadlimit 120 měsíců a míchání `GR` s jeho regiony odmítnuty; duplicitní region se sčítá jen jednou; `EL62` zakazuje `series=harm`.
- **Live provenance:** počasí odlišuje `forecast`/`reanalysis`; Meteostat vyznačuje `model_fields`; FIRMS používá `sources_failed`/`null` pro selhaný zdroj, neporovnává NOAA-21 s S-NPP v ratio. Ověřeno chování konektoru, nikoli nezávisle údaje NASA.
- **Vercel deployment status** je `success` pro aktuální commit. To **není potvrzení** úspěšného `pytest` ani `vitest`; GitHub Actions nevrátily relevantní běhy.

### Nepřekročené vědecké slabiny

1. `EL42` (Notio Aigaio): LOYO 25,0 %, time-split **−77,7 % v roce 2025**; zůstává `harmonized`. `EL54` (Ipeiros): **+80,4 % v roce 2023** a time-split MdAPE 31,9 %, také `harmonized`. Práh `relative` hlídá LOYO a peak, nikoli time-split extrémy.
2. LOYO `harm_lo/harm_hi` je empirická škála kvantilů chyb, **nikoli ověřený 80% predikční interval** pro historická data; bez coverage testu nelze garantovat rozsah.
3. Poměrové mapování MODIS→VIIRS s nulovým MODIS počtem nemůže bez interceptu odhadnout >0 VIIRS; regionální a časová nestacionarita není eliminována.
4. Před 2012 je anomální baseline `fixed_2002_2011` retrospektivní (v některých cílových letech obsahuje pozdější data). Nelze ji prezentovat jako tehdy existující varování.
5. Live NOAA-20 NRT vůči historickému VIIRS S-NPP není kalibrovaná srovnatelná řada a hotspot není jednotlivý požár, plocha ani předpověď.
6. **AOI:** faktory jsou fitovány pro region NUTS2, nikoli validovány pro libovolné polygony. Překryv nebo chybné uložení AOI může významově změnit výsledky; Argentina umí AOI identifikovat, nikoli pro něj vytvořit vlastní kalendář, protože individuální detekce nejsou distribuovány.

### Doporučení před odevzdáním

**P0:** opravte R2-002 (roundtrip GeoJSON) a R2-001 (anomálie v ročních sumářích a caveats pro alternativní sérii); přidejte regresní testy. Explicitně vysvětlete extrémní regionální chyby validace a možnosti alternativní série. **P1:** validace AOI na lokálních subregionech a pobřeží, kontrola intervalů a benchmarky výkonu mobilu; vyřešení R2-003. **P2:** drobné UX legendy a vyhlazení prezentace. Detailní roadmapa v `ROADMAP_TO_10.md`.

### Rozsah, omezení a reprodukovatelnost

Ověřené skutečnosti: živé produkční MCP, aktuální GitHub kód, starý a nový commit, aritmetická konzistence řad a baseline; deterministický výpočet chyby AOI serializace. **Neověřeno:** úplný běh pipeline ze surových FIRMS souborů, nezávislý download NASA dat, běh test runneru, automatizovaný browser, mobilní výkon a vizuální přístupnost. Neuvádět skóre jako oficiální NASA ranking.

**Odkazy:** [aktuální commit](https://github.com/MetrPikeska/burning-calendar/commit/d93826b54ef78f8596d6f9fa73a73d1406240f8d), [porovnání s minulou revizí](https://github.com/MetrPikeska/burning-calendar/compare/b09212a410a22e50edc9271efcdd86e0503ad763...d93826b54ef78f8596d6f9fa73a73d1406240f8d), [oficiální zadání](https://www.spaceappschallenge.org/2026/challenges/modis-and-viirs-hot-spots/), [produkční web](https://burning-calendar.vercel.app/).

<!-- MCP_TEST_REPORT.md -->

## Burning Calendar — produkční MCP red-team retest (Round 2)

**Snapshot:** 14. 11. 2026, commit `d93826b` · **Server:** `https://burning-calendar.vercel.app/api/mcp` přes připojené produkční nástroje · **Rozsah:** 16 dynamicky objevených tool schemas, 16 normálních volání a sady chybových/hranových vstupů. Nepoužit zátěžový test. 

**Legenda:** PASS = uvedený konkrétní vstup odpověděl očekávaně; REPRO = reprodukovaný defekt; RISK = nedoložená vědecká/statistická kvalita; NOT TESTED = přímý test nebyl proveden. Neodvozovat z PASS úplnou bezchybnost.

### A. Matice nástrojů

| Nástroj | Běžný test → skutečný výsledek | Hranový/chybný test | Verdikt |
|---|---|---|---|
| `search_regions` | `country=GR, level=nuts2, limit=20` → 13 regionů, 12 harmonized + EL62 relative | Předchozí `limit=0` schéma odmítá | PASS |
| `get_region_series` | `EL52,2024-01..2024-12` → total 828, všechny měsíce se správnými jednotkami; `EL62 2007-07`→ `src=observed` | `EL99`, převrácený interval, 312 měsíců → `INVALID_ARGUMENT` | PASS |
| `get_season_calendar` | `EL52,year=2024` → season window `2024-04..2025-03`, total 868 | `year=2100` (předchozí audit) → prázdné seasons + popis okna | PASS / sémantika season year |
| `get_anomalies` | `EL52,2024` → flagged 05–08; `EL52 2024-08`: 208, p90 33.9 | `year=2099` → prázdná data + out_of_coverage | PASS |
| `compare_regions` | `EL52` proti `EL61`, `year_total,2024` → 828 proti 221 | `EL52` vs relative `EL62` → ranking_allowed=false | PASS |
| `aggregate` | `[EL52,EL61],2024` → 1049 | `[GR,EL52]` odmítnuto; `[EL52,EL52]` vrátí 828; `[EL52,EL62]` → 209 MODIS a výjimka v anomaly metadata | PASS; BC-002 opraveno |
| `rank_regions` | `country=GR,level=nuts2,density_per_1000km2,top=5` → EL61 81.87, EL30 81.69; EL62 excluded_relative | Třídění a exclusion ověřeno ve výstupu; neprováděn extrémní `top` limit | PASS |
| `find_region_at` | 40.6401,22.9444 → EL52 | 37.75,23.8 → `found=false`, `nearest EL30 3.54 km`; 0,0 → not found | PASS (detekční assignment = jiná politika) |
| `get_validation` | GR → LOYO MdAPE 5.4 %, time-split 7.1 %; EL52 units `mean` | EL42/EL54 extrémy potvrzeny; přepočteny mediány z ročních chyb | PASS + RISK |
| `get_methodology` | `topic=harmonization` → ratios 2012–2019, fallback, Terra-only chain | Limity/anomalies topics dostupné, nekontrolována každá věta s původními FIRMS soubory | PASS |
| `show_calendar` | EL52 2024 → 828; explicitně `series=modis` → 205, bez měsíčních `anom` | `EL62,series=harm` odmítnuto; `series=modis` má stále `totals[].anomaly_months` z harm | **REPRO R2-001** |
| `get_fire_alerts` | GR,7 days → count 0, metadata GDACS/CEMS | `country=AR,region_id=EL52` → bez varování GR | **REPRO R2-003** |
| `get_fire_weather` | EL52,2026-11-12..17 → 6 dní, forecast od 15.11, reanalysis předtím | 2026-02-30, 2025-02-29, 2026-04-31 odmítnuty; leap 2024-02-29 přijato | PASS; BC-005 opraveno |
| `get_weather_stations` | EL52,2026-11-01..10 → Thessaloniki Airport, 5 days_with_measurements, many model-filled fields | Reversed range odmítnut | PASS + caveat station_lag |
| `get_recent_detections` | EL52,3 days → `configured=true`, NOAA-20/NOAA-21/MODIS fields, FRP, UTC a caveats | 1-day window nemá complete-day ratio (`null`), ne falešně 0 | PASS; NRT není harmonizované |
| `investigate_month` | EL52 2024-08 → value 208, rank 3/26, weather + JSON/CSV evidence links | Pro 2024-08 live správně skipped; minulý audit 1999-12→ out_of_coverage | PASS |

Některé třetí strany měnily výsledky **během retestu**: live FIRMS se u NOAA-21 jednou vrátilo bez úplných dat (`sources_failed`, `per_sensor_per_day=null`), jindy s detekcemi. Toto je důkaz správného oddělení selhání od nulového pozorování, **ne** důkaz přesnosti nebo spolehlivosti zdroje.

### B. Regrese vůči minulému auditu

| BC-ID | Původní reprodukce | Nový vstup a výsledek | Stav |
|---|---|---|---|
| BC-001 | `show_calendar(EL52,2024,series=modis)` vracelo pro `2024-05` současně `v=0` a `anom=true`, `unit=VIIRS-equivalent` | `unit=raw MODIS...`; `2024-05` má pouze `v=0`, bez `anom`; top-level `anomaly_months_omitted` | **PASS s novým R2-001** (vnořený `totals`) |
| BC-002 | Mixed `aggregate([EL52,EL62],2024)` vracelo harmonizované `EL52.anomaly_months` | `series=modis,total=209`; EL52 `anomaly_months_omitted`, EL62 MODIS `anomaly_months=['2024-06']` | **PASS** |
| BC-003 | `EL62 2007-07:modis=81,src=backcast` | `modis=81,src=observed`; `AR 02,2007-07:src=observed` | **PASS** |
| BC-004 | `*_mad_months` vypočtené mean, definované median | `get_validation(EL52).units` říká `mean absolute difference`, `np.mean` v kódu zůstává | **PASS** |
| BC-005 | `get_fire_weather(2026-02-30)` přijalo datum | `INVALID_ARGUMENT: from: invalid calendar date`; další neplatná data odmítnuta, 2024-02-29 přijato | **PASS** |

**Rozpor dokumentace:** stará část tool description stále může naznačovat, že „anomalies outlined“ obecně i pro alternativní série; skutečné vnořené metadata popisují výjimku. Upravit po fixu R2-001.

### C. Povinné integrační scénáře (A–J)

**A. Historická konzistence (EL52 2024).** Měsíční harmonizovaná/VIIRS série: 65,189,27,40,13,55,88,208,14,46,76,7 → **828**. `get_region_series.totals` = 828, `aggregate` = 828, `compare_regions.year_total` = 828, `show_calendar.totals` = 828. Pro EL61 = 221; aggregate EL52+EL61 = 1049. Pozor `get_season_calendar(EL52,2024)` = 868 za **2024-04..2025-03**, ne kalendářní 2024.

**B. Relative-mode safety (EL62).** `get_region_series(2007-07)` → raw MODIS 81, `harm` nepřítomné, `src=observed`; `show_calendar(series=harm)` → odmítnuto. Smíšený `aggregate` volí MODIS a explicitní caveat. **Prošlo**.

**C. Backcast a nejistota (GR 2007-08).** `modis=3137`, `harm=11943.1`, `harm_lo=8730.4`, `harm_hi=15382.7`, `src=backcast`, `fit_level=region_month_dn`. Rozdíl metrik jasně popsán. **Prošlo s vědeckou výhradou:** interval nebyl prokázán jako predikční interval s garantovaným pokrytím.

**D. Regionální porovnání.** EL52 a EL61 `year_total` porovnává 2024-01..12; `season_total` porovnává **odlišná** okna (`EL52 2024-04..2025-03`, `EL61 2023-12..2024-11`) a každé je v datech uvedeno. Při komunikaci používat year_total pro stejné období. **Prošlo**.

**E. Live FIRMS.** NASA FIRMS NRT pole `counts_by_day`, `sensor`, `lat/lon`, `frp_mw`, `confidence`, `daynight`, UTC, source+fetched_at; `configured=true`. `NOAA-20` proti historickému S-NPP poskytuje jen hrubé per-day ratio, výstup explicitně `nrt_not_harmonized`. V době retestu se live hodnoty měnily a některé sensor rates byly `null` při selhání. **Robustnost částečně prokázána, senzorová kalibrace ne**.

**F. Model vs stanice.** `get_fire_weather` rozlišuje forecast/reanalysis a model grid cell; `get_weather_stations` uvádí model_fields a počet skutečně měřených dní. K 14.11. měla vybraná stanice za 1.–10.11. měření pouze do 5.11., u srážek byly model fills. **Prošlo v metadatech, nekontrolovány externí meteo zdroje**.

**G. Invalid inputs.** `EL99`, 312 měsíců, reversed dates, 2026-02-30, 2025-02-29 a GR+EL52 v aggregate → správné chyby. Duplicate EL52 nepřičten dvakrát. **Prošlo s výjimkou konfliktních volitelných parametrů get_fire_alerts (R2-003)**.

**H. Geographic edge cases.** Thessaloniki found EL52; bod 3,54 km od hranice Attiki vrací `found=false` a `nearest` s kontextem; 0,0 not found. Výpočet AOI na malých ostrovech/pobřežích nebyl otestován v browseru. **Částečně**.

**I. Cross-country.** GR LOYO MdAPE 5.4 %, AR 1.5 %; AR metadata obsahují 24 provincií (22 harmonized, 2 relative). Bez normalizace regionálního footprintu a rozdílného fire regime nelze mechanicky srovnávat počty GR a AR. **Data dostupná; externí srovnatelnost není prokázána**.

**J. Spolehlivost AI agenta.** Většina výstupů má units, source, caveats, time windows, případně `ranking_allowed`. Ale `R2-001` přenáší výslovně nevhodné vnořené `anomaly_months` a R2-003 dovoluje konflikt země/region; nejčastější bezpečnostní problém je význam dat, nikoli HTTP chyba.

### D. CONFIRMED BUGS — nové přesné reprodukce

#### R2-001 — Medium — `show_calendar` po opravě BC-001 nechává staré roční anomálie

- **Komponenta:** `web/api/_lib/widget.ts::calendarData` a `web/api/_lib/tools.ts::regionSeries` (year summaries / caveats).
- **Vstup:** `show_calendar({"region_id":"EL52","from":"2024-01","to":"2024-12","series":"modis","caveats":"full"})`.
- **Očekáváno:** při `anomaly_months_omitted` také `totals[].anomaly_months` nepřítomné nebo zřetelně označené jako `harm_anomaly_months`; `small_counts`/outage caveat navázané na zobrazovanou sérii.
- **Skutečnost:** `series=modis`, `unit=raw MODIS...`, `2024-05:v=0` bez `anom` — to je správně. **Ale:** `totals=[{year:2024,modis:205,harm:828,viirs:828,anomaly_months:["2024-05","2024-06","2024-07","2024-08"]}]` a `caveats` obsahují `small_counts:2024-05 (13)` (harm) a `outage` pro VIIRS S-NPP. Agent může roční anomálie mylně přisoudit MODIS.
- **Příčina:** `calendarData` mění pouze top-level `anomaly_months` a `months` cell; `totals: records` beze změny přenáší předem vypočtené harmonizované anomálie a obecné caveats.
- **Dopad:** vědecká/interpretativní nekonzistence ve strojovém výstupu, nejsilnější u `MODIS=0`.
- **Oprava:** při `series !== anomalySeries` z `totals` odstranit `anomaly_months` (nebo přejmenovat na `anomaly_months_of_harm`), filtrovat model-dependent caveats, včetně skutečné outage série.
- **Regresní test:** `show_calendar(EL52,2024,modis)` musí vracet žádnou neoznačenou `anomaly_months` na *žádné úrovni*; `show_calendar(EL52,2024,harm)` musí zachovat 4 správné měsíce; otestovat i `series=viirs`.

#### R2-002 — High — AOI GeoJSON export/import není idempotentní

- **Komponenta:** `web/src/aoi/geojson.ts::{aoiToGeoJson,parseGeoJson,areaKm2}`; trigger `web/src/main.ts::wireAoiDownloads` a `web/src/aoi/draw.ts::readFile`.
- **Vstup/kroky:** 1) zvolit bod `[23,39]` a radius 5 km; 2) `A=emptyAoi(5)` s `points=[[23,39]]`; 3) export `aoiToGeoJson(A)`; 4) import `B=parseGeoJson(JSON.stringify(export),5)`; 5) porovnat `areaKm2(A)` a `areaKm2(B)`.
- **Očekáváno:** `areaKm2(B) ≈ areaKm2(A) ≈ 78,54 km²`; reexport/reimport nemění AOI.
- **Skutečnost dle deterministické logiky zdrojového kódu a nezávislé geometrické kalkulace:** `aoiToGeoJson` emitne **dvě** features: `{role:point,geometry:Point}` **a** `{role:point-buffer,geometry:Polygon(64-gon)}`; parser role ignoruje a vytvoří `points.length=1` + `polygons.length=1`. `areaKm2` sčítá disk 78,5398 a kruhový polygon cca 78,4137 → **156,9535 km²**. Další opakování přidá další polygon a plochu zvětší na cca 235,37 km². Samotné browser klikání nebylo provedeno, ale jednotlivé funkce a výsledek z jejich algoritmu jednoznačně vyplývají.
- **Druhý důsledek:** GeoJSON si nenese závazně rekonstruovatelný `radius_km`. Při novém sezení s pickerem 5 km import bodu, který byl původně 2km kruhem, rozšíří efektivní `contains` na 5 km. **To může změnit i vybrané hotspoty a všechny kalendářní hodnoty.** Linie má radius pouze v custom feature properties, které parser nečte.
- **Dopad:** nespolehlivá plocha, změna AOI po exportu/reimportu, chybná interpretace vlastního výběru. Pro vědecký nástroj vysoká priorita.
- **Oprava:** oddělit kanonické data AOI od mapové dekorace. Export pouze nezávislých geometrií + `radius_km` na kolekci (nebo bufferované polygonové plochy *bez* původního zdroje současně); parser obnoví radius a ignoruje `role=point-buffer` tam, kde je redundantní. Zajistit kompatibilní mapový export, validaci a idempotenci.
- **Regresní test:** `areaKm2(parseGeoJson(JSON.stringify(aoiToGeoJson(A)), A.radius_km)) ≈ areaKm2(A)` pro `Point radius 2/5/50`, `LineString`, `Polygon`, kombinované AOI; `contains` na bodech uvnitř a mezi poloměry 2–5 km musí být shodné po novém načtení a export-import-export invariantní.

#### R2-003 — Medium — konfliktní country a region není odmítnut

- **Komponenta:** `web/api/_lib/live/register.ts::get_fire_alerts`.
- **Vstup:** `get_fire_alerts({"country":"AR","region_id":"EL52","days":2,"caveats":"full"})`.
- **Očekáváno:** `INVALID_ARGUMENT: region EL52 belongs to GR, not AR`, případně `ignored_country:"AR"` s výraznou výstrahou.
- **Skutečnost:** úspěšný výstup `region.id="EL52", countries=["GR"],region_id="EL52",count=0` bez caveatu o rozporu. Dle kódu `if (region_id)` přepíše country na `r.country`.
- **Dopad:** agent požadující data Argentiny může získat data Řecka, nebezpečné zvláště u živých alertů. Metadata sice zpětně odhalují `GR`, ale request nebyl splněn.
- **Oprava:** mutual exclusion, nebo explicitně ověřit `country===region.country` a chybu vrátit před dotazem upstream.
- **Regresní test:** `AR+EL52` musí skončit chybou; `GR+EL52` a `AR` bez regionu musí fungovat.

#### R2-004 — Low — legenda nabízí anomálii, i když ji alternativa nezobrazuje

- **Komponenta:** `web/src/charts/heatmap.ts::marksKey` + `renderHeatmap`.
- **Kroky:** zobrazit harmonized region `EL52`, přepnout `series=modis`. Zdrojový kód prázdní `anomalies` při `series !== shownSeries(mode,"harm")`, ale `marksKey(hasRange)` generuje položku „Anomaly“ vždy.
- **Očekáváno:** legenda odpovídá tomu, co může nastat na mapě, nebo vysvětluje „anomaly marks only on main series“.
- **Skutečnost:** nekonzistence mezi podmíněnými marks a nepodmíněnou legendou (staticky potvrzeno; **vizuální rendering neověřen**).
- **Oprava:** dát `marksKey` parametr `showAnomalies` a zobrazit legendu podmíněně.
- **Regresní test:** DOM/component test pro default harm, raw modis a VIIRS.

### E. SCIENTIFIC RISKS, NOT CONFIRMED BUGS

1. Time-split extrémy: EL42 rok 2025 −77,7 %, EL54 rok 2023 +80,4 %, přesto oba `harmonized`. Přidat výrazné per-region warning; u AOI posuzovat lokální validaci.
2. `harm_lo..harm_hi` není ověřený 80% coverage interval. Backcastové anomálie a threshold bez nejistoty mohou evokovat přesnost.
3. MODIS nulová pozorování při existujícím VIIRS fire signal → násobicí model umí jen nulu, není vhodný pro malé regiony a AOI.
4. AOI dotčené regiony přes `touchedRegions` vybírané podle **bbox z `regions.geojson`** (pro mapu generalizované), kdežto detections jsou přiřazeny jemnějšími polygon boundaries. U drobných pobřežních ostrovů je možné opomenutí; konkrétní falešně negativní AOI nebylo reprodukováno → riziko, nikoli potvrzený bug.
5. Zobrazená `area_km2` používá lokální shoelace projekci a při překryvech geometrických částí sčítá plochy vícekrát (komentář v kódu), nikoli union/equal-area CRS. Nesmí sloužit jako přesná normalizace hustoty bez korekce.
6. Model počasí je single-point grid estimate, Meteostat může obsahovat model fill; jejich rozdíly nejsou validace požární nebezpečnosti.

### F. Limity auditního přístupu a zdrojové odkazy

**Production**: reálné MCP tool calls; nikoli napodobení lokálních funkcí. **Static**: soubory čtené na konkrétním commitu, nikoli předpoklad z dokumentace. **Neprovedeno**: lokální `npm test`, `uv run pytest`, hardware/browser rendering, interaktivní drawing v prohlížeči, skutečné stažení původních FIRMS a individuální ruční bodová validace AOI. CI Vercel status `success` potvrzuje deploy status, nikoli test coverage.

Primární kód:  
- `web/api/_lib/widget.ts` [source](https://github.com/MetrPikeska/burning-calendar/blob/d93826b54ef78f8596d6f9fa73a73d1406240f8d/web/api/_lib/widget.ts)  
- `web/api/_lib/tools.ts` [source](https://github.com/MetrPikeska/burning-calendar/blob/d93826b54ef78f8596d6f9fa73a73d1406240f8d/web/api/_lib/tools.ts)  
- `web/api/_lib/live/register.ts` [source](https://github.com/MetrPikeska/burning-calendar/blob/d93826b54ef78f8596d6f9fa73a73d1406240f8d/web/api/_lib/live/register.ts)  
- `web/src/aoi/geojson.ts` [source](https://github.com/MetrPikeska/burning-calendar/blob/d93826b54ef78f8596d6f9fa73a73d1406240f8d/web/src/aoi/geojson.ts)  
- `web/src/aoi/run.ts` [source](https://github.com/MetrPikeska/burning-calendar/blob/d93826b54ef78f8596d6f9fa73a73d1406240f8d/web/src/aoi/run.ts)  
- `web/test/aoi.test.ts` [source](https://github.com/MetrPikeska/burning-calendar/blob/d93826b54ef78f8596d6f9fa73a73d1406240f8d/web/test/aoi.test.ts).

<!-- SCIENTIFIC_REVIEW.md -->

## Burning Calendar — vědecká revize po opravách

**Auditní verze:** `d93826b` (14. 11. 2026). **Důkazní úrovně:** [MCP] = aktuální reálná odpověď serveru, [CODE] = čtený zdrojový kód, [CALC] = nezávisle přepočtená hodnota, [RISK] = vědecká slabina bez plné reprodukce na původních datech. Konstatuji pouze to, co skutečně podporují tyto důkazy. Tato revize **není** recenzovaný článek ani reprocessing surového archivu NASA FIRMS.

### 1. Otázka vědecké kontinuity

Projekt [CODE: `pipeline/harmonize.py`] modeluje očekávanou četnost VIIRS S-NPP 375m detekcí z MODIS Terra/Aqua ve starší době. Pro oblast a měsíc se provede aproximace

`VIIRS_hat(y,m) = sum_{day,night} MODIS(y,m,dn) * F(region,m,dn)`.

`F = sum(VIIRS) / sum(MODIS)` v overlap období 2012–2019, se fallback hierarchy `region_month_dn → region_season_dn → region_dn → national_dn`; pro Terra-only 2000-11 až 2002-06 další člen `G = (Terra+Aqua)/Terra` z 2003–2011. Před 2012-02 je `harm` model, od 2012-02 pozorovaná VIIRS S-NPP série (2026 část provisional). Hodnota **není** počet požárů, burnt area, severity, fire danger ani předpověď události.

**Silné stránky:** den/noc odděleně, seasonality, sensor overlap, low-count fallback, origin flag, LOYO validace, time-split, region fallback do relative a rozlišené provisional měsíce. Tyto volby řeší reálný fyzikálně-statistický problém satelitní pozorovatelnosti.

**Omezení:** poměrové mapování přes nulu znamená, že `MODIS=0 → VIIRS_hat=0`, i když skutečný VIIRS může zachytit slabý či malý hotspot; např. [MCP] `EL52 2024-05`: MODIS **0** proti VIIRS **13**. Vliv rozdílného pixel footprintu, scan angle, revisit frequency, přítomnosti oblačnosti, orbit drift, land-cover změn a statických filtrů není u historických individuálních detekcí garantovaně odstraněn pouhým poměrem.

### 2. Nezávislý cross-tool a statistický přepočet

#### 2.1 EL52 — rok 2024

[MCP] `get_region_series` vrací harmonizované měsíční počty:

| Měsíc | 01 | 02 | 03 | 04 | 05 | 06 | 07 | 08 | 09 | 10 | 11 | 12 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `harm`/VIIRS | 65 | 189 | 27 | 40 | 13 | 55 | 88 | 208 | 14 | 46 | 76 | 7 |
| `modis` | 17 | 65 | 6 | 5 | 0 | 16 | 23 | 25 | 5 | 24 | 19 | 0 |

[CALC] `sum(harm)=828`, `sum(modis)=205`. [MCP] `get_region_series.totals`, `show_calendar.totals`, `aggregate`, `compare_regions(year_total)` všechny hlásí **828**. Po přidání EL61 (**221**) je aggregate **1049**. `get_season_calendar(EL52,2024)` dává 868, protože sezonní rok = **2024-04 až 2025-03**. Nejde o chybu konzistence; jde o dvě odlišná časová okna.

#### 2.2 Baseline a percentily

[CALC] Pro srpen `EL52` máme měsíční `harm` za 2014–2023 `[21,12,19,19,17,23,12,30,8,69]`. Medián je **19,0**, percentil numpy-linear P90 = **33,9** (10 položek, interpolační pozice 8,1). [MCP] `get_anomalies(EL52,2024)` uvádí pro srpen `value=208`, `baseline_median=19`, `baseline_p90=33.9`, `anom_pct=100`, `anom=true`: **aritmetika odpovídá**.

[CALC] Pro Řecko v srpnu 2007 je baseline 2002–2011 **bez 2007**, hodnoty `[609.5,594.8,711.4,400.8,1120.3,1282.0,2697.5,781.2,1960.4]`; medián **781,2**, P90 **2107,82**; [MCP] uvádí **781,2** a **2107,8**. Pro samotný srpen `GR 2007`: raw MODIS **3137**, `harm=11943.1`, interval **8730.4–15382.7**, `src=backcast`.

**Význam:** překontroloval jsem **výpočet percentilů z publikovaných měsíčních hodnot**, nikoliv to, zda jsou původní FIRMS detekce kompletní. Neprokazuje to nezávisle fyzikální správnost kalibrace.

#### 2.3 LOYO a time-split přepočet

[CODE] `validate.py`: LOYO drží venku jeden rok z 2012–2019, v každém průchodu refituje F na zbylých sedmi letech; time-split fit 2012–2019 a test 2020–2025. [CALC] Medián absolutních hodnot ročních percent chyb vrácených `get_validation` odpovídá reportovaným MdAPE po zaokrouhlení:

| Region | LOYO MdAPE (% report/recalc) | Time-split MdAPE (% report/recalc) | Významný testovací rok |
|---|---:|---:|---|
| EL42 (Notio Aigaio) | 25,0 / 24,95 | 22,8 / 22,80 | **2025: −77,7 %** |
| EL54 (Ipeiros) | 24,2 / 24,20 | 31,9 / 31,90 | **2023: +80,4 %** |
| AR (Argentina) | 1,5 / 1,45 | 6,7 / 6,75 | 2022: −14,8 % |

Malé rozdíly jsou pouze přesnost zobrazených vstupních ročních odchylek (na 1 desetinné místo). `EL52`: LOYO **4 %**, time split **11,8 %**. `GR`: LOYO **5,4 %**, split **7,1 %**. Korelace GR LOYO **r=0,985** je vysoká, ale může odrážet sezónnost a společné trendy, nikoliv dobré kalibrované výstupy pro *každý* měsíc nebo slabé oblasti.

### 3. Nejsilnější vědecké výhrady

#### 3.1 Regiony s neobhajitelnou extrapolací [RISK, P0]

[CODE] `relative` se určuje nad **LOYO mediánem annual abs error >25 %** nebo zhoršením peak-month hit o více než jeden sezonní rok proti raw MODIS. Time-split není součástí výběrového pravidla. Proto zůstávají `EL42` a `EL54` harmonized navzdory ročním extrapolačním chybám kolem ±80 % ve vybraných letech. Při hodnocení podle práce s rizikem mohou soudci rozpor „validovaný region“ vs „extrémní budoucí chyba“ oprávněně napadnout.

**Doporučení:** přidat nezávislý stability criterion / `low_reliability` kategorii s explicitním **worst-year error** a split-error, místo automatického potlačení dat. Nevybírat finální hranici až podle těch samých testových let; zaznamenat pravidlo a výsledky sensitivity. Uvést per-region graf skutečnost vs model a baseline raw MODIS.

#### 3.2 Historická nejistota [RISK, P1]

[CODE] `validate.band`: 10. a 90. percentil LOYO poměru `observed/predicted`, pooling dle DJF/MAM/JJA/SON. Intervaly `harm_lo/hi` násobí predikci těmito faktory. To není samo o sobě kalibrovaný 80% predikční interval: poměr může být nestacionární, regionální rozdělení širší než sezonní pool, nulové predikce nejsou zahrnuty, korelace mezi měsíci mění agregovaný interval.

**Doporučení:** vyhodnotit empirical LOYO coverage (`lower <= obs <= upper`) po regionu a roce, stratifikovat nízké počty, analyzovat nonstationarity, uvést počet platných testů. Otevřeně nazývat rozsah „empirical error band“ místo „80% confidence interval“, pokud není kalibrován.

#### 3.3 Anomálie a leakage [RISK, P0/P1]

[CODE] `anomalies` bere stejný měsíc z předchozích 10 let, **před 2012** však fixně 2002–2011 (bez cílového roku). Proto hodnota „anomálie srpen 2007“ je **retrospektivní**, historická baseline obsahuje i budoucnost oproti roku 2007. Data poskytují správné `baseline_kind=fixed_2002_2011`. V roce 2024 už `2014–2023` žádnou temporal leakage tohoto druhu nemá.

Při low-count month může vzniknout formálně správná, ale operativně slabá anomálie: EL52 květen 2024 VIIRS **13**, P90 **12,1**, `anom=true`. Převést to bez dalších indikátorů na „extreme wildfires“ by bylo chybné. Anomálie nebere v úvahu interval modelu pro před-2012, charakter intenzity FRP, plošné rozšíření ani délku trvání jednotlivých ohnisek.

**Doporučení:** zavést `relative_anomaly` vs `operational_signal` a text „low absolute count“. Přepínač raw/VIIRS nesmí implicitně dědit `harm` anomaly flags (BC-001/002 opravily většinu, ale R2-001 zůstává v totals). Realtime přirovnání NOAA-20 k S-NPP nepovažovat za statisticky kalibrovaný z-score/percentile.

#### 3.4 Fit window, orbit drift a region-specific effects [RISK, P1]

2012–2019 předchází nejvýraznějším driftovým změnám MODIS po 2020/2021, což je obhajitelná volba, ne však absolutní záruka reprezentativity 2000–2011. Velké roční odchylky time split jsou důvodem pro sensitivity test více fit windows, trend per sensor/daynight a zejména distribuci v jednotlivých regionech. `fit_window_gap_pct` srovnává celkový backcast 2000–2011, ale může zakrýt lokálně/měsíčně velké rozdíly, které se ve součtu vyruší.

#### 3.5 Statické zdroje a geografické přiřazení [RISK, P1]

[CODE] `pipeline/filters.py` vyřazuje 0,01° senzor–rok buňky s ≥16 detekčními dny. Tím může odstranit i skutečné dlouhotrvající vegetační požáry; bez sensitivity není možné prohlásit filtr za bezchybné oddělení flares vs wildfire. [CODE] přiřazení polygonu používá `within` a nearest ≤5 km; pobřežní body se mohou přiřadit regionu i mimo jeho hranici. Použití přesných hraničních polygonů vs zjednodušené webové mapy se musí jasně odlišovat. Počty v národních a regionálních souborech mohou mít rozdíl kvůli unassigned detekcím (GR example 240 unassigned); nejde o implicitní double counting.

### 4. Nový AOI — zásadní metodologické omezení

[CODE] `web/src/aoi/run.ts` vyhledává kandidátní regiony podle překryvu bounding boxu AOI a **generalizovaných** `regions.geojson`; v Řecku stahuje filtrované individuální detekce z jejich regionálních CSV a klientsky provádí PIP / point-line buffer. Poté `computeAoi.ts` použije **regionální** koeficienty F/G každé detekce a přičte odpovídající predikce. Výsledek je označen jako „estimate“, což je korektní.

#### 4.1 Co je inovativní

- Vlastní polygon, multipolygon, bod + radius a koridor kolem linie; import GeoJSON, export detekcí, měsíční CSV a interaktivní kalendář.
- Client-side region-specific harmonization na filtrovaných hotspotech umožňuje reprodukovatelnost s NUTS2 soubory. V `web/test/aoi.test.ts` existují fixture assertions, že úplná AOI = EL52/EL64/EL62/EL30 rekonstruuje vydané regionální měsíce a že kombinace EL51+EL52 dává součet. **Zdroj testů jsem četl, ale test runner neproběhl v tomto auditu.**
- Argentina umí určit sousedící provincie, **ne** vytvořit kalendář individuálního AOI (individuální FIRMS body pro AR nejsou publikovány).

#### 4.2 Geoprostorová slabina: AOI GeoJSON není roundtrip [CODE+CALC, R2-002]

Definujeme `A = { polygons:[], points:[[23,39]], lines:[], radius_km:5 }`. [CODE] `areaKm2(A) = π*5² = 78,5398 km²`. `aoiToGeoJson` současně zapíše Point **i** jeho kruhovou polygonovou výplň. Parser pak načte oba typy jako dvě různá území; `areaKm2` je sečte. [CALC] 64bodový polygon dává ~**78,4137 km²**, nová plocha ~**156,9535 km²**. Druhý roundtrip přidá další polygon a plocha je ~**235,3672 km²**. Tento závěr je deterministická vlastnost funkcí; nevyžaduje přístup ke skrytým datům. Neprovedl jsem však klikací end-to-end test browseru.

Ještě vážnější je ztráta poloměru: parser ignoruje exportované `properties.radius_km`, používá radius ovládacího prvku při importu. Nové sezení s radius 5 km může rozšířit původní 2km AOI do 5km, takže **změní počet vybraných detekcí**, nikoli jen uváděnou plochu.

**Korektní návrh:** používat **kanonickou reprezentaci** pro výměnu dat (typ, geometrie, radius, WGS84) a **oddělenou odvozenou geometrii** pro rendering. Jeden fyzický objekt nesmí být v matematice zaznamenán jako dva. Pro libovolný polygon AOI (zejména velký, s holes a přesahy) plocha vyžaduje vhodné equal-area projekce / geodesickou plochu a union operace. Pro zjednodušenou verzi explicitně uvést aproximativnost a nezobrazovat plošné density bez oprav.

#### 4.3 Co ještě nebylo validováno

- Přesnost a completeness malých pobřežních AOI / drobných ostrovů při výběru regionů podle generalizovaných bbox.
- Hraniční detekce, holes a samoprotínající se polygony; GeoJSON parser kontroluje souřadnice a počet bodů, ale ne topologickou validitu.
- Rozdíl metodiky AOI (regionální faktory v subregionu) vs faktory kalibrované na stejné vlastní oblasti; cross-border / cross-region AOI se systémem relative.
- Výkon na mobilu při parsování větších CSV / 20k vertex AOI, případně paměťové limity.

### 5. Live data: původ a operativní limity

- **NASA FIRMS NOAA-20/NOAA-21/MODIS NRT**: nehomogenizované, jinak filtrované než historické S-NPP standard processing. Odpovědi mají čas, satelit, FRP, lat/lon, confidence a counts. `ratio_to_median_per_day` je explicitně „order of magnitude only“, nikoliv přesný detektor anomálií.
- **GDACS/Copernicus EMS**: agregované eventy/aktivace s jednotkami hektarů, odlišné od pixelové měsíční řady; absence výstupu neprokazuje absenci požáru. Konfliktní parametr country/region dnes není odmítnut (R2-003).
- **Open-Meteo**: reanalysis/analysis/forecast model grid, bodový kontext regionu. Není to pozorovaná stanice ani standardizovaný FWI. `hot-dry-windy` pravidlo není totéž jako předpověď požáru.
- **Meteostat**: denní stanice s `model_fields` pro nahrazená měření; `days_with_measurements` a `last_measured_date` je nutné uvádět. V auditním okně pro EL52 byla poslední měřená data ze dne 5.11. i když se vracely modelové dny poté.

Licence/atribuce jsou publikovány v MCP source block, avšak jejich tvrzení jsem nepřekontroloval s právními podmínkami každého upstream provozovatele.

### 6. Závěrečné doporučení NASA reviewerovi

Projekt je metodicky promyšlenější než prosté „spojení CSV“: nabízí explicitní referenční stupnici, backcast a validaci, transparentní omezení a nové AOI. Přesto **vědecky nejzranitelnější** zůstávají [1] regionální split outliers, [2] nekalibrovaná empirická rozpětí a [3] rozdíl mezi pozorovanou detekcí a skutečným požárem / požárním rizikem. Je třeba dát do prezentace několik **negativních** validačních případů a říci, v kterých oblastech je model slabý. Nevyvozovat obecnou spolehlivost celého Řecka z nízké MdAPE státu.

### Primární kód a dokumentace

- [`pipeline/harmonize.py`](https://github.com/MetrPikeska/burning-calendar/blob/d93826b54ef78f8596d6f9fa73a73d1406240f8d/pipeline/harmonize.py)
- [`pipeline/validate.py`](https://github.com/MetrPikeska/burning-calendar/blob/d93826b54ef78f8596d6f9fa73a73d1406240f8d/pipeline/validate.py)
- [`pipeline/calendar_metrics.py`](https://github.com/MetrPikeska/burning-calendar/blob/d93826b54ef78f8596d6f9fa73a73d1406240f8d/pipeline/calendar_metrics.py)
- [`pipeline/filters.py`](https://github.com/MetrPikeska/burning-calendar/blob/d93826b54ef78f8596d6f9fa73a73d1406240f8d/pipeline/filters.py)
- [`pipeline/regions.py`](https://github.com/MetrPikeska/burning-calendar/blob/d93826b54ef78f8596d6f9fa73a73d1406240f8d/pipeline/regions.py)
- [`web/src/aoi/compute.ts`](https://github.com/MetrPikeska/burning-calendar/blob/d93826b54ef78f8596d6f9fa73a73d1406240f8d/web/src/aoi/compute.ts)
- [`web/src/aoi/geojson.ts`](https://github.com/MetrPikeska/burning-calendar/blob/d93826b54ef78f8596d6f9fa73a73d1406240f8d/web/src/aoi/geojson.ts)
- [`web/test/aoi.test.ts`](https://github.com/MetrPikeska/burning-calendar/blob/d93826b54ef78f8596d6f9fa73a73d1406240f8d/web/test/aoi.test.ts)
- [NASA Space Apps Challenge 2026 — official page](https://www.spaceappschallenge.org/2026/challenges/modis-and-viirs-hot-spots/)

<!-- ROADMAP_TO_10.md -->

## Burning Calendar — prioritní roadmapa po druhém auditu

**Základ:** commit `d93826b` · 14. 11. 2026 · audit skóre **7,3/10**. Jedná se o **návod pro developery**, nikoli o provedené změny. Hodnotí se pravděpodobný dopad na vědeckou kvalitu a hackathonové posouzení. Všechny původní chyby BC-001–BC-005 prošly retestem. **Nepřidávejte další funkce, dokud nevyřešíte nová regresní rizika.**

### Hodnoticí rámec

- **S** = lokální oprava + 1–3 focused testy; **M** = zásah do více částí + test kontraktu/UX; **L** = výzkumná nebo datová změna vyžadující reprocessing/validaci. Nejde o časový příslib.
- **Dopad:** Critical / High / Medium / Low. **P0** = bezpečnost vědecké interpretace / hotový submission. **P1** = důvěryhodnost a stabilita. **P2** = polish mimo úzké jádro.

### P0 — doporučené před odevzdáním

| # | Úkol | Náročnost | Impact | Akceptační kritérium |
|---|---|---|---|---|
| **P0-01** | **Opravit AOI GeoJSON roundtrip (`R2-002`).** Rozdělit kanonický export geometrií od pomocných mapových `point-buffer`. Respektovat `radius_km` při importu a exportu, nezdvojovat plochu. | **M** | **High** | `parseGeoJson(aoiToGeoJson(a))` zachová `contains`, `area_km2` a radius pro Point/Line/Polygon/MultiPolygon; stejné vlastnosti po 2+ opakováních. Radius 2 km nesmí po novém načtení narůst na 5 km. |
| **P0-02** | **Dokončit anomaly-series oddělení v `show_calendar` (`R2-001`).** Nestačí měsíční flags: přefiltrovat také `totals[].anomaly_months`, `small_counts` a outage caveat podle výběru. | **S–M** | **High** | `show_calendar(EL52,2024,series=modis)` má `v(2024-05)=0`, bez `anom` v měsících a bez neoznačených `anomaly_months` kdekoli; caveats nehlásí VIIRS gap jako problém MODIS. `series=harm` zachová korektní 4 anomálie. |
| **P0-03** | **Ukázat problematické regionální time-split výsledky** (nejlépe 1 věta + krátký validační graf a metodický limit, bez přibarvování). | **S** | **High (věda)** | Notio Aigaio EL42 rok 2025 −77,7 %; Ipeiros EL54 rok 2023 +80,4 %. Status `harmonized` nesmí působit jako univerzální záruka. |
| **P0-04** | **Zajistit testy a jasný datový kontrakt před submission.** `npm test`, `npm run typecheck`, `npm run build`, `uv run pytest`; doplnit nové testy pro AOI roundtrip a MCP nested anomalies. | **M** | **High** | Skutečně zelené testy + ukázka výsledku, žádné unverifikované „100% test coverage“. Vercel success samotný nestačí. |
| **P0-05** | **V prezentaci přesně oddělit** „detections“, „modelled VIIRS-equivalent“, „observed VIIRS“, „unharmonized NRT“ a „fire danger“. | **S** | **High (důvěra)** | Žádný slide ani text nenazývá aktivní detekci jednotlivým požárem / spálenou plochou; každá historická 2000–2011 predikce má nápis backcast/uncertainty. |

#### P0 funkční regresní test suite

```text
R2-002 AOI roundtrip
  let a = {polygons:[], points:[[23,39]], lines:[], radius_km:5};
  let b = parseGeoJson(JSON.stringify(aoiToGeoJson(a)), 5);
  expect(areaKm2(b)).toBeCloseTo(areaKm2(a), 1);
  // dnešní logika dává zhruba 156.95 vs 78.54 km²
  // testovat také nové sezení: a.radius_km=2, import picker radius=5.

R2-001 MCP calendar semantics
  let r = show_calendar({region_id:'EL52',from:'2024-01',to:'2024-12',series:'modis'});
  expect(r.months.find(m=>m.ym==='2024-05').v).toBe(0);
  expect(r.months.find(m=>m.ym==='2024-05').anom).toBeUndefined();
  expect(r.totals.every(y=>!('anomaly_months' in y))).toBe(true);
  expect(r.unit).toMatch(/raw MODIS/i);
```

Výše uvedený kód je **návrh testu**, nikoliv potvrzení jeho spuštění. Před úpravou nevolat původní fixture bez kontroly, zda zachovává stejné `anomaly_months` pro `harm` a `relative`.

### P1 — vědecká a provozní robustnost

| # | Úkol | Náročnost | Dopad a proč |
|---|---|---|---|
| **P1-01** | **Time-split quality gate** pro všechny regiony, s `max_abs_error_pct`, `time_split_mdape_pct`, status `low_reliability`. Nezvolit hranici pouze podle testovaných extrémů. | **M** | Dává soudcům pravdivý obraz, proč region s LOYO 24 % může mít 80% chybu mimo trénink. |
| **P1-02** | **Empirické pokrytí backcast intervalů:** LOYO obs v `harm_lo/hi`, po regionu, sezoně a low-count strata. | **L** | Výrok o `harm_lo..harm_hi` získá měřenou spolehlivost, místo neověřené coverage. |
| **P1-03** | **AOI edge-case testy:** velký souvislý region, malé ostrovy/řecké pobřeží, otvory, MultiPolygon, přesah NUTS2, `relative`-harmonized mix, nulové detekce. Vybrat několik geometrií a kontrolovat vstupní jednotlivé hotspointy. | **M–L** | Ověření vědecké správnosti nového klíčového use-case, nikoliv jen algoritmická unit-test korektnost. |
| **P1-04** | **AOI plocha**: geodesic/equal-area polygon union, překryvy a holes. Zobrazené hodnoty nekombinovat s density bez přesného area. | **M** | Odstraňuje subjektivní chyby normalizace a orientace ve velikosti území. |
| **P1-05** | **R2-003**: konfliktní `get_fire_alerts(country,region_id)` zamítnout nebo vyjádřit explicitní warning. | **S** | Zamezí automatickému použití dat špatné země v AI agentovi. |
| **P1-06** | **Senzorová kontinuita po S-NPP:** NOAA-20 splice pouze s overlap kalibrací, rozdíly v day/night, confidence a quality flags, plus temporal stability test. | **L** | Klíčové pro dlouhodobou udržitelnost, ale vyhnout se rychlé nespolehlivé náhradě. |
| **P1-07** | **Sensitivity static-source filtru** (16 dní/rok v 0.01°), fine geolocation a MODIS vs VIIRS typové filtry. | **L** | Zmenší riziko vyhození skutečných dlouhotrvajících požárů a „false anomaly“ nízkých počtů. |
| **P1-08** | **Subregion validity** pro výběr AOI: empiricky ověřit, že region-specific F/G nepřestřelují v polygonu s jiným land cover a agrární praxí. | **L** | Zabrání zobecnění validace NUTS2 na každý malý polygon. |
| **P1-09** | **Kontrolované browser testy**: mobil, více přepnutí zemí/regionů během AOI loadu, upload 5MB/20k vertex a výpadek CSV, screenshoty desktop/mobil. | **M** | Jediný způsob, jak potvrdit skutečnou použitelnost mimo static code review. |

### P2 — přesnost UX a prezentace

| # | Úkol | Náročnost | Důvod |
|---|---|---|---|
| **P2-01** | `marksKey(showAnomalies)` místo stálé legendy (`R2-004`). | **S** | Eliminace zavádějícího vysvětlení, když se raw series neznačí. |
| **P2-02** | AOI URL state/shareable link; obnovit AOI po reloadu, nebo explicitně říct, že není persistováno. | **M** | Snazší sdílení vědeckého scénáře, opakované hodnocení. |
| **P2-03** | AOI export s sidecar metodikou (`source version`, `fit source regions`, `method_version`, `area reliability`, `CRS`). | **M** | Reprodukovatelnost po stažení, hlavně kvůli AI agentům. |
| **P2-04** | AR custom AOI detekce (streaming/tiles/server subset) až po řešení performance a licencí. | **L** | Rozšíření geografického záběru, ale nepředbíhá kritické opravy pro GR. |
| **P2-05** | U každé „anomaly“ uvést abs count, percentile, baseline sample size a caveat low-count. | **S** | Zamezí interpretaci `13 > 12.1` jako velkého požáru. |
| **P2-06** | Human task benchmark: bez nápovědy vybrat oblast kolem Thessaloniki, určit peak, zobrazit anomaly, stáhnout srovnatelné CSV. | **M** | Test reálné použitelnosti pro emergency managera a soudce. |

### Priority podle přínosu k NASA zadání

1. **P0-01 + P0-02:** opravují **významová zkreslení**; žádná nová funkce nemá vyšší hodnotu.
2. **P0-03 + P1-01:** zvyšují důvěru v ústřední výzkumnou tezi. Historická řada není univerzálně přesná, protože průměr na státě vypadá dobře.
3. **P1-03/04/08:** z vlastního AOI dělají vědecky důvěryhodnou funkci, nikoli jen efektní interakci.
4. **P0-05 + P1-09:** jasný příběh a reálný browser test jsou pro hackathonové posouzení užitečnější než další menu metrik.
5. **P1-06:** až po otestování oprávněnosti kalibrace; rychlá implementace neověřeného NOAA-20 switch by projektu mohla uškodit.

### Očekávání skóre (není predikce rozhodnutí NASA)

Po **opravách P0 a jejich skutečné verifikaci** by se interní skóre mohlo realisticky posunout přibližně k **7,7–8,0/10**. Za **9+/10** bych požadoval kromě funkčního AOI také důkazy o spolehlivosti na úrovni malých regionů, interval coverage, transparentní invalidation limits a ověřenou interaktivní použitelnost. Skóre **10/10 nelze odůvodnit jen přidáním funkcí**.

### Předání Claude Code — bezpečná pravidla

Pracovat jen v nové implementační session, tento audit byl read-only. Každý fix uvést jako separátní commit a doložit **red→green test**, příslušnou reprodukci a případné změny datového kontraktu. Nenahrazovat `P0-03` kosmetickým disclaimerem: zobrazit skutečné chyby. Nezaměňovat `MCP PASS` s vědeckým důkazem. Po každém deployi zopakovat produkční smoke test, zejména nested `show_calendar`, roundtrip AOI a invalid parametry.

**Reprodukovatelné podklady:** `EXECUTIVE_REVIEW.md`, `MCP_TEST_REPORT.md`, `SCIENTIFIC_REVIEW.md` v této složce; [aktuální commit](https://github.com/MetrPikeska/burning-calendar/commit/d93826b54ef78f8596d6f9fa73a73d1406240f8d).
