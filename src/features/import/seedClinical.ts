/**
 * Clinical seed data จากแนวทาง รพ.สุโขทัย IPD + พระจอมเกล้า 2560 (Renal)
 *
 * รวม:
 *  - HAD rules (19 ยา)
 *  - Renal dose adjustments (top critical ~35 ยา จาก พระจอมเกล้า 2560)
 *  - Disease rules (DM/CKD/HF/Lithium/Pregnancy)
 *  - Duplicate therapy classes (ACEI/ARB/BB/Alpha-1/Statin/NSAID)
 *  - Drug timing (Levothyroxine, Madopar)
 *  - DUE drug list (12 ยา ATB ควบคุม)
 *  - SR no-crush list (tube feeding)
 */

import type { HadRule, DiseaseRule, LabRule } from '@/types/drug'

// ====================================================================
// HAD_RULES (19 ยาจากแนวทางสุโขทัย IPD)
// ====================================================================

export const SUKHOTHAI_HAD: HadRule[] = [
  {
    drug_key: 'adrenaline', drug_name: 'Adrenaline',
    max_dose: '50 mcg/kg/min',
    full_note: 'ขนาดสูงกว่านี้เพิ่มเสี่ยง renal shutdown',
  },
  {
    drug_key: 'amiodarone', drug_name: 'Amiodarone',
    max_rate: '30 mg/min', max_conc: '2 mg/ml (peripheral) / 3 mg/ml (max)',
    dilution: 'Dilute ใน D5W เท่านั้น',
    full_note: 'Conc >2 mg/ml ควรให้ทาง central line · Conc >3 mg/ml ระวัง peripheral phlebitis',
  },
  {
    drug_key: 'atracurium', drug_name: 'Atracurium',
    full_note: 'สังเกตอาการกล้ามเนื้ออ่อนแรงและการกดการหายใจ',
  },
  {
    drug_key: 'atropine', drug_name: 'Atropine',
    full_note: 'ฉีดอย่างรวดเร็ว เพราะหากฉีดช้าอาจเกิด paradoxical bradycardia',
  },
  {
    drug_key: 'calcium gluconate', drug_name: 'Calcium gluconate',
    max_rate: '200 mg/min',
    full_note: 'Rate >200 mg/min → vasodilate · BP drop, bradycardia, arrhythmia, arrest',
  },
  {
    drug_key: 'digoxin', drug_name: 'Digoxin',
    full_note: 'วัด HR และลงบันทึกก่อนให้ยา · ปรับขนาดตาม CrCl: >90 ml/min: 0.125-0.25 mg OD · 60-89: 0.125 mg OD · 30-59: 0.125 mg วันเว้นวัน · <30: หลีกเลี่ยง/ระมัดระวัง',
  },
  {
    drug_key: 'dobutamine', drug_name: 'Dobutamine',
    max_conc: '5 mg/ml',
    full_note: 'infusion rate >20 mcg/kg/min ระวัง Hypertension',
  },
  {
    drug_key: 'dopamine', drug_name: 'Dopamine',
    max_dose: '50 mcg/kg/min', max_conc: '3.2 mg/ml',
    full_note: 'rate >20 mcg/kg/min ระวัง Hypertension · ขนาดสูงเพิ่มเสี่ยง renal shutdown · ขนาด 20-40 mcg/kg/min ติดตาม I/O',
  },
  {
    drug_key: 'heparin', drug_name: 'Heparin',
    full_note: 'เฝ้าระวัง Heparin-induced thrombocytopenia (HIT)',
  },
  {
    drug_key: 'magnesium sulfate', drug_name: 'Magnesium sulfate',
    max_rate: '1-2 g/h', max_conc: '200 mg/ml',
    full_note: 'ผู้ป่วยไตบกพร่อง: ติดตามเฝ้าระวัง Mg toxicity · rate เร็วไปอาจเกิด hypotension',
  },
  {
    drug_key: 'morphine', drug_name: 'Morphine',
    full_note: 'IV push ฉีดช้าๆ 4-5 นาที (ถ้าเร็วเสี่ยง respiratory depression, hypotension) · ระวังในผู้ป่วยไตบกพร่อง หรือ Urine output <600 ml/d',
    antidote: 'Naloxone',
  },
  {
    drug_key: 'nicardipine', drug_name: 'Nicardipine',
    max_rate: '15 mg/h', max_conc: '0.5 ml/ml (peripheral max)',
    full_note: 'Peripheral line เปลี่ยนตำแหน่งทุก 12 ชม. · Central line เปลี่ยนทุก 24 ชม. · Conc >0.5 ml/ml ใช้ central line · ระวัง BP drop เมื่อ IV bolus',
  },
  {
    drug_key: 'nitroglycerine', drug_name: 'Nitroglycerine',
    full_note: 'IV infusion โดยใช้ infusion pump เท่านั้น',
  },
  {
    drug_key: 'norepinephrine', drug_name: 'Norepinephrine',
    full_note: 'ใช้เวลานานควรเปลี่ยนบริเวณที่แทงเข็มเป็นระยะ เพื่อลดภาวะหลอดเลือดแข็งตัว',
  },
  {
    drug_key: 'phenytoin', drug_name: 'Phenytoin',
    dilution: 'Dilute ใน NSS เท่านั้น',
    full_note: 'ห้ามใช้ D5W (จะตกตะกอน)',
  },
  {
    drug_key: 'potassium chloride', drug_name: 'Potassium chloride (KCl)',
    max_rate: '20 mEq/h', max_conc: '40 mEq/L (peripheral) / 80 mEq/L (central)',
    route_note: 'ห้ามให้ IV push, IV bolus',
    full_note: 'Peripheral rate ≤10 mEq/h · Central rate ≤20 mEq/h · ระวังในผู้ป่วยไตวาย/urine output <600 ml/d (hyper K) · rate >10 mEq/h ควรติดตาม EKG',
  },
  {
    drug_key: 'regular insulin', drug_name: 'Regular insulin (RI)',
    full_note: 'สามารถ IV push โดยไม่ต้องเจือจาง',
  },
  {
    drug_key: '3% sodium chloride', drug_name: '3% Sodium chloride',
    max_rate: '100 ml/h หรือ 1 mEq/kg/h',
    full_note: 'ไม่ควรให้ rate เกินกำหนด',
  },
  {
    drug_key: 'enoxaparin', drug_name: 'Enoxaparin',
    route_note: 'ห้ามฉีด IM',
    full_note: 'ปรับตาม CrCl: ≥30 ml/min: 1 mg/kg SC q 12 hr · <30: 1 mg/kg SC OD',
  },
]

