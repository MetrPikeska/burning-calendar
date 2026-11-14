"""Validation of the harmonization for one region (docs/wiki/harmonization.md, Validation protocol).

1. LOYO over FIT_YEARS: refit without year y, predict y's months from MODIS, compare with VIIRS.
   The out-of-sample months form one series, on which season metrics are compared per season year.
2. Time split: fit on 2012-2019, predict 2020-2025.
3. Trend of the annual VIIRS/MODIS ratio per day/night over 2012-2025 (OLS, % of mean per year).
Mode rule (decided 13 Nov 2026, peak part amended 14 Nov 2026): `relative` when the LOYO median
absolute annual error > 25 %, or the harmonized series hits the VIIRS peak month in more than
PEAK_MARGIN fewer held-out season years than raw MODIS does.
"""

import numpy as np
import pandas as pd

from calendar_metrics import climatology, season_metrics
from harmonize import CLIM_END, FIT_YEARS, FULL_YEARS, SEASON, VIIRS_START, fit, model

MDAPE_MAX = 25.0
PEAK_MARGIN = 1  # season years


def _obs(m: pd.DataFrame) -> pd.Series:
    return (m["viirs_D"] + m["viirs_N"]).astype(float)


def loyo(m: pd.DataFrame, national: pd.DataFrame | None) -> pd.DataFrame:
    """Out-of-sample prediction for every month of FIT_YEARS. Columns: pred, obs, modis, year, month."""
    parts = []
    for y in FIT_YEARS:
        F, G = fit(m, national, years=[x for x in FIT_YEARS if x != y])
        mod = model(m, F, G)
        sel = (m["year"] == y) & (m.index >= VIIRS_START)  # 2012 compared Feb-Dec on both sides
        parts.append(pd.DataFrame({"pred": mod.loc[sel, "model"], "obs": _obs(m)[sel],
                                   "modis": (m["modis_D"] + m["modis_N"])[sel],
                                   "year": y, "month": m.loc[sel, "month"]}))
    return pd.concat(parts)


def time_split(m: pd.DataFrame, national: pd.DataFrame | None) -> pd.DataFrame:
    F, G = fit(m, national, years=FIT_YEARS)
    mod = model(m, F, G)
    sel = (m["year"] >= 2020) & (m["year"] <= FULL_YEARS[-1])  # 2026 (partial, provisional) stays out
    return pd.DataFrame({"pred": mod.loc[sel, "model"], "obs": _obs(m)[sel],
                         "modis": (m["modis_D"] + m["modis_N"])[sel], "year": m.loc[sel, "year"],
                         "month": m.loc[sel, "month"]})


def band(lo: pd.DataFrame) -> pd.DataFrame:
    """Multiplicative 10/90 % band per calendar month from LOYO obs/pred, pooled by season."""
    d = lo[lo["pred"] > 0].assign(r=lambda x: x["obs"] / x["pred"], season=lambda x: x["month"].map(SEASON))
    rows = []
    for mo in range(1, 13):
        r = d.loc[d["season"] == SEASON[mo], "r"]
        if len(r) < 6:
            r = d["r"]
        q_lo, q_hi = (np.percentile(r, [10, 90]) if len(r) else (np.nan, np.nan))
        rows.append({"month": mo, "q_lo": round(float(q_lo), 3), "q_hi": round(float(q_hi), 3)})
    return pd.DataFrame(rows)


def _annual(df: pd.DataFrame) -> pd.DataFrame:
    a = df.groupby("year")[["pred", "obs", "modis"]].sum()
    a["err_pct"] = np.where(a["obs"] > 0, 100 * (a["pred"] - a["obs"]) / a["obs"], np.nan)
    return a


def _monthly_scores(df: pd.DataFrame) -> dict:
    p, o = df["pred"].to_numpy(float), df["obs"].to_numpy(float)
    ok = ~np.isnan(p) & ~np.isnan(o)
    p, o = p[ok], o[ok]
    return {
        "bias_pct": round(float(100 * (p.sum() - o.sum()) / o.sum()), 1) if o.sum() > 0 else None,
        "r": round(float(np.corrcoef(p, o)[0, 1]), 3) if p.std() > 0 and o.std() > 0 else None,
        "rmse_log1p": round(float(np.sqrt(np.mean((np.log1p(p) - np.log1p(o)) ** 2))), 3),
        "n_months": int(len(p)),
    }


