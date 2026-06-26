/**
 * RDU (Rational Drug Use) screening — เกณฑ์ตัวชี้วัดของกระทรวงสาธารณสุข
 *
 * แต่ละ template มี
 *  - trigger drug: ยาที่ทำให้กฎนี้เข้าข่ายตรวจสอบ (เช่น ATB ATC J01, NSAIDs, long-acting BZD)
 *  - condition: เงื่อนไขที่ทำให้การใช้ "อาจไม่เหมาะสมตาม RDU"
 *      • icd10/context ที่ pharmacist tick (รหัส visit) — ระบบไม่ดึงจาก HIS เลยต้องให้ tick
 *      • age (auto จาก patient.age)
 *      • eGFR (auto จาก patient.egfr/scr)
 *
 * Behavior:
 *  - ถ้า trigger drug อยู่ใน Rx + condition match → 🚨 alert "อาจไม่เหมาะสม"
 *  - ถ้า trigger drug อยู่ใน Rx แต่ condition ที่เป็น context ยังไม่ได้ tick → info "ตรวจสอบเพิ่ม"
 *  - ถ้าไม่มี trigger drug → ไม่ทำอะไร
 */
import type { DrugEntry, PatientInput, ScreeningAlert } from '@/types/screening'

// ============ Trigger drug detectors ============
function isAntibiotic(d: DrugEntry): boolean {
  const cat = (d.master?.drug_category ?? '').toLowerCase()
  const cls = (d.master?.drug_class ?? '').toLowerCase()
  const gen = (d.master?.generic_name ?? '').toLowerCase()
  const name = (d.master?.drug_name ?? d.drug_name ?? '').toLowerCase()
  const hay = `${cat} ${cls} ${gen} ${name}`
  if (/antibiotic|antibacterial|penicillin|cephalosporin|macrolide|quinolone|fluoroquinolone|aminoglycoside|tetracycline|sulfa|carbapenem|glycopeptide/i.test(hay)) return true
  const atbGenerics = [
    'amoxicillin', 'amoxycillin', 'penicillin', 'ampicillin', 'cloxacillin', 'dicloxacillin',
    'cephalexin', 'cefazolin', 'cefuroxime', 'cefotaxime', 'ceftriaxone', 'ceftazidime', 'cefepime', 'cefixime',
    'azithromycin', 'erythromycin', 'clarithromycin', 'roxithromycin',
    'ciprofloxacin', 'norfloxacin', 'ofloxacin', 'levofloxacin', 'moxifloxacin',
    'doxycycline', 'tetracycline', 'metronidazole', 'tinidazole',
    'cotrimoxazole', 'trimethoprim', 'sulfamethoxazole',
    'gentamicin', 'amikacin', 'streptomycin', 'tobramycin',
    'vancomycin', 'teicoplanin', 'clindamycin', 'lincomycin',
    'meropenem', 'imipenem', 'ertapenem',
    'rifampicin', 'isoniazid', 'pyrazinamide', 'ethambutol',
    'fosfomycin', 'nitrofurantoin',
  ]
  if (atbGenerics.some((a) => gen.includes(a))) return true
  return false
}

function isNsaidOrCoxib(d: DrugEntry): boolean {
  const hay = [
    d.master?.generic_name, d.master?.drug_class, d.master?.drug_category, d.master?.drug_name, d.drug_name,
  ].filter(Boolean).join(' ').toLowerCase()
  const keys = [
    'ibuprofen', 'naproxen', 'diclofenac', 'mefenamic', 'indomethacin', 'piroxicam',
    'meloxicam', 'celecoxib', 'etoricoxib', 'ketorolac', 'aspirin', 'nsaid',
    'nonsteroidal', 'anti-inflammatory', 'cox-2', 'coxib',
  ]
  return keys.some((k) => hay.includes(k))
}

const LONG_ACTING_BZD = ['diazepam', 'chlordiazepoxide', 'dipotassium chlorazepate', 'clorazepate']

function isLongActingBenzo(d: DrugEntry): boolean {
  const gen = (d.master?.generic_name ?? '').toLowerCase()
  const name = (d.master?.drug_name ?? d.drug_name ?? '').toLowerCase()
  return LONG_ACTING_BZD.some((k) => gen.includes(k) || name.includes(k))
}

function isOral(d: DrugEntry): boolean {
  const df = (d.master?.dosage_form ?? '').toLowerCase()
  const form = (d.master?.form ?? '').toLowerCase()
  return /tab|cap|syr|susp|sol|oral|elix|drop/i.test(df + ' ' + form) && !/injection|inject\b|^inj/i.test(df)
}

