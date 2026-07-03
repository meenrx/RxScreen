import type { DrugEntry, PatientInput } from '@/types/screening'
import type { LabRule } from '@/types/drug'
import { renalBasisOf } from '@/features/renal/calc'
import { IBW_REQUIRED } from './clinicalRefs'

/** กรอง labRules ตาม indication ที่ผู้ใช้เลือก (default rule = no indication → ใช้เสมอ) */
function filterRulesByIndication(d: DrugEntry, patient: PatientInput): LabRule[] {
  const rules = d.labRules ?? []
  const selected = patient.selected_indications?.[d.icode]?.trim()
  if (!selected) return rules
  return rules.filter((r) => {
    const ind = r.indication?.trim()
    return !ind || ind === selected
  })
}

export type FieldId =
  | 'age' | 'sex' | 'weight' | 'height' | 'scr' | 'egfr' | 'inr'
  | 'allergies' | 'is_pregnant' | 'is_lactating' | 'g6pd' | 'smoking' | 'alcohol'
  | 'diseases'
  | 'k' | 'na' | 'albumin' | 'hb' | 'plt' | 'ast' | 'alt' | 'bilirubin' | 'glucose'

/** คำที่บ่งชี้ว่าเป็น NSAID (เช็คจาก generic / drug_class / drug_category) */
const NSAID_KEYS = [
  'ibuprofen', 'naproxen', 'diclofenac', 'mefenamic', 'indomethacin', 'piroxicam',
  'meloxicam', 'celecoxib', 'etoricoxib', 'ketorolac', 'nsaid',
  'nonsteroidal', 'anti-inflammatory', 'propionic', 'arcoxia', 'brufen',
  // NB: aspirin ไม่นับเป็น NSAID (antiplatelet) — ยกเว้นจากกฎ NSAID/ไต
]

function isNsaid(d: DrugEntry): boolean {
  const hay = [
    d.master?.generic_name, d.master?.drug_class, d.master?.drug_category, d.master?.drug_name, d.drug_name,
  ].filter(Boolean).join(' ').toLowerCase()
  return NSAID_KEYS.some((k) => hay.includes(k))
}

/** รูปแบบยาที่บ่งชี้ว่าเป็นรูปแบบเหลว/สำหรับเด็ก (syrup / suspension / drops / elixir / solution)
 *  เช็คจาก form (ไทย) หรือ dosage_form (อังกฤษ) หรือชื่อยาเอง — ครอบคลุมเคสที่ admin
 *  ยังกรอกข้อมูล master ไม่ครบ */
const LIQUID_FORM_KEYS_TH = ['ยาน้ำ', 'น้ำเชื่อม', 'น้ำแขวน', 'หยด']
const LIQUID_FORM_KEYS_EN = [
  'syr', 'syrup', 'susp', 'suspension', 'drop', 'elix', 'elixir',
  'soln', 'solution', 'oral liquid', 'liquid',
]

function isSyrupForm(d: DrugEntry): boolean {
  const form = (d.master?.form ?? '').toLowerCase()
  const dosage = (d.master?.dosage_form ?? '').toLowerCase()
  const name = ((d.master?.drug_name ?? d.drug_name) ?? '').toLowerCase()
  if (LIQUID_FORM_KEYS_TH.some((k) => form.includes(k) || name.includes(k))) return true
  if (LIQUID_FORM_KEYS_EN.some((k) => dosage.includes(k) || form.includes(k))) return true
  // Fallback: name pattern like "PARACET SYR" or "(ยาน้ำ) ..." which is how the hospital
  // formulary labels liquid forms even before form/dosage_form are populated.
  if (/\bsyr\b|\bsusp\b|\bdrop\b|\bsoln\b/i.test(name)) return true
  return false
}

/** รูปแบบยาทาภายนอก / ไม่ดูดซึมเข้ากระแสเลือดเป็นหลัก —
 *  ยาหยอดตา (OPH), ยาหยอดหู (OTI/EAR), ยาสูดพ่น (INH/NEB), ยาทา (cream/oint/gel),
 *  ยาเหน็บ (SUPP), ยาพ่นจมูก (NASAL) ฯลฯ
 *  ยาเหล่านี้ไม่ต้องคำนวณ mg/kg, ไม่ต้องเช็ค renal/IBW/Beers — เว้นแต่ admin set
 *  rule ใน LAB_RULES ตรง ๆ */
const TOPICAL_KEYS_TH = ['ตา', 'หู', 'จมูก', 'พ่น', 'ทา', 'เหน็บ']
const TOPICAL_KEYS_EN = [
  'oph', 'eye', 'ear', 'oti', 'otic',
  'inh', 'inhaler', 'inhalation', 'neb', 'nebul',
  'nasal', 'nas',
  'top', 'topical', 'cream', 'ointment', 'oint', 'lotion', 'gel', 'spray',
  'patch', 'plaster',
  'supp', 'suppository', 'vag', 'vaginal',
]

