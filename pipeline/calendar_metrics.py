"""Season metrics, anomalies and outage flags from a monthly series.

Onset/end: first month where the cumulative within-season count reaches 10% / 90%
(Freeborn et al. 2014). Peak month: highest mean count (Giglio et al. 2006).
Season year starts at the climatological minimum month and is labelled by the
calendar year that holds most of its months: the start year when the season starts
in Jan-Jul, the next year when it starts in Aug-Dec (a Dec 2019 - Nov 2020 season is
2020). Months are 1-12.
"""

import numpy as np
import pandas as pd

ONSET_Q, END_Q = 0.10, 0.90


def climatology(s: pd.Series) -> np.ndarray:
    """Mean count per calendar month (index 0 = Jan). `s` is indexed by 'YYYY-MM'."""
    mo = s.index.str[5:7].astype(int)
    return s.groupby(mo).mean().reindex(range(1, 13)).to_numpy()


def onset_end(values12: np.ndarray, start_month: int) -> tuple[int | None, int | None, int | None]:
    """values12 ordered from start_month. Returns (onset, end, length) as calendar months."""
    total = values12.sum()
    if not total > 0:
        return None, None, None
    cum = np.cumsum(values12) / total
    i_on = int(np.argmax(cum >= ONSET_Q))
    i_end = int(np.argmax(cum >= END_Q))
    to_month = lambda i: (start_month - 1 + i) % 12 + 1
    return to_month(i_on), to_month(i_end), i_end - i_on + 1


def is_bimodal(clim: np.ndarray) -> bool:
    """Two circular peaks >= 2 months apart, each trough < 50% of the smaller peak."""
    peaks = [i for i in range(12) if clim[i] > clim[i - 1] and clim[i] >= clim[(i + 1) % 12]]
    if len(peaks) < 2:
        return False
    peaks.sort(key=lambda i: clim[i], reverse=True)
    a = peaks[0]
    for b in peaks[1:]:
        dist = min((a - b) % 12, (b - a) % 12)
        if dist < 2:
            continue
        lo, hi = sorted((a, b))
        arc1 = clim[lo:hi + 1].min()
        arc2 = np.concatenate([clim[hi:], clim[:lo + 1]]).min()
        small = min(clim[a], clim[b])
        return bool(max(arc1, arc2) < 0.5 * small)
    return False


def season_metrics(s: pd.Series, start_month: int | None = None,
                   clim_end: str | None = None) -> tuple[dict, list[dict]]:
    """Climatology summary and per-season-year metrics for a monthly series.
    start_month defaults to the climatological minimum of `s`. clim_end (YYYY-MM) limits the
    climatology to months up to it; season years are still listed for the whole series."""
    clim = climatology(s[s.index <= clim_end] if clim_end else s)
    start = start_month or int(np.nanargmin(clim)) + 1
    order = [(start - 1 + i) % 12 + 1 for i in range(12)]
    on, end, length = onset_end(clim[[m - 1 for m in order]], start)
    summary = {"peak_month": int(np.nanargmax(clim)) + 1, "onset": on, "end": end,
               "season_length": length, "season_start_month": start, "bimodal": is_bimodal(clim)}
    years = []
    first, last = int(s.index[0][:4]), int(s.index[-1][:4])
    for y in range(first, last + 1):
        yms = [f"{y + (start - 1 + i) // 12}-{(start - 1 + i) % 12 + 1:02d}" for i in range(12)]
        if not all(ym in s.index for ym in yms):
            continue
        v = s.loc[yms].to_numpy(dtype=float)
        if np.isnan(v).any():
            continue
        o, e, l = onset_end(v, start)
        years.append({"season_year": y + (1 if start >= 8 else 0), "onset": o, "end": e, "season_length": l,
                      "peak_month": order[int(np.argmax(v))] if v.sum() > 0 else None,
                      "total": round(float(v.sum()), 1)})
    return summary, years


def anomalies(s: pd.Series, baseline_floor: int = 2002, baseline_n: int = 10) -> pd.DataFrame:
    """Percentile rank of each month among the same month of the preceding 10 years.
    Years whose 10-year window would start before `baseline_floor` use
    baseline_floor..baseline_floor+9 minus the target year. anom = above baseline p90.
    Also returns baseline_median, baseline_p90 and baseline_years (the window as text)."""
    df = pd.DataFrame({"v": s.astype(float)})
    df["year"] = df.index.str[:4].astype(int)
    df["month"] = df.index.str[5:7].astype(int)
    piv = df.pivot(index="year", columns="month", values="v")
    rows = []
    for ym, r in df.iterrows():
        y, mo, x = int(r["year"]), int(r["month"]), r["v"]
        if y - baseline_n >= baseline_floor:
            base_years = list(range(y - baseline_n, y))
            label = f"{y - baseline_n}-{y - 1}"
        else:
            lo, hi = baseline_floor, baseline_floor + baseline_n - 1
            base_years = [b for b in range(lo, hi + 1) if b != y]
            label = f"{lo}-{hi}" + (f" without {y}" if lo <= y <= hi else "")
        base = piv.loc[piv.index.isin(base_years), mo].dropna().to_numpy()
        if len(base) < 5:
            rows.append((None, False, None, None, None))
            continue
        med = round(float(np.median(base)), 1)
        p90 = round(float(np.percentile(base, 90)), 1)
        if np.isnan(x):
            rows.append((None, False, med, p90, label))
            continue
        p = 100 * ((base < x).sum() + 0.5 * (base == x).sum()) / len(base)
        rows.append((round(float(p), 1), bool(x > 0 and x > np.percentile(base, 90)), med, p90, label))
    return pd.DataFrame(rows, index=df.index,
                        columns=["anom_pct", "anom", "baseline_median", "baseline_p90", "baseline_years"])


def outage_days(yms: pd.Index, outages: pd.DataFrame) -> pd.Series:
    """Days per month covered by any listed outage (pass the rows of one sensor)."""
    days = pd.Series(0, index=yms)
    for _, o in outages.iterrows():
        for d in pd.date_range(o["start"], o["end"], freq="D"):
            key = d.strftime("%Y-%m")
            if key in days.index:
                days[key] += 1
    return days