// ============ RDU rule definitions ============
export type RduContextKey = 'URI' | 'DIARRHEA' | 'NORMAL_LABOR' | 'TRAUMA'

export interface RduContextOption {
  key: RduContextKey
  label: string
  emoji: string
  hint: string
}

/** ตัวเลือก context (รหัสกลุ่มโรค) ที่ pharmacist ติ๊ก เมื่อ trigger drug ปรากฏ */
export const RDU_CONTEXT_OPTIONS: RduContextOption[] = [
  { key: 'URI', label: 'URI / ไข้หวัด', emoji: '🤧', hint: 'J00–J06, J20–J21, H65–H66' },
  { key: 'DIARRHEA', label: 'อุจจาระร่วงเฉียบพลัน', emoji: '💧', hint: 'A00–A09, K52' },
  { key: 'NORMAL_LABOR', label: 'คลอดปกติ (O80.0)', emoji: '🤰', hint: 'IPD Pdx เท่านั้น' },
  { key: 'TRAUMA', label: 'บาดแผลสด/อุบัติเหตุ', emoji: '🩹', hint: 'S/T codes + V/W/X external' },
]

interface RduCheck {
  id: string
  name: string
  target: string
  source: string
  reason: string
  triggerLabel: string
  triggerMatch: (d: DrugEntry) => boolean
  /** ตรวจเงื่อนไข — return:
   *   'inappropriate' = match แน่นอน (alert orange/red)
   *   'remind' = trigger present แต่ต้อง confirm context (alert blue info)
   *   'ok' = ไม่ต้องเตือน */
  evaluate: (triggerDrugs: DrugEntry[], patient: PatientInput) => 'inappropriate' | 'remind' | 'ok'
  contextKey?: RduContextKey
}

const RDU_CHECKS: RduCheck[] = [
  {
    id: 'rdu-uri-atb',
    name: 'ATB ใน URI',
    target: '≤ 20%',
    source: 'RDU MOPH รายงาน 1',
    reason: 'การติดเชื้อทางเดินหายใจส่วนบนส่วนใหญ่เกิดจากไวรัส — ATB ไม่ช่วยและไม่จำเป็น',
    triggerLabel: 'ยาปฏิชีวนะ (ATB)',
    triggerMatch: isAntibiotic,
    contextKey: 'URI',
    evaluate: (_drugs, patient) => {
      if (patient.rdu_context?.includes('URI')) return 'inappropriate'
      return 'remind'
    },
  },
  {
    id: 'rdu-diarrhea-atb',
    name: 'ATB ในอุจจาระร่วงเฉียบพลัน',
    target: '≤ 20%',
    source: 'RDU MOPH รายงาน 2',
    reason: 'อุจจาระร่วงส่วนใหญ่หายเองได้ — ATB เพิ่มความเสี่ยงดื้อยาโดยไม่จำเป็น',
    triggerLabel: 'ยาปฏิชีวนะ (ATB)',
    triggerMatch: isAntibiotic,
    contextKey: 'DIARRHEA',
    evaluate: (_drugs, patient) => {
      if (patient.rdu_context?.includes('DIARRHEA')) return 'inappropriate'
      return 'remind'
    },
  },
  {
    id: 'rdu-nsaid-ckd3',
    name: 'NSAIDs ใน CKD stage 3+',
    target: '≤ 10%',
    source: 'RDU MOPH (NSAIDs + eGFR<60)',
    reason: 'NSAIDs ลดเลือดไปเลี้ยงไต → เพิ่มเสี่ยง AKI ในผู้ป่วย CKD stage 3 ขึ้นไป',
    triggerLabel: 'NSAIDs / COX-2',
    triggerMatch: isNsaidOrCoxib,
    evaluate: (_drugs, patient) => {
      // มี eGFR — เช็คอัตโนมัติ
      if (patient.egfr !== undefined) {
        return patient.egfr < 60 ? 'inappropriate' : 'ok'
      }
      // ไม่มี eGFR → เตือนให้ check
      return 'remind'
    },
  },
  {
    id: 'rdu-normal-labor-atb',
    name: 'ATB ในคลอดปกติ',
    target: '≤ 10%',
    source: 'RDU MOPH รายงาน 4 (Pdx O80.0)',
    reason: 'คลอดปกติทางช่องคลอด (Pdx O80.0) ไม่ต้องการ ATB',
    triggerLabel: 'ยาปฏิชีวนะ (ATB)',
    triggerMatch: isAntibiotic,
    contextKey: 'NORMAL_LABOR',
    evaluate: (_drugs, patient) => {
      if (patient.rdu_context?.includes('NORMAL_LABOR')) return 'inappropriate'
      return 'remind'
    },
  },
  {
    id: 'rdu-trauma-atb',
    name: 'ATB ในบาดแผลสด/อุบัติเหตุ',
    target: '3.1 ≤ 40% · 3.2 monitoring',
    source: 'RDU MOPH รายงาน 3.1/3.2',
    reason: 'บาดแผลสดส่วนใหญ่ไม่จำเป็นต้อง ATB — เว้นแผลสัตว์กัด แผลลึกถึงกล้าม แผลไหม้',
    triggerLabel: 'ยาปฏิชีวนะ (ATB)',
    triggerMatch: isAntibiotic,
    contextKey: 'TRAUMA',
    evaluate: (_drugs, patient) => {
      if (patient.rdu_context?.includes('TRAUMA')) return 'inappropriate'
      return 'remind'
    },
  },
  {
    id: 'rdu-longacting-benzo-elderly',
    name: 'Long-acting BZD ในผู้สูงอายุ',
    target: '≤ 5%',
    source: 'RDU MOPH (Diazepam/Chlordiazepoxide/Clorazepate ในอายุ ≥65)',
    reason: 'BZD ครึ่งชีวิตยาวสะสมในผู้สูงอายุ — เสี่ยงล้ม, ความจำเสื่อม, สับสน',
    triggerLabel: 'Long-acting BZD',
    triggerMatch: (d) => isLongActingBenzo(d) && isOral(d),
    evaluate: (_drugs, patient) => {
      if (patient.age !== undefined && patient.age >= 65) return 'inappropriate'
      if (patient.age === undefined) return 'remind'
      return 'ok'
    },
  },
]

