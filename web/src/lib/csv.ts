// Range filter for the static per-region CSV (regions/{id}.csv). Keeps the pipeline's columns
// unchanged, so the full-series file and a filtered download share one format. DOM-free.

/** Keep the header and the rows whose `ym` lies in [from, to] (inclusive, "YYYY-MM"; null = open). */
export function filterCsvByRange(csv: string, from: string | null, to: string | null): string {
  const lines = csv.split(/\r?\n/);
  const header = lines[0] ?? "";
  const ymCol = header.split(",").indexOf("ym");
  if (ymCol < 0) throw new Error("CSV has no ym column");
  const rows = lines.slice(1).filter((line) => {
    if (!line) return false;
    const ym = line.split(",")[ymCol];
    return (!from || ym >= from) && (!to || ym <= to);
  });
  return [header, ...rows].join("\n") + "\n";
}

export function csvFileName(country: string, region: string, from: string | null, to: string | null): string {
  const range = from || to ? `_${from ?? "start"}_${to ?? "end"}` : "";
  return `burning-calendar_${country}_${region}${range}.csv`;
}
