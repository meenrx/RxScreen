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
  /** คำค้น / ชื่อเรียกอื่น (trade/brand names) เช่น "Atarax" สำหรับ hydroxyzine — ใช้ตอนพิมพ์ค้นหา */
  search_keywords?: string[]
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

  // ===== ฟิลด์จาก Sheet "บัญชียา" (Hospital drug account) =====
  /** หน่วยจ่าย/บรรจุ เช่น เม็ด, ขวด (60 ml.), ซอง, Amp., Vial */
  pack_unit?: string
  /** Dosage form ภาษาอังกฤษจาก sheet เช่น TABLETS, INJECTIONS, SYRUPS */
  dosage_form?: string
  /** หมวดบัญชียาโรงพยาบาล เช่น ก, ข, ค, ง */
  drug_account?: string
  /** หมวดยาเชิงเภสัชวิทยา เช่น ANTIHISTAMINES, PENICILLINS — ใช้คู่กับ drug_class */
  drug_category?: string
  /** ข้อบ่งใช้/therapeutic use ภาษาไทย */
  therapeutic?: string
  /** ราคาทุน (บาท/หน่วย) */
  unit_cost?: number
  /** ราคาขาย (บาท/หน่วย) */
  unit_price?: number

  // ===== ฟิลด์ clinical screening (จากแนวทางสุโขทัย/รือเสาะ) =====
  /** ยาที่ต้อง Drug Use Evaluation (DUE) — กรอกใบ DUE + ปรึกษาอาจารย์ 96 ชม. */
  is_DUE?: boolean
  /** ห้ามบดเม็ดยา (SR/ER tablets) — ต้องปรึกษาแพทย์ถ้าผู้ป่วยใช้ tube feeding */
  no_crush?: boolean
  /** คำเตือนเรื่องเวลากิน เช่น "ก่อนอาหาร 1 ชม.", "ก่อนอาหาร 30 นาที" */
  timing_note?: string
  /** Class keys สำหรับ duplicate therapy detection — เช่น "ACEI", "ARB", "BB", "STATIN", "NSAID" */
  dup_class?: string[]
  updatedAt?: Date
}

/** HAD_RULES — กฎ High Alert Drug รายละเอียดที่เภสัชกรต้องเตือนเสมอ */
export interface HadRule {
  id?: string
  /** key เช่น icode หรือ generic name lowercase */
  drug_key: string
  /** ชื่อยาแสดงผล */
  drug_name: string
  /** Max dose เช่น "50 mcg/kg/min" */
  max_dose?: string
  /** Max rate เช่น "30 mg/min" */
  max_rate?: string
  /** Max concentration เช่น "5 mg/ml" */
  max_conc?: string
  /** Dilution requirements เช่น "Dilute ใน D5W เท่านั้น" */
  dilution?: string
  /** Route restriction เช่น "ห้ามให้ IV push" */
  route_note?: string
  /** หมายเหตุเพิ่มเติม / full text */
  full_note?: string
  /** Antidote ถ้ามี */
  antidote?: string
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
  /** เงื่อนไขแจ้งเตือนตามค่า lab (operator-based เหมือน dose_meta) สำหรับยาตัวนี้
   *  เช่น ">5.5:K สูง — ระวัง arrhythmia; <3.5:K ต่ำ — พิจารณาให้ KCl"
   *  ระบบจะเทียบค่า lab (param) ของผู้ป่วยกับเงื่อนไข แล้วเตือนด้วยข้อความ action */
  alert_meta?: string
  renal_dose_rules?: string
  /** ฐานการปรับ dose ตามไต: 'crcl' = คำนวณ Cockcroft-Gault (ขอ age/weight/sex/scr),
   *  'egfr' = ให้ผู้ใช้กรอก eGFR ตรง ๆ. ไม่ระบุ = เดาจาก dose_meta/param (default crcl) */
  renal_basis?: 'crcl' | 'egfr'
  /** ยกเว้นเกณฑ์ไต — ยานี้ไม่ต้องปรับตามไต (ปิดทั้ง dose_meta และ built-in renal ref) */
  renal_exempt?: boolean
  pediatric_dose?: string
  /** ขนาดยาตามน้ำหนัก (band format เดียวกับ dose_meta)
   *  เช่น "<10:125 mg q8h; 10-20:250 mg q8h; >20:500 mg q8h"
   *  ใช้คู่กับ patient.weight (kg) */
  dose_by_weight?: string
  /** ขนาดยาตามอายุ (หน่วยเดือน — แม่นกว่าปีในเด็กเล็ก)
   *  เช่น "<6:0.4 mL; 6-12:0.6 mL; 12-24:0.8 mL; 24-72:1.2 mL"
   *  ใช้คู่กับ patient.age × 12 (auto convert จากปีในฟอร์ม) */
  dose_by_age_months?: string
  /** ความแรงยาน้ำต่อ 5 mL เช่น "250 mg/5 mL" หรือเลข mg ต่อ 5mL — ใช้คำนวณ mL/dose เด็ก */
  conc_per_5ml?: string
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
  /** Onset ของปฏิกิริยา — R = Rapid (<24h), D = Delayed (วัน-สัปดาห์) */
  onset?: 'R' | 'D'
  /** Documentation level — 1=Established (มีวิจัยยืนยัน), 2=Probable (มีรายงาน), 3=Suspected */
  documentation?: '1' | '2' | '3'
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
  /** เกณฑ์ราคาต่อหน่วย (บาท) ที่ถือว่า "ยาแพง" — ราคาขาย/ทุน ≥ ค่านี้จะแจ้งเตือน (0 = ปิด) */
  expensive_unit_price_threshold?: number
  /** กลุ่มยา (drug_class) ที่ห้ามจ่ายซ้ำ — ว่าง = เตือนทุกกลุ่ม */
  duplicate_classes?: string[]
  updatedAt?: Date
}

