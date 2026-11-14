"""Harmonization v0: VIIRS-equivalent monthly counts for one region.

Factor F[month, dn] = sum(VIIRS) / sum(MODIS Terra+Aqua) over the fit window,
with a fallback chain month -> season -> all months when the MODIS stratum is thin.
Back-cast: 2002-07..2011-12 = sum_dn F * MODIS.
Terra-only months (2000-11..2002-06): chained G[month, dn] = (Terra+Aqua)/Terra fitted
on 2003-2011, then F * G * Terra.
From 2012 the series is observed VIIRS.

Uncertainty v0: 10th/90th percentile of the yearly ratios in the stratum over the fit
window (stand-in until the LOYO residuals of step 2).
"""

import numpy as np
import pandas as pd

FIT_YEARS = range(2012, 2020)
CHAIN_YEARS = range(2003, 2012)
START, END = "2000-11", "2025-12"
AQUA_START = "2002-07"
VIIRS_START = "2012-01"
MIN_PER_YEAR = 5
MIN_TOTAL = 30
SEASON = {12: "DJF", 1: "DJF", 2: "DJF", 3: "MAM", 4: "MAM", 5: "MAM",
          6: "JJA", 7: "JJA", 8: "JJA", 9: "SON", 10: "SON", 11: "SON"}
LEVELS = ["region_month_dn", "region_season_dn", "region_dn"]


def monthly_counts(df: pd.DataFrame) -> pd.DataFrame:
    """Wide monthly table indexed by ym: columns {modis,terra,aqua,viirs}_{D,N}."""
    d = df.copy()
    d["src"] = np.where(d["sensor"] == "viirs", "viirs", d["satellite"].str.lower())
    wide = d.groupby(["ym", "src", "daynight"]).size().unstack(["src", "daynight"], fill_value=0)
    wide.columns = [f"{s}_{dn}" for s, dn in wide.columns]
    yms = pd.period_range(START, END, freq="M").strftime("%Y-%m")
    wide = wide.reindex(yms, fill_value=0)
    for s in ("terra", "aqua", "viirs"):
        for dn in "DN":
            if f"{s}_{dn}" not in wide:
                wide[f"{s}_{dn}"] = 0
    for dn in "DN":
        wide[f"modis_{dn}"] = wide[f"terra_{dn}"] + wide[f"aqua_{dn}"]
    wide.index.name = "ym"
    wide["year"] = wide.index.str[:4].astype(int)
    wide["month"] = wide.index.str[5:7].astype(int)
    return wide


def _ratio_table(m: pd.DataFrame, num: str, den: str, years: range) -> pd.DataFrame:
    """Fit num/den per (month, dn) with fallback. Returns rows month, dn, f, f_lo, f_hi, level."""
    w = m[m["year"].isin(years)]
    n_years = len(years)
    rows = []
    for dn in "DN":
        nu, de = f"{num}_{dn}", f"{den}_{dn}"
        yearly = w.groupby(["year", "month"])[[nu, de]].sum().reset_index()
        yearly["season"] = yearly["month"].map(SEASON)
        groupings = [("month", lambda mo: yearly["month"] == mo),
                     ("season", lambda mo: yearly["season"] == SEASON[mo]),
                     ("all", lambda mo: np.ones(len(yearly), bool))]
        for mo in range(1, 13):
            for level, (_, sel) in zip(LEVELS, groupings):
                g = yearly[sel(mo)].groupby("year")[[nu, de]].sum()
                tot_de = g[de].sum()
                if tot_de >= MIN_TOTAL and tot_de / n_years >= MIN_PER_YEAR or level == LEVELS[-1]:
                    break
            f = g[nu].sum() / tot_de if tot_de else np.nan
            r = (g[nu] / g[de]).replace([np.inf], np.nan).dropna()
            lo, hi = (np.percentile(r, [10, 90]) if len(r) >= 3 else (np.nan, np.nan))
            rows.append({"month": mo, "dn": dn, "f": f, "f_lo": lo, "f_hi": hi,
                         "level": level, "den_total": int(tot_de)})
    return pd.DataFrame(rows)


def fit(m: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """F = VIIRS/MODIS on FIT_YEARS, G = MODIS/Terra on CHAIN_YEARS."""
    return _ratio_table(m, "viirs", "modis", FIT_YEARS), _ratio_table(m, "modis", "terra", CHAIN_YEARS)


def series(m: pd.DataFrame, F: pd.DataFrame, G: pd.DataFrame) -> pd.DataFrame:
    """Monthly records: ym, modis, viirs, harm, harm_lo, harm_hi, src, fit_level."""
    Fi = F.set_index(["month", "dn"])
    Gi = G.set_index(["month", "dn"])
    rank = {lvl: i for i, lvl in enumerate(LEVELS)}
    out = []
    for ym, r in m.iterrows():
        mo = r["month"]
        modis = int(r["modis_D"] + r["modis_N"])
        viirs = int(r["viirs_D"] + r["viirs_N"]) if ym >= VIIRS_START else None
        rec = {"ym": ym, "modis": modis, "viirs": viirs}
        if ym >= VIIRS_START:
            rec.update(harm=float(viirs), harm_lo=None, harm_hi=None, src="observed", fit_level=None)
        else:
            terra_only = ym < AQUA_START
            h = lo = hi = 0.0
            levels = []
            for dn in "DN":
                f = Fi.loc[(mo, dn)]
                if terra_only:
                    g = Gi.loc[(mo, dn)]
                    base = r[f"terra_{dn}"] * g["f"]
                    levels.append(max(f["level"], g["level"], key=rank.get))
                else:
                    base = r[f"modis_{dn}"]
                    levels.append(f["level"])
                h += base * f["f"]
                lo += base * f["f_lo"]
                hi += base * f["f_hi"]
            rec.update(harm=round(h, 1), harm_lo=round(lo, 1), harm_hi=round(hi, 1),
                       src="backcast_terra" if terra_only else "backcast",
                       fit_level=max(levels, key=rank.get))
        out.append(rec)
    return pd.DataFrame(out)
