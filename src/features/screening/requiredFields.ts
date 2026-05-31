import type { DrugEntry, PatientInput } from '@/types/screening'
import { renalBasisOf } from '@/features/renal/calc'

export type FieldId =
  | 'age' | 'sex' | 'weight' | 'height' | 'scr' | 'egfr' | 'inr'
  | 'allergies' | 'is_pregnant' | 'is_lactating' | 'g6pd' | 'smoking' | 'alcohol'
  | 'diseases'
  | 'k' | 'na' | 'albumin' | 'hb' | 'plt' | 'ast' | 'alt' | 'bilirubin' | 'glucose'

/** คำที่บ่งชี้ว่าเป็น NSAID (เช็คจาก generic / drug_class / drug_category) */
const NSAID_KEYS = [
  'ibuprofen', 'naproxen', 'diclofenac', 'mefenamic', 'indomethacin', 'piroxicam',
  'meloxicam', 'celecoxib', 'etoricoxib', 'ketorolac', 'aspirin', 'nsaid',
  'nonsteroidal', 'anti-inflammatory', 'propionic', 'arcoxia', 'brufen',
]

function isNsaid(d: DrugEntry): boolean {
  const hay = [
    d.master?.generic_name, d.master?.drug_class, d.master?.drug_category, d.master?.drug_name, d.drug_name,
  ].filter(Boolean).join(' ').toLowerCase()
  return NSAID_KEYS.some((k) => hay.includes(k))
}

export interface RequiredField {
  id: FieldId
  label: string
  unit?: string
  reasons: string[]   // ยาที่ทำให้ field นี้จำเป็น
  priority: 'high' | 'medium' | 'low'
}

/** ตรวจหา fields ที่ต้องการกรอกจากรายการยา */
export function computeRequiredFields(drugs: DrugEntry[]): RequiredField[] {
  const map = new Map<FieldId, RequiredField>()
  function add(id: FieldId, label: string, unit: string | undefined, reason: string, priority: RequiredField['priority']) {
    const ex = map.get(id)
    if (ex) {
      if (!ex.reasons.includes(reason)) ex.reasons.push(reason)
      if (priorityRank(priority) > priorityRank(ex.priority)) ex.priority = priority
    } else {
      map.set(id, { id, label, unit, reasons: [reason], priority })
    }
  }

  // ตรวจ Warfarin → ขอ INR เสมอ
  const hasWarf = drugs.some((d) => {
    const n = (d.master?.drug_name ?? d.drug_name ?? '').toLowerCase()
    const g = d.master?.generic_name?.toLowerCase() ?? ''
    return n.includes('warfarin') || g.includes('warfarin')
  })
  if (hasWarf) {
    add('inr', 'INR', undefined, 'Warfarin → ต้องการ INR เพื่อปรับขนาด', 'high')
  }

  for (const d of drugs) {
    const name = d.master?.drug_name ?? d.icode
    // 1) มี dose_meta → ปรับ dose ตามไต
    //    - rule ที่ใช้ CrCl → ขอ age+weight+sex+scr (คำนวณ Cockcroft-Gault)
    //    - rule ที่ใช้ eGFR → ขอ eGFR ตรง ๆ ไม่ต้องคำนวณ
    const renalRule = d.labRules?.find((r) => r.dose_meta)
    if (renalRule) {
      if (renalBasisOf(renalRule) === 'egfr') {
        add('egfr', 'eGFR', 'mL/min', `${name} → ปรับ dose ตาม eGFR (กรอกค่าตรง)`, 'high')
      } else {
        add('age', 'อายุ', 'ปี', `${name} → ปรับ dose ตาม CrCl`, 'high')
        add('weight', 'น้ำหนัก', 'kg', `${name} → ปรับ dose ตาม CrCl`, 'high')
        add('sex', 'เพศ', undefined, `${name} → ปรับ dose ตาม CrCl`, 'high')
        add('scr', 'SCr', 'mg/dL', `${name} → ปรับ dose ตาม CrCl`, 'high')
      }
    }
    // 1.2) NSAID → ขอค่าไต (eGFR) เพื่อเช็คความปลอดภัย (เสี่ยง AKI)
    if (isNsaid(d)) {
      add('egfr', 'eGFR', 'mL/min', `${name} (NSAID) → ควรเช็คการทำงานของไต`, 'high')
    }
    // 1.5) ยาที่ต้องใช้ IBW → ขอส่วนสูงเพิ่ม
    //   (Aminoglycosides, Vancomycin, Phenytoin loading dose ฯลฯ)
    if (d.master?.requires_ibw) {
      add('age', 'อายุ', 'ปี', `${name} → ต้องการ IBW`, 'high')
      add('weight', 'น้ำหนัก', 'kg', `${name} → ต้องการ IBW`, 'high')
      add('sex', 'เพศ', undefined, `${name} → ต้องการ IBW`, 'high')
      add('height', 'ส่วนสูง', 'cm', `${name} → คำนวณ IBW (Devine)`, 'high')
    }
    // 2) Pregnancy category D/X → ถามตั้งครรภ์ตรง ๆ (ไม่ต้องผ่านเพศ)
    if (d.master?.pregnancy_category === 'D' || d.master?.pregnancy_category === 'X') {
      add('is_pregnant', 'ตั้งครรภ์', undefined, `${name} (Cat ${d.master.pregnancy_category}) — ต้องเช็คก่อนจ่าย`, 'high')
    }
    if (d.master?.pregnancy_category === 'C') {
      add('is_pregnant', 'ตั้งครรภ์', undefined, `${name} (Cat C) — ใช้ระวัง`, 'medium')
    }
    // 3) Lactation unsafe → ถามให้นม
    if (d.master?.lactation_safe === false) {
      add('is_lactating', 'ให้นมบุตร', undefined, `${name} ไม่แนะนำในระยะให้นม`, 'high')
    }
    // 4) Beers → ขออายุ
    if (d.master?.beers_avoid_elderly) {
      add('age', 'อายุ', 'ปี', `${name} อยู่ใน Beers (≥65 ปี)`, 'high')
    }
    // 5) Pediatric dose → ขอแค่ "น้ำหนัก" (คำนวณ mg/kg/dose) ไม่ต้องขอเพศ/อายุ
    const hasPed = d.labRules?.some((r) => r.pediatric_dose || r.min_dose_kg || r.max_dose_kg)
    if (hasPed) {
      add('weight', 'น้ำหนัก', 'kg', `${name} → คำนวณขนาดยาเด็ก (mg/kg/dose)`, 'high')
    }
    // 6) Smoking interaction
    if (d.master?.smoking_interaction) {
      add('smoking', 'สูบบุหรี่', undefined, `${name} มีปฏิกิริยากับบุหรี่`, 'medium')
    }
    if (d.master?.alcohol_interaction) {
      add('alcohol', 'ดื่มแอลกอฮอล์', undefined, `${name} มีปฏิกิริยากับแอลกอฮอล์`, 'medium')
    }
    // 7) G6PD-unsafe → ถาม "มี G6PD?" (ใช่/ไม่ใช่)
    if (d.master?.g6pd_unsafe) {
      add('g6pd', 'มี G6PD', undefined, `${name} ห้ามในผู้ป่วย G6PD`, 'high')
    }
    // 8) LAB_RULES param specific → ใส่ field ตาม param
    for (const r of d.labRules ?? []) {
      if (!r.param) continue
      const id = paramToFieldId(r.param)
      if (id) {
        add(id, `${r.param}${r.normal_range ? ` (ปกติ ${r.normal_range})` : ''}`, r.unit, `${name} → ต้อง monitor ${r.param}`, mapPriority(r.priority))
      }
    }
  }

  return [...map.values()].sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority))
}

