# Faktory (sucho, teplota, vítr) a prediktivní model: návrh

Stav: návrh, rozhodnutí neučiněno (14. 11. 2026). Čísla o zdrojích dat jsou ze shrnutí vyhledávání a z katalogových stránek, ne z naší práce s daty. Co není ověřeno z primární stránky, je označeno `UNVERIFIED`.

Souvisí s: `docs/notes/2026-11-14-feedback-early-warning-research.md` (požadavek na sucho, vítr, vlhkost a lag), [harmonization.md](../wiki/harmonization.md), [calendar-and-anomalies.md](../wiki/calendar-and-anomalies.md), [decisions.md](../wiki/decisions.md).

## Otázka 1: dá se ke každému požáru dohledat stav faktorů?

Ano pro počasí, sucho a vegetaci. Ne pro příčinu zapálení.

- **Počasí a sucho jsou souvislé mřížky.** Ke každé buňce a dni existuje hodnota, takže spojení je prostorově-časový join přes (buňka, datum) se zpožděnými okny (například 7, 14, 30 a 90 dní před detekcí). Pro 2000-2025 je to levné a opakovatelné.
- **Co se nedá zjistit:** kdo a proč zapálil, zda šlo o pálení strniště nebo o zapálení člověkem. Hotspot to neříká. Odhad typu z CORINE a sezóny už ve wiki je (greece.md) a není validovaný po jednotlivých požárech.

## Zdroje dat (všechno je veřejné, ale přístup přes účet a API klíč Copernicus CDS)

| Zdroj | Veličiny | Rozlišení | Pokrytí | Poznámka |
|---|---|---|---|---|
| [CEMS fire danger indices, historical](https://ewds.climate.copernicus.eu/datasets/cems-fire-historical-v1) | FWI, FFMC, DMC, DC, ISI, BUI, indexy USA a Austrálie | 0,25°, denně | od 1940 podle katalogu CDS (starší zdroje uvádějí 1979 nebo 1980, UNVERIFIED které platí) | Počítáno z ERA5. Nejpřímější prediktor požárního počasí. |
| [ERA5-Land](https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land) | teplota, rosný bod, vítr, srážky, půdní vlhkost, vysušení | 0,1° (nativně 9 km), hodinově | od 1950 | Z něj lze odvodit vlastní indexy a vlhkost půdy. |
| [SPEIbase](https://spei.csic.es/database.html) | SPEI na různých časových škálách | 0,5°, měsíčně | od 1901, konec podle verze (v2.9.0 do 2022, novější vydání existují, UNVERIFIED které je aktuální) | Standardní index sucha, vhodný pro lag na měsíční úrovni. |
| MODIS MOD13 nebo VIIRS VI | NDVI, EVI, případně NDMI z jiných produktů | 250 m až 1 km | od 2000 | Stav vegetace, zdroj paliva. Neověřeno v této práci. |
| CORINE Land Cover, DEM, cesty a sídla | typ krajiny, sklon, vzdálenost k infrastruktuře | 100 m a jemnější | statické | CORINE už ve wiki. |

Přesné licence a podmínky použití nejsou ověřené (UNVERIFIED), pro výsledky v pitchi se musí uvést zdroj.

## Omezení, která musí návrh říkat nahlas

1. **Jednotkou je hotspot, ne požár.** Pro "každý požár" je třeba nejdřív shlukovat detekce do událostí (prostorově-časové shlukování, podobně jako GWIS). Jinak jeden velký požár vyrobí tisíce "pozorování".
2. **Rozlišení.** Reanalýzy mají 9 až 25 km, pixel má 375 m až 1 km. Faktor je kontext okolí, ne lokální měření.
3. **Negativní vzorky.** Bez buňko-dnů bez požáru vyjde jen "co požáru předcházelo". Model potřebuje obě třídy a pozor na nevyvážené třídy.
4. **Zemědělské pálení a zapálení člověkem.** Nejsou řízené počasím stejně jako přírodní požáry. Bez typu krajiny se signál rozmaže (viz Zervaki a kol. v greece.md).
5. **Souvislost není příčina.** Reportovat asociaci s kontrolou sezónnosti a trendu, ne "sucho způsobuje".
6. **Cílová veličina nese chybu.** Harmonizovaný počet má nejistotu a drift senzorů (harmonization.md). Raději binární cíl (například nad 90. percentilem) a výstup s intervalem než surové počty.
7. **Únik informace při validaci.** Blokově po letech (leave-one-year-out), stejně jako náš `pipeline/harmonize.py`, ne náhodné dělení.

## Návrh po vrstvách

1. **Vysvětlující analýza (realistická, do jednoho dne).** Pro region x měsíc: `harmonizovaný počet ~ sezónnost + trend + FWI/SPEI se zpožděním`. Výstup: zpoždění v týdnech, síla vztahu, interval. Odpovídá požadavku poroty ("testovat sucho -> detekce, ne jen vizuální srovnání") a nic nepředpovídá.
2. **Rizikový kontext v aplikaci (nice-to-have).** Vedle naší anomálie ukázat percentil FWI a SPEI pro měsíc a region, stupně normal / elevated / critical. Bez modelu, jen další statické JSON v kontraktu.
3. **Prediktivní model (po hackathonu).** Cíl: překročí příští týden daný region 90. percentil? Nebo: aspoň jeden velký požár? Rozlišení region x týden. Logistická regrese nebo gradientní boosting, benchmark klimatologie, metriky Brier a PR-AUC, skill proti klimatologii, validace leave-one-year-out, kalibrace. Nic z toho není slíbeno v pitchi.
4. **Napojení na aktuální data.** Předpovědi FWI (CEMS, EFFIS) jako vstup pro krátkodobé varování. Potřebuje NRT FIRMS (bezplatný MAP_KEY) a plánovanou úlohu, už je v TODO jako nice-to-have.

## Doporučení pro zbývající čas

- Feature freeze je v neděli 12:00. Vrstvu 3 a 4 neslibovat.
- Do pitche stačí jedna věta: "předpověď vyžaduje počasí, my ukazujeme historický rozsah a plán na lag-analýzu".
- Pokud zbude čas, vrstva 1 pro jeden region (například Řecko, jeden FWI soubor ze CDS) jako náčrt s grafem lagu. Stahování přes CDS vyžaduje účet a API klíč, který nemáme a nesmí být v repozitáři.

## Rizika

- Přístup do CDS vyžaduje registraci (osobní údaje a klíč), proto to zatím není hotové.
- Příliš silné tvrzení "sucho předpovídá požáry" při 25 letech dat a jedné zemi by neobstálo u poroty. Raději "souvislost s lagem X týdnů, interval Y".
- Rozdíl mezi počtem hotspotů a počtem požárů (greece.md, EFFIS vs hasiči) znamená, že se model neptá na stejné číslo jako oficiální statistiky.