// ====================================================================
// Renal Dose Adjustments (top critical ~35 ยา จาก พระจอมเกล้า 2560)
// เก็บลง LAB_RULES collection โดยใช้ field dose_meta ที่ engine อ่านอยู่แล้ว
// ====================================================================

export interface RenalSeed {
  drug_key: string  // generic lowercase สำหรับ match
  drug_name: string
  dose_meta: string // format: "CrCl>50:dose; CrCl 10-50:dose; CrCl<10:dose"
}

export const SUKHOTHAI_RENAL: RenalSeed[] = [
  // Antibiotics
  { drug_key: 'amikacin', drug_name: 'Amikacin', dose_meta: 'CrCl>60:15-20 mg/kg q24h; CrCl 40-59:15 mg/kg q36h; CrCl 30-39:15 mg/kg q48h; CrCl<30:not recommended' },
  { drug_key: 'gentamicin', drug_name: 'Gentamicin', dose_meta: 'CrCl>60:4-7 mg/kg q24h; CrCl 40-59:q36h; CrCl 30-39:q48h; CrCl<30:not recommended' },
  { drug_key: 'streptomycin', drug_name: 'Streptomycin', dose_meta: 'CrCl>50:q24h; CrCl 10-50:q24-72h; CrCl<10:q72-96h' },
  { drug_key: 'cefazolin', drug_name: 'Cefazolin', dose_meta: 'CrCl>50:1-2g q8h; CrCl 10-50:q12h; CrCl<10:q24-48h' },
  { drug_key: 'cefepime', drug_name: 'Cefepime', dose_meta: 'normal:2g q12h; CrCl 30-60:2g q24h; CrCl 11-29:1g q24h; CrCl<11:500mg q24h' },
  { drug_key: 'ceftazidime', drug_name: 'Ceftazidime', dose_meta: 'normal:2g q8h; CrCl 31-50:1g q12h; CrCl 16-30:1g q24h; CrCl 6-15:500mg q24h; CrCl<5:500mg q48h' },
  { drug_key: 'ciprofloxacin', drug_name: 'Ciprofloxacin', dose_meta: 'CrCl≥30:no adjust; CrCl 5-29:200-400mg q18-24h' },
  { drug_key: 'levofloxacin', drug_name: 'Levofloxacin', dose_meta: 'normal:750mg q24h; CrCl 20-49:750mg q48h; CrCl<20:750mg once then 500mg q48h' },
  { drug_key: 'meropenem', drug_name: 'Meropenem', dose_meta: 'normal:1g q8h; CrCl 26-50:1g q12h; CrCl 10-25:500mg q12h; CrCl<10:500mg q24h' },
  { drug_key: 'imipenem', drug_name: 'Imipenem', dose_meta: 'ปรับตาม CrCl + น้ำหนัก — ดูตารางในแนวทาง · ทั่วไป CrCl<10: 125-250mg q12h' },
  { drug_key: 'ertapenem', drug_name: 'Ertapenem', dose_meta: 'normal:1g OD; CrCl≤30:500mg OD' },
  { drug_key: 'piperacillin', drug_name: 'Piperacillin+Tazobactam', dose_meta: 'normal:4.5g q6-8h; CrCl 20-40:3.375g q6h; CrCl<20:2.25g q6h' },
  { drug_key: 'vancomycin', drug_name: 'Vancomycin', dose_meta: 'normal:15-20 mg/kg q8-12h; CrCl<20:ขยายช่วงตาม serum level monitor' },
  { drug_key: 'colistin', drug_name: 'Colistin', dose_meta: 'CrCl>80:160mg q12h; CrCl 50-79:160mg q12-24h; CrCl<50:160mg q24-36h' },
  { drug_key: 'metronidazole', drug_name: 'Metronidazole', dose_meta: 'normal:7.5 mg/kg q6h; CrCl<10:50%' },
  { drug_key: 'fluconazole', drug_name: 'Fluconazole', dose_meta: 'CrCl>50:full dose; CrCl≤50:50% (single dose ไม่ต้องปรับ)' },
  { drug_key: 'acyclovir', drug_name: 'Acyclovir', dose_meta: 'CrCl>50:5-12.4 mg/kg q8h; CrCl 25-50:q12h; CrCl 10-25:q24h; CrCl<10:50% q24h' },
  { drug_key: 'oseltamivir', drug_name: 'Oseltamivir', dose_meta: 'CrCl>60:75mg BID; CrCl 30-60:30mg BID; CrCl 10-30:30mg OD; CrCl<10:not recommended' },
  { drug_key: 'cotrimoxazole', drug_name: 'Co-trimoxazole (TMP/SMX)', dose_meta: 'CrCl>30:full dose; CrCl 15-30:50%; CrCl<15:avoid' },
  // Cardio
  { drug_key: 'atenolol', drug_name: 'Atenolol', dose_meta: 'CrCl>35:no adjust; CrCl 15-35:max 50mg OD; CrCl<15:max 25mg OD' },
  { drug_key: 'enalapril', drug_name: 'Enalapril', dose_meta: 'CrCl>30:no adjust; CrCl≤30:2.5mg/day start, titrate' },
  { drug_key: 'digoxin', drug_name: 'Digoxin', dose_meta: 'CrCl>90:0.125-0.25mg OD; CrCl 60-89:0.125mg OD; CrCl 30-59:0.125mg วันเว้นวัน; CrCl<30:หลีกเลี่ยง' },
  { drug_key: 'enoxaparin', drug_name: 'Enoxaparin', dose_meta: 'CrCl≥30:1 mg/kg q12h SC; CrCl<30:1 mg/kg OD SC' },
  // DM
  { drug_key: 'metformin', drug_name: 'Metformin', dose_meta: 'eGFR>45:no adjust; eGFR 30-45:max 1000mg/day; eGFR<30:contraindicated' },
  { drug_key: 'glibenclamide', drug_name: 'Glibenclamide', dose_meta: 'eGFR<60:contraindicated (เปลี่ยนเป็น Glipizide)' },
  { drug_key: 'empagliflozin', drug_name: 'Empagliflozin', dose_meta: 'eGFR<30:contraindicated · กรณี HF: eGFR<20 contraindicated' },
  // Pain / other
  { drug_key: 'allopurinol', drug_name: 'Allopurinol', dose_meta: 'eGFR>50:75%; eGFR 40-59:150mg OD; eGFR 20-39:100mg OD; eGFR 10-19:100mg วันเว้นวัน; eGFR<10:100mg ทุก 3 วัน' },
  { drug_key: 'colchicine', drug_name: 'Colchicine', dose_meta: 'CrCl 30-80:no adjust monitor; CrCl<30:0.3mg OD start, gout flare ไม่ซ้ำใน 2 สัปดาห์' },
  { drug_key: 'gabapentin', drug_name: 'Gabapentin', dose_meta: 'CrCl>60:300-1200 TID; 30-59:200-700 BID; 15-29:200-700 OD; <15:100-300 OD' },
  { drug_key: 'pregabalin', drug_name: 'Pregabalin', dose_meta: 'CrCl>60:full; 30-60:50%; 15-30:25%; <15:1 dose OD' },
  { drug_key: 'ranitidine', drug_name: 'Ranitidine', dose_meta: 'CrCl<50: oral 150mg q18-24h, IV 50mg q18-24h' },
  // ARV
  { drug_key: 'tenofovir', drug_name: 'Tenofovir', dose_meta: 'CrCl≥50:300mg OD; CrCl 30-49:q48h; CrCl 10-29:q72-96h; CrCl<10:not studied' },
  { drug_key: 'lamivudine', drug_name: 'Lamivudine', dose_meta: 'HIV: CrCl>50:300mg OD; 30-49:150mg OD; 15-29:150 first then 100mg OD; 5-14:50mg OD; <5:25mg OD' },
  // Anticoagulant / others
  { drug_key: 'warfarin', drug_name: 'Warfarin', dose_meta: 'ไม่ต้องปรับตามไต — ปรับตาม INR เป้าหมาย 2-3 (MVR 2.5-3.5)' },
]

