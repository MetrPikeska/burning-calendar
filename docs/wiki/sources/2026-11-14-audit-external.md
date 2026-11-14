---
title: External audit of commit b09212a (Czech, 4 reports)
updated: 2026-11-14
verified_by: claims BC-001 to BC-005 checked against main 1435272 on 14 Nov 2026, all five reproduced in code; fixed on branch audit-fixes
sources: [burning_calendar_audit_2026-11-14.zip]
---

Verbatim copy of the four Markdown reports from burning_calendar_audit_2026-11-14.zip (independent read-only audit of main b09212a and the production MCP server, 14 Nov 2026). Self-assessed score 6.8/10 on the auditor's own weights, not NASA criteria. Order: executive review, MCP test report, scientific review, roadmap.


<!-- EXECUTIVE_REVIEW.md -->

## Burning Calendar — nezávislé exekutivní hodnocení

**Datum auditu:** 14. 11. 2026  
**Rozsah:** repo `MetrPikeska/burning-calendar`, `main` commit `b09212a410a22e50edc9271efcdd86e0503ad763`; připojený produkční MCP server Burning Calendar; čtení zdrojového kódu.  
**Přístup:** read-only. Žádná změna aplikace, dat, prostředí nebo repozitáře.  
**Statut:** nezávislý technický a vědecký *screening*, nikoli publikovaná vědecká peer review ani úplný vizuální/browser test.

### Verdikt

**Předběžné hodnocení: 6,8/10.** Projekt je funkčně nadprůměrný hackathonový prototyp, ale pro náročné mezinárodní posuzování ještě není vědecky a významově dostatečně robustní. Rozhodující výhrady nejsou počet funkcí ani atraktivita mapy, nýbrž *vědecká spolehlivost harmonizace v problematických regionech*, *interpretace anomálií v jiných datových režimech* a *přesnost metadat*.

| Kategorie (vlastní audit, **neoficiální kritéria NASA**) | Váha | Skóre | Příspěvek |
|---|---:|---:|---:|
| Vědecká správnost | 30 % | 6,5 | 1,950 |
| Soulad se zadáním | 25 % | 6,5 | 1,625 |
| Technické provedení | 20 % | 7,8 | 1,560 |
| Inovace | 15 % | 7,4 | 1,110 |
| Použitelnost a prezentace | 10 % | 5,5 | 0,550 |
| **Celkem** | **100 %** | | **6,795 → 6,8/10** |

Skóre použitelnosti je méně jisté: podařilo se provést **code review**, nikoli skutečný test responzivity, čtečky obrazovky a vizuálního chování v běžném prohlížeči. Produkční MCP je dostupné; veřejný web nebylo možné tímto auditním prostředím přímo vykreslit a interaktivně ovládat. Proto nejde o definitivní UX skóre.

### Co funguje a bylo nezávisle ověřeno

- Přístup k privátnímu repozitáři; identifikována architektura (Python FIRMS/GeoPandas pipeline, předpočítané JSON/CSV, TypeScript/MapLibre UI, stateless Vercel MCP API, živé konektory).
- **16 aktuálních MCP nástrojů** bylo objeveno dynamicky a každý byl alespoň jednou normálně zavolán. Vybrané nástroje prošly hranovými a neplatnými vstupy. Detail v `MCP_TEST_REPORT.md`.
- Pro `EL52`, kalendářní rok **2024**, souhlasí měsíční řada, `get_region_series.totals`, `aggregate`, `compare_regions.year_total` i `show_calendar`: **828 harmonizovaných/pozorovaných VIIRS detekcí**. Základní anomálie odpovídají květnu–srpnu.
- `EL62` správně zůstává v režimu `relative`, má `harm=null`, a `show_calendar(series="harm")` odmítá nepřípustné zobrazení. Smíšená agregace správně přechází na společnou stupnici MODIS; samotné popisky anomálií mají problém (níže).
- Historický srpen 2007 pro Řecko vrací **11 943,1** modelovaných detekcí, interval **8 730,4–15 382,7**, původ `backcast`; výstup je rozlišen od skutečného počtu **3 137 MODIS**.
- Live FIRMS NOAA-20/NOAA-21/MODIS skutečně odpovědělo; `get_fire_weather` rozlišuje reanalýzu a předpověď, `get_weather_stations` označuje modelově doplněné hodnoty místo jejich vydávání za měření.

### Potvrzené chyby vyžadující zásah

| ID | Závažnost | Zjištění | Bezprostřední riziko |
|---|---|---|---|
| **BC-001** | **High** | `show_calendar(series="modis")` zachová `anom` ze série `harm` a hlavní `unit` také odkazuje na VIIRS-equivalent. V `EL52` květen 2024: `v=0`, `anom=true`. | AI agent či uživatel považuje **nulový MODIS měsíc za anomálii MODIS**. |
| **BC-002** | **High** | `aggregate(["EL52","EL62"], 2024)` používá součet v surových MODIS, ale vrací `EL52.anomaly_months` z harmonizovaného režimu. | Výstup mísí významy na různých stupnicích. |
| **BC-003** | Medium | V `relative` režimu `EL62`, před rokem 2012, má přímo pozorovaná hodnota `modis` pole `src="backcast"`. | Nepřesná informace o datovém původu. |
| **BC-004** | Medium | `get_validation` definuje `onset_mad_months` aj. jako medián, ale `pipeline/validate.py` používá `np.mean`. | Nesprávné vědecké metadata/metodika. |
| **BC-005** | Medium | `get_fire_weather` přijalo neexistující `2026-02-30` a vrátilo prázdná data s `upstream_error`. | Chyba klientského vstupu maskovaná jako problém zdroje. |

Reprodukce a návrhy regresních testů jsou v `MCP_TEST_REPORT.md`. Problémy BC-001/002 se týkají významu atributů v ověřeném výstupu; **samotný grafický vzhled widgetu nebyl vizuálně potvrzen**.

### Kritické vědecké nálezy

1. **Úspěch na úrovni celého státu neimplikuje úspěch v každém regionu.** Řecko: LOYO medián absolutní roční chyby **5,4 %**; ale region `EL42` (Notio Aigaio) má v časovém testu 2025 roční odchylku **−77,7 %** a `EL54` (Ipeiros) v roce 2023 **+80,4 %**, a oba zůstávají `harmonized`.
2. **Zpětný odhad je model se závislostí na kalibračním období.** Regionálně a po měsících se odhaduje poměr VIIRS/MODIS 2012–2019 a před rokem 2012 se násobí MODIS. Data nejsou přímým pozorováním VIIRS.
3. **Intervaly `harm_lo/harm_hi` nejsou doložené jako kalibrované predikční intervaly.** Jsou odvozené z 10. a 90. percentilu poměru `observed/predicted` při LOYO a sdílené v rámci meteorologických ročních období. Není prokázané pokrytí 80 % v jednotlivých regionech ani před 2012.
4. **Anomálie jsou relativní statistické příznaky, nikoli automaticky významné požáry.** `EL52` květen 2024: **13 VIIRS detekcí**, historické `p90=12,1`, příznak `anom=true` — legitimní aritmetika, ale absolutně malý počet. Před rokem 2012 se používá pevná referenční řada **2002–2011** včetně budoucích let vůči testovanému roku (v datech správně označená jako retrospektivní/fixed, nikoliv real-time).
5. **Současná živá detekce není automaticky srovnatelná s historií.** FIRMS NOAA-20 NRT není kalibrováno na VIIRS S-NPP standard processing; projekt to správně uvádí, ale zveřejněný poměr živé a historické četnosti nesmí být prodáván jako přesná anomálie.

### Zadání NASA: čím projekt přispívá a co chybí

Základní koncept — propojit historické MODIS a VIIRS hot spoty do časového kalendáře, vyznačit typická období a umožnit historické srovnání — **je implementován** pro Řecko a Argentinu. Skutečně zajímavým přínosem je propojení vysvětlitelného backcastu s **mode fallback podle validace**, nejistotou a strojově čitelným MCP.

Na druhé straně jsou geografické výběry omezeny na předdefinované administrativní regiony (a bod převedený na region), nikoli libovolně nakreslený či nahraný polygon AOI. Jde o **omezení rozsahu**, nikoli automaticky porušení povinného požadavku; úplné oficiální vymezení minimálních/volitelných funkcí se z tohoto prostředí nepodařilo znovu načíst. Vizuální přístupnost, mobilní reálný provoz a exporty jsou **ověřeny jen na úrovni kódu**.

### Co bych požadoval před odevzdáním

