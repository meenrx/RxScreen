import type { DdiOverride, DiseaseRule, DrugMaster, HadRule, LabRule } from './drug'

export interface PatientInput {
  hn?: string
  /** เลข admission (IPD) — ใช้ตามรอยย้อนหลัง */
  an?: string
  patient_name?: string
  age?: number
  weight?: number
  height?: number
  sex?: 'M' | 'F'
  scr?: number
  /** eGFR/CrCl ที่กรอกตรง (mL/min) — ถ้ามี ใช้ค่านี้ปรับ dose ได้เลย ไม่ต้องคำนวณจาก SCr */
  egfr?: number
  inr?: number
  /** ค่าแล็บอื่น ๆ (จาก QR/กรอกมือ) — key เป็นตัวพิมพ์เล็กของชื่อ param เช่น k, ast, alt, bun
   *  ใช้เทียบกับ LAB_RULE.param ที่ไม่ใช่ scr/crcl/inr */
  labs?: Record<string, number>
  /** วันที่ของค่าแล็บ (YYMMDD) keyed เหมือน labs + 'crcl'/'scr'/'inr' — ไว้บอกว่าค่าเก่าแค่ไหน */
  labDates?: Record<string, string>
  /** true=เจาะแล้วผิดปกติ/พร่อง, false=เจาะแล้วปกติ, undefined=ยังไม่เจาะ (แยกจาก g6pd) */
  g6pd_tested?: boolean
  /** อายุครรภ์ (สัปดาห์) ถ้าตั้งครรภ์ */
  pregnancy_weeks?: number
  is_pregnant?: boolean
  is_lactating?: boolean
  /** มี G6PD deficiency หรือไม่ */
  g6pd?: boolean
  smoking?: boolean
  alcohol?: boolean
  /** ผู้ป่วยให้อาหารทางสาย (NG/PEG) — เตือนเรื่อง SR/ER no-crush */
  tube_feeding?: boolean
  diseases?: string[]
  /** allergy → drug name, class, หรือ allergen เช่น "Penicillin", "Sulfa" */
  allergies?: string[]
  /** RDU context flags ที่เภสัชกร tick ว่าผู้ป่วยมา OPD ด้วยอาการ/diagnosis อะไร
   *  เพื่อให้ระบบเช็คเกณฑ์ RDU MOPH เช่น 'URI' / 'DIARRHEA' / 'NORMAL_LABOR' / 'TRAUMA' */
  rdu_context?: string[]
  /** ข้อบ่งใช้ที่เภสัชกรเลือก ต่อยา — ใช้กรณียาตัวเดียวมีหลาย LAB_RULE ต่อข้อบ่งใช้
   *  key = icode, value = ข้อความ indication ที่ตรงกับ rule.indication */
  selected_indications?: Record<string, string>
}

export interface DrugEntry {
  icode: string
  drug_name: string
  sig?: string
  master?: DrugMaster
  labRules?: LabRule[]
  /** ขนาดที่แพทย์สั่ง (จาก q3: iperdose/iperday/strength) — ใช้เช็คขนาดจริง */
  strength_mg?: number   // ความแรงต่อหน่วย (mg) — เฉพาะเม็ด/แคปซูล
  per_dose?: number      // จำนวนต่อครั้ง (iperdose)
  per_day?: number       // จำนวนครั้งต่อวัน (iperday หรือแปลงจาก frequency)
  daily_mg?: number      // ขนาดรวมต่อวัน (mg) = strength_mg × per_dose × per_day
  frequency?: string     // BID/TID/OD/q8h ...
  route?: string         // กิน/ฉีด/หยอด (จาก sig)
  prn?: boolean          // เมื่อจำเป็น (PRN)
  meal?: string          // ก่อน/หลังอาหาร/ก่อนนอน (จาก sig)
}

export type AlertSeverity = 'red' | 'orange' | 'yellow' | 'blue'

export type AlertType =
  | 'DDI' | 'LAB' | 'DISEASE' | 'DRP' | 'RENAL' | 'PED'
  | 'ALLERGY' | 'HAD' | 'LASA' | 'PREG' | 'LACT' | 'BEERS' | 'G6PD'
  | 'FOOD' | 'SMOKING' | 'ALCOHOL' | 'TDM'
  | 'TIMING' | 'DUE' | 'NO_CRUSH' | 'COST' | 'SUBST' | 'RDU'
  /** IV Y-site compatibility — ยาฉีดผสม/ให้ร่วมสายไม่ได้ */
  | 'IVC'
  /** ควรได้รับยาเพิ่ม (untreated indication / care gap) เช่น K ต่ำ ควรได้ KCl */
  | 'OMIT'

export interface ScreeningAlert {
  id: string
  type: AlertType
  severity: AlertSeverity
  title: string
  detail: string
  drugs?: string[]
  recommendation?: string
  source?: DdiOverride | DiseaseRule | LabRule | DrugMaster | HadRule
}

export interface ScreeningResult {
  patient: PatientInput
  drugs: DrugEntry[]
  alerts: ScreeningAlert[]
  crcl?: number
  ibw?: number
  createdAt: Date
}
