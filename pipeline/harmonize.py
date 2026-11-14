"""Harmonization: VIIRS-equivalent monthly counts for one region.

Factor F[month, dn] = sum(VIIRS) / sum(MODIS Terra+Aqua) over the fit window, with the
fallback chain region_month_dn -> region_season_dn -> region_dn -> national_dn. A stratum
is accepted when its MODIS total over the window is >= MIN_TOTAL and >= MIN_PER_YEAR per year.
Back-cast: 2002-07..2011-12 = sum_dn F * MODIS.
Terra-only months (2000-11..2002-06): chained G[month, dn] = (Terra+Aqua)/Terra fitted on
2003-2011 with the same chain, then F * G * Terra.
From 2012 the series is observed VIIRS. Uncertainty bands come from validate.loyo_band.
"""

import numpy as np
import pandas as pd

FIT_YEARS = tuple(range(2012, 2020))
FULL_YEARS = tuple(range(2012, 2026))
CHAIN_YEARS = tuple(range(2003, 2012))
START, END = "2000-11", "2025-12"
AQUA_START = "2002-07"
VIIRS_START = "2012-01"
MIN_PER_YEAR = 5
MIN_TOTAL = 30
SEASON = {12: "DJF", 1: "DJF", 2: "DJF", 3: "MAM", 4: "MAM", 5: "MAM",
          6: "JJA", 7: "JJA", 8: "JJA", 9: "SON", 10: "SON", 11: "SON"}
LEVELS = ["region_month_dn", "region_season_dn", "region_dn", "national_dn"]
RANK = {lvl: i for i, lvl in enumerate(LEVELS)}


def monthly_counts(df: pd.DataFrame) -> pd.DataFrame:
    """Wide monthly table indexed by ym: columns {modis,terra,aqua,viirs}_{D,N}, year, month."""
    d = df.assign(src=np.where(df["sensor"] == "viirs", "viirs", df["satellite"].str.lower()))
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


def _accept(den_total: float, n_years: int) -> bool:
    return den_total >= MIN_TOTAL and den_total / n_years >= MIN_PER_YEAR


def fit_ratio(m: pd.DataFrame, num: str, den: str, years, national: pd.DataFrame | None = None) -> pd.DataFrame:
    """num/den per (month, dn) with the fallback chain. Rows: month, dn, f, level, den_total."""
    years = tuple(years)
    w = m[m["year"].isin(years)]
    nat = national[national["year"].isin(years)] if national is not None else w
    rows = []
    for dn in "DN":
        nu, de = f"{num}_{dn}", f"{den}_{dn}"
        by_month = w.groupby("month")[[nu, de]].sum()
        by_season = w.groupby(w["month"].map(SEASON))[[nu, de]].sum()
        total = w[[nu, de]].sum()
        nat_total = nat[[nu, de]].sum()
        for mo in range(1, 13):
            cands = [("region_month_dn", by_month.loc[mo] if mo in by_month.index else None),
                     ("region_season_dn", by_season.loc[SEASON[mo]] if SEASON[mo] in by_season.index else None),
                     ("region_dn", total)]
            level, s = "national_dn", nat_total
            for lvl, c in cands:
                if c is not None and _accept(c[de], len(years)):
                    level, s = lvl, c
                    break
            f = s[nu] / s[de] if s[de] > 0 else np.nan
            rows.append({"month": mo, "dn": dn, "f": float(f), "level": level, "den_total": int(s[de])})
    return pd.DataFrame(rows)


def fit(m: pd.DataFrame, national: pd.DataFrame | None = None, years=FIT_YEARS) -> tuple[pd.DataFrame, pd.DataFrame]:
    """F = VIIRS/MODIS on `years`, G = MODIS/Terra on CHAIN_YEARS."""
    return (fit_ratio(m, "viirs", "modis", years, national),
            fit_ratio(m, "modis", "terra", CHAIN_YEARS, national))


def model(m: pd.DataFrame, F: pd.DataFrame, G: pd.DataFrame) -> pd.DataFrame:
    """Modelled VIIRS-equivalent count for every month (ignores observed VIIRS).
    Columns: model, fit_level, terra_only."""
    out = pd.DataFrame(index=m.index)
    out["terra_only"] = m.index < AQUA_START
    total = np.zeros(len(m))
    lvl = np.zeros(len(m), dtype=int)
    for dn in "DN":
        f = F[F["dn"] == dn].set_index("month")
        g = G[G["dn"] == dn].set_index("month")
        fm = m["month"].map(f["f"]).to_numpy()
        gm = m["month"].map(g["f"]).to_numpy()
        base = np.where(out["terra_only"], m[f"terra_{dn}"] * gm, m[f"modis_{dn}"])
        total += np.nan_to_num(base * fm)
        lf = m["month"].map(f["level"].map(RANK)).to_numpy()
        lg = m["month"].map(g["level"].map(RANK)).to_numpy()
        lvl = np.maximum(lvl, np.where(out["terra_only"], np.maximum(lf, lg), lf))
    out["model"] = total
    out["fit_level"] = [LEVELS[i] for i in lvl]
    return out


def series(m: pd.DataFrame, F: pd.DataFrame, G: pd.DataFrame, band: pd.DataFrame | None = None,
           mode: str = "harmonized") -> pd.DataFrame:
    """Monthly records indexed by ym: modis, viirs, harm, harm_lo, harm_hi, src, fit_level.
    band: rows month, q_lo, q_hi (multipliers of the modelled value)."""
    mod = model(m, F, G)
    rec = pd.DataFrame(index=m.index)
    rec["modis"] = (m["modis_D"] + m["modis_N"]).astype(int)
    observed = m.index >= VIIRS_START
    viirs = (m["viirs_D"] + m["viirs_N"]).astype(float)
    rec["viirs"] = viirs.where(observed)
    rec["harm"] = np.where(observed, viirs, mod["model"].round(1))
    if band is not None:
        b = band.set_index("month")
        lo = m["month"].map(b["q_lo"]).to_numpy() * mod["model"]
        hi = m["month"].map(b["q_hi"]).to_numpy() * mod["model"]
        rec["harm_lo"] = np.where(observed, np.nan, lo.round(1))
        rec["harm_hi"] = np.where(observed, np.nan, hi.round(1))
    else:
        rec["harm_lo"] = np.nan
        rec["harm_hi"] = np.nan
    rec["src"] = np.where(observed, "observed", np.where(mod["terra_only"], "backcast_terra", "backcast"))
    rec["fit_level"] = np.where(observed, None, mod["fit_level"])
    if mode == "relative":
        rec[["harm", "harm_lo", "harm_hi"]] = np.nan
    rec["viirs"] = rec["viirs"].astype("Int64")
    return rec