// ====================================================================
// Disease Rules (จากแนวทาง สุโขทัย หัวข้อ 5, 6)
// ====================================================================

export const SUKHOTHAI_DISEASE_RULES: DiseaseRule[] = [
  // DM
  { disease_key: 'CKD_METFORMIN', disease: 'CKD', display_name: 'CKD + Metformin', drug_class: 'Metformin', severity: 'contraindicated', note: 'eGFR<30: ห้ามใช้ · eGFR 30-45: max 1000 mg/day' },
  { disease_key: 'CKD_SGLT2', disease: 'CKD', display_name: 'CKD + SGLT2 (Empagliflozin)', drug_class: 'SGLT2', severity: 'contraindicated', note: 'eGFR<30: ห้ามใช้ · HF: eGFR<20 ห้ามใช้' },
  { disease_key: 'CKD_GLIBENCLAMIDE', disease: 'CKD', display_name: 'CKD + Glibenclamide', drug_class: 'Sulfonylurea', severity: 'contraindicated', note: 'eGFR<60: ห้ามใช้ (เปลี่ยนเป็น Glipizide)' },
  { disease_key: 'HF_PIOGLITAZONE', disease: 'HF', display_name: 'HF NYHA III-IV + Pioglitazone', drug_class: 'Thiazolidinedione', severity: 'contraindicated', note: 'ผู้ป่วย HF NYHA 3-4 ห้ามใช้ Pioglitazone' },
  { disease_key: 'CKD_NSAID', disease: 'CKD', display_name: 'CKD + NSAIDs', drug_class: 'NSAID', severity: 'avoid', note: 'eGFR<30: หลีกเลี่ยง NSAIDs' },
  // Pregnancy bans
  { disease_key: 'PREG_STATIN', disease: 'PREGNANCY', display_name: 'ตั้งครรภ์ + Statin', drug_class: 'Statin', severity: 'contraindicated', note: 'ห้ามใช้ในหญิงตั้งครรภ์' },
  { disease_key: 'PREG_WARFARIN', disease: 'PREGNANCY', display_name: 'ตั้งครรภ์ + Warfarin', drug_icode: 'warfarin', severity: 'contraindicated', note: 'ห้ามใช้ (teratogenic) — เปลี่ยนเป็น LMWH' },
  { disease_key: 'PREG_ERGOT', disease: 'PREGNANCY', display_name: 'ตั้งครรภ์ + Ergot', drug_class: 'Ergot', severity: 'contraindicated', note: 'ห้ามใช้ Ergotamine/Methylergonovine ในระหว่างตั้งครรภ์' },
  // Elderly Beers
  { disease_key: 'ELDERLY_LABZD', disease: 'ELDERLY', display_name: 'อายุ ≥65 + Long-acting BZD', drug_class: 'Long-acting BZD', severity: 'avoid', note: 'หลีกเลี่ยง chlordiazepoxide / diazepam / dipotassium chlorazepate' },
  // Lithium
  { disease_key: 'CKD_LITHIUM', disease: 'CKD', display_name: 'CKD + Lithium', drug_icode: 'lithium', severity: 'avoid', note: 'CrCl<30: ไม่แนะนำ' },
  { disease_key: 'PREG_LITHIUM', disease: 'PREGNANCY', display_name: 'ตั้งครรภ์ไตรมาสแรก + Lithium', drug_icode: 'lithium', severity: 'contraindicated', note: 'ห้ามใช้ในไตรมาสแรก' },
  // Allopurinol HLA
  { disease_key: 'ALLOPURINOL_NEW', disease: 'NEW_PATIENT', display_name: 'ผู้ป่วยใหม่ + Allopurinol', drug_icode: 'allopurinol', severity: 'caution', note: 'ผู้ป่วยใหม่/รับยา <2 เดือน: ตรวจ HLA-B*58:01 ก่อน — ไม่พบผล → consult แพทย์' },
]

