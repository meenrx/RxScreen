/** Insulin Sliding Scale calculator — มาตรฐาน hospital pharmacy ไทย */

export interface SlidingScaleRule {
  bs_min: number
  bs_max: number
  units: number
  note?: string
}

/** Sliding scale มาตรฐาน — Regular Insulin SC */
export const STANDARD_SCALE: SlidingScaleRule[] = [
  { bs_min: 0, bs_max: 69, units: 0, note: '⚠ Hypoglycemia! ให้ 50% Dextrose 50 mL IV หรือ glucose paste — recheck 15 นาที' },
  { bs_min: 70, bs_max: 150, units: 0, note: 'อยู่ในเป้าหมาย ไม่ต้องให้ insulin' },
  { bs_min: 151, bs_max: 200, units: 2 },
  { bs_min: 201, bs_max: 250, units: 4 },
  { bs_min: 251, bs_max: 300, units: 6 },
  { bs_min: 301, bs_max: 350, units: 8 },
  { bs_min: 351, bs_max: 400, units: 10, note: 'ตรวจ urine ketone' },
  { bs_min: 401, bs_max: 9999, units: 12, note: '⚠ BS สูงมาก พิจารณา DKA — call MD + ตรวจ ABG, ketone' },
]

/** Aggressive scale — ผู้ป่วย insulin-resistant */
export const AGGRESSIVE_SCALE: SlidingScaleRule[] = [
  { bs_min: 0, bs_max: 69, units: 0, note: '⚠ Hypoglycemia!' },
  { bs_min: 70, bs_max: 150, units: 0 },
  { bs_min: 151, bs_max: 200, units: 4 },
  { bs_min: 201, bs_max: 250, units: 6 },
  { bs_min: 251, bs_max: 300, units: 8 },
  { bs_min: 301, bs_max: 350, units: 10 },
  { bs_min: 351, bs_max: 400, units: 12, note: 'ตรวจ urine ketone' },
  { bs_min: 401, bs_max: 9999, units: 14, note: '⚠ BS สูงมาก พิจารณา DKA' },
]

export interface SlidingScaleResult {
  rule?: SlidingScaleRule
  units: number
  note?: string
  recheckMinutes: number
}

export function calcInsulinSlidingScale(bs: number, scale: SlidingScaleRule[] = STANDARD_SCALE): SlidingScaleResult {
  const rule = scale.find((r) => bs >= r.bs_min && bs <= r.bs_max)
  if (!rule) return { units: 0, recheckMinutes: 60 }
  const recheckMinutes = bs < 70 ? 15 : bs > 400 ? 30 : 60
  return { rule, units: rule.units, note: rule.note, recheckMinutes }
}