function isTopicalOrExternal(d: DrugEntry): boolean {
  const form = (d.master?.form ?? '').toLowerCase()
  const dosage = (d.master?.dosage_form ?? '').toLowerCase()
  const name = ((d.master?.drug_name ?? d.drug_name) ?? '').toLowerCase()
  if (TOPICAL_KEYS_TH.some((k) => form.includes(k) || name.includes(k))) return true
  if (TOPICAL_KEYS_EN.some((k) => dosage.includes(k) || form.includes(k))) return true
  // ชื่อยา pattern: "...-OPH", " OPH", "EYE", "EAR", "INH", "(ตา)" ฯลฯ
  if (/-?\boph\b|\beye\b|\bear\b|\binh\b|\bneb\b|\btop\b|\bnasal\b|\bsupp\b|\bvag\b/i.test(name)) return true
  return false
}

export interface RequiredField {
  id: FieldId
  label: string
  unit?: string
  reasons: string[]   // ยาที่ทำให้ field นี้จำเป็น
  priority: 'high' | 'medium' | 'low'
}

/** ตรวจหา fields ที่ต้องการกรอกจากรายการยา */
export function computeRequiredFields(drugs: DrugEntry[], patient: PatientInput = {}): RequiredField[] {
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
    // Liquid/syrup forms in this hospital are de facto pediatric prescribing —
    // skip adult-specific requirements (Cockcroft-Gault CrCl, IBW, Beers,
    // smoking/alcohol, and Cat-C "use with caution" pregnancy) so the
    // pharmacist sees only what's actually useful: weight + specific labs.
    // Cat D/X pregnancy and G6PD are kept because they apply regardless of
    // dosage form.
    const syrup = isSyrupForm(d)
    // Topical / external (OPH, EAR, INH, cream, supp, ...) — ดูดซึมเข้ากระแสต่ำ
    // ข้ามทุก auto-trigger ที่ตั้งอยู่บน master field (renal/IBW/Beers/preg-C/
    // smoking/alcohol/G6PD/syrup-weight). ใช้เฉพาะ rule ที่ admin set ใน LAB_RULES
    // ตรง ๆ เท่านั้น — ถ้าไม่ตั้งค่า ไม่ต้องถาม
    const topical = isTopicalOrExternal(d)
    const rules = filterRulesByIndication(d, patient)
    if (topical) {
      // เฉพาะ LAB_RULES param-based เท่านั้น (ข้อ 8 ด้านล่าง)
      for (const r of rules) {
        if (!r.param) continue
        const id = paramToFieldId(r.param)
        if (id) {
          add(id, `${r.param}${r.normal_range ? ` (ปกติ ${r.normal_range})` : ''}`, r.unit, `${name} → ต้อง monitor ${r.param}`, mapPriority(r.priority))
        }
      }
      continue
    }

    // 1) มี dose_meta → ปรับ dose ตามไต
    //    - rule ที่ใช้ CrCl → ขอ age+weight+sex+scr (คำนวณ Cockcroft-Gault)
    //    - rule ที่ใช้ eGFR → ขอ eGFR ตรง ๆ ไม่ต้องคำนวณ
    const renalRule = rules.find((r) => r.dose_meta)
    if (renalRule && !syrup) {
      // ถ้ามีค่าไต (CrCl/eGFR) อยู่แล้ว เช่นจาก QR → ใช้ได้เลย ไม่ต้องขอ SCr มาคำนวณ
      const haveRenal = patient.egfr !== undefined && patient.egfr > 0
      if (!haveRenal) {
        if (renalBasisOf(renalRule) === 'egfr') {
          add('egfr', 'eGFR', 'mL/min', `${name} → ปรับ dose ตาม eGFR (กรอกค่าตรง)`, 'high')
        } else {
          add('egfr', 'CrCl/eGFR', 'mL/min', `${name} → ปรับ dose ตามไต (กรอก CrCl หรือ SCr+อายุ+นน.+เพศ)`, 'high')
          add('scr', 'SCr', 'mg/dL', `${name} → ปรับ dose ตาม CrCl (ถ้าไม่มี CrCl ตรง)`, 'medium')
        }
      }
    }
    // 1.2) NSAID → ขอค่าไต (eGFR) เพื่อเช็คความปลอดภัย (เสี่ยง AKI)
    //   เก็บไว้แม้เป็นยาน้ำ — เด็กกินยาน้ำ NSAID ก็เสี่ยง AKI เหมือนกัน
    if (isNsaid(d)) {
      add('egfr', 'eGFR', 'mL/min', `${name} (NSAID) → ควรเช็คการทำงานของไต`, 'high')
    }
    // 1.5) ยาที่ต้องใช้ IBW → ขอส่วนสูงเพิ่ม
    //   flag ในฐานข้อมูล หรือ built-in list (aminoglycosides, vancomycin)
    const needIbw = d.master?.requires_ibw || IBW_REQUIRED.test(`${d.master?.generic_name ?? ''} ${d.master?.drug_name ?? d.drug_name ?? ''}`.toLowerCase())
    if (needIbw && !syrup) {
      add('age', 'อายุ', 'ปี', `${name} → ต้องการ IBW`, 'high')
      add('weight', 'น้ำหนัก', 'kg', `${name} → ต้องการ IBW`, 'high')
      add('sex', 'เพศ', undefined, `${name} → ต้องการ IBW`, 'high')
      add('height', 'ส่วนสูง', 'cm', `${name} → คำนวณ IBW (Devine)`, 'high')
    }
    // 2) Pregnancy category D/X → ถามตั้งครรภ์ตรง ๆ (ไม่ต้องผ่านเพศ)
    //   เก็บไว้แม้เป็นยาน้ำ — แม่ที่ตั้งครรภ์สามารถได้รับยาน้ำได้
    if (d.master?.pregnancy_category === 'D' || d.master?.pregnancy_category === 'X') {
      add('is_pregnant', 'ตั้งครรภ์', undefined, `${name} (Cat ${d.master.pregnancy_category}) — ต้องเช็คก่อนจ่าย`, 'high')
    }
    if (d.master?.pregnancy_category === 'C' && !syrup) {
      add('is_pregnant', 'ตั้งครรภ์', undefined, `${name} (Cat C) — ใช้ระวัง`, 'medium')
    }
    // 3) Lactation unsafe → ถามให้นม
    if (d.master?.lactation_safe === false && !syrup) {
      add('is_lactating', 'ให้นมบุตร', undefined, `${name} ไม่แนะนำในระยะให้นม`, 'high')
    }
    // 4) Beers → ขออายุ — ข้ามถ้าเป็นยาน้ำ (เด็กไม่ใช่ผู้สูงอายุ)
    if (d.master?.beers_avoid_elderly && !syrup) {
      add('age', 'อายุ', 'ปี', `${name} อยู่ใน Beers (≥65 ปี)`, 'high')
    }
    // 5) Pediatric dose → ขอ "น้ำหนัก" (mg/kg) และ/หรือ "อายุ" (band ตามอายุ)
    const hasPedWeight = rules.some((r) =>
      r.pediatric_dose || r.min_dose_kg || r.max_dose_kg || r.dose_by_weight,
    )
    if (hasPedWeight) {
      add('weight', 'น้ำหนัก', 'kg', `${name} → คำนวณขนาดยาเด็กตามน้ำหนัก`, 'high')
    }
    const hasPedAge = rules.some((r) => r.dose_by_age_months)
    if (hasPedAge) {
      add('age', 'อายุ', 'ปี (เด็กเล็กกรอกทศนิยม เช่น 0.5 = 6 เดือน)', `${name} → ขนาดยาเด็กตามช่วงอายุ`, 'high')
    }
    // (เคยมีกฎ 5b: ยาน้ำที่ไม่มี pediatric_dose ก็ขอ weight — false-positive กับยาน้ำ
    //  ที่ไม่ใช้ mg/kg เช่น alum milk, simethicone, antacid suspension ลบทิ้ง
    //  ถ้าอยากให้ระบบขอน้ำหนัก ต้อง set pediatric rule ใน LAB_RULES ตรง ๆ)
    // 6) Smoking interaction — adult-specific
    if (d.master?.smoking_interaction && !syrup) {
      add('smoking', 'สูบบุหรี่', undefined, `${name} มีปฏิกิริยากับบุหรี่`, 'medium')
    }
    if (d.master?.alcohol_interaction && !syrup) {
      add('alcohol', 'ดื่มแอลกอฮอล์', undefined, `${name} มีปฏิกิริยากับแอลกอฮอล์`, 'medium')
    }
    // 7) G6PD-unsafe → ถาม "มี G6PD?" (ใช่/ไม่ใช่)
    //   เก็บไว้แม้เป็นยาน้ำ — เด็กเป็น G6PD ได้
    if (d.master?.g6pd_unsafe) {
      add('g6pd', 'มี G6PD', undefined, `${name} ห้ามในผู้ป่วย G6PD`, 'high')
    }
    // 8) LAB_RULES param specific → ใส่ field ตาม param (เก็บไว้ทั้ง 2 กรณี)
    for (const r of rules) {
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
