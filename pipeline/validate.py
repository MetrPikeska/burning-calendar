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
# Quality note on harmonized regions (does not change the mode): "limited" when the held-out 2020-2025 test has a
# median annual error above MDAPE_MAX, or any held-out year (LOYO or 2020-2025) misses VIIRS by more than this.
YEAR_ERR_MAX = 50.0
# Season window for the validation: MODIS climatology up to 2011, before the first VIIRS validation year, so no
# held-out year (LOYO 2012-2019, time split 2020-2025) shapes the season years it is scored on (audit BC3-002).
VALIDATION_CLIM_END = "2011-12"
BAND_NOMINAL_PCT = 80
COUNT_CLASSES = (("0", 0, 0), ("1-19", 1, 19), ("20-99", 20, 99), ("100+", 100, np.inf))


def quality(res: dict) -> dict | None:
    """Worst held-out year and the quality note of a harmonized region; None in relative mode."""
    if res["mode"] != "harmonized":
        return None
    errs = [(abs(e), int(y), test, e) for test, key in (("loyo", "loyo"), ("time_split", "time_split"))
            for y, e in (res[key]["annual_err_pct"] or {}).items() if e is not None]
    worst = max(errs) if errs else None
    ts = res["time_split"]["annual_mdape_pct"]
    reasons = []
    if ts is not None and ts > MDAPE_MAX:
        reasons.append(f"time_split_mdape {ts} > {MDAPE_MAX}")
    if worst and worst[0] > YEAR_ERR_MAX:
        reasons.append(f"{worst[2]} {worst[1]} error {worst[3]:+.1f} % beyond +-{YEAR_ERR_MAX:.0f} %")
    return {
        "level": "limited" if reasons else "ok",
        "reasons": reasons,
        "worst_year": worst[1] if worst else None,
        "worst_test": worst[2] if worst else None,
        "worst_err_pct": worst[3] if worst else None,
        "time_split_mdape_pct": ts,
    }


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
    """Multiplicative 10/90 % band per calendar month from LOYO obs/pred, pooled by season.
    zero_hi: upper bound (90th percentile of observed VIIRS) for months whose prediction is 0, where a
    multiplicative band collapses to [0, 0] although VIIRS can see fire (audit BC3-004)."""
    d = lo[lo["pred"] > 0].assign(r=lambda x: x["obs"] / x["pred"], season=lambda x: x["month"].map(SEASON))
    z = lo[lo["pred"] == 0].assign(season=lambda x: x["month"].map(SEASON))
    rows = []
    for mo in range(1, 13):
        r = d.loc[d["season"] == SEASON[mo], "r"]
        if len(r) < 6:
            r = d["r"]
        q_lo, q_hi = (np.percentile(r, [10, 90]) if len(r) else (np.nan, np.nan))
        zo = z.loc[z["season"] == SEASON[mo], "obs"]
        if len(zo) < 6:
            zo = z["obs"]
        zero_hi = round(float(np.percentile(zo, 90)), 1) if len(zo) else 0.0
        rows.append({"month": mo, "q_lo": round(float(q_lo), 3), "q_hi": round(float(q_hi), 3), "zero_hi": zero_hi})
    return pd.DataFrame(rows)


def band_coverage(ts: pd.DataFrame, b: pd.DataFrame) -> dict:
    """Share of held-out 2020-2025 months whose observed VIIRS lies inside the band, overall and by count class."""
    bb = b.set_index("month")
    lo = ts["month"].map(bb["q_lo"]) * ts["pred"]
    hi = np.where(ts["pred"] > 0, ts["month"].map(bb["q_hi"]) * ts["pred"], ts["month"].map(bb["zero_hi"]))
    inside = (ts["obs"] >= lo.fillna(0) - 1e-9) & (ts["obs"] <= hi + 1e-9)
    ok = ts["obs"].notna()

    def share(mask) -> dict:
        n = int((mask & ok).sum())
        return {"pct": round(float(100 * inside[mask & ok].mean()), 1) if n else None, "n": n}

    return {
        "nominal_pct": BAND_NOMINAL_PCT, "test": "2020-2025", "band_from": "LOYO 2012-2019",
        **share(pd.Series(True, index=ts.index)),
        "by_observed_count": {name: share((ts["obs"] >= a) & (ts["obs"] <= z)) for name, a, z in COUNT_CLASSES},
        "zero_prediction": share(ts["pred"] == 0),
    }


