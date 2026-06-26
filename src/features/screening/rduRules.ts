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
   *   'ok' = ไม่ต้องเตือน */
  evaluate: (triggerDrugs: DrugEntry[], patient: PatientInput) => 'inappropriate' | 'ok'
  /** key ของ context chip ที่ pharmacist ติ๊ก (สำหรับกฎที่ต้องการ ICD-10) */
  contextKey?: RduContextKey
  /** รหัส ICD-10 ที่ครอบคลุม template นี้ — โชว์ใน alert ให้ pharmacist เทียบ HIS */
  icd10Include?: string[]
  icd10Exclude?: string[]
  /** หมายเหตุ ICD-10 เช่น "Pdx เท่านั้น", "ต้องมี V/W/X external cause ร่วม" */
  icd10Note?: string
}

const RDU_CHECKS: RduCheck[] = [
  {
    id: 'rdu-uri-atb',
    name: 'ATB ใน URI / หลอดลมอักเสบเฉียบพลัน',
    target: '≤ 20%',
    source: 'RDU MOPH รายงาน 1',
    reason: 'การติดเชื้อทางเดินหายใจส่วนบนส่วนใหญ่เกิดจากไวรัส — ATB ไม่ช่วยและไม่จำเป็น',
    triggerLabel: 'ยาปฏิชีวนะ (ATB)',
    triggerMatch: isAntibiotic,
    contextKey: 'URI',
    icd10Include: [
      'J00', 'J01.0', 'J01.1', 'J01.2', 'J01.3', 'J01.4', 'J01.8', 'J01.9',
      'J02.0', 'J02.8', 'J02.9',
      'J03.0', 'J03.8', 'J03.9',
      'J04.0', 'J04.1', 'J04.2',
      'J05.0', 'J05.1',
      'J06.0', 'J06.8', 'J06.9',
      'J10.1', 'J11.1',
      'J20.0', 'J20.1', 'J20.2', 'J20.3', 'J20.4', 'J20.5', 'J20.6', 'J20.7', 'J20.8', 'J20.9',
      'J21.0', 'J21.8', 'J21.9',
      'H65.0', 'H65.1', 'H65.9',
      'H66.0', 'H66.4', 'H66.9',
      'B05.3', 'J32.9',
    ],
    icd10Exclude: ['H67.0', 'H67.1', 'H67.8', 'H72.0', 'H72.1', 'H72.2', 'H72.8', 'H72.9'],
    evaluate: (_drugs, patient) => patient.rdu_context?.includes('URI') ? 'inappropriate' : 'ok',
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
    icd10Include: [
      'A00', 'A00.0', 'A00.1', 'A00.9',
      'A02.0',
      'A03.0', 'A03.1', 'A03.2', 'A03.3', 'A03.8', 'A03.9',
      'A04.0', 'A04.1', 'A04.2', 'A04.3', 'A04.4', 'A04.5', 'A04.6', 'A04.7', 'A04.8', 'A04.9',
      'A05.0', 'A05.3', 'A05.4', 'A05.8', 'A05.9',
      'A06.0', 'A06.1',
      'A08.0', 'A08.1', 'A08.2', 'A08.3', 'A08.4', 'A08.5',
      'A09', 'A09.0', 'A09.9',
      'K52.1', 'K52.8', 'K52.9',
    ],
    icd10Note: 'A09 เป็น invalid code — แนะนำใช้ A09.0 หรือ A09.9',
    evaluate: (_drugs, patient) => patient.rdu_context?.includes('DIARRHEA') ? 'inappropriate' : 'ok',
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
      if (patient.egfr !== undefined) return patient.egfr < 60 ? 'inappropriate' : 'ok'
      return 'ok'  // ไม่มี eGFR → ไม่เตือน (กลไก renal/CKD ของระบบจัดการแยก)
    },
  },
  {
    id: 'rdu-normal-labor-atb',
    name: 'ATB ในคลอดปกติ',
    target: '≤ 10%',
    source: 'RDU MOPH รายงาน 4',
    reason: 'คลอดปกติทางช่องคลอด (Pdx O80.0) ไม่ต้องการ ATB',
    triggerLabel: 'ยาปฏิชีวนะ (ATB)',
    triggerMatch: isAntibiotic,
    contextKey: 'NORMAL_LABOR',
    icd10Include: ['O80.0'],
    icd10Note: 'ใช้เป็น Pdx (Principal Diagnosis) เท่านั้น · IPD',
    evaluate: (_drugs, patient) => patient.rdu_context?.includes('NORMAL_LABOR') ? 'inappropriate' : 'ok',
  },
  {
    id: 'rdu-trauma-atb',
    name: 'ATB ในบาดแผลสด/อุบัติเหตุ',
    target: '3.1 ≤ 40% · 3.2 monitoring',
    source: 'RDU MOPH รายงาน 3.1/3.2',
    reason: 'บาดแผลสดส่วนใหญ่ไม่จำเป็นต้อง ATB — เว้นแผลสัตว์กัด แผลลึกถึงกล้าม แผลไหม้น้ำร้อนลวก',
    triggerLabel: 'ยาปฏิชีวนะ (ATB)',
    triggerMatch: isAntibiotic,
    contextKey: 'TRAUMA',
    icd10Include: [
      'S00-S01', 'S09.1', 'S09.8', 'S09.9', 'S10.7-S10.9', 'S11.7-S11.9',
      'S16', 'S19', 'S20-S21', 'S29', 'S30-S31', 'S39.0', 'S39.8-S39.9',
      'S40-S41', 'S46', 'S49', 'S50-S51', 'S56', 'S59', 'S60-S61', 'S66',
      'S69', 'S70-S71', 'S76', 'S79', 'S80-S81', 'S86', 'S89', 'S90-S91',
      'S96', 'S99',
      'T00-T01', 'T07', 'T09.0-T09.1', 'T09.5', 'T11.0-T11.1', 'T11.5',
      'T13.0-T13.1', 'T13.5', 'T14.0-T14.1', 'T14.6', 'T14.9',
      'T20-T25', 'T29-T32',
    ],
    icd10Note: 'ต้องมี ICD-10 external cause ร่วม: V01-V99, W00-W99, X00-X59',
    evaluate: (_drugs, patient) => patient.rdu_context?.includes('TRAUMA') ? 'inappropriate' : 'ok',
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

    // สร้าง ICD-10 section ถ้ามี — ใช้เป็น checklist เทียบ HIS
    const icdLines: string[] = []
    if (check.icd10Include?.length) {
      icdLines.push(`📌 ผู้ป่วยรายนี้ต้องไม่มี ICD-10:\n${check.icd10Include.join(', ')}`)
      if (check.icd10Exclude?.length) {
        icdLines.push(`(ยกเว้นรหัสที่ระบุไม่นับ: ${check.icd10Exclude.join(', ')})`)
      }
      if (check.icd10Note) icdLines.push(`หมายเหตุ: ${check.icd10Note}`)
    }

    alerts.push({
      id: `rdu_${check.id}`,
      type: 'RDU',
      severity: 'orange',
      title: `📋 RDU: ${check.name} — อาจไม่เหมาะสม`,
      detail: [
        check.reason,
        `ยา: ${drugNames}`,
        ...icdLines,
        `เป้าหมาย: ${check.target} · ${check.source}`,
      ].join('\n'),
      drugs: triggerDrugs.map((d) => d.icode),
      recommendation: 'ถ้าผู้ป่วยมี ICD-10 ในรายการข้างต้น → พิจารณาไม่จ่าย + counseling',
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
