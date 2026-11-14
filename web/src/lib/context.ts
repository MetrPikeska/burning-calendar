// Context factors for one month (fire weather, drought, land cover). DOM-free: shared with api/mcp.ts.
// The values are written by pipeline/factors.py and may be absent. They give context for the calendar,
// not an explanation or a prediction.
import type { FwiLevel, RegionContext, RegionFile, SpeiLevel } from "./contract.ts";

export interface MonthContext {
  fwi: { value: number; pct: number | null; level: FwiLevel | null } | null;
  spei: { label: "SPEI-3" | "SPEI-6"; value: number; level: SpeiLevel | null }[];
  landcover: RegionContext["landcover"];
}

/** Context for `ym`, or null when the region has no context data at all for that month. */
export function contextFor(region: Pick<RegionFile, "months" | "context">, ym: string): MonthContext | null {
  const rec = region.months.find((m) => m.ym === ym);
  const fwi = rec?.fwi != null ? { value: rec.fwi, pct: rec.fwi_pct ?? null, level: rec.fwi_level ?? null } : null;
  const spei: MonthContext["spei"] = [];
  if (rec?.spei3 != null) spei.push({ label: "SPEI-3", value: rec.spei3, level: rec.spei3_level ?? null });
  if (rec?.spei6 != null) spei.push({ label: "SPEI-6", value: rec.spei6, level: rec.spei6_level ?? null });
  const landcover = region.context?.landcover ?? null;
  if (!fwi && !spei.length && !landcover) return null;
  return { fwi, spei, landcover };
}

export const FWI_WORDS: Record<FwiLevel, string> = {
  normal: "normal fire weather",
  elevated: "elevated fire weather (top quarter)",
  critical: "critical fire weather (top decile)",
};

export const SPEI_WORDS: Record<SpeiLevel, string> = {
  dry: "dry",
  normal: "near normal",
  wet: "wet",
};

/** One-sentence text for tools and the CSV hint: levels in words, no causal claim. */
export function contextSentence(c: MonthContext): string {
  const parts: string[] = [];
  if (c.fwi) {
    parts.push(`FWI ${c.fwi.value.toFixed(1)}${c.fwi.pct != null ? ` (percentile ${Math.round(c.fwi.pct)} of this calendar month)` : ""}${c.fwi.level ? `, ${FWI_WORDS[c.fwi.level]}` : ""}`);
  }
  for (const s of c.spei) parts.push(`${s.label} ${s.value.toFixed(2)}${s.level ? ` (${SPEI_WORDS[s.level]})` : ""}`);
  return parts.join("; ");
}
