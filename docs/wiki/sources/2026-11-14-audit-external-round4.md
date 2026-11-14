---
title: External audit round 4 of commit 3dbb123 (Czech, 4 reports)
updated: 2026-11-14
verified_by: not checked claim by claim; read on 14 Nov 2026 next to round 3, which covers the same code with sharper findings
sources: [burning_calendar_audit_2026-11-14.zip (left in the main checkout root)]
---

Verbatim copy of the four Markdown reports found as untracked files in the main checkout root on 14 Nov 2026 (repository at 3dbb123, production at 0a3dcea, production MCP, AOI module). Written by a different auditor than round 3, in a more favourable tone; scores are the auditor's own.


<!-- EXECUTIVE_REVIEW.md -->

# NEZÁVISLÝ EXPERTNÍ AUDIT — BURNING CALENDAR
**NASA Space Apps Challenge 2026: Harmonization of MODIS and VIIRS Hot Spots**  
**Role:** Nezávislý technický a vědecký auditor / Seniorní expert na Earth Observation (NASA FIRMS, MODIS, VIIRS)  
**Datum auditu:** 14. listopadu 2026  
**Cílový systém:** [burning-calendar.vercel.app](https://burning-calendar.vercel.app/) / Repozitář: `MetrPikeska/burning-calendar`  
**Auditovaný rozsah:** Repozitář (commit `3dbb123`), produkční nasazení Vercel (commit `0a3dcea`), aktivní produkční MCP server (16 nástrojů), webová aplikace, harmonizační metodika a nový AOI modul.

---

## 1. Manažerské shrnutí (Executive Summary)

Projekt **Burning Calendar** představuje výjimečně propracovanou, vědecky podloženou a technicky excelentní reakci na výzvu *NASA Space Apps Challenge 2026 — Harmonization of MODIS and VIIRS Hot Spots*. Cílem projektu je vytvořit harmonizovaný 26letý kalendář požární aktivity (listopad 2000 až říjen 2026) sjednocením dat ze senzorů MODIS (satelity Terra a Aqua, rozlišení 1 km) a VIIRS (satelit Suomi-NPP, rozlišení 375 m) pro Řecko (13 regionů NUTS2 a národní celek) a Argentinu (24 provincií a národní celek).

Jako přísný a nezávislý porotce jsem podrobil celý systém komplexnímu red-team testování:
1. **MCP Server:** Všech 16 nástrojů produkčního MCP serveru bylo otestováno v 37 automatizovaných scénářích (standardní volání, mezní hodnoty, neplatné argumenty, obrácené intervaly, live vstupy třetích stran). Server prokázal stoprocentní odolnost vůči chybovým stavům a dříve identifikované zranitelnosti (BC-001 až BC-005 a R2-001 až R2-004) byly v produkci spolehlivě sanovány.
2. **Konzistence napříč nástroji:** V pozorovaném období (2012–2026) je bilance mezi měsíčními záznamy, ročními součty, widgety, porovnáváním a agregacemi naprosto exaktní. V relativním režimu nedochází k neoprávněnému míchání škál.
3. **Nový AOI (Area of Interest) modul:** Umožňuje uživateli kreslit na mapě polygony, body i linie s nastavitelným poloměrem bufferu nebo nahrávat GeoJSON a v reálném čase počítá požární kalendář přímo z bodových detekcí NASA FIRMS. Round-trip import/export byl úspěšně opraven a funguje korektně.
4. **Kritická zjištění:**
   - **Nesoulad produkčního nasazení (Deployment Divergence):** Lokální commit `3dbb123` (zavádějící příznak `quality: "limited"` pro harmonizované regiony se slabým testovacím rokem) nebyl pushnut na `origin/main`. Produkční Vercel deployment běží na commitu `0a3dcea` a uživatelům MCP i webu tyto limity nezobrazuje.
   - **Prostorová neaditivita (Spatial Aggregation Discrepancy):** Kvůli nelineárnímu poměrovému modelování na úrovni region × měsíc × den/noc se součet 12 harmonizovaných řeckých NUTS2 regionů v roce 2007 (backcast) neshoduje s národním modelem GR o **-9,56 %** ročně a v srpnu 2007 dokonce o **-18,66 %** (chybí přes 2 200 detekcí).
   - **Regiony na hraně validace:** Regiony `EL42` (Notio Aigaio) a `EL54` (Ipeiros) vykazují v časovém testu (2020–2025) extrémní roční odchylky (-77,7 % a +80,4 %), přesto zůstávají zařazeny v režimu `harmonized`.
   - **AOI mikroskopické měřítko a plocha:** Použití NUTS2 konverzních faktorů na libovolný mikro-polygon je aproximací bez mikroskopické validace (což autoři v UI poctivě uvádějí). Plocha AOI se počítá rovinnou aproximací Shoelace a při překryvu více nakreslených prvků dochází ke zdvojení plochy (diluce vypočtené hustoty).

---

## 2. Hodnocení podle oficiálních kritérií NASA Space Apps Challenge

| Kritérium | Váha | Skóre (0–10) | Vážený příspěvek | Klíčové odůvodnění |
| :--- | :---: | :---: | :---: | :--- |
| **1. Vědecká přesnost a validace** | 30 % | **8.8 / 10** | 2.64 | Důsledná metodika kalibrace (2012–2019) a hold-out testování (2020–2025), LOYO cross-validace, explicitní empirická pásma chyb (`harm_lo` / `harm_hi`). Srážka za ignorování časového testu při klasifikaci režimu (EL42, EL54) a prostorovou neaditivitu v agregaci. |
| **2. Soulad se zadáním challenge** | 25 % | **9.6 / 10** | 2.40 | Bezezbytku řeší všechny body výzvy #15: harmonizace MODIS C6.1 a VIIRS S-NPP 375 m, 26letá řada, řešení přechodu Terra $\to$ Aqua $\to$ VIIRS, bimodalita požárních sezón, anomálie vůči 10letému plovoucímu normálu. |
| **3. Technické provedení a architektura**| 20 % | **9.5 / 10** | 1.90 | Extrémně čistá architektura bez těžkého backendu. Bleskový statický hosting na CDN, přísné TypeScript a Python typování, 355+ automatizovaných testů (pytest + vitest). Kompletní 16nástrojový MCP server s JSON-RPC a SSE. Srážka za nepushnutý commit `3dbb123`. |
| **4. Inovativnost a přidaná hodnota** | 15 % | **9.7 / 10** | 1.46 | MCP server umožňující AI asistentům samostatně bádat nad satelitními daty; klient-side AOI modul počítající požární kalendář z milionu bodových detekcí přímo v prohlížeči; integrace Open-Meteo ERA5 reanalýz a live NASA FIRMS NRT. |
| **5. UX, přístupnost a prezentace** | 10 % | **9.2 / 10** | 0.92 | Skvěle navržená vizualizace (heat strips via Observable Plot, interaktivní MapLibre GL mapa), vysoká přístupnost (ARIA role, keyboard navigation, skip links, contrast). Drobná omezení v mobilním layoutu při otevření pokročilých filtrů. |
| **CELKOVÉ VÁŽENÉ SKÓRE** | **100 %** | **9.32 / 10** | **9.32 / 10** | **GLOBAL FINALIST / GLOBAL WINNER CONTENDER** |

---

## 3. Klíčové silné stránky projektu (Highlights)

1. **Vědecká integrita a odmítnutí "black-box" iluzí:**  
   Projekt se nepokouší maskovat selhání harmonizace. Pokud region neprojde přísnou validací (např. řecký ostrovní region `EL62` Ionia Nisia nebo 13 provincií Argentiny s nízkým počtem požárů), model nesnaží extrapolovat falešná data, ale transparentně přepne do režimu `relative` (zobrazuje surový MODIS a zřetelně to uvádí).
2. **Připravenost pro éru AI agentů (First-class MCP Integration):**  
   Burning Calendar neposkytuje pouze dashboard pro lidi, ale kompletní Model Context Protocol (MCP) server s 16 specializovanými nástroji. Každý nástroj vrací strukturovaná metadata, přesné fyzikální a satelitní jednotky, vysvětlení metodiky a rigorózní caveats (upozornění na satelitní výpadky, malé počty detekcí, odhadovaný původ dat).
3. **Plně reprodukovatelná a otevřená pipeline:**  
   Všechny kroky zpracování (stahování FIRMS, prostorový ořez, filtrace statických zdrojů z WDO, denní/noční dělení, výpočet faktorů, LOYO validace a generování JSON/CSV) jsou plně automatizovány v Pythonu a verzovány. Celá databáze je dostupná ke stažení po jednotlivých regionech i časových řezech.
4. **Klient-side výpočet vlastních území (AOI Engine):**  
   Přenesení kompletního harmonizačního a analytického algoritmu do čistého TypeScriptu v prohlížeči (`web/src/aoi/compute.ts`) umožňuje uživatelům analyzovat libovolný vlastní polygon nebo okolí infrastruktury z bodových detekcí bez nutnosti zatěžovat server.

---

## 4. Závažná zjištění a slabiny (Red-Team Findings)

### RT-01: Divergence mezi lokálním vývojem a produkčním nasazením (P0)
- **Stav:** `CONFIRMED`
- **Popis:** V lokálním repozitáři byl vytvořen commit `3dbb123` (*"Add a quality note to harmonized regions with weak held-out years"*), který zavádí varování `quality: "limited"` pro regiony se slabou predikcí v letech 2020–2025 (`EL42`, `EL54`, Argentina `10`, `26`, `58`, `78`). Tento commit však nebyl pushnut do vzdáleného repozitáře `origin/main`.
- **Dopad:** Produkční nasazení na Vercelu (běžící na commitu `0a3dcea`) i živé produkční MCP API stále prezentují např. Notio Aigaio (`EL42`) jako stoprocentně spolehlivě harmonizované bez jakéhokoliv varování před chybou -77,7 %.

### RT-02: Prostorová neaditivita harmonizovaných řad v minulosti (P1)
- **Stav:** `CONFIRMED` / `SCIENTIFIC LIMITATION`
- **Popis:** Kalibrační faktory jsou odhadovány nezávisle pro každý region $r$ i pro celou zemi GR:
  $$K_{r, m, dn} = \frac{\sum \text{VIIRS}_{r, m, dn}}{\sum \text{MODIS}_{r, m, dn}}$$
  V důsledku Jensenovy nerovnosti a prostorově proměnlivého poměru denních a nočních detekcí neplatí aditivita:
  $$\sum_{r} \text{Harm}_{r, m, y} \neq \text{Harm}_{\text{GR}, m, y}$$
  V extrémním požárním roce 2007 činí národní odhad pro Řecko $22\,765.9$ detekcí, zatímco součet 12 harmonizovaných regionů dává pouze $20\,588.5$ detekcí (deficit $2\,177$ detekcí, tj. **-9,56 %**). V kritickém měsíci srpnu 2007 je deficit dokonce **-18,66 %** ($9\,714.8$ vs $11\,943.1$).
- **Dopad:** Nástroj `aggregate` ani webové rozhraní na tento rozdíl neupozorňují, což může vést uživatele k mylným závěrům při sčítání dílčích území.

### RT-03: Ponechání regionů s fatální chybou v časovém testu v režimu `harmonized` (P1)
- **Stav:** `CONFIRMED` / `SCIENTIFIC LIMITATION`
- **Popis:** Pravidlo pro zařazení do režimu `harmonized` v `pipeline/validate.py` testuje pouze LOYO MdAPE ($\le 25 \%$) a posun vrcholu sezóny ($\ge -1$). Zcela však ignoruje výsledek časového rozdělení (*time-split* 2020–2025). Region `EL42` sice prošel LOYO s chybou 25,0 %, ale v roce 2025 selhal s chybou **-77,7 %**. Region `EL54` prošel LOYO s 24,2 %, ale v roce 2023 selhal s chybou **+80,4 %** (a časovým MdAPE 31,9 %).
- **Dopad:** Model se v těchto regionech chová v novějších letech nestabilně a prokazuje selhání předpokladu stacionarity detekčního poměru.

### RT-04: Geometrické zkreslení a riziko zdvojení plochy v AOI (P2)
- **Stav:** `CONFIRMED`
- **Popis:** 
  1. Výpočet plochy `areaKm2` v `web/src/aoi/geojson.ts` používá plochou aproximaci Shoelace vzorce s korekcí na průměrnou zeměpisnou šířku (`kx = 111.32 * cos(lat)`). U velkých polygonů dochází k odchylkám vůči rovnoploché projekci EPSG:6933, kterou používá zbytek pipeline.
  2. Při nakreslení nebo importu více vzájemně se překrývajících prvků (např. dva polygony s 50% průnikem) funkce `areaKm2` jednoduše sečte plochy obou prvků (průnik započte dvakrát), zatímco prostorový test `contains` vyhodnotí body správně pouze jednou. Vypočtená hustota požárů na jednotku plochy je pak uměle podhodnocena.

---

## 5. Závěrečný verdikt porotce

Burning Calendar je **mimořádný projekt**, který výrazně převyšuje běžný standard hackathonových výstupů. Nejde o pouhý prototyp, ale o funkční vědecko-technickou platformu s reálným přínosem pro výzkum klimatu, operační řízení požární ochrany i moderní AI systémy. 

Předložené nedostatky nejsou fatálními vadami architektury, nýbrž přirozenými vědeckými a provozními hranicemi, které vyžadují:
1. Okamžité nasazení zadrženého commitu `3dbb123` do produkce.
2. Doplnění transparentních caveats o prostorové neaditivitě.
3. Zpřísnění klasifikačního prahu pro harmonizaci na základě časového testu.

Projekt hodnotím celkovou známkou **9.32 / 10** a jednoznačně jej doporučuji k postupu mezi globální finalisty NASA Space Apps Challenge 2026.

<!-- MCP_TEST_REPORT.md -->

# PROTOKOL O TESTOVÁNÍ MCP SERVERU — BURNING CALENDAR
**Projekt:** Burning Calendar (NASA Space Apps Challenge 2026)  
**Rozhraní:** Model Context Protocol (MCP) Server  
**Endpoint:** `https://burning-calendar.vercel.app/api/mcp`  
**Protokol:** JSON-RPC 2.0 přes HTTP POST s podporou Server-Sent Events (`Accept: application/json, text/event-stream`)  
**Datum testování:** 14. listopadu 2026  
**Počet objevených nástrojů:** 16  
**Počet provedených testovacích případů:** 37  
**Výsledek:** 36 úspěšných, 1 funkční (re-klasifikována cesta k polím), 0 pádů serveru (100% dostupnost).

---

## 1. Katalog a latence nástrojů (Production Tool Inventory)

Všechny nástroje byly objeveny přímo přes metodu `tools/list` na živém produkčním endpointu. Níže je uveden jejich kompletní seznam s průměrnou naměřenou latencí:

| Nástroj | Účel nástroje | Hlavní argumenty | Naměřená latence | Stav produkce |
| :--- | :--- | :--- | :---: | :---: |
| `search_regions` | Vyhledávání a filtrování regionů dle země, úrovně a textu | `country`, `level`, `query`, `limit` | 215 ms | Plně funkční |
| `get_region_series` | Měsíční (max 120) nebo roční řady detekcí s příznaky původu | `region_id`, `from`, `to`, `aggregate`, `fields` | 240 ms | Plně funkční |
| `get_season_calendar` | Klimatologické parametry sezóny, nástup, vrchol, délka, ročníky | `region_id`, `year` | 198 ms | Plně funkční |
| `get_anomalies` | Měsíční anomálie vůči 10letému plovoucímu normálu (p90) | `region_id`, `year` | 185 ms | Plně funkční |
| `compare_regions` | Porovnání 2–10 regionů v dané metrice s kontrolou srovnatelnosti | `region_ids`, `metric`, `year` | 210 ms | Plně funkční |
| `aggregate` | Součet detekcí za období pro 1–40 regionů | `region_ids`, `from`, `to`, `top` | 230 ms | Plně funkční |
| `rank_regions` | Seřazení regionů podle metriky s vyloučením nesrovnatelných | `metric`, `country`, `level`, `year`, `order`, `top`| 225 ms | Plně funkční |
| `find_region_at` | Bodové vyhledání regionu s 5km pobřežním bufferem | `lat`, `lon` | 190 ms | Plně funkční |
| `get_validation` | Statistická validace (LOYO a časový split 2020–2025) | `region_id` | 180 ms | Plně funkční |
| `get_methodology` | Vědecká a technická dokumentace projektu | `topic` | 170 ms | Plně funkční |
| `show_calendar` | Generování interaktivního widgetu pro chat klienta | `region_id`, `from`, `to`, `series` | 205 ms | Plně funkční |
| `get_fire_alerts` | LIVE: Aktivní výstrahy GDACS (kombinace MODIS/VIIRS) | `country`, `region_id`, `days` | 310 ms | Plně funkční |
| `get_fire_weather` | LIVE: Denní meteorologická data a indexy požárního počasí (ERA5) | `region_id`, `lat`, `lon`, `from`, `to` | 540 ms | Plně funkční |
| `get_weather_stations`| LIVE: Vyhledání nejbližších meteorologických stanic | `region_id`, `lat`, `lon`, `from`, `to` | 490 ms | Plně funkční |
| `get_recent_detections`| LIVE: Poslední NRT detekce NASA FIRMS (poslední 1–7 dní) | `region_id`, `lat`, `lon`, `days` | 620 ms | Plně funkční |
| `investigate_month` | Komplexní forenzní analýza anomálního měsíce (historie + počasí) | `region_id`, `ym`, `lat`, `lon` | 722 ms | Plně funkční |

---

## 2. Matice testů odolnosti a mezních hodnot (Red-Team Test Matrix)

### 2.1 Testování vstupních parametrů a chybových stavů
Každý nástroj byl otestován proti nesprávným typům, obráceným rozsahům, neexistujícím identifikátorům a protichůdným parametrům:

1. **`search_regions` (limit = 0):**
   - *Vstup:* `{"limit": 0}`
   - *Výsledek:* Zamítnuto Zod schématem (`limit must be >= 1`). Vrácen korektní chybový JSON-RPC kód.
2. **`search_regions` (neplatná země):**
   - *Vstup:* `{"country": "ZZ"}`
   - *Výsledek:* Zamítnuto (`expected 'GR' | 'AR'`).
3. **`get_region_series` (obrácený časový interval):**
   - *Vstup:* `{"region_id": "EL52", "from": "2024-12", "to": "2024-01"}`
   - *Výsledek:* Systém interně prohodil meze na `2024-01` až `2024-12` a vrátil korektní chronologická data bez pádu.
4. **`get_region_series` (překročení limitu 120 měsíců):**
   - *Vstup:* `{"region_id": "EL52", "from": "2001-01", "to": "2025-12"}` (300 měsíců)
   - *Výsledek:* Odmítnuto s informací o překročení limitu 120 měsíců a doporučením použít `aggregate: "year"` nebo číst CSV.
5. **`get_region_series` (neexistující region):**
   - *Vstup:* `{"region_id": "EL99"}`
   - *Výsledek:* Korektní chyba `isError: true` s hlášením `Region EL99 not found`.
6. **`compare_regions` (chybějící rok pro roční metriku):**
   - *Vstup:* `{"region_ids": ["EL52", "EL61"], "metric": "year_total"}`
   - *Výsledek:* Odmítnuto s požadavkem na zadání parametru `year`.
7. **`aggregate` (míchání celého státu s jeho subregionem):**
   - *Vstup:* `{"region_ids": ["GR", "EL52"], "from": "2024-01", "to": "2024-12"}`
   - *Výsledek:* Odmítnuto s vysvětlením, že nelze sčítat nadřazený celek se subregionem (prevence double-countingu).
8. **`find_region_at` (otevřený oceán):**
   - *Vstup:* `{"lat": 0.0, "lon": 0.0}`
   - *Výsledek:* `{"found": false, "nearest": null}`.

---

## 3. Ověření dříve reportovaných zranitelností a oprav

Během testování byla provedena přímá re-validace všech dříve identifikovaných chyb z interních i externích auditů:

### Re-test R2-001 (`show_calendar` se `series: "modis"` nepřenáší cizí anomálie)
- **Scénář:** Zavolán `show_calendar` pro `EL52` s parametrem `series: "modis"`.
- **Dřívější chyba:** V poli `totals` zůstávalo pole `anomaly_months` počítané z harmonizované řady, přestože uživatel zobrazil surový MODIS.
- **Ověřený stav na produkci:** **OPRAVENO (CONFIRMED FIXED).** Pole `totals[0].anomaly_months` je `undefined` a v odpovědi je explicitní příznak `anomaly_months_omitted: "anomaly flags refer to the harm series, not to the modis values shown; call show_calendar without series or get_anomalies"`.

### Re-test R2-003 (`get_fire_alerts` s konfliktními argumenty)
- **Scénář:** Zavolán `get_fire_alerts` s `country: "AR"` a `region_id: "EL52"`.
- **Dřívější chyba:** Nástroj nekontroloval příslušnost regionu k zemi a vracel prázdný výsledek nebo selhával.
- **Ověřený stav na produkci:** **OPRAVENO (CONFIRMED FIXED).** Nástroj vrátil `isError: true` s jasným vysvětlením, že `EL52` nepatří do Argentiny.

### Re-test BC-005 (`get_fire_weather` s neplatným kalendářním datem)
- **Scénář:** Zavolán `get_fire_weather` pro `EL52` s datem `from: "2026-02-30"`.
- **Dřívější chyba:** Skript nevalidoval reálnou existenci dnů v měsíci a způsobil pád na volání Open-Meteo API.
- **Ověřený stav na produkci:** **OPRAVENO (CONFIRMED FIXED).** Zod parser okamžitě zachytil neplatné ISO datum a vrátil chybovou odpověď bez kontaktování externího API.

---

## 4. Testy konzistence mezi nástroji (Cross-Tool Consistency)

Následující testy ověřovaly, zda různé nástroje poskytují matematicky i sémanticky identické hodnoty při dotazech na stejná data:

### 4.1 Měsíční součet vs. roční hodnota (EL52 v roce 2024 — harmonizovaný režim)
- `get_region_series` (součet 12 měsíčních hodnot `harm`): **828**
- `get_region_series` (`totals[0].total`): **828**
- `show_calendar` (`totals[0].harm`): **828**
- `aggregate` (`total` pro EL52): **828**
- `compare_regions` (`metric: "year_total"`, rok 2024): **828**
- **Verdikt:** **100% shoda (PASS)**.

### 4.2 Měsíční součet vs. roční hodnota (EL62 v roce 2024 — relativní režim)
- `get_region_series` (součet 12 měsíčních hodnot `modis`): **4**
- `get_region_series` (`totals[0].total`): **4**
- `show_calendar` (`totals[0].modis`): **4**
- `aggregate` (`total` pro EL62): **4**
- `compare_regions` (`metric: "year_total"`, rok 2024): **4**
- **Verdikt:** **100% shoda (PASS)**. Žádný nástroj se nepokusil aproximovat VIIRS.

### 4.3 Míchání harmonizovaných a relativních regionů v `aggregate` a `compare_regions`
- **Volání `aggregate` pro `EL52` (harmonizovaný) a `EL62` (relativní):**
  Systém automaticky detekoval nekompatibilitu škál, přepnul celou agregaci na `series: "modis"` a vrátil součet surových detekcí MODIS (205 + 4 = 209).
- **Volání `compare_regions` pro `EL52` a `EL62` v metrice `density_per_1000km2`:**
  Systém vrátil `ranking_allowed: false`, jednotlivým regionům přiřadil jejich nativní metriky a přidal caveat, že porovnání hustoty mezi harmonizovaným a relativním regionem je zakázáno.
- **Verdikt:** **Příkladná vědecká obezřetnost (PASS)**.

### 4.4 Regionální součty NUTS2 vs. Národní celek GR (Kritické zjištění)
1. **Pozorované období (rok 2024):**
   - Součet 12 harmonizovaných NUTS2 regionů (`harm`): $4\,000$
   - Surový počet VIIRS detekcí pro relativní region `EL62`: $19$
   - Součet $4\,000 + 19 = 4\,019$
   - Národní řada `GR` v roce 2024 (`harm`): **4 019**
   - **Shoda v pozorovaném období:** **Exaktní (0,00 % odchylka)**.
2. **Modelované období v minulosti (Extrémní rok 2007 — Backcast):**
   - Národní odhad `GR` za rok 2007: **22 765.9** detekcí
   - Součet 12 harmonizovaných NUTS2 regionů v roce 2007: **20 588.5** detekcí
   - **Roční rozdíl:** **-2 177.4 detekcí (-9.56 %)**
   - V kritickém měsíci **srpen 2007 (vrchol požárů)**:
     - Národní model `GR`: **11 943.1** detekcí
     - Součet 12 harmonizovaných NUTS2 regionů: **9 714.8** detekcí
     - **Měsíční rozdíl:** **-2 228.3 detekcí (-18.66 %)**
- **Verdikt:** **CONFIRMED SCIENTIFIC LIMITATION**. Model pro celou zemi GR používá národní poměry VIIRS/MODIS, zatímco regiony používají lokální poměry. Nástroj `aggregate` ani `get_region_series` v současné produkční verzi uživatele na tuto prostorovou neaditivitu neupozorňují.

---

## 5. Analýza metadat, jednotek a varovných zpráv (Caveats)

Produkční MCP server důsledně připojuje ke všem výstupům pole `caveats` s unikátními kódy:
- `detections_not_fires`: Připomíná základní zásadu EO, že satelitní hotspoty nejsou počtem požárů ani spálenou plochou.
- `backcast` / `backcast_terra`: Označuje odhadované měsíce před únorem 2012 a zvýšenou nejistotu v éře pouze se satelitem Terra (2000–2002).
- `small_counts`: Zabraňuje falešné interpretaci statistických anomálií u měsíců s méně než 20 detekcemi (např. květen 2024 v EL52 s 13 detekcemi).
- `outage` / `outage_viirs`: Informuje o výpadcích satelitů Aqua (srpen–září 2020) a S-NPP (červen–červenec 2024, březen/duben/červenec 2026).
- `coverage`: Informuje o provizorní povaze NRT dat po srpnu 2026 a ukončení mise S-NPP dne 2. listopadu 2026.

### Zjištění k nasazení: Absence `validation_limits` v produkci
V commitu `3dbb123` byl v lokálním kódu implementován nový caveat `validation_limits`, který má varovat před extrémními chybami v testovacích letech (např. u `EL42` a `EL54`). Protože tento commit nebyl pushnut na produkční Vercel, živý server `https://burning-calendar.vercel.app/api/mcp` tento caveat **neobsahuje**.

<!-- SCIENTIFIC_REVIEW.md -->

# VĚDECKÝ A METODICKÝ AUDIT HARMONIZACE — BURNING CALENDAR
**Téma:** Harmonizace satelitních detekcí aktivních požárů MODIS (Terra/Aqua) a VIIRS (S-NPP)  
**Časové období:** 2000-11 až 2026-10 (26 let)  
**Auditor:** Nezávislý expert na Earth Observation a satelitní detekci požárů (NASA FIRMS)  
**Datum auditu:** 14. listopadu 2026  

---

## 1. Dekonstrukce a audit harmonizačního modelu

### 1.1 Fyzikální a orbitální rozdíly senzorů
Harmonizace mezi MODIS a VIIRS je jednou z nejnáročnějších úloh v družicovém dálkovém průzkumu požárů. Příčinou jsou fundamentální odlišnosti obou systémů:
1. **Prostorové rozlišení v nadiru:** MODIS (kanály 4 $\mu$m a 11 $\mu$m) má rozlišení $1\,000\text{ m}$. VIIRS I-band (I4 na 3,74 $\mu$m a I5 na 11,5 $\mu$m) má rozlišení $375\text{ m}$. Poměr plochy jednoho pixelu v nadiru je $(1000/375)^2 \approx 7.1$.
2. **Deformace na okraji pásu (Bow-tie effect):** MODIS nepoužívá agregaci pixelů na okraji skenovacího pásu; velikost pixelu MODIS na okraji narůstá až na $4.8\text{ km} \times 2.0\text{ km}$ (téměř $10\times$ větší plocha než v nadiru). VIIRS disponuje unikátním algoritmem agregace vzorků (3:1 v nadiru, 2:1 uprostřed, 1:1 na okraji pásu), díky čemuž rozměr pixelu VIIRS 375 m nepřekročí $800\text{ m} \times 800\text{ m}$ ani na samém okraji pásu. VIIRS tak zachovává schopnost detekovat malé požáry napříč celým záběrem.
3. **Orbitální přelety:**
   - **Terra:** dopolední sestupný / večerní vzestupný uzel (cca 10:30 a 22:30 místního slunečního času).
   - **Aqua:** odpolední vzestupný / noční sestupný uzel (cca 13:30 a 01:30).
   - **Suomi-NPP:** odpolední vzestupný / noční sestupný uzel (cca 13:30 a 01:30), tedy v těsném tandemu s družicí Aqua.

### 1.2 Matematická konstrukce konverzních faktorů
Projekt implementuje multiplikativní harmonizační model rozdělený podle tří dimenzí: **region ($r$), kalendářní měsíc ($m \in 1..12$) a denní/noční přelet ($dn \in \{\text{D}, \text{N}\}$)**.

Kalibrační období je stanoveno na plné překryvné roky **2012-02 až 2019-12**. Konverzní faktor je definován jako poměrový estimátor celkového počtu detekcí:
$$K_{r, m, dn} = \frac{\sum_{y=2012}^{2019} \text{VIIRS}_{r, m, y, dn}}{\sum_{y=2012}^{2019} \text{MODIS}_{r, m, y, dn}}$$

Pro období před únorem 2012 (éra Terra + Aqua) se harmonizovaný počet detekcí počítá jako:
$$\widehat{\text{VIIRS}}_{r, m, y} = \sum_{dn \in \{\text{D}, \text{N}\}} K_{r, m, dn} \cdot \text{MODIS}_{r, m, y, dn}$$

Pro nejstarší období (2000-11 až 2002-06), kdy byla na orbitě pouze družice Terra, projekt používá dvoustupňové řetězení faktorů (*chained factors*):
$$K^{\text{Terra}}_{r, m, dn} = \frac{\sum \text{MODIS (Terra+Aqua)}}{\sum \text{MODIS (Terra)}}$$
$$\widehat{\text{VIIRS}}_{r, m, y} = \sum_{dn} K_{r, m, dn} \cdot K^{\text{Terra}}_{r, m, dn} \cdot \text{Terra}_{r, m, y, dn}$$

---

## 2. Kritická vědecká omezení modelu

### 2.1 Problém nulového absolutního členu (Zero-Intercept / Zero-Inflation Problem)
Model je striktně lineární bez absolutního členu ($\text{VIIRS} = K \cdot \text{MODIS}$). 
- **Důsledek:** Pokud MODIS v daném měsíci zaznamená $0$ detekcí, modelovaná hodnota VIIRS je **vždy striktně 0**.
- **Fyzikální realita:** VIIRS 375 m má detekční limit požárního zářivého výkonu (FRP) přibližně $0.5–1.0\text{ MW}$, zatímco MODIS 1 km má detekční limit okolo $8–10\text{ MW}$. V sušších měsících s rozptýleným zemědělským pálením nebo drobnými lesními požáry VIIRS běžně zaznamenává 10 až 50 detekcí, zatímco MODIS nezaznamená vůbec nic. Tyto drobné požáry jsou v historické řadě 2000–2012 zcela vymazány.

### 2.2 Prostorová neaditivita (Spatial Non-Additivity)
Z důvodu nezávislého výpočtu faktorů pro národní úroveň ($GR$) a dílčí kraje ($NUTS2$) dochází k závažné neaditivitě v modelovaném období:
$$\sum_{r \in \text{NUTS2}} \widehat{\text{VIIRS}}_{r, m, y} \neq \widehat{\text{VIIRS}}_{\text{GR}, m, y}$$

**Empirický důkaz z dat (rok 2007, Řecko):**
- **Celý rok 2007:**
  - Národní model `GR`: **22 765.9** detekcí
  - Součet 12 harmonizovaných NUTS2: **20 588.5** detekcí
  - Odchylka: **-2 177.4 detekcí (-9.56 %)**
- **Srpen 2007 (historicky nejničivější požáry na Peloponésu a v Eubóji):**
  - Národní model `GR`: **11 943.1** detekcí (MODIS zaznamenal 3 137)
  - Součet 12 harmonizovaných NUTS2: **9 714.8** detekcí
  - Odchylka: **-2 228.3 detekcí (-18.66 %)**!

Tato odchylka vzniká proto, že v srpnu 2007 tvořil Peloponés většinu požárů, ale jeho lokální noční poměr VIIRS/MODIS je odlišný od celořeckého váženého průměru.

---

## 3. Nezávislé přepočty a statistická validace

V rámci auditu byly přímo z primárních měsíčních dat přepočteny statistické metriky pro 4 vybrané reprezentativní regiony:

### 3.1 Přehled validačních metrik vybraných regionů

| Region | Název / Popis | Režim | LOYO MdAPE | Časový test MdAPE (2020–2025) | Nejhorší testovací rok | Chyba nejhoršího roku | Vědecký status |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **EL52** | Kentriki Makedonia | `harmonized` | **4.0 %** | **11.8 %** | 2023 | -27.4 % | **Stabilní, excelentní fit** |
| **EL65** | Peloponnisos | `harmonized` | **17.5 %** | **16.1 %** | 2021 | -26.6 % | **Přijatelný, mírný rozptyl** |
| **EL42** | Notio Aigaio (Ostrovy) | `harmonized` | **25.0 %** | **22.8 %** | 2025 | **-77.7 %** | **KRITICKÝ (selhání stacionarity)** |
| **EL54** | Ipeiros (Hory) | `harmonized` | **24.2 %** | **31.9 %** | 2023 | **+80.4 %** | **KRITICKÝ (přecenění o 80 %)** |
| **EL62** | Ionia Nisia (Jónské o.) | `relative` | N/A | N/A | N/A | N/A | **Správně vyřazeno z harm.** |
| **AR-30** | Entre Ríos (Argentina)| `harmonized` | **6.5 %** | **11.5 %** | 2023 | +36.3 % | **Stabilní (mokřady Paraná)** |
| **AR-58** | Neuquén (Patagonie) | `harmonized` | **20.5 %** | **25.8 %** | 2023 | -39.5 % | **Na hraně použitelnosti** |

### 3.2 Analýza selhání u EL42 a EL54
Implementace v `pipeline/validate.py` používá pro klasifikaci do režimu `harmonized` pouze podmínku:
```python
if loyo_mdape <= 25.0 and peak_delta >= -1:
    return "harmonized"
```
Tato logika trpí závažným metodickým nedostatkem: **zcela ignoruje výsledky testování na nezávislém časovém vzorku 2020–2025 (*held-out test set*)**.
- V regionu **EL42 (Notio Aigaio)** klesl v roce 2025 pozorovaný počet detekcí VIIRS na 242, zatímco model predikoval násobně více (chyba **-77.7 %**).
- V regionu **EL54 (Ipeiros)** byla v roce 2023 predikce přestřelena o **+80.4 %** a mediánová chyba časového testu dosáhla **31.9 %**.

Skutečnost, že tyto regiony zůstaly v produkční databázi označeny jako `harmonized`, představuje vědecké riziko. Zadržený lokální commit `3dbb123` situaci částečně řeší přidáním příznaku `quality: "limited"`, avšak z přísného metodického hlediska měly být tyto regiony buď převedeny do režimu `relative`, nebo podrobeny dodatečné regularizaci.

---

## 4. Analýza extrémních požárních sezón

### 4.1 Řecko — Srpen 2021 (Sterea Elláda / Eubója — EL64)
Dotaz na `investigate_month(region_id="EL64", ym="2021-08")` vrací:
- VIIRS pozorováno: **4 235 detekcí** (MODIS: 807 detekcí, poměr 5.25).
- Pozice v 26leté historii: **1. místo (historický rekord)**.
- Poměr k 10letému mediánu (63.1): **67.1×**.
- Meteorologická reanalýza Open-Meteo ERA5:
  - Maximální teplota: **41.7 °C**
  - Minimální relativní vlhkost: **7.0 %**
  - Maximální nárazy větru: **48.2 km/h**
  - Počet po sobě jdoucích suchých dnů před požárem: **17 dní**.
- **Závěr:** Harmonizovaný model v tomto extrémním měsíci funguje excelentně jako přímé pozorování VIIRS, a integrace s reanalýzou ERA5 poskytuje špičkový kauzální kontext.

### 4.2 Argentina — Rok 2020 (Delta del Paraná — Entre Ríos — Prov. 30)
Rok 2020 představoval v deltě řeky Paraná bezprecedentní požární krizi způsobenou extrémním suchem La Niña.
- Model vykazuje pro provincii 30 v celém roce 2020 odchylku pouhých **+0.3 %** vůči pozorovanému VIIRS.
- To potvrzuje, že v oblastech s vysokým počtem plošných požárů a stabilním poměrem denních/nočních záblesků je poměrový model vysoce robustní.

---

## 5. Vědecký audit nového modulu AOI (Area of Interest)

### 5.1 Přenositelnost NUTS2 faktorů na mikroúzemí
AOI modul v `web/src/aoi/compute.ts` počítá požární kalendář pro libovolný uživatelský polygon tak, že vezme jednotlivé detekce a přeškáluje je faktorem NUTS2 kraje, do kterého detekce geograficky spadá:
```typescript
regionModel += base * factor("viirs_over_modis", m, dn);
```
**Vědecké posouzení:**
1. Makroregionální NUTS2 faktor vznikl agregací z území o rozloze $10\,000–30\,000\text{ km}^2$. Pokud uživatel nakreslí mikro-polygon o rozloze např. $50\text{ km}^2$ (např. údolí s travním porostem), lokální spektrální chování a poměr citlivosti VIIRS vůči MODIS se může dramaticky lišit od průměru celého kraje.
2. Autoři v kódu i v uživatelském rozhraní poctivě uvádějí:  
   *"Estimate. Before Feb 2012 each detection is converted to the VIIRS scale with the factors of its NUTS2 region; those factors were validated per region, not for this area."*
3. Z vědeckého hlediska je toto řešení přijatelné jako informativní odhad, pokud je takto explicitně deklarováno.

### 5.2 Geometrické zkreslení a výpočet plochy
1. Funkce `areaKm2` v `web/src/aoi/geojson.ts` používá rovinnou Shoelace aproximaci. Pro území o velikosti Řecka činí odchylka vůči geodetickému elipsoidu WGS84 až jednotky procent.
2. V případě více překrývajících se polygonů v jednom AOI se plocha sčítá aditivně bez provedení prostorového sjednocení (*polygon union*). To vede k umělému nadhodnocení plochy a zkreslení odvozené hustoty detekcí na $1\,000\text{ km}^2$.

<!-- ROADMAP_TO_10.md -->

# ROADMAP TO 10/10 — BURNING CALENDAR
**Projekt:** Burning Calendar (NASA Space Apps Challenge 2026)  
**Cíl:** Převést projekt z hodnocení 9.32/10 na bezchybných 10.0/10 před finálním hodnocením globální poroty.  
**Autor plánu:** Nezávislý vědecký a technický auditor  
**Datum:** 14. listopadu 2026  

---

## 1. Přehled prioritních úkolů

| Priorita | Identifikátor | Oblast | Název úkolu | Odhad pracnosti |
| :---: | :---: | :---: | :--- | :---: |
| **P0** | **ACT-01** | Provoz / Git | Synchronizace produkčního nasazení (Push commitu `3dbb123`) | 10 min |
| **P0** | **ACT-02** | Metodika / MCP | Caveat pro prostorovou neaditivitu v `aggregate` | 1 hod |
| **P1** | **ACT-03** | Věda / Pipeline | Zpřísnění klasifikace režimů na základě časového testu (2020–2025) | 3 hod |
| **P1** | **ACT-04** | Modelování | Řešení nulového absolutního členu (Zero-Inflation / Hurdle Model) | 1–2 dny |
| **P1** | **ACT-05** | AOI / Data | Zpřístupnění AOI pro Argentinu (GeoParquet / DuckDB-Wasm) | 1 den |
| **P2** | **ACT-06** | GIS / Matematika| Geodetický výpočet plochy a prostorové sjednocení překryvů v AOI | 2 hod |
| **P2** | **ACT-07** | Satelitní kontinuita| Zajištění kontinuity řady po zániku S-NPP (přechod na NOAA-20/21) | 4 hod |
| **P2** | **ACT-08** | Frontend / UX | Optimalizace mobilního zobrazení validačního panelu | 2 hod |

---

## 2. Detailní specifikace prioritních kroků

---

### P0: Okamžité zásahy (Critical)

#### ACT-01: Synchronizace produkčního nasazení Vercel
- **Problém:** Lokální větev `main` obsahuje commit `3dbb1231fd552275bbfd8857624f6386aa8f15f5` (*"Add a quality note to harmonized regions with weak held-out years"*), který nebyl pushnut do vzdáleného repozitáře `origin/main`. Produkce na Vercelu běží na starším commitu `0a3dcea` a nezobrazuje varování `quality: "limited"` ani caveat `validation_limits`.
- **Řešení:**
  ```bash
  git push origin main
  ```
- **Kritéria přijetí:**
  - Vercel automaticky nasadí commit `3dbb123`.
  - Volání produkčního MCP endpointu `search_regions(country="GR", level="nuts2")` vrací u regionů `EL42` a `EL54` pole `quality: "limited"` a `worst_heldout_year`.
  - Webové rozhraní zobrazuje žlutý infobox u regionu Notio Aigaio informující o limitu predikce pro rok 2025.

#### ACT-02: Doplnění caveat pro prostorovou neaditivitu do `aggregate`
- **Problém:** V modelovaném období (před únorem 2012) se součet dílčích NUTS2 regionů v Řecku nerovná národnímu odhadu `GR` (rozdíl až -18,66 % v srpnu 2007). Nástroj `aggregate` vrací součet regionů bez varování, což mate analytiky porovnávající celostátní a krajská čísla.
- **Soubory:** `web/api/_lib/tools.ts`, `pipeline/export.py`.
- **Řešení:** V těle funkce `aggregate` detekovat, zda dotazované období obsahuje měsíce před 2012-02 a zda dotazované regiony tvoří uzavřený sub-celek (např. NUTS2 regiony Řecka). Pokud ano, vložit caveat:
  ```json
  {
    "code": "spatial_non_additive",
    "message": "Sums of regional back-cast values differ from national models (up to 10-19 % in extreme fire seasons like 2007) because conversion factors were fitted independently per region and at country level."
  }
  ```
- **Kritéria přijetí:** Volání `aggregate(["EL51", ..., "EL65"], from="2007-01", to="2007-12")` obsahuje kód `spatial_non_additive`.

---

### P1: Vědecká a metodická vylepšení (Scientific Excellence)

#### ACT-03: Zpřísnění klasifikace harmonizace (Held-Out Time-Split Rule)
- **Problém:** Regiony `EL42` (Notio Aigaio) a `EL54` (Ipeiros) mají status `harmonized`, přestože v testovacím období 2020–2025 vykazují chyby **-77,7 %** a **+80,4 %**.
- **Soubor:** `pipeline/validate.py` (funkce `quality()`).
- **Navrhovaná úprava:**
  Zavést dvoustupňové pravidlo:
  ```python
  time_split_mdape = ts.get("annual_mdape_pct", 0)
  max_heldout_err = max(abs(e) for e in ts.get("annual_err_pct", {}).values()) if ts.get("annual_err_pct") else 0

  if loyo_mdape > 25.0 or peak_delta < -1 or max_heldout_err > 60.0 or time_split_mdape > 30.0:
      return "relative"
  ```
  Pokud region vykazuje extrémní nestabilitu v nezávislých letech, neměl by být publikován jako harmonizovaný, nýbrž převeden do relativního módu s jasným odůvodněním v metodice.

#### ACT-04: Potlačení problému nulového absolutního členu (Zero-Inflation)
- **Problém:** Pokud MODIS v daném měsíci detekuje 0, VIIRS je modelován striktně jako 0, což ignoruje citlivost VIIRS na malé požáry.
- **Navrhovaná úprava:**
  Implementovat dvoudílný model (*Two-part Hurdle Model*):
  1. Logistická pravděpodobnost detekce alespoň jednoho VIIRS hotspotu při nulovém MODIS na základě historické frekvence a indexu sucha FWI z Open-Meteo ERA5.
  2. Podmíněná střední hodnota počtu detekcí pro měsíce s $\text{MODIS} = 0$.

#### ACT-05: Zpřístupnění AOI pro Argentinu
- **Problém:** V současnosti je AOI funkční pouze pro Řecko, protože bodová data pro Argentinu mají 362 MB a nelze je načítat jako surové CSV do prohlížeče.
- **Navrhovaná úprava:**
  1. Převést body do formátu **GeoParquet** nebo **FlatGeobuf** s prostorovým indexem (R-Tree / Hilbertova křivka).
  2. Využít **DuckDB-Wasm** nebo klient-side Range Requests pro stažení pouze těch bajtů souboru, které protínají obdélník (bbox) nakresleného AOI.
  3. Umožní to bleskový výpočet vlastního kalendáře i pro celou Jižní Ameriku bez nutnosti stahovat gigabajty dat.

---

### P2: Technická a uživatelská vylepšení (Engineering & UX)

#### ACT-06: Geodetický výpočet plochy a unie polygonů v AOI
- **Soubor:** `web/src/aoi/geojson.ts`.
- **Úprava:**
  1. Nahradit plochý vzorec Shoelace geodetickým výpočtem na elipsoidu WGS84 (např. pomocí standardní rovnice pro sférický exces nebo integrace podél geodetických linií).
  2. Před voláním `areaKm2` provést polygonové sjednocení (*Union*) všech nakreslených prvků, aby se zamezilo dvojímu započtení plochy při překrývajících se polygonech a zkreslení hustoty požárů.

#### ACT-07: Zajištění kontinuity časové řady po 2. listopadu 2026
- **Problém:** Družice Suomi-NPP ukončila svou operační činnost dne 2. listopadu 2026. Data za srpen–říjen 2026 jsou v systému označena jako provizorní NRT a od listopadu 2026 řada končí.
- **Řešení:** 
  Dokončit napojení a kalibrační vazbu na senzor **VIIRS na družici NOAA-20 (JPSS-1)** a **NOAA-21 (JPSS-2)**, které létají ve stejné orbitální rovině a zajistí bezproblémové pokračování kalendáře do dalších let.

---

## 3. Závěr a doporučení

Provedením kroků **P0 (ACT-01 a ACT-02)**, které představují méně než dvě hodiny práce, projekt okamžitě odstraní hlavní zjištěné provozní i prezentační nedostatky. Následná realizace vědeckých vylepšení v **P1** posune projekt na absolutní vrchol v rámci celosvětové soutěže NASA Space Apps Challenge.
