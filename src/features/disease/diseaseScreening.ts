import type { DiseaseRule } from '@/types/drug'

/**
 * Disease-based screening
 * - parse DISEASE_RULES.screening_notes ในรูปแบบ "condition=action | condition=action | ..."
 * - condition ตัวอย่าง: "eGFR<30", "INR<2.0", "BW เพิ่ม>5%"
 * - ใช้ match กับค่า lab ที่ผู้ใช้กรอก → ออกผลคำแนะนำ
 */

export interface DiseaseRuleHit {
  condition: string
  action: string
  severity: 'red' | 'orange' | 'yellow' | 'blue'
}

export interface ParsedNote {
  condition: string
  param?: string
  op?: '<' | '<=' | '>' | '>=' | '=' | 'range'
  value?: number
  value2?: number   // for range
  action: string
}

export function parseScreeningNotes(notes: string | undefined): ParsedNote[] {
  if (!notes) return []
  return notes
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => {
      const eqIdx = line.indexOf('=')
      if (eqIdx < 0) return null
      const condition = line.slice(0, eqIdx).trim()
      const action = line.slice(eqIdx + 1).trim()
      const parsed = parseCondition(condition)
      return { condition, ...parsed, action }
    })
    .filter((x): x is ParsedNote => x !== null)
}

function parseCondition(c: string): Pick<ParsedNote, 'param' | 'op' | 'value' | 'value2'> {
  // range "10-50" — param can be before
  const range = c.match(/^([A-Za-z%+฀-๿]+)\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/)
  if (range) {
    return { param: range[1], op: 'range', value: parseFloat(range[2]), value2: parseFloat(range[3]) }
  }
  // op "<", "<=", ">", ">=", "="
  const op = c.match(/^([A-Za-z%+฀-๿\s]+?)\s*(<=|>=|<|>|=)\s*(\d+(?:\.\d+)?)$/)
  if (op) {
    return { param: op[1].trim(), op: op[2] as ParsedNote['op'], value: parseFloat(op[3]) }
  }
  return {}
}

/** Match ค่าที่ผู้ใช้กรอกกับ rules */
export function matchScreeningRules(notes: string | undefined, labValues: Record<string, number | undefined>): DiseaseRuleHit[] {
  const parsed = parseScreeningNotes(notes)
  const hits: DiseaseRuleHit[] = []
  for (const r of parsed) {
    if (!r.param || r.op === undefined) {
      // condition ที่ parse ไม่ได้ → แสดง่าๆ
      hits.push({ condition: r.condition, action: r.action, severity: 'yellow' })
      continue
    }
    const v = labValues[r.param.toLowerCase()] ?? labValues[r.param.toUpperCase()] ?? labValues[r.param]
    if (v === undefined) continue
    let matched = false
    switch (r.op) {
      case '<': matched = v < (r.value ?? 0); break
      case '<=': matched = v <= (r.value ?? 0); break
      case '>': matched = v > (r.value ?? 0); break
      case '>=': matched = v >= (r.value ?? 0); break
      case '=': matched = v === r.value; break
      case 'range': matched = v >= (r.value ?? 0) && v <= (r.value2 ?? Infinity); break
    }
    if (matched) {
      const sev: DiseaseRuleHit['severity'] = /ห้าม|stop|hold|รุนแรง/i.test(r.action) ? 'red'
        : /ลด|ปรับ|reduce|adjust|เพิ่ม|increase/i.test(r.action) ? 'orange' : 'yellow'
      hits.push({ condition: r.condition, action: r.action, severity: sev })
    }
  }
  return hits
}

export function extractLabFields(disease: DiseaseRule): { required: string[]; optional: string[] } {
  const required = (disease.required_labs ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const optional = (disease.optional_labs ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  return { required, optional }
}