**P0:** opravit význam anomálií v alternativních sériích (BC-001/002), nezaměňovat model a pozorování (BC-003), opravit metrický popis validace (BC-004), ošetřit kalendářní datum (BC-005); doplnit jasné regionální upozornění na extrémy time-split validace. **P1:** ověřit pokrytí intervalů, testy stability kalibrace, kontrolu baseline u nulových řad a být velmi přesný v prezentaci čísel. **P2:** vizuální polish až po potvrzení vědecké správnosti. Plná prioritizace v `ROADMAP_TO_10.md`.

### Meze auditu a průkaznost

- **Ověřeno:** živé volání všech 16 MCP nástrojů, vybrané mezní/chybné vstupy, mezitoolové srovnání a čtení konkrétní verze zdrojového kódu. Služby třetích stran odpovídaly v čase auditu.
- **Neověřeno:** reprodukce celé FIRMS pipeline z originálních vstupních souborů (jejich velikost ani originální data nejsou přímo v GitHub repozitáři), spuštění lokálního `pytest`/`vitest`, skutečný browser/telefon, vizuální widget a externí validace proti nezávislému senzoru či požárovým záznamům.
- **Nehodnoceno jako chyba:** absence celostátního živého alarmu neznamená nepřítomnost požáru; prázdné období mimo pokrytí vrací správnou výstrahu; nástroje správně odmítají nesmyslné ID nebo většinu překročených limitů.