// ====================================================================
// Duplicate therapy classes (รพ.สุโขทัย หัวข้อ 7)
// → ใช้กับ DRUG_MASTER.dup_class field
// ====================================================================

export interface DupClassMapping {
  /** ชื่อ class แสดงผล */
  class_name: string
  /** keys (lowercase) ที่จะ match กับ generic_name หรือ drug_category ของยา */
  drug_keys: string[]
}

export const DUPLICATE_THERAPY_CLASSES: DupClassMapping[] = [
  {
    class_name: 'ACEI',
    drug_keys: ['enalapril', 'perindopril', 'lisinopril', 'captopril', 'ramipril', 'quinapril'],
  },
  {
    class_name: 'ARB',
    drug_keys: ['losartan', 'valsartan', 'irbesartan', 'olmesartan', 'telmisartan', 'candesartan', 'azilsartan'],
  },
  {
    class_name: 'Beta-blocker',
    drug_keys: ['atenolol', 'propranolol', 'metoprolol', 'bisoprolol', 'carvedilol', 'nebivolol', 'labetalol'],
  },
  {
    class_name: 'Alpha-1 blocker',
    drug_keys: ['doxazosin', 'prazosin', 'terazosin', 'tamsulosin', 'alfuzosin'],
  },
  {
    class_name: 'Statin',
    drug_keys: ['simvastatin', 'atorvastatin', 'rosuvastatin', 'pravastatin', 'lovastatin', 'fluvastatin', 'pitavastatin'],
  },
  {
    class_name: 'NSAID',
    drug_keys: ['ibuprofen', 'naproxen', 'diclofenac', 'meloxicam', 'celecoxib', 'etoricoxib', 'piroxicam', 'indomethacin', 'mefenamic', 'aspirin'],
  },
]

