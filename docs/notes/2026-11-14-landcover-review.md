# Krajinný pokryv: co dělá main a co vylepšit

Stav k 14. 11. 2026, commit `075f9d5` na `main`. Návrh, nic se tu neimplementuje. Údaje o velikosti souborů, přihlášení a CLC 2024 jsou ze shrnutí vyhledávání, ne z primárních stránek (`UNVERIFIED`).

Souvisí s: [faktory-a-model](2026-11-14-faktory-a-model.md), PR #4 (kontextová vrstva), [greece.md](../wiki/greece.md), [decisions.md](../wiki/decisions.md).

## Co dělá main dnes

- **Žádný kód pro krajinný pokryv.** V `pipeline/`, `web/` a `tests/` nejsou `landcover`, `corine`, `worldcover` ani `clc`.
- **Jen text:**
  - `docs/wiki/greece.md`: CORINE 100 m (2000, 2006, 2012, 2018), třídy orná půda 211 až 213 a heterogenní zemědělství 241 až 244, ESA WorldCover 2020 a 2021.
  - `docs/wiki/decisions.md`: rozdělení typů požárů podle CORINE je "nice-to-have".
  - `docs/wiki/harmonization.md`: poměr VIIRS/MODIS je nejvyšší na orné půdě.
  - `TODO.md`: "CORINE split of the factor".
- **Háčky, kam by se to dalo napojit:** `pipeline/hotspots.py` (CSV s jednotlivými detekcemi pro Řecko včetně souřadnic, regionu a FRP) a `pipeline/regions.py` (polygony NUTS2, přiřazení bodu do regionu).

## Co přidává PR #4 a kde je slabé

PR #4 přidává `landcover_shares` v `pipeline/factors.py`: podíly plochy orné půdy, lesa a křovin či trávy na region, vykreslené jako pruh v panelu měsíce. Je to jen zobrazení, nic jiného ty hodnoty nečte. Na skutečných datech se to nikdy nespustilo.

## Návrhy, od nejdůležitějšího

1. **Definovat skupiny tříd jednou a zapsat je.** PR #4 má v orné půdě navíc 221 až 223 (vinice, ovocné sady, olivy) a pastviny 231 dává ke křovinám a trávě, wiki uvádí jen 211 až 213 a 241 až 244. V Řecku jsou olivové háje velká plocha, takže se pruh liší podle toho, jak se to vybere. Zvolit jednu definici, zapsat ji do `greece.md` a použít ji všude.
2. **Neřešit vektor o 8,9 GB.** Podle [zrcadla na Zenodu](https://zenodo.org/records/11549846) má celý evropský vektor CLC 2018 asi 8,9 GB (`UNVERIFIED`, třetí strana). Lepší je 100m raster čtený po oknech jen pro obdélník Řecka a součty po regionech (zonální statistika), nebo jednorázový výřez pomocí `ogr2ogr`, kde se uchová jen malý soubor. Zda stažení vyžaduje účet EU Login a zda portál nabízí výřez, je neověřené.
3. **Pruh krajiny přesunout z panelu měsíce.** Podíly se s měsícem nemění. Patří do hlavičky regionu nebo do sekce o metodě, jednou, ne pod každý vybraný měsíc.
4. **Zpřesnit `other_pct`.** Zbytek zahrnuje i plochu, kterou CORINE nepokrývá (moře, pobřeží, chybějící data) a nesoulad polygonů. Buď hlásit pokrytý podíl, nebo oba vrstvy oříznout na pevninu před dělením.
5. **Rok z dat, ne z textu.** Popisek "CORINE 2018" je napevno. Rok má vyčíst ze souboru. Zda už vyšel CLC 2024, nevím (plánováno na polovinu 2026, `UNVERIFIED`). Krajina se mění pomalu, takže 2018 je přijatelný, ale musí být uvedený.
6. **Skutečné využití: třída u každé detekce.** Rozšířit `pipeline/hotspots.py` tak, aby každá detekce dostala skupinu CORINE, a zapsat počty detekcí na orné půdě a mimo ni po regionech a měsících. To je zmiňované "rozdělení typů požárů". Omezení: jeden statický rok pro 25 let, pixel MODIS 1 km míchá více tříd, po jednotlivých požárech to není ověřeno.
7. **Krajina v harmonizaci (až po víkendu).** Wiki říká, že poměr je nejvyšší na orné půdě. Zvlášť fitovaný faktor pro ornou a ostatní půdu by mohl snížit chybu v Thesálii a Střední Makedonii. Rizika: tenké strata, další úrovně záložního řetězu, nová validace.
8. **Testy se skutečným názvem sloupce.** `Code_18` je předpoklad. Ověřit sloupec ve skutečném souboru a přidat testovací vstup s jeho schématem, test na pobřeží a na součet podílů rovný 100.

## Doporučení

- **Před freezem (neděle 12:00):** nanejvýš body 1 a 3, tedy zapsat definici tříd a přesunout pruh z měsíčního panelu. Obojí je malé a nezávisí na stahování.
- **Nespouštět nic, co vyžaduje velké stahování**, dokud se neukáže, že je krajina v prezentaci potřeba.
- **Po víkendu:** bod 6 jako první skutečné využití, bod 7 až po validaci.