// ============ Public entry point ============
export function buildRduAlerts(drugs: DrugEntry[], patient: PatientInput): ScreeningAlert[] {
  const alerts: ScreeningAlert[] = []
  for (const check of RDU_CHECKS) {
    const triggerDrugs = drugs.filter(check.triggerMatch)
    if (triggerDrugs.length === 0) continue
    const verdict = check.evaluate(triggerDrugs, patient)
    if (verdict === 'ok') continue
    const drugNames = triggerDrugs.map((d) => d.master?.drug_name ?? d.icode).join(', ')
    const inappropriate = verdict === 'inappropriate'
    alerts.push({
      id: `rdu_${check.id}`,
      type: 'RDU',
      severity: inappropriate ? 'orange' : 'blue',
      title: inappropriate
        ? `📋 RDU: ${check.name} — อาจไม่เหมาะสม`
        : `📋 RDU: ${check.name} — ตรวจสอบเพิ่ม`,
      detail: inappropriate
        ? `${check.reason}\nยา: ${drugNames}\nเป้าหมาย: ${check.target} · ${check.source}`
        : `พบยา ${check.triggerLabel} (${drugNames}) — ${check.contextKey ? 'ติ๊ก context ผู้ป่วยด้านบนเพื่อตรวจ' : 'กรอกข้อมูลที่เกี่ยวข้องเพื่อตรวจอัตโนมัติ'}\n${check.reason}\nเป้าหมาย: ${check.target} · ${check.source}`,
      drugs: triggerDrugs.map((d) => d.icode),
      recommendation: inappropriate
        ? 'พิจารณาความจำเป็น · ถ้าไม่ตรงเกณฑ์ → พิจารณาไม่จ่ายและ counseling ผู้ป่วย'
        : undefined,
    })
  }
  return alerts
}

/** หา trigger drug categories ที่ active ในใบสั่งรอบนี้ — ใช้ใน UI ว่าจะโชว์ context picker หรือไม่ */
export function getActiveRduTriggers(drugs: DrugEntry[]): {
  needsContext: boolean
  triggers: string[]
} {
  const triggers: string[] = []
  let needsContext = false
  if (drugs.some(isAntibiotic)) {
    triggers.push('ATB')
    needsContext = true
  }
  if (drugs.some(isNsaidOrCoxib)) triggers.push('NSAIDs')
  if (drugs.some((d) => isLongActingBenzo(d) && isOral(d))) triggers.push('LongActBZD')
  return { needsContext, triggers }
}
