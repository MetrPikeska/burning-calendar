"""Harmonization: VIIRS-equivalent monthly counts for one region.

Factor F[month, dn] = sum(VIIRS) / sum(MODIS Terra+Aqua) over the fit window, with the
fallback chain region_month_dn -> region_season_dn -> region_dn -> national_dn. A stratum
is accepted when its MODIS total over the window is >= MIN_TOTAL and >= MIN_PER_YEAR per year.
Back-cast: 2002-07..2012-01 = sum_dn F * MODIS.
Terra-only months (2000-11..2002-06): chained G[month, dn] = (Terra+Aqua)/Terra fitted on
2003-2011 with the same chain, then F * G * Terra.
From Feb 2012 the series is observed VIIRS (to END; 2026 from the area API, NRT months provisional). Uncertainty bands come from validate.loyo_band.
"""

import numpy as np
import pandas as pd

FIT_YEARS = tuple(range(2012, 2020))
FULL_YEARS = tuple(range(2012, 2026))
CHAIN_YEARS = tuple(range(2003, 2012))
START, END = "2000-11", "2026-10"  # 2026 from the FIRMS area API, S-NPP ended 2 Nov 2026
AQUA_START = "2002-07"
CLIM_END = "2025-12"  # climatology (calendar, season start) uses complete calendar years only
VIIRS_DATA_START = "2012-01"  # first month with S-NPP detections in FIRMS (record starts 20 Jan 2012)
VIIRS_START = "2012-02"  # first complete VIIRS month: Jan 2012 keeps its raw viirs count but is back-cast and kept out of fit and validation
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


def detection_days(df: pd.DataFrame) -> pd.DataFrame:
    """Days with at least one detection per month and sensor (distinct acq_date, UTC), indexed by ym.
    days_viirs is null before VIIRS_DATA_START."""
    yms = pd.period_range(START, END, freq="M").strftime("%Y-%m")
    out = pd.DataFrame(index=yms)
    out.index.name = "ym"
    for sensor in ("modis", "viirs"):
        n = df[df["sensor"] == sensor].groupby("ym")["acq_date"].nunique()
        out[f"days_{sensor}"] = n.reindex(yms, fill_value=0).astype("Int64")
    out.loc[out.index < VIIRS_DATA_START, "days_viirs"] = pd.NA
    return out


def fit_ratio(m: pd.DataFrame, num: str, den: str, years, national: pd.DataFrame | None = None) -> pd.DataFrame:
    """num/den per (month, dn) with the fallback chain. Rows: month, dn, f, level, den_total."""
    years = tuple(years)
    w = m[m["year"].isin(years)]
    nat = national[national["year"].isin(years)] if national is not None else w
    if num.startswith("viirs") or den.startswith("viirs"):  # only complete VIIRS months enter a VIIRS ratio
        w, nat = w[w.index >= VIIRS_START], nat[nat.index >= VIIRS_START]
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
    rec["viirs"] = viirs.where(m.index >= VIIRS_DATA_START)  # raw count, partial in Jan 2012
    rec["harm"] = np.where(observed, viirs, mod["model"].round(1))
    if band is not None:
        b = band.set_index("month")
        lo = m["month"].map(b["q_lo"]).to_numpy() * mod["model"]
        hi = m["month"].map(b["q_hi"]).to_numpy() * mod["model"]
        rec["harm_lo"] = np.where(observed, np.nan, lo.round(1))
        rec["harm_hi"] = np.where(observed, np.nan, hi.round(1))
        if "zero_hi" in b:  # a zero estimate still has an upper bound (audit BC3-004)
            zero = ~observed & (mod["model"].to_numpy() == 0)
            rec.loc[zero, "harm_hi"] = m.loc[zero, "month"].map(b["zero_hi"]).to_numpy()
    else:
        rec["harm_lo"] = np.nan
        rec["harm_hi"] = np.nan
    rec["src"] = np.where(observed, "observed", np.where(mod["terra_only"], "backcast_terra", "backcast"))
    rec["fit_level"] = np.where(observed, None, mod["fit_level"])
    if mode == "relative":
        # No modelled series: every value shown (raw MODIS, raw VIIRS) is observed (audit BC-003).
        rec[["harm", "harm_lo", "harm_hi"]] = np.nan
        rec["src"] = "observed"
        rec["fit_level"] = None
    rec["viirs"] = rec["viirs"].astype("Int64")
    return rec
