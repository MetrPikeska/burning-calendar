# Jak vyhrát Space Apps v Soluni (návod pro tým, 13. 11. 2026)

Fakta a zdroje: `docs/wiki/space-apps-rules.md`, `docs/wiki/past-winners.md`, `docs/wiki/sources/2026-11-13-research-how-to-win.md`.

## To nejdůležitější

- Porota hodnotí 5 kritérií, každé 1 až 5, bez vah. Presentation váží stejně jako Validity a hodnotí se z dema i ze stránky projektu.
- Hotspotová aplikace globální cenu za posledních 6 let nezískala. Fire projekty s FIRMS končily jako nominee nebo finalist. Dál se dostaly ty, které měly něco proklikatelného a vědecké zdůvodnění.
- Lokální odevzdání je v neděli v 15:00, globální okno se zavírá ve 23:59. Pitch je v 16:00, vyhlášení ve 22:00.
- Do sobotní 13:00 musí běžet jeden region od FIRMS CSV až po nasazený kalendář. Všechno ostatní na tom staví.

## Na kick-off v sobotu v 10:00 zjistit od Local Leada (Christos Letsios)

1. Který termín platí pro lokální porotu: 15:00, nebo 23:59?
2. Délka pitche a jestli jsou otázky poroty.
3. Živé demo z vlastního notebooku, nebo jen slidy? HDMI nebo USB-C? Wi-Fi?
4. Kolik projektů postupuje jako Global Nominee a jaké jsou lokální ceny.

## Kritéria a co na ně ukážeme

| Kritérium | Co porota chce | Co ukážeme |
|---|---|---|
| Impact | dosah, kolik lidí to využije | CONAE a záchranáři, Řecko a Argentina. Bez propojení senzorů se podle autorky výzvy „ztratí skoro 10 let historie“ |
| Creativity | nové, nebo smysluplné vylepšení | jeden kalendář 2000 až 2025 v jednotkách VIIRS, přepínač MODIS / VIIRS / harmonizováno. Rozdíl proti EFFIS a GWIS podle `related-tools.md` |
| Validity | vědecky podložené, funkční, použitelné | číslo chyby z leave-one-year-out, otevřeně přiznané limity (drift orbity, konec S-NPP), nasazená URL, reprodukovatelný pipeline |
| Relevance | NASA data jako jádro | FIRMS MODIS + VIIRS je celý vstup. Do pole „Space Agency Partner Data“ CONAE |
| Presentation | jasně výzva, řešení a proč na tom záleží | pitch níže, 30s video podle oficiální osnovy, podrobná stránka projektu |

Kategorie, kam míříme: Best Use of Data („makes space data accessible“), Best Use of Science, Local Impact (pálení strnišť v Thesálii, Argentina pro CONAE).

## Časový plán

Na místě se dá pracovat zhruba 16 hodin: v sobotu 10:00 až 21:00, v neděli 9:00 až 15:00.

**Sobota**
- **10:00-10:30** kick-off, otázky na Local Leada, rozdělit role. Jeden člověk vlastní data a metodu, druhý web a prezentaci. Prezentujícího určit hned.
- **10:30-13:00** svislý řez Řecka:
  - FIRMS CSV, faktor, kalendářní JSON podle `data-contract.md`,
  - heatmapa rok × měsíc,
  - deploy na Vercel.
  - **Milník 13:00:** veřejná URL s reálnými daty.
- **13:00-18:00**:
  - přepínač MODIS / VIIRS / harmonizováno,
  - výběr regionu,
  - souhrn sezóny,
  - anomálie,
  - export CSV,
  - číslo z LOYO,
  - pipeline pro Argentinu.
- **18:00-21:00**:
  - opravy,
  - koncept textů na stránku projektu,
  - README (problém, přístup, data, spuštění),
  - snímky obrazovky.
- **Večer**: žádné nové funkce. Nanejvýš nahrát první záložní průchod obrazovky.

**Neděle**
- **9:00-12:00** dotáhnout a opravit chyby.
- **12:00** feature freeze. Od té chvíle jen opravy textů a dat.
- **12:00-13:00**:
  - natočit 30s video,
  - nahrát záložní 60s průchod aplikací,
  - uložit screenshoty lokálně.
- **13:00-14:00** vyplnit stránku projektu a odeslat. Odevzdávat jde opakovaně a hodnotí se poslední uložená verze, takže první verze nejpozději ve 14:00.
- **14:00-14:30** dvakrát nahlas projet pitch s časovačem, ideálně i před někým mimo tým.
- **14:30** oběd. **15:00** finální uložení, test projektoru a Wi-Fi.
- **16:00** pitch.