function priorityRank(p: 'high' | 'medium' | 'low'): number {
  return p === 'high' ? 3 : p === 'medium' ? 2 : 1
}

function mapPriority(p: string | undefined): 'high' | 'medium' | 'low' {
  const v = (p ?? '').toLowerCase()
  if (v === 'urgent' || v === 'high' || v === 'critical') return 'high'
  if (v === 'medium' || v === 'mod' || v === 'moderate') return 'medium'
  return 'low'
}

function paramToFieldId(param: string): FieldId | null {
  const k = param.toLowerCase().trim()
  if (k.includes('scr') || k.includes('creat')) return 'scr'
  if (k === 'inr') return 'inr'
  if (k === 'k' || k === 'k+' || k === 'potassium') return 'k'
  if (k === 'na' || k === 'na+' || k === 'sodium') return 'na'
  if (k.includes('albumin')) return 'albumin'
  if (k === 'hb' || k.includes('hemoglobin')) return 'hb'
  if (k === 'plt' || k.includes('platelet')) return 'plt'
  if (k === 'ast') return 'ast'
  if (k === 'alt') return 'alt'
  if (k.includes('bili')) return 'bilirubin'
  if (k.includes('glu') || k.includes('sugar')) return 'glucose'
  return null
}

/** เช็คว่ากรอก field นี้แล้วยัง */
export function isFieldFilled(patient: PatientInput, extra: Record<string, unknown>, id: FieldId): boolean {
  switch (id) {
    case 'age': return patient.age !== undefined && patient.age > 0
    case 'weight': return patient.weight !== undefined && patient.weight > 0
    case 'height': return patient.height !== undefined && patient.height > 0
    case 'sex': return patient.sex !== undefined
    case 'scr': return patient.scr !== undefined && patient.scr > 0
    case 'egfr': return patient.egfr !== undefined && patient.egfr > 0
    case 'inr': return patient.inr !== undefined && patient.inr > 0
    case 'allergies': return (patient.allergies?.length ?? 0) > 0
    case 'is_pregnant': return patient.is_pregnant !== undefined
    case 'is_lactating': return patient.is_lactating !== undefined
    case 'g6pd': return patient.g6pd !== undefined
    case 'smoking': return patient.smoking !== undefined
    case 'alcohol': return patient.alcohol !== undefined
    case 'diseases': return (patient.diseases?.length ?? 0) > 0
    default: return extra[id] !== undefined && extra[id] !== ''
  }
}
