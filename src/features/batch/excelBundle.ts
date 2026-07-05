// โหมด "คัดกรองทั้งหมด" — parse Excel 5 ไฟล์ฝั่ง client → รวมเป็น bundle ต่อคนไข้ (offline)
import { calcCrCl } from '@/features/renal/calc'
import type { PatientInput, DrugEntry } from '@/types/screening'
import type { DrugMaster, LabRule } from '@/types/drug'

export type FileKind = 'admission' | 'lab' | 'drug' | 'allergy' | 'diagnosis' | 'unknown'
export const FILE_KINDS: FileKind[] = ['admission', 'lab', 'drug', 'allergy', 'diagnosis']
export const KIND_LABEL: Record<FileKind, string> = {
  admission: 'ข้อมูลผู้ป่วย', lab: 'ผลแลป', drug: 'รายการยา',
  allergy: 'แพ้ยา', diagnosis: 'การวินิจฉัย', unknown: 'ไม่ทราบชนิด',
}

type Row = Record<string, unknown>
const s = (v: unknown) => (v == null ? '' : String(v)).trim()

function num(v: unknown): number | undefined {
  const str = s(v)
  if (!str) return undefined
  const range = str.match(/^(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)$/) // "3 - 5" → ค่ากลาง
  if (range) return (parseFloat(range[1]) + parseFloat(range[2])) / 2
  const m = str.match(/-?\d+(?:\.\d+)?/) // ตัด [Stage x] / หน่วยทิ้ง เช่น "45.16[Stage 3]"
  return m ? parseFloat(m[0]) : undefined
}
function toYYMMDD(v: unknown): string | undefined {
  const str = s(v)
  const m = str.match(/(\d{4})-(\d{2})-(\d{2})/) // YYYY-MM-DD → YYMMDD
  if (m) return m[1].slice(2) + m[2] + m[3]
  if (v instanceof Date) return String(v.getFullYear()).slice(2) + String(v.getMonth() + 1).padStart(2, '0') + String(v.getDate()).padStart(2, '0')
  return undefined
}

/** ตรวจชนิดไฟล์จากหัวคอลัมน์ (ปลอดภัยกว่าชื่อไฟล์/sheet) */
export function detectKind(rows: Row[], fileName = ''): FileKind {
  const h = (rows.length ? Object.keys(rows[0]) : []).map((x) => x.toLowerCase().trim())
  const has = (c: string) => h.includes(c)
  if (has('age_year') || has('weight_kg')) return 'admission'
  if (has('analyte') && has('value')) return 'lab'
  if (has('icode') || has('generic_name')) return 'drug'
  if (has('icd10')) return 'diagnosis'
  if (has('agent')) return 'allergy'
  const fn = fileName.toLowerCase()
  for (const k of FILE_KINDS) if (fn.includes(k)) return k
  return 'unknown'
}

/** อ่านไฟล์ Excel (dynamic import xlsx เพื่อไม่ให้ bundle หลักใหญ่) */
export async function parseWorkbook(buf: ArrayBuffer): Promise<Row[]> {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json<Row>(ws, { defval: '' })
}

function groupBy(rows: Row[], key: string): Map<string, Row[]> {
  const m = new Map<string, Row[]>()
  for (const r of rows) { const k = s(r[key]); if (!k) continue; const a = m.get(k); if (a) a.push(r); else m.set(k, [r]) }
  return m
}

// analyte (lowercase) → key ใน labs (scr/inr/egfr จัดการแยก)
const ANALYTE: Record<string, string> = {
  alt: 'alt', ast: 'ast', albumin: 'albumin', fbs: 'fbs', hb: 'hb', hba1c: 'hba1c',
  k: 'k', potassium: 'k', mg: 'mg', na: 'na', sodium: 'na', platelet: 'plt', plt: 'plt',
  wbc: 'wbc', neutrophil: 'neut', neut: 'neut', band: 'band', eosinophil: 'eos', eos: 'eos',
}

function icdToDiseases(icds: string[], age?: number): { diseases: string[]; is_pregnant: boolean } {
  const set = new Set<string>(); let preg = false
  for (const raw of icds) {
    const c = s(raw).toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (/^N18/.test(c)) set.add('CKD')
    if (/^E1[0-4]/.test(c)) set.add('DM')
    if (/^I48/.test(c)) set.add('AF')
    if (/^J4[456]/.test(c)) set.add('Asthma_COPD')
    if (/^I50/.test(c)) set.add('HF')
    if (/^(D5[0-3]|D64)/.test(c)) set.add('Anemia')
    if (/^K7[0246]/.test(c)) set.add('Cirrhosis')
    if (/^(O\d|Z34|Z3A)/.test(c)) preg = true
  }
  if ((age ?? 0) >= 65) set.add('ELDERLY')
  return { diseases: [...set], is_pregnant: preg }
}

export interface Bundle { an: string; patient: PatientInput; drugs: DrugEntry[]; ward?: string }

