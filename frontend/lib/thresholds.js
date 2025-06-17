// thresholds.js  –  central place for alarm limits
export const THRESHOLDS = {
  highHigh: 50,
  high:     35,
  low:      25,
  lowLow:   10,
};

// helper → returns "HIGH HIGH" | "HIGH" | "LOW" | "LOW LOW" | null
export function levelFor(value) {
  if (value >= THRESHOLDS.highHigh) return "HIGH HIGH";
  if (value >= THRESHOLDS.high)     return "HIGH";
  if (value <= THRESHOLDS.lowLow)   return "LOW LOW";
  if (value <= THRESHOLDS.low)      return "LOW";
  return null;
}