/** เหตุการณ์ที่หมอสั่งยาที่ถูก off ซ้ำ → บันทึกจำนวนเพื่อคำนวณมูลค่าประหยัด */
export interface InterventionEvent {
  /** วันที่ (ISO string — เลี่ยงเก็บ Date ใน array) */
  date: string
  /** จำนวนที่หมอสั่งรอบนี้ */
  qty: number
  /** มูลค่าประหยัด = qty × unit_cost */
  saved: number
  pharmacist_name?: string
}

/** INTERVENTION — บันทึกการ off/เปลี่ยนยา ต่อผู้ป่วย (HN) + มูลค่าประหยัดสะสม */
export interface Intervention {
  id?: string
  hn: string
  patient_name?: string
  icode: string
  drug_name: string
  generic_name?: string
  /** off = หยุดยา, switched = เปลี่ยนเป็นยาอื่น */
  status: 'off' | 'switched'
  /** เหตุผล เช่น ยาแพง / ยาซ้ำซ้อน / อื่น ๆ */
  reason?: string
  /** ยาทางเลือกที่เปลี่ยนไปใช้ (กรณี switched) */
  alternative_name?: string
  /** ราคาทุน/ขาย ณ เวลาบันทึก (snapshot) */
  unit_cost?: number
  unit_price?: number
  /** จำนวนครั้งที่หมอสั่งซ้ำหลัง off */
  reorder_count: number
  /** จำนวนหน่วยรวมที่สั่งซ้ำ */
  total_qty: number
  /** มูลค่าประหยัดสะสม (บาท) = total_qty × unit_cost */
  total_saved: number
  events?: InterventionEvent[]
  pharmacist_uid: string
  pharmacist_name: string
  createdAt: Date
  updatedAt?: Date
}

/** DRUG_SUBSTITUTION — ยาที่เปลี่ยนบริษัท/รูปลักษณ์ แสดงเตือนตอนคัดกรอง (พร้อมรูปก่อน/หลัง) */
export interface DrugSubstitution {
  id?: string
  /** icode ของยาในระบบ */
  icode: string
  drug_name: string
  /** ชื่อ/บริษัทเดิม */
  old_brand?: string
  /** ชื่อ/บริษัทใหม่ */
  new_brand?: string
  note?: string
  /** URL รูปก่อน (Firebase Storage) */
  before_image?: string
  /** URL รูปหลัง (Firebase Storage) */
  after_image?: string
  /** แสดงเตือนตอนคัดกรองหรือไม่ */
  active: boolean
  /** วันที่เริ่มเปลี่ยน */
  effective_date?: string
  pharmacist_uid?: string
  pharmacist_name?: string
  createdAt?: Date
  updatedAt?: Date
}

export interface DispensingLog {
  id?: string
  hn?: string
  /** เลข admission (IPD) — ใช้ตามรอย prescribing error ย้อนหลัง */
  an?: string
  patient_name?: string
  age?: number
  weight?: number
  scr?: number
  crcl?: number
  allergies?: string[]
  is_pregnant?: boolean
  drugs: { icode: string; drug_name: string; sig?: string }[]
  alerts_count: number
  /** จำนวน alert แยกตามระดับความรุนแรง — ใช้ทำรายงาน dashboard */
  red_count?: number
  orange_count?: number
  yellow_count?: number
  /** ชนิด alert ที่พบ (dedupe ต่อการคัดกรอง) เช่น ['DDI','RENAL'] — ใช้หา "ประเด็นที่พบบ่อย" */
  alert_types?: string[]
  /** การประเมิน Medication Error โดยเภสัชกร (คัดกรองก่อนจ่าย = NCC MERP ระดับ B) */
  me_status?: 'confirmed' | 'not_me'
  me_level?: 'B'
  me_note?: string
  ddi_count: number
  drp_count: number
  ai_summary?: string
  pharmacist_uid: string
  pharmacist_name: string
  pharmacist_lic?: string
  createdAt: Date
}
