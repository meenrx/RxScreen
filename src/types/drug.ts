/** DRUG_MASTER — ตารางยาแม่ */
export interface DrugMaster {
  id?: string
  icode: string
  drug_name: string
  generic_name?: string
  drug_class?: string
  unit?: string
  /** รูปแบบยา เช่น ยาเม็ด, ยาน้ำ, ยาฉีด */
  form?: string
  /** ความแรง เช่น "100mg", "500mg/5mL" */
  strength?: string
  active?: boolean
  note?: string
  /** High Alert Drug — เตือนสีแดงทันที (insulin, warfarin, opioid, K injection) */
  is_HAD?: boolean
  /** LASA pairs — รายชื่อ icode หรือชื่อยาที่หน้าตา/ออกเสียงคล้าย */
  lasa_with?: string[]
  /** Pregnancy category (FDA): A, B, C, D, X */
  pregnancy_category?: 'A' | 'B' | 'C' | 'D' | 'X'
  /** Lactation safe? */
  lactation_safe?: boolean
  /** Beers criteria — ควรหลีกเลี่ยงในผู้สูงอายุ ≥65 ปี */
  beers_avoid_elderly?: boolean
  /** G6PD-unsafe */
  g6pd_unsafe?: boolean
  /** ต้องใช้ IBW (Ideal Body Weight) ในการคำนวณ dose
   *  - true = ขอส่วนสูงตอนคัดกรอง เช่น Aminoglycosides, Vancomycin (ในคนอ้วน), Phenytoin loading
   *  - false/undefined = ใช้ ABW ปกติ ไม่ต้องขอส่วนสูง */
  requires_ibw?: boolean
  /** สำหรับ allergy check — ตัว allergen หลัก เช่น "Penicillin", "Sulfa", "NSAID" */
  allergens?: string[]
  /** Therapeutic class for cross-reactivity (penicillin↔cephalosporin ฯลฯ) */
  cross_react?: string[]
  /** Smoking interaction */
  smoking_interaction?: string
  /** Alcohol interaction */
  alcohol_interaction?: string
  /** Food interactions เช่น Warfarin + vit K */
  food_interaction?: string
  /** Drug-Lab Test Interference เช่น "Phenytoin → false ↓ Free T4", "Vitamin C → false ↓ glucose" */
  lab_interference?: string
  updatedAt?: Date
}

/** LAB_RULES */
export interface LabRule {
  id?: string
  icode: string
  drug_name?: string
  param?: string
  unit?: string
  normal_range?: string
  /** high | medium | low | urgent | routine */
  priority?: string
  reason?: string
  /** flag "1"/"0" — ต้องการ dose check */
  dose_check?: string
  dose_meta?: string
  renal_dose_rules?: string
  pediatric_dose?: string
  /** ข้อบ่งใช้ */
  indication?: string
  /** mg/kg minimum */
  min_dose_kg?: string
  /** mg/kg maximum */
  max_dose_kg?: string
  /** maximum mg/day */
  max_dose_day?: string
  /** ความเข้มข้น */
  concentration?: string
  /** ความถี่ */
  frequency?: string
  tdm_range?: string
  max_daily_dose?: string
  min_daily_dose?: string
  updatedAt?: Date
}

export interface DdiOverride {
  id?: string
  drug_a: string
  drug_b: string
  severity: 'major' | 'moderate' | 'minor' | 'contraindicated'
  mechanism?: string
  local_note?: string
  recommendation?: string
  updatedAt?: Date
}

export interface DrugCounseling {
  id?: string
  icode: string
  drug_name?: string
  short_label?: string
  full_counseling?: string
  /** ภาษาไทยฉบับเต็ม (จาก Google Sheet column counseling_th) */
  counseling_th?: string
  /** อาการข้างเคียง */
  side_effect?: string
  /** อาการที่ต้องไปพบแพทย์ทันที */
  when_to_er?: string
  /** ปฏิกิริยากับอาหาร */
  food_interaction?: string
  /** กลุ่มผู้ป่วยพิเศษ */
  special_pop?: string
  storage?: string
  warning?: string
  checklist?: string[]
  updatedAt?: Date
}

export interface DiseaseRule {
  id?: string
  /** ตัวย่อโรค เช่น CKD, DM */
  disease_key?: string
  disease: string
  /** ชื่อแสดง */
  display_name?: string
  /** ค่า lab ที่ต้องการ คั่นด้วย , */
  required_labs?: string
  /** ค่า lab เสริม */
  optional_labs?: string
  /** หมายเหตุการคัดกรอง */
  screening_notes?: string
  drug_icode?: string
  drug_class?: string
  severity?: 'contraindicated' | 'caution' | 'avoid'
  note?: string
  updatedAt?: Date
}

/** WARFARIN_INR_PROTOCOL — ตารางปรับขนาดตามช่วง INR */
export interface WarfarinInrProtocol {
  id?: string
  inr_min: number
  inr_max: number
  action: 'increase' | 'decrease' | 'hold' | 'maintain' | string
  adjust_pct?: number
  note?: string
  vit_k?: string
}

/** WARFARIN_TWD_TABLE — ตาราง weekly dose + schedule */
export interface WarfarinTwdTable {
  id?: string
  strength_mg: number
  twd_mg: number
  schedule_code: string
  description?: string
}

/** PHARMACIST — รายชื่อจาก Sheet */
export interface PharmacistEntry {
  id?: string
  icode_ph: string
  prefix?: string
  first_name: string
  last_name: string
  license_no: string
  role?: string
  active?: boolean
}

export interface AppConfig {
  id?: string
  anthropic_api_key?: string
  anthropic_model?: string
  hospital_name?: string
  hospital_address?: string
  updatedAt?: Date
}

export interface DispensingLog {
  id?: string
  hn?: string
  patient_name?: string
  age?: number
  weight?: number
  scr?: number
  crcl?: number
  allergies?: string[]
  is_pregnant?: boolean
  drugs: { icode: string; drug_name: string; sig?: string }[]
  alerts_count: number
  ddi_count: number
  drp_count: number
  ai_summary?: string
  pharmacist_uid: string
  pharmacist_name: string
  pharmacist_lic?: string
  createdAt: Date
}