def _season_compare(pred: pd.Series, obs: pd.Series, modis: pd.Series, start: int) -> dict:
    """Season metrics per season year: harmonized prediction and raw MODIS, both against VIIRS."""
    def by_year(s):
        return {y["season_year"]: y for y in season_metrics(s, start_month=start)[1]}
    P, O, M = by_year(pred), by_year(obs), by_year(modis)
    years = sorted(set(P) & set(O) & set(M))
    out = {"season_years": years}
    for name, X in (("harm", P), ("modis_raw", M)):
        hits = [X[y]["peak_month"] == O[y]["peak_month"] for y in years]
        d_on = [abs(_mdiff(X[y]["onset"], O[y]["onset"])) for y in years if X[y]["onset"] and O[y]["onset"]]
        d_end = [abs(_mdiff(X[y]["end"], O[y]["end"])) for y in years if X[y]["end"] and O[y]["end"]]
        d_len = [abs(X[y]["season_length"] - O[y]["season_length"]) for y in years
                 if X[y]["season_length"] and O[y]["season_length"]]
        out[name] = {
            "peak_hit_rate": round(float(np.mean(hits)), 3) if hits else None,
            "peak_hits": int(sum(hits)),
            "onset_mad_months": round(float(np.mean(d_on)), 2) if d_on else None,
            "end_mad_months": round(float(np.mean(d_end)), 2) if d_end else None,
            "length_mad_months": round(float(np.mean(d_len)), 2) if d_len else None,
            "onset_exact_share": round(float(np.mean([d == 0 for d in d_on])), 3) if d_on else None,
        }
    return out


def _mdiff(a: int, b: int) -> int:
    """Signed circular month difference a - b in -5..6."""
    return (a - b + 5) % 12 - 5


def trend(m: pd.DataFrame) -> dict:
    out = {}
    w = m[(m["year"] >= FULL_YEARS[0]) & (m["year"] <= FULL_YEARS[-1]) & (m.index >= VIIRS_START)]
    for dn in "DN":
        a = w.groupby("year")[[f"viirs_{dn}", f"modis_{dn}"]].sum()
        a = a[a[f"modis_{dn}"] > 0]
        r = a[f"viirs_{dn}"] / a[f"modis_{dn}"]
        if len(r) < 5:
            out[dn] = None
            continue
        slope = np.polyfit(r.index.to_numpy(float), r.to_numpy(), 1)[0]
        out[dn] = {"slope_pct_per_year": round(float(100 * slope / r.mean()), 2),
                   "ratio_by_year": {int(k): round(float(v), 2) for k, v in r.items()}}
    return out


def fit_window_gap(m: pd.DataFrame, national: pd.DataFrame | None) -> float | None:
    """% difference of the 2000-2011 back-cast total between the 2012-2025 and 2012-2019 fits."""
    a = model(m, *fit(m, national, FIT_YEARS))
    b = model(m, *fit(m, national, FULL_YEARS))
    sel = m.index < VIIRS_START
    ta, tb = a.loc[sel, "model"].sum(), b.loc[sel, "model"].sum()
    return round(float(100 * (tb - ta) / ta), 1) if ta > 0 else None


def validate(m: pd.DataFrame, national: pd.DataFrame | None, start_month: int) -> tuple[dict, pd.DataFrame]:
    """Returns (validation dict, LOYO band)."""
    lo = loyo(m, national)
    ts = time_split(m, national)
    ann = _annual(lo)
    ts_ann = _annual(ts)
    pred_s = pd.Series(lo["pred"].to_numpy(), index=lo.index)
    obs_s = pd.Series(lo["obs"].to_numpy(), index=lo.index)
    mod_s = pd.Series(lo["modis"].to_numpy(float), index=lo.index)
    seasons = _season_compare(pred_s, obs_s, mod_s, start_month)
    mdape = float(np.nanmedian(ann["err_pct"].abs())) if ann["err_pct"].notna().any() else np.nan
    harm_hits = seasons["harm"]["peak_hits"]
    raw_hits = seasons["modis_raw"]["peak_hits"]
    n_seasons = len(seasons["season_years"])
    reasons = []
    if not (mdape <= MDAPE_MAX):
        reasons.append(f"loyo_mdape {mdape:.1f} > {MDAPE_MAX}")
    if raw_hits - harm_hits > PEAK_MARGIN:
        reasons.append(f"peak hits {harm_hits}/{n_seasons} vs raw MODIS {raw_hits}/{n_seasons}, "
                       f"more than {PEAK_MARGIN} season year worse")
    gap = fit_window_gap(m, national)
    res = {
        "loyo": {
            "years": list(FIT_YEARS),
            "annual_mdape_pct": round(mdape, 1) if not np.isnan(mdape) else None,
            "annual_err_pct": {int(y): (round(float(e), 1) if not np.isnan(e) else None)
                               for y, e in ann["err_pct"].items()},
            "monthly": _monthly_scores(lo),
            "season": seasons,
        },
        "time_split": {
            "fit": "2012-2019", "test": "2020-2025",
            "annual_err_pct": {int(y): (round(float(e), 1) if not np.isnan(e) else None)
                               for y, e in ts_ann["err_pct"].items()},
            "annual_mdape_pct": round(float(np.nanmedian(ts_ann["err_pct"].abs())), 1)
            if ts_ann["err_pct"].notna().any() else None,
            "monthly": _monthly_scores(ts),
        },
        "fit_window_gap_pct": gap,
        "ratio_trend": trend(m),
        "mode": "relative" if reasons else "harmonized",
        "mode_reasons": reasons,
    }
    return res, band(lo)


def raw_start_month(m: pd.DataFrame) -> int:
    """Climatological minimum month of the MODIS series (scale-free; used before harm exists)."""
    s = (m["modis_D"] + m["modis_N"]).astype(float)
    return int(np.nanargmin(climatology(s[s.index <= CLIM_END]))) + 1
