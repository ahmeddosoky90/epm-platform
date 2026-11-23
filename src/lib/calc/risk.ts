/** Configurable 5x5 matrix. Score = probability × impact; bands per thresholds. */
export const RISK_BANDS = [
  { min: 15, label: "Critical", color: "#ff3b30" },
  { min: 8, label: "High", color: "#ff9500" },
  { min: 4, label: "Medium", color: "#ffcc00" },
  { min: 1, label: "Low", color: "#34c759" },
];
export function riskScore(probability: number, impact: number): number {
  if (![probability, impact].every((n) => Number.isInteger(n) && n >= 1 && n <= 5)) throw new Error("Probability and impact must be integers 1..5");
  return probability * impact;
}
export const riskBand = (score: number) => RISK_BANDS.find((b) => score >= b.min) ?? RISK_BANDS[RISK_BANDS.length - 1];