**Primární důkazy:** zdrojové soubory [`pipeline/harmonize.py`](https://github.com/MetrPikeska/burning-calendar/blob/b09212a410a22e50edc9271efcdd86e0503ad763/pipeline/harmonize.py), [`pipeline/validate.py`](https://github.com/MetrPikeska/burning-calendar/blob/b09212a410a22e50edc9271efcdd86e0503ad763/pipeline/validate.py), [`pipeline/calendar_metrics.py`](https://github.com/MetrPikeska/burning-calendar/blob/b09212a410a22e50edc9271efcdd86e0503ad763/pipeline/calendar_metrics.py), [`web/api/_lib/tools.ts`](https://github.com/MetrPikeska/burning-calendar/blob/b09212a410a22e50edc9271efcdd86e0503ad763/web/api/_lib/tools.ts), získané odpovědi produkčních MCP nástrojů 14. 11. 2026.

<!-- MCP_TEST_REPORT.md -->

## Burning Calendar — MCP Red Team Test Report

**Audit:** 14. 11. 2026 · **Server:** `https://burning-calendar.vercel.app/api/mcp` prostřednictvím připojených produkčních nástrojů · **Repo:** `MetrPikeska/burning-calendar`, commit `b09212a`.  
**Metoda:** dynamické zjištění nástrojů a jejich schémat, skutečná volání; malé kontrolované dávky, žádný load test ani překročení limitů externích služeb. **PASS** = konkrétní provedený test, nikoli záruka celkové bezchybnosti. **REVIEW** = zjištěné riziko. **NOT TESTED** = otevřené ověření. V dokumentu nejsou žádné klíče ani tajné hodnoty.

### 1. Inventura a testovací matice

Bylo zjištěno **16 aktuálně vystavených MCP nástrojů**, o jeden více než ve výčtu staršího zadání (`investigate_month`).

| Nástroj | Provedený normální test | Hraniční/chybný test | Výsledek |
|---|---|---|---|
| `search_regions` | `country=GR, level=nuts2, limit=20` → 13 regionů; AR → regiony AR | `limit=0` → schéma odmítne | **PASS**; explicitní `relative` režimy a jednotky |
| `get_region_series` | `EL52,2024-01..2024-12` → total 828; `GR,2007-08` → backcast a interval; `EL62` → MODIS | překročení 120 měsíců odmítnuto, **přesně 120 měsíců přijato**; převrácené datum a `2024-13` odmítnuty; období po 2026-10 prázdné s caveat | **PASS + BC-003** (`src` v relative režimu) |
| `get_season_calendar` | `EL52,year=2024` → sezóna 2024-04..2025-03, total 868 | `year=2100` → prázdné `years`, sezonní okno je popsáno | **PASS**, pozor na záměnu season/calendar year |
| `get_anomalies` | `EL52,2024` → 4 flagged měsíce; `GR,2007` → pevná retrospektivní baseline | `year=2000` → pouze listopad/prosinec; `year=2099` → prázdné a caveat | **PASS/REVIEW**: historická baseline obsahuje budoucnost vzhledem k testovanému roku |
| `compare_regions` | `EL52,EL61,season_total/year_total,2024` | chybějící `year` odmítnut; duplicita ID redukována na jediný řádek | **PASS/REVIEW**: různé sezónní intervaly stále `ranking_allowed=true` |
| `aggregate` | `EL52,2024` → 828; `EL52,EL61` → 1049 | překrytí `GR+EL52` odmítnuto; duplicita `EL52+EL52` se nenačítá dvakrát; `EL52+EL62` přepne celou sumu na MODIS | **PASS + BC-002** při mixu s relative mode |
| `rank_regions` | `GR,nuts2,density_per_1000km2,top=5` | `year_total` bez `year` odmítnuto; AR 2007 přidává intervaly u modelovaných pořadí | **PASS**; pořadí podle středu je nejisté při překrývajících se intervalech |
| `find_region_at` | Thessaloniki 40.6401,22.9444 → EL52; Korfu 39.62,19.92 → EL62; Buenos Aires → 02 | moře 37.75,23.8 → `found=false`, nearest EL30 3.54 km; 0,0 mimo; lat 90.1 odmítnuta | **PASS/REVIEW**: pobřežní nearest 5 km pro agregaci |
| `get_validation` | GR, AR, EL52, EL42, EL54, EL62, AR provincie 18,94 | `region_id=EL99` odmítnuto | **PASS + BC-004** (mean vs median v definici metrik) |
| `get_methodology` | témata `harmonization`, `anomalies`, `limits`, `calendar` | alternativní témata ověřena; nepodporovaný řetězec samostatně nezkoušen | **PASS**, detailní původ a jednotky |
| `show_calendar` | `EL52,2024-01..12` → 828, heat strip/widget | relative `EL62,series=harm` odmítnuto; převrácené období odmítnuto; `EL52,series=modis` → anomálie z harm | **BC-001** významová nekonzistence |
| `get_fire_alerts` | `GR,days=14` → 0 oznámení; `AR,days=1` → 1 GDACS alert ve Formose | `country=AR,region_id=EL52` se tiše přepne na GR; limit 30 samostatně nezkoušen | **PASS/REVIEW**: konfliktní volitelné argumenty se ignorují |
| `get_fire_weather` | `EL52,2026-11-11..17` → reanalysis + forecast s jednotkami | neexistující `2026-02-30` prošlo jako prázdná odpověď; velké okno bylo zkráceno na dostupný interval | **BC-005** chybná kalendářní validace |
| `get_weather_stations` | `EL52,2026-11-01..12,max_stations=2` → Thessaloniki Airport s měřenými a modelovými poli | převrácený interval a >62 dnů odmítnuty | **PASS**, station/model provenance rozlišeno |
| `get_recent_detections` | `EL52,days=3` → NOAA20=3, NOAA21=4, MODIS=1 | `days=1` → žádný úplný den, rates=`null` místo 0; `days=11` odmítnuto | **PASS**, upozornění na neharmonizované NRT |
| `investigate_month` | `EL52,2024-08` → historická hodnota 208, počasí, evidence; `2026-10` → provisional + live | `ym=1999-12` → history `found=false` a out_of_coverage | **PASS**, kombinovaný důkaz; historie/počasí neprokazují kauzalitu |

**Neprovedeno:** dynamické *mutace* API (server je read-only), vysokozátěžové a rate-limit testy, úplné permutace vstupů, nezávislé testy celé pipeline proti stáhnutým FIRMS originálům, vizuální kontrola widgetu ve skutečném prohlížeči.

### 2. Scénáře A–J z auditního zadání

#### A — historická konzistence (`EL52`, 2024)

Všechny přímo porovnatelné agregace **souhlasí**:

- Měsíční `harm`: leden 65, únor 189, březen 27, duben 40, květen 13, červen 55, červenec 88, srpen 208, září 14, říjen 46, listopad 76, prosinec 7. **Součet = 828**.
- `get_region_series.totals[2024]` = 828, `aggregate.total` = 828, `compare_regions(metric="year_total").rows[EL52]` = 828, `show_calendar.totals[2024].harm` = 828.
- `get_anomalies.flagged`, `get_region_series` i `show_calendar(series="harm")` souhlasí na `2024-05, 2024-06, 2024-07, 2024-08`.
- Pozor: `get_season_calendar(year=2024)` = **868**, protože sezóna není leden–prosinec, ale **duben 2024–březen 2025**. To není numerický rozpor.

#### B — relative-mode safety (`EL62`)

`search_regions` uvádí `mode=relative`; `get_region_series` nevrací `harm` a historický rok 2007 obsahuje 91 surových MODIS detekcí; požadavek `show_calendar(series="harm")` je správně odmítnut. **Problém:** u těchto surových záznamů je `src="backcast"` (BC-003).

#### C — retrospektivní srpen 2007 (`GR`)

`modis=3137`, `harm=11943.1`, `harm_lo=8730.4`, `harm_hi=15382.7`, `src=backcast`, `fit_level=region_month_dn`. Hodnota 11 943,1 **není počet skutečně naměřených VIIRS detekcí v roce 2007**. `get_anomalies` uvádí baseline `2002-2011 without 2007`, `baseline_kind=fixed_2002_2011`, medián 781,2, p90 2107,8, `anom_pct=100`. Toto je *retrospektivní* odchylka; baseline zná budoucí roky.

#### D — regionální srovnání (`EL52` versus `EL61`, 2024)

`season_total`: **868 vs 225**, ale intervaly se liší: EL52 `2024-04..2025-03` a EL61 `2023-12..2024-11`; návrat `ranking_allowed=true` s caveat `season_window`. `year_total`: **828 vs 221** při shodném `2024-01..2024-12`. Uživatelé potřebují srovnání podle společného intervalu; řazení rozdílných sezónních intervalů má být výrazně označeno.

#### E — živé FIRMS NRT (`EL52`, 12.–14. 11. 2026)

`configured=true`; `totals` **NOAA-20=3, NOAA-21=4, MODIS=1**. Top hotspoty vracejí acquisition UTC, lat/lon, `sensor`, `frp_mw`, `confidence`, day/night. Historický kontext listopadu 2016–2025: medián **69 S-NPP detekcí/měsíc**, cca **2,3/den**. Výpočet aktuálního poměru používá pouze NOAA-20 a kompletní dny, nikoliv součet NOAA-20/NOAA-21. Caveat výslovně říká, že jde o **order of magnitude only**, bez cross-sensor calibration. V jednodenním testu `full_days=0` a poměr `null` — správně.

#### F — počasí

`get_fire_weather` pro EL52 mezi 11. a 17. listopadem rozlišuje `kind=reanalysis` a `kind=forecast`, poskytuje grid cell, jednotky i upozornění *model, not weather station; no FWI*. `get_weather_stations` vrací Thessaloniki Airport; z 12 dnů je **5 s alespoň jednou skutečnou měřenou hodnotou**; od 6. do 12. listopadu jsou veškerá ukazovaná pole v `model_fields`. Tedy „weather station“ neznamená automaticky „ověřená měření pro všechny dny“.

#### G — neplatné vstupy

Schémata/implementace odmítají `from>to`, chybný měsíc `2024-13`, >120 měsíčních záznamů, neexistující region, míchání státu s vlastními regiony, chybějící rok pro periodické ranky, `days=11`, `max_stations` a >62 dnů. Naopak `2026-02-30` projde ve `get_fire_weather` (BC-005). Duplicity identifikátorů se obecně deduplikují (ne vždy chyba, ale klient nemá zpětnou informaci o normalizaci).

#### H — hranice a pobřeží

`find_region_at` uvnitř Soluně, na Korfu a v Buenos Aires vrátil očekávaný správní region. Bod v moři **37.75,23.8** vrátil `found=false`, nejbližší Attiki **3,54 km**. To odpovídá oddělení geometrické přítomnosti od přiřazování detekcí do 5 km od pobřeží; test neověřuje polohovou přesnost jednotlivých hotspotů. Doporučen je nezávislý GIS test hraničních/sousedících polygonů.

#### I — mezistátní srovnání

`rank_regions` pro argentinské provincie roku 2007 vrací např. Santiago del Estero **53 109,5** modelovaných detekcí s intervalem **47 029,3–63 491,7**. Absolutní počty **nejsou** korektní mírou rizika mezi Řeckem a Argentinou: odlišná plocha, detekční podmínky, plodiny, frekvence snímkování a spalovací režimy. Pro srovnání používat především prostorovou hustotu a správně popsanou referenční škálu; ani ta neodstraňuje všechny rozdíly.

#### J — spolehlivost pro AI agenty

MCP většinou nabízí `unit`, `units`, `mode`, `caveat_codes`, `coverage`, `source`, `view_url` a odkaz na CSV. To je přínosné. **Riziko není pouze chybějící caveat, ale protichůdná data uvnitř jednoho výstupu** (BC-001/002). Kompaktní agent, který vezme `v` a `anom` bez hlubšího čtení `anomaly_series`, může odpovědět nesprávně i při technicky správném přenosu dat.

### 3. CONFIRMED BUGS — přesné reprodukce

#### BC-001 — High — `show_calendar`: anomálie na jiné stupnici než zobrazená řada

- **Komponenta:** `web/api/_lib/tools.ts` (`show_calendar`), případně prezentace MCP Apps widgetu.
- **Kroky:** připojit Burning Calendar MCP; zavolat `show_calendar` s argumenty níže; porovnat `series`, `unit`, `anomaly_series`, `months` pro květen 2024 s `get_region_series`.
- **Input:** `{"region_id":"EL52","from":"2024-01","to":"2024-12","series":"modis","caveats":"codes"}`.
- **Očekávané:** `unit` odpovídá MODIS; buď anomálie vypočtené nad MODIS, nebo jasně oddělená a neaplikovaná anotační vrstva anomálií harmonizované řady.
- **Skutečné:** `series="modis"`, `unit="VIIRS-equivalent..."`, `anomaly_series="harm"`, `months[2024-05]={"v":0,"src":"observed","anom":true}`. Harmonizovaná hodnota květen 2024 je 13 a `p90=12.1`.
- **Dopad:** mylné hlášení anomálie při nulové hodnotě zvolené série. Velmi výrazné u AI reportů.
- **Oprava:** pro vybranou sérii definovat vlastní `anomaly_*` s odpovídající referencí; nebo vypnout anomálie pro `series != anomaly_series` a vysvětlit proč. Přepnout i hlavní `unit` na zobrazenou sérii; labely v widgetu.
- **Regresní test:** pro `EL52,2024-05,series=modis` nesmí být `v=0 && anom=true` bez explicitního odlišeného důvodu; unit musí obsahovat `raw MODIS`.

#### BC-002 — High — `aggregate`: smíšená agregace s nekompatibilními příznaky

- **Komponenta:** `web/api/_lib/tools.ts`, agregátor (`ms.filter(m => m.anom)` při `series="modis"`).
- **Kroky:** zavolat `aggregate` pro EL52 a relative EL62 v roce 2024; porovnat výsledek s `get_region_series(EL52,2024-05)` a se samostatným MODIS.
- **Input:** `{"region_ids":["EL52","EL62"],"from":"2024-01","to":"2024-12","caveats":"full"}`.
- **Očekávané:** společná škála MODIS pro totals, ale `anomaly_months` se buď neuvedou, nebo budou vypočítány vůči MODIS baseline.
- **Skutečné:** `series="modis"`, `total=209`, EL52 `total=205`, EL62 `total=4` — numericky bezpečné; **EL52 stále `anomaly_months=[2024-05,2024-06,2024-07,2024-08]` z harmonizované řady**. V květnu MODIS EL52 = 0.
- **Dopad:** agent interpretuje anomálie jako odvozené z agregované série, přestože jejich výpočet vychází z jiné řady.
- **Oprava:** při změně `series` přepočítat příznaky na požadované škále nebo vrátit označení `anomaly_series` pro každou jednotku a potlačit incompatible `anomaly_months`.
- **Regresní test:** mixed-mode total 209, ale žádné `EL52.anomaly_months` vydávané za MODIS anomálie; test i pro AR relative provincii.

#### BC-003 — Medium — chybné označení `src` v `relative` režimu

- **Komponenta:** `pipeline/harmonize.py::series` a exportovaná data, `get_region_series`.
- **Kroky:** načíst 2007 pro Ionian Islands; prohlédnout `modis`, `harm`, `src`, `mode`.
- **Input:** `{"region_id":"EL62","from":"2007-07","to":"2007-07","fields":["modis","harm","src"],"caveats":"codes"}` (stejné pole pozorováno při dotazu na celý rok).
- **Očekávané:** surová MODIS detekce má jednoznačně `source=observed_modis` či oddělenou provenienci řady; `backcast` pouze u skutečně modelovaného `harm`.
- **Skutečné:** `mode="relative"`, `modis=81`, `harm` chybí, ale `src="backcast"`.
- **Dopad:** matoucí provenance, zavádějící záměna pozorování a modelu.
- **Oprava:** oddělit `modis_src` a `harm_src`, případně `src` interpretovat podle aktivní série a dokumentovat ji.
- **Regresní test:** relative měsíce před 2012 nesmějí označovat pozorovaný MODIS počet za vypočtený VIIRS backcast.

#### BC-004 — Medium — chybný název statistiky `*_mad_months`

- **Komponenta:** `pipeline/validate.py::_season_compare`, `web/api/_lib/tools.ts` výklad jednotek.
- **Kroky:** zkontrolovat kód: při výpočtu `onset_mad_months`, `end_mad_months` a `length_mad_months` se používá **`np.mean`** nad absolutními rozdíly; v `get_validation` metadatových jednotkách je **"median absolute difference"**.
- **Input:** `{"region_id":"EL52","caveats":"codes"}` → `loyo.peak_month.harmonized.onset_mad_months=1.29` (7 sezon; medián celočíselných absolutních rozdílů nemůže být 1.29).
- **Očekávané:** správně uvést **mean absolute difference** nebo přepnout výpočet na `np.median` a přegenerovat validaci.
- **Skutečné:** rozpor mezi kódem a vědeckým popisem.
- **Dopad:** zkreslení robustness; aritmetický průměr je citlivější na několik velkých odchylek než medián.
- **Oprava:** preferovat výslovné `mean_absolute_month_error` a doplnit zvlášť medián, pokud je relevantní; opravit text a testy.
- **Regresní test:** fixture s absolutními odchylkami `[0,0,6]`: mean=2, median=0; metadata a numerika musí odpovídat.

#### BC-005 — Medium — nesmyslné Gregorian datum v počasí

- **Komponenta:** `get_fire_weather`, date validation / upstream error handling.
- **Kroky:** zavolat weather pro neexistující únorový den.
- **Input:** `{"region_id":"EL52","from":"2026-02-30","to":"2026-03-01","caveats":"codes"}`.
- **Očekávané:** typizovaná chyba `INVALID_ARGUMENT: invalid calendar date` před voláním Open-Meteo.
- **Skutečné:** úspěšná odpověď s `window.from="2026-02-30"`, `days=[]`, nulovými statistikami a caveat `upstream_error`.
- **Dopad:** klient je veden k opakování requestu / podezření na nestabilní službu místo opravy data.
- **Oprava:** striktní ISO `YYYY-MM-DD` parsing s kontrolou Gregorian validity, intervalů i timezone.
- **Regresní test:** `2026-02-30`, `2025-02-29`, `2026-04-31` → invalid argument; `2024-02-29` → valid.

### 4. SCIENTIFIC RISKS (není to automaticky potvrzený bug)

- `EL42`: LOYO MdAPE **25,0 %**, rok 2025 time-split **−77,7 %**; `EL54`: LOYO 24,2 %, time-split 2023 **+80,4 %**. Práh pro `relative` režim vychází pouze z LOYO mediánu a peak hit rozdílu, nemusí chránit před selháním mimo fit okno.
- Interval `harm_lo..harm_hi` z kvantilů LOYO `obs/pred` není empiricky otestovaný predikční interval se známým pokrytím.
- `get_anomalies` před 2012 používá fixní baseline 2002–2011 obsahující (pro starší roky) i budoucí roky; `baseline_kind` tuto skutečnost označuje. Nesmí se interpretovat jako reálně dostupný tehdejší alarm.
- `find_region_at` a historická prostorová agregace nemají identickou politiku přiřazení bodu těsně za hranicí polygonu (historické body se nearest do 5 km připojují k regionu); rozpor je významově vysvětlen, prostorovou přesnost je ale nutno dál testovat.
- Živé NOAA-20 NRT proti historickému S-NPP není radiometricky/statisticky harmonizované; nulový ratio na 2 úplných dnech nevypovídá o nulovém riziku požáru.

### 5. SUSPECTED ISSUES / otevřené testy

- `get_fire_alerts` přijme konfliktní `country="AR",region_id="EL52"` a bez chyby preferuje region GR. Navrhuji explicitní chybu kontradikce nebo `ignored_args` metadata; chování může být záměrná precedence.
- `get_fire_weather` s požadavkem `2026-11-01..2026-12-31` vrátí pouze `2026-11-01..2026-11-29` (dostupné časové okno), nutno ověřit, zda má vždy výrazný caveat o zkrácení.
- `get_anomalies(year=2099)` generuje URL pro měsíc mimo rozsah aplikace, přestože vrací `out_of_coverage`. Kosmetické/ergonomické.
- `web/src/main.ts::downloadCsv` při neúspěchu `fetch` vyhazuje výjimku bez lokálního `try/catch`; selhání samotného browser downloadu nebylo reprodukováno.
- Regresní test UI pro chybné kombinace `series + anomalies`, region/země při rychlém přepínání, mobilní ovládání a čtečku obrazovky není vyhodnocen skutečným browserem.

### 6. IMPROVEMENT IDEAS

Oddělit v datovém kontraktu `value_series`, `anomaly_series`, `anomaly_baseline_series`, `value_source`, `window` a nejistotu; vracet top-level *warnings* pro případy `relative`, `backcast`, `low counts`, `outage`, `unharmonized live`; v každém tool output uvést jednoznačný „safe-to-compare“ příznak namísto nutnosti dedukce z caveats. Speciálně u agregace dokumentovat výběr společné škály a význam každého `anomaly_months`.

### 7. Odkazy na reprodukovatelný kód

- [`web/api/mcp.ts`](https://github.com/MetrPikeska/burning-calendar/blob/b09212a410a22e50edc9271efcdd86e0503ad763/web/api/mcp.ts) — schémata, validace argumentů, obalení výsledků.
- [`web/api/_lib/tools.ts`](https://github.com/MetrPikeska/burning-calendar/blob/b09212a410a22e50edc9271efcdd86e0503ad763/web/api/_lib/tools.ts) — agregace, calendar, regionální výpočty, caveats.
- [`pipeline/harmonize.py`](https://github.com/MetrPikeska/burning-calendar/blob/b09212a410a22e50edc9271efcdd86e0503ad763/pipeline/harmonize.py) — `src`, `harm` a relative mode.
- [`pipeline/validate.py`](https://github.com/MetrPikeska/burning-calendar/blob/b09212a410a22e50edc9271efcdd86e0503ad763/pipeline/validate.py) — LOYO, time split, *mean* errors.
- [`web/api/_lib/live/firms.ts`](https://github.com/MetrPikeska/burning-calendar/blob/b09212a410a22e50edc9271efcdd86e0503ad763/web/api/_lib/live/firms.ts) — NOAA-20 only comparison, NRT caveat.
- [`web/api/_lib/live/stations.ts`](https://github.com/MetrPikeska/burning-calendar/blob/b09212a410a22e50edc9271efcdd86e0503ad763/web/api/_lib/live/stations.ts) — `model_fields` vs measured station days.

**Reprodukční upozornění:** odpovědi živých nástrojů obsahují `fetched_at` a mohou se měnit během dne. Uvedené numerické výsledky jsou skutečný snapshot z 14. 11. 2026, nikoli příslib neměnnosti produkčních dat.

<!-- SCIENTIFIC_REVIEW.md -->

## Burning Calendar — vědecký red-team review harmonizace MODIS–VIIRS

**Auditní verze:** 14. 11. 2026, commit `b09212a410a22e50edc9271efcdd86e0503ad763`.  
**Účel:** prověřit obhajitelnost metody, její interpretaci, validaci, nejistotu a limity. Čísla pocházejí z konkrétních živých odpovědí MCP a zdrojového kódu, pokud není uvedeno jinak. Originální přibližně stovky MB FIRMS dat nebyly v tomto běhu znovu staženy; nejde tedy o úplně nezávislou reprodukci celé pipeline od satelitních bodů.

### 1. Co přesně projekt harmonizuje

Harmonizace zde **neznamená odstranění rozdílů jednotlivých senzorových pixelů**, ale statistické převedení *měsíčních počtů detekcí aktivního ohně* do referenční početní stupnice **VIIRS S-NPP 375 m**.

- `pipeline/load.py`: FIRMS MODIS C6.1 (Terra, Aqua) + VIIRS S-NPP; typ `type == 0` (vegetation fire) tam, kde je dostupný. Data od listopadu 2000 do října 2026, v posledním úseku 2026 NRT/provisional.
- `pipeline/filters.py`: zahazuje detekce v buňce **0,01°**, pokud tam pro daný senzor/rok proběhly detekce na **16 či více různých dnů**. Jde o heuristický filtr statických zdrojů, ne spolehlivou klasifikaci původu požáru.
- `pipeline/regions.py`: počty přiřazuje do GISCO NUTS 2024 (Řecko) či IGN provincií (Argentina) pomocí `within`, případně nearest do 5 km; vstupní pozice nejprve deduplikuje na cca 0,001° grid. Pro hustoty používá plošný výpočet v EPSG:6933.
- `pipeline/harmonize.py`: pro každý region × kalendářní měsíc × day/night kalibruje faktor

  \[
  F_{r,m,d}=\frac{\sum_{y\in 2012\ldots2019} V_{r,y,m,d}}{\sum_{y\in 2012\ldots2019} M_{r,y,m,d}}
  \]

  kde `V` je detekce VIIRS a `M` MODIS Terra+Aqua. Podmínka přijetí vrstvy je alespoň **30 MODIS detekcí za fit okno a průměr alespoň 5 za rok**. Hierarchie fallback: `region_month_dn` → `region_season_dn` → `region_dn` → `national_dn`. Pozor, *5 per year* je v kódu podmínka na **průměr `den_total / n_years`**, nikoli na každý rok zvlášť.
- Výstup: pro měsíce **únor 2012 a pozdější** `harm = observed VIIRS`; pro měsíc před tím

  \[
  \widehat V_{r,t}=\sum_{d\in\{D,N\}} F_{r,m(t),d}\,M_{r,t,d}.
  \]

  Pro Terra-only období **2000-11 až 2002-06** navíc násobí historický Terra počet koeficientem `G=(Terra+Aqua)/Terra` odhadnutým z let **2003–2011**. Leden 2012 zůstává zpětně modelovaný, protože VIIRS S-NPP začíná až 20. ledna, tedy měsíc není kompletní.
- `relative` region se do VIIRS stupnice **nepřevádí**; prezentuje surové MODIS a separátní VIIRS. Takový fallback je obhajitelný, pokud je jasně a důsledně rozlišen v API, grafu, exportu i AI odpovědi.

#### Technicky přínosné

Zvolená reference VIIRS pro kontinuální historii je logická; kalibrace day/night a měsíc a národní fallback jsou lepší než jediný globální násobitel. Zřetelné přepnutí do `relative` při neúspěšné validaci a vysvětlení NRT limitů je výhodou proti jednoduchému slepení dvou satelitních řad.

#### Podstatné nevýhody multiplikativního modelu

1. **MODIS=0 nutí predikci VIIRS=0.** Ani vysoký koeficient nevygeneruje detekce, které nízkorozlišující MODIS neviděl. Přímo v pozorovaných datech `EL52,2024-05` existuje **0 MODIS vs 13 VIIRS**. Při hypotetickém backcastu stejné situace by model řekl nula, včetně intervalu 0–0. To je strukturální problém zejména v nízkopočetných a zemědělských regionech; není to chyba konkrétního MCP výpočtu.
2. **Faktory jsou časově konstantní** pro měsíc a den/noc; nemusí zachytit změnu zemědělských praktik, land-cover, aerosolu/oblačnosti, požárního režimu, velikosti požárů a instrumentální drifty.
3. **Poměr měsíčních součtů neřeší individuální detekční pravděpodobnost.** MODIS a VIIRS nemusí pozorovat stejná místa ve stejných časech, day/night rozpad nestačí zaručit ekvivalenci.
4. **Fallback na národní faktor** může potlačit regionální typ požárů, zejména u ostrovů či nízkých četností. Závažnost chyby závisí na četnosti použití jednotlivých fit levels a měla by se publikovat jako mapa/žebříček kvality.
5. **Statické zdroje a zemědělská vypalování** se mohou překrývat v opakovaně aktivních buňkách; 16-denní filtr v 0,01° buňce může vyhodit skutečné opakované požáry. Je třeba citlivostní analýza, nikoli prezentace filtru jako bezchybného odlišení flarů a vegetation burning.

### 2. Validace — co výsledky dokládají a co ne

`pipeline/validate.py` provádí:

1. **LOYO 2012–2019**: každý rok vynechat, přeučit poměry na ostatních sedmi letech, předpovědět z MODIS a porovnat se skutečným VIIRS (`2012` jen únor–prosinec). To je lepší než in-sample `R²`.
2. **Time split 2020–2025**: kalibrovat na 2012–2019, testovat mimo fit. To je metodicky důležité kvůli změně drah MODIS, době měření a změnám režimů.
3. **Sezónní metriky**: peak-month hit rate versus raw MODIS, onset/end/length errors.
4. **Sensitivity to fit window**: rozdíl backcastu 2000–2011 při fitu 2012–2019 proti fitu 2012–2025.

#### Výběr čísel z `get_validation` (produkční snapshot)

| Region | LOYO annual MdAPE | Time-split annual MdAPE | Výrazné roční testovací chyby | Interpretace |
|---|---:|---:|---|---|
| Greece (`GR`) | **5,4 %** | **7,1 %** | 2023 **+22,9 %**, 2025 **+17,9 %** | Národní agregát je relativně stabilní, část roků má významný bias |
| Argentina (`AR`) | **1,5 %** | **6,7 %** | 2022 **−14,8 %**, 2024 **+9,9 %** | Velký agregát vyhlazuje regionální extrémy |
| Central Macedonia (`EL52`) | **4,0 %** | **11,8 %** | 2023 **−27,4 %**, 2025 **+18,5 %** | LOYO samo podhodnocuje některé pozdější chyby |
| South Aegean (`EL42`) | **25,0 %** | **22,8 %** | 2022 **−62,0 %**, 2025 **−77,7 %** | **Harmonized** režim je zde na hraně obhajitelnosti |
| Epirus (`EL54`) | **24,2 %** | **31,9 %** | 2020 **+61,2 %**, 2023 **+80,4 %** | **Harmonized** status může falešně uklidnit |
| Ionian Islands (`EL62`) | **32,0 %** | **40,5 %** | 2022 **−84,3 %** | Správně vyřazen do `relative` |
| Corrientes (`18`, AR) | **7,2 %** | **4,7 %** | 2024 **+25,8 %** | Silný průměr nemusí znamenat malou chybu ve všech letech |
| Tierra del Fuego (`94`, AR) | **62,1 %** | **60,1 %** | 2023 **−100 %** | Správně v `relative` |

**Matematická kontrola z údajů serveru:** LOYO annual signed errors EL52: `[-4.4, +1.6, -5.4, -17.5, +17.8, -1.6, -3.6, +2.4] %`. Medián jejich absolutních hodnot je `(3.6+4.4)/2 = 4.0 %`, shodný s API. Time-split EL52 `[+6.8,-5.1,-16.8,-27.4,-5.7,+18.5] %` dává medián absolutních `(6.8+16.8)/2 = 11.8 %`, rovněž souhlas. Toto potvrzuje aritmetiku *z publikovaných ročních chyb*, **ne** úplnou nezávislou reprodukci z původních satelitních pozorování.

#### Nedostatečně doložená úspěšnost

- V řeckém agregátu LOYO peak hit rate harmonizace **6/7 = 85,7 %** oproti raw MODIS **4/7 = 57,1 %**. To je relevantní zlepšení. V `EL52` je ale harmonizace **6/7 vs raw 6/7**, tedy **žádný** peak benefit; onset mean error harmonizace **1,29 měsíce** oproti raw **1,14**, tedy zhoršení.
- Regionální `relative` mode se odvozuje z LOYO ročního MdAPE >25 % nebo peak hit o více než 1 season year horší než raw. **Práh 25 % a tolerance 1 sezóny nemají zcela nezávislé předem definované zdůvodnění** a v dokumentaci bylo rozhodnutí/tolerance změněno 14. listopadu po znalosti výsledků. Není to automaticky neplatné, ale hrozí *post-hoc decision bias*. Pro hackathon to otevřeně přiznat, nepovažovat LOYO za nestranné skóre finálního rozhodovacího pravidla.
- `pipeline/build.py::build_region` získává `start = raw_start_month(m)` z celé historie MODIS do 2025 a předává jej validaci. Definice sezóny proto používá i data z vynechaných/testovaných roků. Neovlivní přímo výpočet měsíčního backcastu, ale může způsobit **slabý temporální únik informací do sezónních validačních metrik**. Pro striktní test sezonního prediktoru se start sezóny musí určovat pouze na tréninku pro daný fold.
- Měsíční korelace (`r`) na silně sezónních řadách může vypadat vysoká i při chybné velikosti špiček. Dodat skill score proti raw MODIS, RMSE/MAE měsíčně, chyby malých hodnot, coverage intervalů a per-region tabulky.
- **Potvrzený metadata bug BC-004:** `onset_mad_months`, `end_mad_months`, `length_mad_months` se ve zdrojovém kódu počítají jako `np.mean(abs errors)`, ale MCP jednotky je popisují jako *median absolute difference*. Číslo `1.29` při 7 sezonách není medián celočíselných absolutních měsíčních chyb.

### 3. Intervaly nejistoty — důležitější než grafická estetika

`pipeline/validate.py::band` počítá z LOYO řádků `r=observed/predicted` pouze pro `pred > 0`; pro každý měsíc použije 10. a 90. percentil koeficientů ze **stejného meteorologického ročního období**. `pipeline/harmonize.py::series` pak uvádí `harm_lo=model*q_lo`, `harm_hi=model*q_hi`.

Pro `GR`, srpen **2007** model vrací **11 943,1** s rozsahem **8 730,4–15 382,7** (metoda je v odpovědi popsaná). Tento rozsah **nemá prokázané 80% predikční pokrytí**: nejsou předloženy validační míry out-of-sample coverage, liší se regiony, chyby nejsou nezávislé, průměrná sezóna může maskovat měsíc s extrémním požárem, historické roky mohou být mimo distribuci 2012–2019 a predikce `0` má uměle nulovou šířku. Skutečnost, že jde o percentily reziduí, sama o sobě negarantuje správně kalibrované predikční intervaly.

**Nutný experiment:** pro každý LOYO holdout měsíc znovu fitnout koeficienty i interval bez holdout roku; zhodnotit empirical coverage, width, calibration by count decile, day/night, fit level, region, a zvlášť případ `MODIS=0` a spojené období Terra-only. Kvantifikovat, zda 10–90 interval skutečně obsahuje přibližně 80 % pozorovaných VIIRS měsíčních počtů; pokud ne, nepoužívat název *80% prediction interval* a nahradit jej poctivým „empirical error band“.

### 4. Anomálie a matematická interpretace

`pipeline/calendar_metrics.py::anomalies`: srovnává každý měsíc s týmž kalendářním měsícem ze 10 předchozích let, je-li dostupno; přitom před 2012 používá *fixní baseline* 2002–2011 bez testovaného roku. Výstup `anom_pct` je percentile rank 0–100 (mid-rank při vazbách), `anom` je `x > 0` a `x > p90`.

- **EL52 2024-05:** `harm=13`, `baseline_median=8`, `baseline_p90=12.1`, `anom_pct=95`, `anom=true`. Jde o slabý absolutní důkaz vysoké *spalovací* aktivity: 13 je malý počet satelitních bodů a může reprezentovat jedno přelétávající pozorování opakovaného ohně, nikoli rozsáhlý lesní požár. Server uvádí caveat `small_counts` — vhodné rozšířit do samotného výsledkového labelu.
- **Řecko 2007-08:** `harm=11943.1`, `median=781.2`, `p90=2107.8`, flag vysoké odchylky. Jde o historický backcast a fixní baseline zahrnující další roky 2008–2011, nikoli detekci v čase srpna 2007.
- U řad s častými nulami a deseti baseline roky je p90 velmi hrubé a výsledek citlivý na jedinou mimořádnou sezónu. Chybí hierarchické smršťování nulových regionů či přímé zahrnutí modelové nejistoty do rozhodnutí, zda je rok skutečně neobvyklý.
- Test 12 měsíců × desítky regionů přirozeně generuje řadu překročení prahu p90. Neoznačovat každý flag jako katastrofu; pracovat s absolutní magnitudou, dobou trvání, observability, outage a účelem použití.
- **BC-001 a BC-002:** příznaky anomálií harmonizované řady se nezmění při zobrazení/aggregaci do `modis` stupnice. Toto je již potvrzená interpretativní chyba, nikoliv hypotéza.

**Doporučení:** rozlišit `statistical_high_activity` od `operational_fire_alert`. Publikovat zvlášť `observed_count`, `expected/median`, `p90`, `confidence`, `small_counts`, `outage`, `series` a zobrazenou barevnou kategorii; u dlouhodobé retrospektivní baseline výslovně uvést použití budoucích let.

### 5. Spatial validity a geografická srovnatelnost

- Řecká NUTS2 GISCO 2024, měřítko **1:1M** pro přiřazení, web zjednodušen **1:20M**; argentinské IGN provincie se zjednodušují a jsou oříznuté na přibližně −56° zeměpisné šířky. Změny hranic nejsou historicky verzované — pro starší roky jde o agregaci do *současné* územní soustavy.
- `pipeline/regions.py` zaokrouhluje detekční souřadnice na **0,001°**, pak `within`, potom nearest polygon do **5 km**. Přibližná velikost gridu se liší se zeměpisnou šířkou, nelze ji prezentovat jako univerzálních 100 m. Přiřazení body-on-boundary a ostrovní/pevninské hranice může být citlivé na pořadí výběru nearest při shodné vzdálenosti.
- `get_validation GR` uvádí **124 454 přiřazených** a **240 nepřiřazených** detekcí. Počet za Řecko tedy nemusí přesně rovnat součtu všech NUTS2, pokud národní série zahrnuje i mimoregionální detekce. Rozdíl musí být popsán; k ověření vyžaduje přesný výpočet nad daty.
- `find_region_at(37.75,23.8)` v moři vrací `found=false`, ale `nearest=EL30` ve vzdálenosti 3,54 km; to neznamená, že se každé živé pozorování v moři správně připojuje ke stejné oblasti.
- `density_per_1000km2` je vhodnější než holý počet při mezinárodním srovnání, avšak stále nereflektuje *plošný podíl hořlavé vegetace, zemědělské kultury, oblačnost, revisit a pozorovací geometrii*. Není to wildfire danger index.

### 6. Senzorové výpadky a NRT

`data/outages.csv` aktuálně dokumentuje mezery Terra, Aqua i S-NPP (včetně července 2026 a starších období). Kód `pipeline/build.py` zvýrazňuje měsíc s alespoň 3 výpadkovými dny, ale **neimputuje chybějící detekce**; výsledný nižší počet může být pozorovací artefakt. Při analýze anomálií mimořádně záleží, zda měly porovnávané roky podobné pokrytí.

Z běžících nástrojů:

- `get_recent_detections`: NASA FIRMS **NOAA-20, NOAA-21 a MODIS NRT**. Zdroje nejsou filtrovány stejně jako historická měsíční S-NPP řada; k historii se pro poměr používá **NOAA-20** s caveat `nrt_not_harmonized`. Tento poměr je pouze orientační a nesmí být interpretován jako přesný realtime fire anomaly statistic.
- `get_fire_alerts`: **GDACS/GWIS** a **Copernicus EMS Rapid Mapping**; nálezy jsou event/activation evidence, nikoli úplný výpis všech lokálních vegetačních ohňů. Řecko v testu 14 dnů 0 událostí ≠ nula ohňů. Argentina v jednodenním snapshotu 1 aktivní GDACS event (Formosa).
- `get_fire_weather`: **Open-Meteo reanalýza a forecast v reprezentativním grid bodu**, ne přímé měření za celý region a ne certifikovaný **Canadian FWI**. Také modelu nelze připsat fyzikální příčinu konkrétního ohně bez dalších informací.
- `get_weather_stations`: Meteostat, skutečné pozorování a modelově doplněná pole správně oddělena `model_fields`, ale AI agent má interpretovat tyto metadata. `last_measured_date` může být o řadu dnů starší než nejnovější vrácená data.
- Licenční/provenienční metadata jsou přítomna. U Copernicus dashboard API je v odpovědi licence explicitně označená **UNVERIFIED**; povolení konkrétního způsobu přístupu, podmínky cache a attribution by měly být ověřeny primárními podmínkami služby, ne pouze obecnou Copernicus data policy.

### 7. O čem se smí a nesmí mluvit

| Termín | Co projekt fakticky poskytuje | Čemu se vyhnout |
|---|---|---|
| `active fire detections` | body/pixely detekované satelitním algoritmem | „počet jednotlivých lesních požárů“ |
| `burning activity` | historická četnost detekcí v regionu | celkové spálené hektary či intenzita škod |
| `harm` | po 2012 VIIRS S-NPP count; před 2012 modelovaný ekvivalent | „pozorování VIIRS v roce 2007“ |
| `anomaly` | překročení historického percentilu detekcí | automaticky havárie, evakuace, pravděpodobnost požáru |
| `FRP (MW)` | radiativní výkon jednotlivých detekcí | spálená plocha, severity nebo předpověď |
| `fire weather` | meteorologický kontext odvozený z modelu | validovaný fire-danger/FWI bez výpočtu indexu |
| `live alerts` | události vrácené třetími stranami | výčet všech požárů na daném území |

**Manažer krizového řízení by neměl činit rozhodnutí o evakuaci ani zásahu na základě samotné agregované anomálie či NRT-to-historical ratio.** Projekt je vhodný pro explorativní historický kontext, nikoliv ověřený operativní incident command system.

### 8. Nejdůležitější vědecké důkazní experimenty před submission

1. **Coverage calibration:** nested LOYO s per-region a per-count coverage `harm_lo..harm_hi` včetně nulových měsíců.
2. **Ablace modelu:** raw MODIS baseline; jediný globální factor; region-only; region×month; region×month×daynight; alternativa s interceptem/zero-aware modelem. Porovnat *out-of-sample* ve stejné validaci a shrnout přínos každé složky.
3. **Striktní backtesting:** sezónní start a všechna rozhodovací pravidla z train-only, nestranně vyhodnotit mód `relative` mimo data, na kterých se práh ladil.
4. **Robustness:** měnit kalibrační okna 2012–17, 2012–19, 2014–19; zkoušet filtry 8/16/24 dní; lokální `G` pro Terra; zobrazení intervalů pro slabé regiony.
5. **Temporal observation coverage:** maska nejistých měsíců, pokrytí Terra/Aqua/S-NPP a korekce/necitelnost výpadků; samostatné výsledky NRT 2026.
6. **Spatial audit:** kontrolní ručně vybrané pobřežní body, islands, bbox transformace a conservation of totals mezi národní a subregionální úrovní, explicitně vyčíslit unassigned.
7. **Interpretation tests:** 13 VIIRS/0 MODIS, nuly v baseline, fixní backcast p90, rozdílné season windows a srovnání NOAA-20/S-NPP. Výsledky propsat přímo do MCP instrukcí.

### 9. Závěr vědeckého oponenta

**Model je vysvětlitelný, validace má dobrý základ a konzistentní údaje na státní úrovni. To ovšem nedokazuje, že je historie ve všech regionech věrná.** Za nejslabší body považuji nulový průnik MODIS/VIIRS (zero-input structural failure), nekalibrované intervaly, selekční pravidlo `relative` bez externí validace, extrémní chyby u části *harmonized* regionů a významové míchání anomálií při změně série. Před posouzením náročnou komisí doporučuji explicitně ukázat, **kde model selhává**, nikoli prezentovat pouze agregátní průměr.

#### Primární soubory a evidence

- [`pipeline/harmonize.py`](https://github.com/MetrPikeska/burning-calendar/blob/b09212a410a22e50edc9271efcdd86e0503ad763/pipeline/harmonize.py) — fit, fallback, forward model, backcast, `src`.
- [`pipeline/validate.py`](https://github.com/MetrPikeska/burning-calendar/blob/b09212a410a22e50edc9271efcdd86e0503ad763/pipeline/validate.py) — LOYO, time split, band, trend, mode rule.
- [`pipeline/calendar_metrics.py`](https://github.com/MetrPikeska/burning-calendar/blob/b09212a410a22e50edc9271efcdd86e0503ad763/pipeline/calendar_metrics.py) — anomálie/percentily/sezóny.
- [`pipeline/regions.py`](https://github.com/MetrPikeska/burning-calendar/blob/b09212a410a22e50edc9271efcdd86e0503ad763/pipeline/regions.py), [`pipeline/filters.py`](https://github.com/MetrPikeska/burning-calendar/blob/b09212a410a22e50edc9271efcdd86e0503ad763/pipeline/filters.py), [`data/outages.csv`](https://github.com/MetrPikeska/burning-calendar/blob/b09212a410a22e50edc9271efcdd86e0503ad763/data/outages.csv).
- [`web/api/_lib/live/firms.ts`](https://github.com/MetrPikeska/burning-calendar/blob/b09212a410a22e50edc9271efcdd86e0503ad763/web/api/_lib/live/firms.ts) a [`web/api/_lib/live/stations.ts`](https://github.com/MetrPikeska/burning-calendar/blob/b09212a410a22e50edc9271efcdd86e0503ad763/web/api/_lib/live/stations.ts).
- Živá MCP výstupní evidence: `get_validation` pro GR, AR, EL52, EL42, EL54, EL62, AR-18, AR-94; `get_region_series` GR 2007-08 / EL52 2024 / EL62 2007; `get_anomalies`, `get_recent_detections`, `get_fire_weather`, `get_weather_stations` a `get_fire_alerts`, 14. 11. 2026.

<!-- ROADMAP_TO_10.md -->

## Burning Calendar — Roadmap to 10/10

**Datum:** 14. 11. 2026 · **Baseline auditu:** 6,8/10 (vlastní vážené hodnocení; ne oficiální NASA skóre) · **Repo:** commit `b09212a`.

**Zásada:** deset bodů není možné garantovat doplněním libovolného počtu funkcí. Větší dopad má korektní interpretace, doložená statistická validace a jasná demonstrace hlavního zadání. Doporučení jsou návrhy pro vývojový tým; **během auditu nebyl žádný kód změněn**.

### Priority a složitost

**Složitost:** S = menší izolovaná změna, M = více souborů + regresní testy, L = změna pipeline/dat a vědecká revalidace. Jde o relativní náročnost, nikoli slib časového dokončení.

| Priorita | Úkol | Složitost | Přínos pro vědu a soutěž | Důkaz dokončení |
|---|---|---|---|---|
| **P0-01** | **Sjednotit stupnici zobrazené řady a anomálií (BC-001)**: `show_calendar(series=modis)` nesmí zobrazit VIIRS-derived `anom` jako MODIS anomálii, opravit `unit` | **M** | **Velmi vysoký**: předejde zavádějícímu závěru AI při `v=0, anom=true` | Test EL52 2024-05, výslovné `anomaly_series` a správná jednotka widgetu/API |
| **P0-02** | **Opravit smíšenou agregaci (BC-002)**: při fallbacku na raw MODIS přepočítat anomálie, nebo je potlačit | **S–M** | **Velmi vysoký**: koherentní analytický kontrakt mezi regiony | Test EL52+EL62 2024: součet MODIS 209, žádná chybně popsaná harmonizovaná anomálie |
| **P0-03** | **Oddělit původ `modis` a `harm` (BC-003)**: `src=backcast` nesmí označovat pozorovanou MODIS hodnotu | **M** | **Vysoký**: vědecká transparentnost, důvěra v data | EL62 2007-07 `modis=81` vždy explicitně observed raw MODIS |
| **P0-04** | **Opravit `*_mad_months` (BC-004)**: zvolit a správně pojmenovat mean vs median, aktualizovat jednotky i dokumentaci | **S** | **Vysoký**: zamezí přímo prokazatelnému nesouladu vědeckého popisu s výpočtem | Fixture `[0,0,6]` → mean 2, median 0; žádné chybně zaměnitelné metadata |
| **P0-05** | **Validovat skutečná kalendářní data (BC-005)** napříč live endpointy | **S** | **Střední**: robustní MCP pro AI agenty | `2026-02-30`, `2025-02-29` rejected; `2024-02-29` accepted |
| **P0-06** | **Viditelná regionální quality warning** na `harmonized` regionech s velkými holdout chybami | **M** | **Velmi vysoký**: vědecké tvrzení nepopírá slabá místa (`EL42`, `EL54`) | V UI i MCP zobrazeno time-split error, nejhorší rok, fit level, omezení mode threshold |
| **P0-07** | **Ověřit přímo submission demo**: web/mobile, exporty, uživatelský scénář, čitelnost tooltipů, přesná tvrzení | **M** | **Velmi vysoký**: hodnotitel musí bez studia README pochopit MODIS vs VIIRS, backcast a nejistotu | Projít scénář u Thessaloniki z čistého prohlížeče; zveřejnit checklist výsledků a screen recording |
| **P0-08** | **Jeden nezpochybnitelný vědecký důkaz** na slide/demo: raw vs harm vs observed VIIRS na holdout datech | **M** | **Velmi vysoký**: prokazuje přínos oproti běžnému kalendáři | Viditelná jednoduchá tabulka a graf out-of-sample zlepšení **i zhoršení**; reprodukovatelný skript |
| **P1-01** | **Kalibrovat nejistotu a otestovat coverage** (nested LOYO, zero-count, per-region) | **L** | **Vysoký**: kritická vědecká slabina | Graf empirical coverage vs interval width; poctivě pojmenovaný interval, žádná bezdůvodná 80% garance |
| **P1-02** | **Ablace a robustní baseline**: global factor, region-only, region×month×day/night, zero-aware/intercept model | **L** | **Vysoký**: oddělí skutečnou inovaci od složitosti bez efektu | Matice out-of-sample annual/monthly error a peak hits se stejnými folds |
| **P1-03** | **Striktní backtesting výběru regionálního módu** a sezonního začátku z train-only | **L** | **Vysoký**: snižuje post-hoc/temporal bias | Vnější held-out blok pro mode selection, start_month odvozen jen na train |
| **P1-04** | **Kontrola výpadků a nulových pozorování**; správně mapovat NO_DATA vs zero detections | **M–L** | **Vysoký**: potlačí falešné trendy/anomálie | Matice měsíc×senzor dostupnosti, sensitivity test s vynechanými outage měsíci |
| **P1-05** | **Spatial QA a národní reconciliation**: pobřeží, ostrovy, hranice, cca 0,001° grid, nearest 5 km | **M–L** | **Střední až vysoký**: konzistence prostorové analýzy | Test body-on-boundary, 5-km nearest, pole `assigned/unassigned`, explicitní vysvětlení rozdílu národní/region sumy |
| **P1-06** | **Zvýraznit `NRT not harmonized`** a stav observability, doplnit volitelný `quality/safe_to_compare` API field | **M** | **Vysoký**: snižuje AI hallucinations a chybný operational warning | Chat otázka „je dnes 2× víc požárů?“ musí odmítnout přesný historický poměr bez kalibrace |
| **P1-07** | **Data provenance audit**: úplné FIRMS input verze, checksumy, licence, explicitní standard vs provisional NRT | **M** | **Vysoký**: reprodukovatelnost a soutěžní důvěryhodnost | Rebuild manifest s daty, SHA, DOI/zdroj, daty stažení a licencí |
| **P1-08** | **Uživatelsky definovaná polygon AOI** nebo import GeoJSON, pokud to odpovídá konkrétní interpretaci zadání | **L** | **Střední až vysoký**: potenciálně posiluje challenge compliance | Uživatel vybere polygon, získá časový kalendář, statistiky a export bez nahodilého přeškálování |
| **P2-01** | **Očistit metainformace**: konfliktní country vs region, mimo-coverage view URL, výslovné zprávy o zkrácení live intervalu | **S–M** | **Střední**: ergonomie API a agentů | Kontraktační testy přes všech 16 tools |
| **P2-02** | **Přístupnost/ovládání**: WCAG kontrast, klávesnice mapy, screen reader pro heat strip, telefon/tablet | **M** | **Střední**: širší použitelnost, porotce na mobilu | Playwright/axe a záznam na telefonním viewportu |
| **P2-03** | **Offline/no-network UX**: retry, error states, rozumný loading a export fallback | **S–M** | **Střední**: lepší demo spolehlivost | E2E s blokovaným OpenFreeMap, Open-Meteo a stažením CSV |
| **P2-04** | **Zjednodušit soutěžní narativ**: problém → kalibrace → validační důkaz → mapa/kalendář → limitace → reálný příklad | **S** | **Vysoký pro prezentaci, bez nové vědy** | Jedna přehledná story a odpovědi na očekávané metodické otázky |

### P0 — doporučené pořadí realizace

Nejdřív odstranit **BC-001/002**, protože špatně interpretuje hlavní výstup i pro AI, která čte naprosto správně validní JSON. Následně **BC-003/004/005** jako přesnost datového kontraktu a vstupů. Potom **P0-06**: prezentovat problémové regiony bez zastírání, ideálně *„validated with limitations“* a nejhorší roční chybu, místo jednoslovného `harmonized`.

Jako další krok zaměřit demo na jednu jasnou aplikaci: „Kdy bývá ve střední Makedonii nejvíc satelitních detekcí, jak neobvyklý byl srpen 2024, co to neznamená a co z historie můžeme exportovat?“ Ověřená data: `EL52,2024-08` má **208 detekcí** oproti baseline median **19**, **p90=33,9** (10,9× medián); byly detekovány v **18 dnech**, ale neplyne z toho počet samostatných požárů ani odhad spálené plochy. Tento příklad je interpretativně silnější než anonymní počet funkcí.

### Vědecké testy, které přinesou nejvíce bodů

**1) Falsifikace vlastního modelu.** Vyberte `EL42`, `EL54`, `EL62` a několik robustních regionů; ukažte, kde je ratio model slabý, kde se vyplatí fallback a kde 2020–2025 drift znamená selhání. Demonstrace realistického omezení zvyšuje důvěru.

**2) Kontra-příklad pro nuly.** `EL52,2024-05`: MODIS 0, VIIRS 13. Vysvětlete, proč poměrový model bez interceptu tuto situaci nemůže historicky rekonstruovat. Otestujte `VIIRS ~ α + β MODIS` (s omezením nezápornosti) nebo zero-aware alternativu; zachovat jen pokud zlepší holdout výsledky.

**3) Intervaly se skutečně známým pokrytím.** Publikovat samostatně pokrytí 10.–90. odhadového pásma, zvlášť malopočetné regiony a extrémy. Bez toho byste měli používat „model error band“, nikoliv pravděpodobnostní predikční záruku.

**4) Základní konzervativní baseline.** Přímá raw MODIS řada, konstantní koeficient a region×month×day/night model ve stejném splitu. Pokud složitější model nepřináší benefit pro region, netvrdit opak. Doložený rozdíl je soutěžní inovací; samotný počet factor levels ne.

### Soutěžní strategie: co přidat, co nepřidávat

- **Přidat:** 1 vědecký holdout graf, 1 čitelný příklad s nejistotou, 1 regionální quality flag, návod „jak se čísla nesmějí číst“, krátký záznam funkčního MCP agent workflow.
- **Nepřidávat před P0 fixy:** další dashboardy, predikce šíření požárů, tvrzení o fire danger z modelového počasí bez validace, „AI wildfire predictor“ nebo narychlo složené škály NOAA-20 a S-NPP. Tím by vzrostla složitost i riziko bez řešení původního zadání.
- **AOI polygon:** velmi zajímavé, ale pokud zbyde kapacita až po vědecké kontrole, a pokud potvrzené znění zadání vyžaduje víc než výběr správního regionu. Nezaměňovat volitelnou komplexitu za povinný základ.

### Definition of Done pro hodnocení blízko 10/10

- **Věda:** každé zveřejněné tvrzení o časové srovnatelnosti má regionální out-of-sample výsledky, jasnou definici stupnice, validaci intervalu a caveat pro nízké četnosti, outagy, historické baseline a NRT.
- **MCP:** všech 16 tools má schéma, validní/invalid/boundary fixture; proměnné `series`, `unit`, `anomaly_series`, `source` se nemohou dostat do protichůdného stavu. Jediný kritický false-positive/false-label case blokuje release.
- **Mapa a kalendář:** zvolená série odpovídá hodnotám i legendě, anomálie mají korektní baseline; časové intervaly a backcast rozlišené; export odpovídá zobrazení; mobil i keyboard prošly skutečným testem.
- **Provenience:** metodická verze, datum zdrojů, data stáhnutí, filtrování a licence jsou dohledatelné a rebuildovatelný experiment vede ke stejné validaci.
- **Prezentace:** hodnotitel během krátkého průchodu rozumí problému satelitní diskontinuity, ví proč je backcast nutný, vidí kde model vyhrává a kde selhává, a bez tlaku mu nikdo nepodsouvá detekce jako požáry.

**Poznámka ke skóre:** požadovaných „10/10“ není predikovatelná vlastnost implementace, ale strop vlastního hodnoticího rámce. P0 opravy a P1 důkazy jsou podmínky pro podstatné zlepšení; nové hodnocení má následovat až po nezávislém re-testu.

#### Související reporty

- [`EXECUTIVE_REVIEW.md`](./EXECUTIVE_REVIEW.md) — skóre, rozhodující nálezy a rozsah verifikace.
- [`MCP_TEST_REPORT.md`](./MCP_TEST_REPORT.md) — všech 16 nástrojů, přesné reprodukce BC-001 až BC-005.
- [`SCIENTIFIC_REVIEW.md`](./SCIENTIFIC_REVIEW.md) — metodika, validační chyby, nejistota a regionální limity.