/** รวม 5 ไฟล์ → bundle ต่อคนไข้ (group ด้วย AN) + คำนวณ CrCl/ANC/AEC */
export function buildBundles(
  filesByKind: Partial<Record<FileKind, Row[]>>,
  drugMasters: DrugMaster[],
  labRules: LabRule[],
): Bundle[] {
  const admByAn = new Map((filesByKind.admission ?? []).map((r) => [s(r.an), r]))
  const labByAn = groupBy(filesByKind.lab ?? [], 'an')
  const drugByAn = groupBy(filesByKind.drug ?? [], 'an')
  const allergyByAn = groupBy(filesByKind.allergy ?? [], 'an')
  const dxByAn = groupBy(filesByKind.diagnosis ?? [], 'an')
  const masterByIcode = new Map(drugMasters.map((m) => [s(m.icode).toLowerCase(), m]))
  const rulesByIcode = groupByKey(labRules, (lr) => s(lr.icode))

  const ans = new Set<string>([...admByAn.keys(), ...drugByAn.keys()])
  const bundles: Bundle[] = []

  for (const an of ans) {
    const a = admByAn.get(an)
    const age = num(a?.age_year)
    const sexRaw = s(a?.sex).toUpperCase()
    const sex: 'M' | 'F' | undefined = /^M|^1/.test(sexRaw) ? 'M' : /^F|^2/.test(sexRaw) ? 'F' : undefined
    const weight = num(a?.weight_kg)
    const height = num(a?.height_cm)
    const ward = s(a?.ward) || undefined
    const hn = s(a?.hn) || s(labByAn.get(an)?.[0]?.hn) || s(drugByAn.get(an)?.[0]?.hn) || undefined

    // labs: ค่าล่าสุดต่อ analyte
    const latest = new Map<string, { val: unknown; date?: string }>()
    for (const r of labByAn.get(an) ?? []) {
      const name = s(r.analyte).toLowerCase(); if (!name) continue
      const date = toYYMMDD(r.report_date)
      const prev = latest.get(name)
      if (!prev || (date && (!prev.date || date >= prev.date))) latest.set(name, { val: r.value, date })
    }
    const labs: Record<string, number> = {}
    const labDates: Record<string, string> = {}
    let scr: number | undefined, inr: number | undefined, egfrLab: number | undefined
    for (const [name, { val, date }] of latest) {
      const n = num(val); if (n === undefined) continue
      if (name === 'scr' || name.includes('creat')) { scr = n; if (date) labDates.scr = date; continue }
      if (name === 'inr') { inr = n; if (date) labDates.inr = date; continue }
      if (name === 'egfr' || name === 'gfr') { egfrLab = n; labs.gfr = n; if (date) labDates.gfr = date; continue }
      const key = ANALYTE[name]; if (!key) continue
      labs[key] = n; if (date) labDates[key] = date
    }
    // ANC = WBC×(Neut%+Band%)/100 · AEC = WBC×Eos%/100 (คูณ 1000 → cells/mm³)
    if (labs.wbc !== undefined) {
      if (labs.neut !== undefined) { labs.anc = Math.round(labs.wbc * (labs.neut + (labs.band ?? 0)) / 100 * 1000); if (labDates.wbc) labDates.anc = labDates.wbc }
      if (labs.eos !== undefined) { labs.aec = Math.round(labs.wbc * labs.eos / 100 * 1000); if (labDates.wbc) labDates.aec = labDates.wbc }
    }
    // CrCl (Cockcroft) → egfr; ถ้าคำนวณไม่ได้ ใช้ eGFR จากแลป
    let egfr: number | undefined
    if (age !== undefined && weight !== undefined && scr && sex) egfr = calcCrCl({ age, weight, height, sex, scr }).crcl
    else egfr = egfrLab
    if (egfr !== undefined && labDates.scr) labDates.crcl = labDates.scr

    const icds = (dxByAn.get(an) ?? []).map((r) => s(r.icd10))
    const { diseases, is_pregnant } = icdToDiseases(icds, age)
    const allergies = (allergyByAn.get(an) ?? []).map((r) => s(r.agent)).filter(Boolean)

    const patient: PatientInput = { an, hn, age, sex, weight, height, scr, egfr, inr, labs, labDates, diseases, allergies, is_pregnant }

    const drugs: DrugEntry[] = (drugByAn.get(an) ?? []).map((r) => {
      const icode = s(r.icode)
      const master: DrugMaster = masterByIcode.get(icode.toLowerCase()) ?? ({
        icode, drug_name: s(r.drug_name), generic_name: s(r.generic_name),
        strength: s(r.strength), dosage_form: s(r.dosage_form),
      } as DrugMaster)
      return { icode, drug_name: s(r.drug_name) || master.drug_name, sig: s(r.sig) || undefined, master, labRules: rulesByIcode.get(icode) ?? [] }
    })

    bundles.push({ an, patient, drugs, ward })
  }
  bundles.sort((x, y) => (x.ward ?? '').localeCompare(y.ward ?? '') || x.an.localeCompare(y.an))
  return bundles
}

function groupByKey<T>(arr: T[], keyFn: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const x of arr) { const k = keyFn(x); if (!k) continue; const a = m.get(k); if (a) a.push(x); else m.set(k, [x]) }
  return m
}
