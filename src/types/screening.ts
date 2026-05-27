import type { DdiOverride, DiseaseRule, DrugMaster, LabRule } from './drug'

export interface PatientInput {
  hn?: string
  patient_name?: string
  age?: number
  weight?: number
  height?: number
  sex?: 'M' | 'F'
  scr?: number
  inr?: number
  /** อายุครรภ์ (สัปดาห์) ถ้าตั้งครรภ์ */
  pregnancy_weeks?: number
  is_pregnant?: boolean
  is_lactating?: boolean
  /** มี G6PD deficiency หรือไม่ */
  g6pd?: boolean
  smoking?: boolean
  alcohol?: boolean
  diseases?: string[]
  /** allergy → drug name, class, หรือ allergen เช่น "Penicillin", "Sulfa" */
  allergies?: string[]
}

export interface DrugEntry {
  icode: string
  drug_name: string
  sig?: string
  master?: DrugMaster
  labRules?: LabRule[]
}

export type AlertSeverity = 'red' | 'orange' | 'yellow' | 'blue'

export type AlertType =
  | 'DDI' | 'LAB' | 'DISEASE' | 'DRP' | 'RENAL' | 'PED'
  | 'ALLERGY' | 'HAD' | 'LASA' | 'PREG' | 'LACT' | 'BEERS' | 'G6PD'
  | 'FOOD' | 'SMOKING' | 'ALCOHOL' | 'TDM'

export interface ScreeningAlert {
  id: string
  type: AlertType
  severity: AlertSeverity
  title: string
  detail: string
  drugs?: string[]
  recommendation?: string
  source?: DdiOverride | DiseaseRule | LabRule | DrugMaster
}

export interface ScreeningResult {
  patient: PatientInput
  drugs: DrugEntry[]
  alerts: ScreeningAlert[]
  crcl?: number
  ibw?: number
  createdAt: Date
}