## Pitch (3 až 4 minuty, upravit podle odpovědi Local Leada)

1. **0:00-0:15:** jedna věta. „A burning activity calendar that joins 25 years of MODIS and VIIRS fire hotspots into one record, for emergency teams in Greece and Argentina.“
2. **0:15-0:45:** problém. MODIS končí, VIIRS vidí jinak a víc, a bez propojení se zlomí řada. Jedna věta o tom, kdo to potřebuje (CONAE, záchranáři).
3. **0:45-2:30:** živé demo, jedna cesta:
   - výběr regionu (Thesálie),
   - kalendář,
   - přepnout surová data, ukázat skok v roce 2012, přepnout na harmonizovaná data, skok zmizí. To je hlavní moment celého pitche, „před a po“,
   - označený anomální měsíc,
   - stažení CSV.
4. **2:30-3:15:** metoda na jednom slidu: faktor, chyba z LOYO jedním číslem, a co zatím nefunguje. Podle porotců přiznaný limit body přidává.
5. **3:15-3:45:** co dál: NOAA-20, libovolné území, předání CONAE. Konec jasnou větou a poděkováním.

Pravidla pitche:
- Stack nevysvětlovat, za ten body nejsou.
- Nic, co nefunguje, neukazovat živě.
- Připravit odpověď na otázku „co se rozbije první“.

Pojistky pro případ, že něco selže:
- aplikace jde spustit lokálně z předpočítaných JSON bez sítě,
- otevřené záložky v prohlížeči,
- záložní video a screenshoty na disku,
- vypnuté uspávání a notifikace.

## 30s video (do 30 s, jinak není Global Judging)

Osnova podle oficiálního guidu:
- **0:00** Spearow, Petr, Vita.
- **0:02** výzva Harmonization of MODIS and VIIRS Hot Spots a proč jsme si ji vybrali.
- **0:05** název a tagline.
- **0:10** záznam obrazovky: kalendář, přepnutí surových a harmonizovaných dat, region. V titulku „NASA FIRMS MODIS + VIIRS“.
- **0:20-0:30** dopad: CONAE, záchranáři, další země.

Další pravidla pro video:
- Anglicky, nebo s anglickými titulky.
- Bez loga NASA.
- Pokud v něm bude cokoli vygenerovaného SI, musí mít viditelný vodoznak.
- Video musí být hostované venku, na YouTube jako unlisted, a otevřít se v anonymním okně.

## Checklist odevzdání

- [ ] Project Name, High-Level Project Summary (2 až 3 věty, stejná úvodní věta jako v pitchi)
- [ ] Link to Project Demo: video do 30 s, veřejné
- [ ] Link to Final Project: Vercel URL nebo GitHub repo, veřejné a bez přihlášení, ověřené v anonymním okně
- [ ] Detailed Project Description:
  - problém, uživatelé, metoda,
  - validační číslo a limity,
  - jak to spustit.

  Presentation se hodnotí i odsud, takže text nešetřit.
- [ ] Use of Super Intelligence (SI): popsat pravdivě, k čemu jsme SI použili (rešerše, psaní kódu). Pravidla zakazují použít SI k vymyšlení řešení výzvy, takže u nápadu a metody napsat, jak jsme o nich rozhodli. Porotci toto pole nevidí, ale vidí označení v projektu. Kód a data generované SI uvést v README a v metadatech.
- [ ] NASA Data: FIRMS MODIS C6.1, VIIRS S-NPP (případně NOAA-20) s URL
- [ ] Space Agency Partner Data: CONAE, pokud jejich data použijeme
- [ ] Other References: všechny knihovny, hranice (NUTS, IGN), články k metodě, včetně open source
- [ ] Licence repa: OSI, například MIT
- [ ] Slidy, pokud je použijeme: název týmu, jména, výzva, nejvýš 7 slidů

## Co škrtnout, když to nestíháme

Škrtá se odshora, jádro se nevzdává.

1. MCP server a agentní přístup (`agent-access.md`), WebMCP
2. Rozdělení faktoru podle CORINE, vrstva FRP, hex grid
3. Splice NOAA-20
4. Argentina zúžená na jednu nebo dvě provincie (ale aspoň jedna kvůli CONAE)
5. Anomálie jen jako odchylka od průměru stejného měsíce

Nevzdáváme:
- kalendář s reálnými daty Řecka,
- přepínač surových a harmonizovaných dat,
- jedno validační číslo,
- export CSV,
- veřejnou URL,
- 30s video.