// ====================================================================
// Drug timing (รพ.สุโขทัย หัวข้อ 8)
// ====================================================================

export const DRUG_TIMING_RULES: { key: string; timing_note: string }[] = [
  { key: 'levothyroxine', timing_note: 'รับประทานก่อนอาหารอย่างน้อย 1 ชั่วโมง (กระเพาะว่าง)' },
  { key: 'levodopa', timing_note: 'รับประทานก่อนอาหารอย่างน้อย 30 นาที (Madopar)' },
  { key: 'benserazide', timing_note: 'รับประทานก่อนอาหารอย่างน้อย 30 นาที (Madopar)' },
  { key: 'dolutegravir', timing_note: 'แยกจาก Ferrous/Calcium/MTV/Alum milk: ก่อน 6 ชม. หรือหลัง 2 ชม.' },
  { key: 'alendronate', timing_note: 'ตอนเช้ากระเพาะว่าง น้ำเปล่าเต็มแก้ว ห้ามนอนราบ 30 นาที' },
]

// ====================================================================
// DUE drug list (12 ยา ATB ควบคุม รพ.สุโขทัย) + Sudthawej
// ====================================================================

export const DUE_DRUG_KEYS = [
  'meropenem', 'imipenem', 'doripenem', 'ertapenem',
  'piperacillin', 'ampicillin sulbactam', 'cefoperazone sulbactam',
  'levofloxacin', 'vancomycin', 'colistin', 'sulbactam', 'fosfomycin',
  // Pre-authorization antifungals
  'voriconazole', 'micafungin', 'liposomal amphotericin',
  // Antiviral
  'ganciclovir',
]

// ====================================================================
// SR no-crush list (รพ.สุโขทัย หัวข้อ 5.4 — tube feeding)
// ====================================================================

export const NO_CRUSH_KEYS = [
  'theophylline 200 mg sr',
  'sodium valproate 500 mg sr',
  'nifedipine 20 mg sr',
  'verapamil 240 mg sr',
]

// Re-export LabRule from types for convenience
export type { LabRule }
