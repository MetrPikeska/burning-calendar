# Rozložení webu (sobota 14. 11. 2026, náčrt bez stylu)

Pořadí funkcí odsouhlasil Petr: CSV, výběr regionu, rozsah, lat/lon; panel s mediánem až po `baseline_median` z pipeline; impeccable na konec.

## Desktop (šířka ≥ 900 px)

```
+--------------------------------------------------------------------------+
| Burning Calendar   MODIS + VIIRS ...                       Country [GR v] |
+-------------------------------------------+------------------------------+
|                                           | Area                         |
|                                           | [Kentriki Makedonia (EL52) v]|
|                                           | lat, lon [40.6, 22.9  ] [Go] |
|                 MAPA                      +------------------------------+
|                                           | Kentriki Makedonia  EL52     |
|                                           | Critical period Jul-Feb ...  |
|                                           | [Harm|MODIS|VIIRS]           |
|                                           | From [2000-11] To [2025-12] x|
|                                           | [Download CSV]               |
|                                           | +--------------------------+ |
|                                           | |   heatmapa měsíc × rok   | |
|                                           | +--------------------------+ |
|                                           | Median panel (po pipeline)   |
|                                           | poznámka pod čarou           |
+-------------------------------------------+------------------------------+
```

- Blok „Area“ (seznam regionů + lat/lon) je nad panelem regionu, ne v mapě: na telefonu musí jít vybrat region bez mapy.
- Rozsah a CSV leží těsně nad heatmapou, protože rozsah ztlumí buňky mimo období a CSV bere stejný rozsah.
- Panel s mediánem je pod heatmapou; klik na buňku vybere měsíc.

## Telefon (< 900 px), jeden sloupec

```
header
Area: [region v]  lat, lon [ ] [Go]
MAPA (40vh)
název + kritické období
[Harm|MODIS|VIIRS]
From [ ] To [ ]  x
[Download CSV]
heatmapa (plná šířka, při nedostatku místa vodorovný scroll)
panel s mediánem
poznámka
```

Grid oblasti: desktop `"map area" / "map panel"`, telefon `"area" / "map" / "panel"`.