def _baseline_preds(m: pd.DataFrame, train_years, sel, by_month: bool) -> pd.Series:
    """VIIRS predicted from MODIS with one ratio (by_month False) or one ratio per calendar month, fitted on the
    complete VIIRS months of train_years. A month without MODIS in training falls back to the constant ratio."""
    w = m[m["year"].isin(list(train_years)) & (m.index >= VIIRS_START)]
    obs, mod = _obs(w), (w["modis_D"] + w["modis_N"]).astype(float)
    k = obs.sum() / mod.sum() if mod.sum() > 0 else np.nan
    modis = (m["modis_D"] + m["modis_N"]).astype(float)[sel]
    if not by_month:
        return modis * k
    km = (obs.groupby(w["month"]).sum() / mod.groupby(w["month"]).sum()).replace([np.inf], np.nan)
    return modis * m.loc[sel, "month"].map(km).fillna(k)


def baselines(m: pd.DataFrame) -> dict:
    """Ablation (audit BC3-006): the same LOYO and 2020-2025 tests for a constant ratio and a per-month ratio."""
    def mdape(df):
        a = _annual(df)["err_pct"].abs()
        return round(float(np.nanmedian(a)), 1) if a.notna().any() else None

    out = {}
    for name, by_month in (("constant_ratio", False), ("month_ratio", True)):
        parts = []
        for y in FIT_YEARS:
            sel = (m["year"] == y) & (m.index >= VIIRS_START)
            parts.append(pd.DataFrame({"pred": _baseline_preds(m, [x for x in FIT_YEARS if x != y], sel, by_month),
                                       "obs": _obs(m)[sel], "modis": (m["modis_D"] + m["modis_N"])[sel], "year": y}))
        sel = (m["year"] >= 2020) & (m["year"] <= FULL_YEARS[-1])
        ts = pd.DataFrame({"pred": _baseline_preds(m, FIT_YEARS, sel, by_month), "obs": _obs(m)[sel],
                           "modis": (m["modis_D"] + m["modis_N"])[sel], "year": m.loc[sel, "year"]})
        out[name] = {"loyo_mdape_pct": mdape(pd.concat(parts)), "time_split_mdape_pct": mdape(ts)}
    w = m[m["year"].isin(list(FIT_YEARS)) & (m.index >= VIIRS_START)]
    mod = (w["modis_D"] + w["modis_N"]).sum()
    out["constant_ratio"]["k"] = round(float(_obs(w).sum() / mod), 3) if mod > 0 else None
    return out


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
        # *_mad_months is the MEAN absolute difference in months (audit BC-004); the field names stay for the contract.
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
    b = band(lo)
    res = {
        "season_start_month_validation": start_month,
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
        "band_coverage": band_coverage(ts, b),
    }
    res["baselines"] = baselines(m)
    res["baselines"]["full_model"] = {"loyo_mdape_pct": res["loyo"]["annual_mdape_pct"],
                                      "time_split_mdape_pct": res["time_split"]["annual_mdape_pct"]}
    res["quality"] = quality(res)
    return res, b


def raw_start_month(m: pd.DataFrame, clim_end: str = CLIM_END) -> int:
    """Climatological minimum month of the MODIS series up to clim_end (scale-free; used before harm exists)."""
    s = (m["modis_D"] + m["modis_N"]).astype(float)
    return int(np.nanargmin(climatology(s[s.index <= clim_end]))) + 1


def validation_start_month(m: pd.DataFrame) -> int:
    """Season start for the validation: MODIS climatology up to 2011, before any VIIRS validation year."""
    return raw_start_month(m, VALIDATION_CLIM_END)
