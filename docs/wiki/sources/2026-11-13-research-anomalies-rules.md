# Source: research report B, NOAA-20 continuity / anomaly methods / Space Apps rules

Produced 2026-11-13 by a read-only research agent (web search + fetch). This is the agent's report as delivered, and it is not reviewed claim by claim. It is an immutable input; the wiki pages cite it.

---

The spaceappschallenge.org pages would not load (TLS certificate error), so the 2026 rules could not be read directly. Rules in section 4 marked UNVERIFIED-SNIPPET come only from search-result snippets. Check them on the live site before you submit.

## Actionable for the build

1. **Use NOAA-20 as the continuation of S-NPP, and splice inside the VIIRS family.** NASA calls NOAA-20 and NOAA-21 the drop-in replacements for S-NPP: same sensor, same resolution, same products. In API calls, change `VIIRS_SNPP_*` to `VIIRS_NOAA20_NRT` or `VIIRS_NOAA21_NRT` ([FIRMS blog](https://www.earthdata.nasa.gov/news/blog/transitioning-from-suomi-npp-viirs-omps-what-firms-users-need-know)). NOAA's review found the two satellites give "compatible" detection counts and FRP ([NOAA STAR 2019](https://www.star.nesdis.noaa.gov/JPSS/documents/AMM/N20/Land_ActiveFires_Iband_Beta_Provisional.pdf)). No published S-NPP to NOAA-20 count factor was found, so compute your own from the 2018 to Nov 2026 overlap.
2. **Keep separate day and night ratios.** NOAA's figures (3-4x more daytime pixels, about 20x more at night, for 375 m against 750 m/MODIS) show the same direction as the Greece numbers (3.14 day, 4.50 night) ([NOAA STAR 2019](https://www.star.nesdis.noaa.gov/JPSS/documents/AMM/N20/Land_ActiveFires_Iband_Beta_Provisional.pdf)).
3. **Plan for MODIS ending.** Terra is due to stop in January 2027 and Aqua around September 2027 ([CAMS, 25 Feb 2026](https://atmosphere.copernicus.eu/drifting-away-modis-cams-global-fire-assimilation-system)). After that a "VIIRS-equivalent" series is needed, not a "MODIS-equivalent" one. Consider making VIIRS the reference scale from 2012 onward and back-casting 2000-2011 from MODIS.
4. **Anomaly metric.** Use the same structure as GWIS and EFFIS: current period against the mean of the last 10 years for the same period, plus cumulative-season curves. For the statistic, use a log(1+x) z-score or a negative-binomial / percentile rank, because monthly counts are skewed and often zero.
5. **Demo.** Plan for a demo of at most 30 seconds of video or 7 slides, hosted externally, with English subtitles. That limit is confirmed for 2022 and only from snippets for 2026. Also add a section describing how AI tools were used (UNVERIFIED-SNIPPET for 2026).

## 1. S-NPP, NOAA-20 and NOAA-21 consistency

- **NOAA STAR Beta Maturity Review for the VIIRS 375 m Active Fire algorithm** (I. Csiszar, 2019) ([PDF](https://www.star.nesdis.noaa.gov/JPSS/documents/AMM/N20/Land_ActiveFires_Iband_Beta_Provisional.pdf)) states:
  - "Good consistency of detection rates between Suomi NPP and NOAA-20."
  - "Compatible detections counts and FRP retrievals between Suomi NPP and NOAA-20."
  - The FRP comparison used 0.5° and 2° grids for Feb to Apr 2019. The values are only in figures, so there are no numbers to quote.
  - It lists "Further detailed Suomi NPP vs. NOAA-20 comparisons for the entire possible range of FRP retrievals" as future work.
  - It reports "3-4x more daytime fire pixels" and "+20x more nighttime fire pixels" for 375 m compared with VIIRS 750 m and MODIS 1 km.
- **Overpass offset.** NOAA-20 and NOAA-21 fly in the same orbital plane as S-NPP, about 50 minutes apart ([FIRMS blog](https://www.earthdata.nasa.gov/news/blog/transitioning-from-suomi-npp-viirs-omps-what-firms-users-need-know)). An AMS 2019 abstract makes the same point ([AMS](https://ams.confex.com/ams/2019Annual/webprogram/Paper351681.html)).
- **Peer-reviewed comparison.** No paper found that publishes S-NPP vs NOAA-20 375 m count or FRP ratios (UNVERIFIED). Zhou et al. 2023 (IEEE TGRS) studies night fire detection with both satellites, not checked for ratios ([ESPO listing](https://espo.nasa.gov/korus-aq/node/94926)).
- **What FIRMS has published about the S-NPP end.** The blog was posted 27 Oct 2026 and updated 3 Nov ([link](https://www.earthdata.nasa.gov/news/blog/transitioning-from-suomi-npp-viirs-omps-what-firms-users-need-know)):
  - FIRMS stopped producing S-NPP data at 13:00 UTC on 2 Nov 2026.
  - Historical data stays available.
  - The replacements are NOAA-20 and NOAA-21. Users with S-NPP-only alerts should add those feeds.
  - MODIS Terra is the only morning overpass left, and NASA is still working out what replaces it.
  - It gives no splicing or recalibration advice.
- **LANCE notice** (3 Nov 2026) ([link](https://www.earthdata.nasa.gov/news/blog/transitioning-from-suomi-npp-noaa-20-noaa-21-what-lance-users-need-know)):
  - Science data delivery stopped at 15:40 UTC on 2 Nov (day 306). This differs from the FIRMS time, and no explanation was found.
  - Product names change from VNP to VJ1 (NOAA-20) and VJ2 (NOAA-21).
  - It suggests ingesting NOAA-20 and NOAA-21 together for hazard use.

## 2. Anomaly detection for fire-count series

- **GWIS** shows the seasonal cumulative number of fires and burnt area against the average of the last 10 years. It also has "VIIRS Weekly (Cumulative) Thermal Anomalies" views. Its fire counts are clusters of MODIS/VIIRS detections, so they differ from EFFIS counts ([GWIS applications](https://gwis.jrc.ec.europa.eu/applications), [seasonal trend](https://gwis.jrc.ec.europa.eu/apps/gwis.statistics/seasonaltrend)).
- **EFFIS** compares current burnt area and number of fires against a multi-year average ([EFFIS applications](https://forest-fire.emergency.copernicus.eu/applications)). The JRC 2026 situation page uses a 2006-2025 baseline ([JRC](https://joint-research-centre.ec.europa.eu/projects-and-activities/natural-and-man-made-hazards/fires/current-wildfire-situation-europe_en)).
- **JRC Africa Knowledge Platform** compares MODIS/FIRMS counts for each 10-day period with the long-term mean of the same period. Positive means more fires than usual. The exact formula is not documented ([AKP](https://africa-knowledge-platform.ec.europa.eu/node/36950)).
- **CAMS GFAS** articles do not describe any anomaly-reporting method ([CAMS](https://atmosphere.copernicus.eu/drifting-away-modis-cams-global-fire-assimilation-system)).
- **Global Fire Atlas anomaly reporting:** not found (UNVERIFIED).
- **Count models:**
  - A 2024 PLOS ONE paper models monthly MODIS fire counts in Kenya with a negative binomial model, including a Bayesian version, to handle overdispersion ([PMC10810550](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10810550/)).
  - An EGU 2016 abstract runs a Contextual Mann-Kendall trend test on 156 months of MODIS counts ([EGU2016-17227](https://meetingorganizer.copernicus.org/EGU2016/EGU2016-17227-2.pdf?pdf)).
  - No operational product found that uses log(1+x) z-scores. It is a reasonable method but has no citation from this search (UNVERIFIED).
- **Fire weather context.** Jolly et al. 2015, "Climate-induced variations in global wildfire danger from 1979 to 2013," *Nat. Commun.* 6:7537, [doi:10.1038/ncomms8537](https://doi.org/10.1038/ncomms8537). It reports an 18.7% rise in global mean fire weather season length ([Treesearch](https://research.fs.usda.gov/treesearch/48648)).

## 3. Harmonization options

- **Ratio scaling vs regression on log counts vs quantile mapping of fire counts across sensors:** no paper found that tests these on counts (UNVERIFIED).
- **Quantile mapping on FRP.** A search summary pointed to Kaur et al. 2019 (*Remote Sensing* 11(10):1205), which reportedly maps off-nadir MODIS FRP onto the near-nadir distribution and checks the result against VIIRS. The page returned 403, so this is UNVERIFIED ([MDPI](https://www.mdpi.com/2072-4292/11/10/1205)).
- **Li, Zhang, Kondragunta & Csiszar 2018**, "Comparison of Fire Radiative Power Estimates From VIIRS and MODIS Observations," JGR-Atmos 123(9), [doi:10.1029/2017JD027823](https://doi.org/10.1029/2017JD027823). The agreement depends on spatial scale. On 1° grids the difference averages about 20% in fire-prone regions and varies more in fire-limited ones ([MODIS abstract](https://modarch.gsfc.nasa.gov/sci_team/pubs/abstract_new.php?id=28428)).
- **Sofiev & Kouznetsov 2026**, "Observation operator and detection limits for MODIS and VIIRS Fire Radiative Power products," GMD 19:10123, [doi:10.5194/gmd-19-10123-2026](https://doi.org/10.5194/gmd-19-10123-2026). It builds analytical operators that map FRP between MODIS and VIIRS, accounting for pixel area and detection limits. It covers FRP, not counts. A 1.2 diurnal factor for VIIRS was read through a summarizer only ([GMD](https://gmd.copernicus.org/articles/19/10123/2026/)).
- **Takeaway.** A ratio per region, month and day/night is a defensible start. A log-count regression or empirical CDF matching over the 2012+ overlap is a fallback you can justify, but no paper found applies it to counts.

## 4. NASA Space Apps 2026 submission rules

- **Submission window:** opens Sat 14 Nov 2026 at 09:00 and closes Sun 15 Nov at 23:59 local time. The Submission Guide was due out 13 Nov (UNVERIFIED-SNIPPET, [2026 page](https://www.spaceappschallenge.org/2026/)).
- **Eligibility:** submit through the team project page. "Create Your Own Challenge" projects cannot enter Global Judging (UNVERIFIED-SNIPPET, [submission guide](https://www.spaceappschallenge.org/resources/project-submission-guide/)).
- **Project page fields, demo format and language (2022 guide, confirmed)** ([2022 PDF](https://spaceapps-prod.s3.amazonaws.com/media/documents/Space_Apps_2022_Project_Submission_Guide.pdf)):
  - Fields: Project Title; High-Level Project Summary; Link to Final Project (public, no login needed); Link to Project "Demo" (exactly one link); Detailed Description.
  - Demo: "video (up to 30 seconds) OR slides (up to 7 slides)", hosted externally.
  - Language: English throughout. A video may be in another language only with English subtitles.
  - The 2026 snippet repeats the 30-second, externally hosted video (UNVERIFIED-SNIPPET).
- **Judging criteria:** Impact, Creativity, Validity, Relevance, Presentation. Presentation should get equal attention to the other four (UNVERIFIED-SNIPPET, [Judging & Awards Guide](https://www.spaceappschallenge.org/resources/judging-awards-guide)).
- **AI disclosure:** a snippet of the 2026 FAQ says AI tools, now called "Super Intelligence (SI)" tools, are allowed, but each submission must describe how they were used (UNVERIFIED-SNIPPET, [FAQ](https://www.spaceappschallenge.org/resources/participant-faqs/)). The name change itself is confirmed: NASA cites Executive Order 14434 of 29 Sep 2026 ([NASA](https://www.nasa.gov/super-intelligence/)). That page does not mention Space Apps.
- **Award categories for 2026:** not retrieved (UNVERIFIED).
