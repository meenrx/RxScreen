/**
 * Renal dose helpers — Cockcroft-Gault + IBW + dose_meta parser
 *
 * dose_meta format ที่รองรับ (semicolon-separated rules):
 *   "CrCl<10:hold; CrCl 10-50:1g q24h; CrCl>50:1g q12h"
 *   "CrCl<30:avoid; CrCl 30-50:reduce 50%"
 */

export interface RenalInput {
  age: number          // ปี
  weight: number       // kg (actual body weight)
  height?: number      // cm
  sex: 'M' | 'F'
  scr: number          // mg/dL
}

export interface RenalResult {
  crcl: number
  ibw: number | null
  weightUsed: number
  weightBasis: 'IBW' | 'ABW' | 'AdjBW'
  formula: string
}

/** Ideal Body Weight (Devine formula) — ต้องมีส่วนสูง */
export function calcIBW(heightCm: number, sex: 'M' | 'F'): number {
  const heightInches = heightCm / 2.54
  const over60 = Math.max(0, heightInches - 60)
  const base = sex === 'M' ? 50 : 45.5
  return +(base + 2.3 * over60).toFixed(2)
}

/** Adjusted body weight = IBW + 0.4 * (ABW - IBW), ใช้เมื่อ ABW > 1.3 * IBW */
export function calcAdjBW(abw: number, ibw: number): number {
  return +(ibw + 0.4 * (abw - ibw)).toFixed(2)
}

/** Cockcroft-Gault CrCl (mL/min) — เลือก weight ตาม clinical rule */
export function calcCrCl(input: RenalInput): RenalResult {
  const { age, weight, height, sex, scr } = input
  let weightUsed = weight
  let weightBasis: 'IBW' | 'ABW' | 'AdjBW' = 'ABW'
  let ibw: number | null = null

  if (height && height > 0) {
    ibw = calcIBW(height, sex)
    if (weight < ibw) {
      weightUsed = weight
      weightBasis = 'ABW'
    } else if (weight > 1.3 * ibw) {
      weightUsed = calcAdjBW(weight, ibw)
      weightBasis = 'AdjBW'
    } else {
      weightUsed = ibw
      weightBasis = 'IBW'
    }
  }

  const sexFactor = sex === 'F' ? 0.85 : 1
  const crcl = ((140 - age) * weightUsed * sexFactor) / (72 * scr)

  return {
    crcl: +crcl.toFixed(1),
    ibw,
    weightUsed: +weightUsed.toFixed(2),
    weightBasis,
    formula: `((140 - ${age}) × ${weightUsed} × ${sexFactor}) / (72 × ${scr})`,
  }
}

export interface DoseRule {
  condition: string         // raw
  matches: (crcl: number) => boolean
  action: string            // เช่น "1g q24h", "hold"
}

/**
 * Parse dose_meta string → DoseRule[]
 * รองรับรูปแบบ:
 *   CrCl<10:hold
 *   CrCl 10-50:1g q24h
 *   CrCl>=30:full dose
 *   CrCl>50:1g q12h
 */
export function parseDoseMeta(meta: string | undefined): DoseRule[] {
  if (!meta) return []
  return meta
    .split(/[;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line): DoseRule | null => {
      const [cond, ...rest] = line.split(':')
      if (!cond || rest.length === 0) return null
      const action = rest.join(':').trim()
      const condition = cond.trim()
      const matches = buildMatcher(condition)
      if (!matches) return null
      return { condition, matches, action }
    })
    .filter((r): r is DoseRule => r !== null)
}

function buildMatcher(cond: string): ((crcl: number) => boolean) | null {
  // strip optional "CrCl" prefix
  const c = cond.replace(/^CrCl\s*/i, '').trim()
  // range like "10-50"
  const range = c.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/)
  if (range) {
    const lo = parseFloat(range[1])
    const hi = parseFloat(range[2])
    return (crcl) => crcl >= lo && crcl <= hi
  }
  // operators
  const op = c.match(/^(<=|>=|<|>|=)\s*(\d+(?:\.\d+)?)$/)
  if (op) {
    const value = parseFloat(op[2])
    switch (op[1]) {
      case '<': return (crcl) => crcl < value
      case '<=': return (crcl) => crcl <= value
      case '>': return (crcl) => crcl > value
      case '>=': return (crcl) => crcl >= value
      case '=': return (crcl) => crcl === value
    }
  }
  return null
}

export function findMatchingDoseAction(meta: string | undefined, crcl: number): string | null {
  const rules = parseDoseMeta(meta)
  const matched = rules.find((r) => r.matches(crcl))
  return matched ? matched.action : null
}
