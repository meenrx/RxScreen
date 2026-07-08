import type { DdiOverride, DiseaseRule, DrugMaster, HadRule, LabRule, DrugSubstitution } from '@/types/drug'
import type { DrugEntry, PatientInput, ScreeningAlert } from '@/types/screening'
import { calcCrCl, findMatchingDoseAction, renalBasisOf, computePediatricDose } from '@/features/renal/calc'
import { buildRduAlerts } from './rduRules'
import { buildQrRuleAlerts } from './qrRules'
import { findRenalRef, pickRenalBand } from './renalDoseRef'
import { findHadRef } from './hadRef'
import { BEERS_2023, NO_CRUSH, G6PD_UNSAFE, LACTATION_AVOID, TERATOGEN, findRef, drugText, findMaxDose, WEEKLY_DOSING, findTbDose, YSITE_INCOMPAT, YSITE_SOLO } from './clinicalRefs'

function nameEq(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

function drugMatches(entry: DrugEntry, key: string): boolean {
  if (!key) return false
  const k = key.toLowerCase()
  if (entry.icode.toLowerCase() === k) return true
  if (entry.master?.icode.toLowerCase() === k) return true
  if (entry.master?.drug_name.toLowerCase().includes(k)) return true
  if (entry.master?.generic_name?.toLowerCase().includes(k)) return true
  return false
}

function classMatches(entry: DrugEntry, drugClass: string | undefined): boolean {
  if (!drugClass) return false
  return nameEq(entry.master?.drug_class, drugClass)
}

/** กรอง labRules ของยาตาม indication ที่เภสัชกรเลือก
 *   - ถ้าเลือกแล้ว → ใช้เฉพาะ rule ที่ indication ตรง + rule ที่ไม่ได้ระบุ indication (default — ใช้ได้ทุกข้อบ่งใช้)
 *   - ถ้ายังไม่เลือก → คืนทั้งหมด (ปล่อยให้ alert โชว์ทุกตัว เพื่อให้เภสัชกรเห็นแล้วเลือก) */
function filterRulesByIndication(drug: DrugEntry, patient: PatientInput): LabRule[] {
  const rules = drug.labRules ?? []
  const selected = patient.selected_indications?.[drug.icode]?.trim()
  if (!selected) return rules
  return rules.filter((r) => {
    const ind = r.indication?.trim()
    if (!ind) return true  // default rule — ใช้ได้ทุก indication
    return ind === selected
  })
}

/** หา list ของ indication ที่ยาตัวนี้รองรับ (unique, ไม่นับ default) */
export function getDrugIndications(drug: DrugEntry): string[] {
  const set = new Set<string>()
  for (const r of drug.labRules ?? []) {
    const ind = r.indication?.trim()
    if (ind) set.add(ind)
  }
  return [...set].sort()
}

// ============ DDI ============
export function buildDdiAlerts(drugs: DrugEntry[], ddiList: DdiOverride[]): ScreeningAlert[] {
  const alerts: ScreeningAlert[] = []
  for (let i = 0; i < drugs.length; i++) {
    for (let j = i + 1; j < drugs.length; j++) {
      const a = drugs[i]
      const b = drugs[j]
      const found = ddiList.find(
        (d) =>
          (drugMatches(a, d.drug_a) && drugMatches(b, d.drug_b)) ||
          (drugMatches(a, d.drug_b) && drugMatches(b, d.drug_a)),
      )
      if (!found) continue
      const sev: ScreeningAlert['severity'] =
        found.severity === 'contraindicated' || found.severity === 'major' ? 'red' :
        found.severity === 'moderate' ? 'orange' : 'yellow'
      alerts.push({
        id: `ddi_${a.icode}_${b.icode}`,
        type: 'DDI',
        severity: sev,
        title: `DDI ${labelSev(found.severity)}: ${a.master?.drug_name ?? a.icode} ↔ ${b.master?.drug_name ?? b.icode}`,
        detail: [found.mechanism, found.local_note].filter(Boolean).join(' — ') || 'พบคู่ยาที่ระบุไว้ใน DDI override',
        recommendation: found.recommendation,
        drugs: [a.icode, b.icode],
        source: found,
      })
    }
  }
  return alerts
}

function labelSev(s: DdiOverride['severity']) {
  switch (s) {
    case 'contraindicated': return 'ห้ามใช้ร่วม'
    case 'major': return 'รุนแรง'
    case 'moderate': return 'ปานกลาง'
    case 'minor': return 'เล็กน้อย'
  }
}

// ============ LAB ============
export function buildLabAlerts(drugs: DrugEntry[], labRules: LabRule[], patient: PatientInput): ScreeningAlert[] {
  const alerts: ScreeningAlert[] = []
  for (const drug of drugs) {
    // warfarin: INR จัดการใน Warfarin panel แล้ว (มีคำแนะนำปรับ dose จริง) → ไม่ต้องเตือน LAB monitor ซ้ำ
    const isWarfarin = /warfarin/i.test(`${drug.master?.generic_name ?? ''} ${drug.master?.drug_name ?? drug.drug_name ?? ''}`)
    const allRulesForDrug = labRules.filter((r) => r.icode === drug.icode
      && !(isWarfarin && /inr/i.test(r.param ?? '')))
    // กรองตาม indication: ใช้ rule.id เป็น key — ถ้า drug.labRules มี id ตรงกัน → คือ allowed
    const allowedIds = new Set(filterRulesByIndication(
      { ...drug, labRules: allRulesForDrug },
      patient,
    ).map((r) => r.id).filter((id): id is string => !!id))
    const rules = allRulesForDrug.filter((r) => !r.indication?.trim() || (r.id && allowedIds.has(r.id)))
    for (const r of rules) {
      const sev: ScreeningAlert['severity'] = r.priority === 'high' ? 'red' : r.priority === 'medium' ? 'orange' : 'yellow'

      // เงื่อนไขแจ้งเตือนแบบ operator (admin ตั้งใน Lab/Dose) — เช่น ">5.5:K สูง"
      // เทียบค่า lab ของผู้ป่วยกับเงื่อนไข → เตือนด้วยข้อความ action ที่ตั้งไว้
      if (r.alert_meta) {
        const v = readPatientLab(patient, r.param)
        if (v !== undefined) {
          const action = findMatchingDoseAction(r.alert_meta, v)
          if (action) {
            const hard = /ห้าม|หยุด|อันตราย|วิกฤต|contraindicat|stop/i.test(action)
            alerts.push({
              id: `labalert_${drug.icode}_${r.param}_${r.id ?? ''}`,
              type: 'LAB',
              severity: hard ? 'red' : sev,
              title: `📋 ${drug.master?.drug_name ?? drug.icode} — ${r.param ?? ''} = ${v}: ${action}`,
              detail: [r.normal_range ? `ค่าปกติ: ${r.normal_range} ${r.unit ?? ''}` : null, r.reason].filter(Boolean).join(' · '),
              recommendation: action,
              drugs: [drug.icode],
              source: r,
            })
          }
        }
        continue // ใช้ alert_meta เป็นหลักสำหรับ rule นี้ (ไม่ต้องเช็ค normal_range ซ้ำ)
      }

      // ข้าม rule ที่เป็น "renal dose adjustment" — จะไป trigger RENAL alert แยก
      // ไม่งั้นเด้ง LAB monitor ซ้ำซ้อนกับ RENAL ที่บอก action แล้ว
      if (r.dose_meta) continue

      const paramValue = readPatientLab(patient, r.param)
      const inRange = isInNormalRange(paramValue, r.normal_range)
      const outOfRange = paramValue !== undefined && inRange === false

      // เตือนเฉพาะเมื่อ "มีค่า และค่าผิดปกติจริง" — ไม่มีค่า/ในเกณฑ์ = ผ่าน (ไม่โชว์)
      if (!outOfRange) continue

      alerts.push({
        id: `lab_${drug.icode}_${r.param}_${r.id ?? ''}`,
        type: 'LAB',
        severity: 'red',
        title: `LAB monitor: ${drug.master?.drug_name ?? drug.icode} — ${r.param ?? '-'} = ${paramValue}`,
        detail: [
          r.normal_range ? `ค่าปกติ: ${r.normal_range} ${r.unit ?? ''}` : null,
          r.reason ? `เหตุผล: ${r.reason}` : null,
          '⚠ ค่าผิดปกติ',
        ].filter(Boolean).join(' · '),
        drugs: [drug.icode],
        source: r,
      })
    }
  }
  return alerts
}

// ============ Dose appropriateness (ขนาดที่แพทย์สั่งจริง เทียบมาตรฐาน) ============
export function buildDoseAlerts(drugs: DrugEntry[], patient: PatientInput): ScreeningAlert[] {
  const alerts: ScreeningAlert[] = []
  const isChild = patient.age !== undefined && patient.age < 15
  for (const d of drugs) {
    const gen = d.master?.generic_name
    const name = d.master?.drug_name ?? d.drug_name
    const label = d.master?.drug_name ?? d.drug_name ?? d.icode

    // 1) ยา "สัปดาห์ละครั้ง" (เช่น methotrexate) แต่สั่งรายวัน = อันตรายร้ายแรง
    if (WEEKLY_DOSING.test(`${gen ?? ''} ${name ?? ''}`.toLowerCase()) && !d.prn) {
      const daily = (d.per_day ?? 0) >= 1 && !/สัปดาห์|week|wk|จันทร|อังคาร|พุธ|พฤหัส|ศุกร|เสาร|อาทิตย/i.test(d.sig ?? '')
      if (daily) alerts.push({
        id: `dose_weekly_${d.icode}`, type: 'DRP', severity: 'red',
        title: `🚨 ${label} — สั่งรายวัน! ยานี้ต้องให้ "สัปดาห์ละครั้ง"`,
        detail: `${d.sig ?? ''} — การให้ methotrexate รายวันเสี่ยง toxicity รุนแรง/เสียชีวิต`,
        recommendation: 'ตรวจสอบกับแพทย์ทันที — ยืนยันความถี่ (สัปดาห์ละครั้ง)',
        drugs: [d.icode],
      })
    }

    // 2) เกินขนาดสูงสุดผู้ใหญ่ (เฉพาะผู้ใหญ่ + มี daily_mg คำนวณได้)
    if (isChild || d.daily_mg === undefined || d.prn) continue
    const ref = findMaxDose(gen, name)
    if (!ref) continue
    if (d.daily_mg > ref.max * 1.001) {
      const over = d.daily_mg / ref.max
      alerts.push({
        id: `dose_over_${d.icode}`, type: 'DRP', severity: over >= 1.5 ? 'red' : 'orange',
        title: `⚠️ ${label} — ขนาดเกินมาตรฐาน: สั่ง ${round1(d.daily_mg)} mg/วัน (สูงสุด ${ref.max})`,
        detail: [`${d.strength_mg ?? '?'} mg × ${d.per_dose ?? '?'} × ${d.per_day ?? '?'} ครั้ง/วัน`, ref.note].filter(Boolean).join(' · '),
        recommendation: 'ทบทวนขนาดกับแพทย์ (Lexicomp/BNF)',
        drugs: [d.icode],
      })
    }
  }
  return alerts
}
function round1(n: number): number { return Math.round(n * 10) / 10 }

// ============ IV Y-site compatibility (ยาฉีดให้ร่วมสายไม่ได้) ============
function isInjectable(d: DrugEntry): boolean {
  const f = `${d.master?.dosage_form ?? d.master?.form ?? ''}`.toLowerCase()
  return /inject|\binj\b|vial|amp(oule|ule|)\b|parenteral|\biv\b|ยาฉีด|ฉีด/.test(f)
}
export function buildYSiteAlerts(drugs: DrugEntry[]): ScreeningAlert[] {
  const inj = drugs.filter(isInjectable)
  if (inj.length < 2) return []
  const alerts: ScreeningAlert[] = []
  const nameOf = (d: DrugEntry) => `${d.master?.generic_name ?? ''} ${d.master?.drug_name ?? d.drug_name ?? ''}`.toLowerCase()
  const seen = new Set<string>()

  // คู่ที่เข้ากันไม่ได้ (pairwise)
  for (let i = 0; i < inj.length; i++) {
    for (let j = i + 1; j < inj.length; j++) {
      const t1 = nameOf(inj[i]), t2 = nameOf(inj[j])
      for (const p of YSITE_INCOMPAT) {
        if ((p.a.test(t1) && p.b.test(t2)) || (p.a.test(t2) && p.b.test(t1))) {
          const key = [inj[i].icode, inj[j].icode].sort().join('|')
          if (seen.has(key)) break
          seen.add(key)
          alerts.push({
            id: `ysite_${key}`, type: 'IVC', severity: p.severe ? 'red' : 'orange',
            title: `💉 IV เข้ากันไม่ได้: ${inj[i].master?.drug_name ?? inj[i].icode} ↔ ${inj[j].master?.drug_name ?? inj[j].icode}`,
            detail: p.note,
            recommendation: 'ห้ามผสม/ให้แยกสาย · flush สาย (NS) ระหว่างยา',
            drugs: [inj[i].icode, inj[j].icode],
          })
          break
        }
      }
    }
  }
  // ยาที่ต้องให้แยกสายเสมอ (phenytoin/diazepam) เมื่อมียาฉีดอื่นร่วม
  for (const d of inj) {
    const t = nameOf(d)
    const solo = YSITE_SOLO.find((s) => s.re.test(t))
    if (solo && inj.some((o) => o !== d)) {
      alerts.push({
        id: `ysite_solo_${d.icode}`, type: 'IVC', severity: 'orange',
        title: `💉 ${d.master?.drug_name ?? d.icode} — ให้แยกสาย`,
        detail: solo.note, recommendation: 'ให้สายเดี่ยว + flush ก่อน/หลัง', drugs: [d.icode],
      })
    }
  }
  return alerts
}

// ============ ขนาดยาวัณโรคผู้ใหญ่ตามน้ำหนัก (H/R/Z/E) — คำนวณจากน้ำหนักให้เลย ============
export function buildTbDoseAlerts(drugs: DrugEntry[], patient: PatientInput): ScreeningAlert[] {
  const wt = patient.weight
  if (!wt) return []
  if (patient.age !== undefined && patient.age < 15) return [] // เด็ก → ใช้เส้นทางขนาดยาเด็ก (mg/kg)
  const alerts: ScreeningAlert[] = []
  for (const d of drugs) {
    const ref = findTbDose(d.master?.generic_name, d.master?.drug_name ?? d.drug_name)
    if (!ref) continue
    const rec = ref.dose(wt)
    // เทียบกับขนาดที่แพทย์สั่ง (ถ้าคำนวณได้จาก q3) — ต่างเกิน → เตือนส้ม
    let severity: ScreeningAlert['severity'] = 'blue'
    let mismatch = ''
    if (d.daily_mg !== undefined) {
      const ratio = d.daily_mg / rec.mg
      if (ratio < 0.85 || ratio > 1.2) { severity = 'orange'; mismatch = ` · ⚠️ สั่ง ${round1(d.daily_mg)} mg/วัน (ต่างจากแนะนำ)` }
      else mismatch = ` · ✓ สั่ง ${round1(d.daily_mg)} mg/วัน`
    }
    alerts.push({
      id: `tbdose_${d.icode}`,
      type: 'DRP',
      severity,
      title: `💊 ${ref.label} ตามน้ำหนัก ${wt} kg → แนะนำ ${rec.mg} mg/วัน${mismatch}`,
      detail: `${ref.perKg}${rec.byWeight ? ' · คำนวณตามน้ำหนัก (นน. <35 หรือ >70)' : ''} · แนวทางการรักษาวัณโรค (DDC)`,
      recommendation: severity === 'orange' ? `ทบทวนขนาด → แนะนำ ${rec.mg} mg/วัน` : undefined,
      drugs: [d.icode],
    })
  }
  return alerts
}

function readPatientLab(p: PatientInput, param?: string): number | undefined {
  if (!param) return undefined
  const k = param.toLowerCase()
  if (k.includes('crcl') || k.includes('cr cl') || k.includes('cockcroft')) {
    // คำนวณ CrCl อัตโนมัติจาก SCr + อายุ + น้ำหนัก (Cockcroft-Gault)
    if (!p.scr || !p.age || !p.weight) return undefined
    const { crcl } = calcCrCl({ scr: p.scr, age: p.age, weight: p.weight, sex: p.sex ?? 'M' })
    return crcl
  }
  if (k.includes('scr') || k.includes('creat')) return p.scr
  if (k === 'inr') return p.inr
  // ค่าแล็บอื่น ๆ จาก labs map (K, AST, ALT, BUN, ...) — เทียบชื่อ param แบบ normalize
  const labKey = k.replace(/[^a-z0-9]/g, '')
  return p.labs?.[k] ?? p.labs?.[labKey]
}

function isInNormalRange(value: number | undefined, range?: string): boolean | undefined {
  if (value === undefined || !range) return undefined
  const m = range.match(/(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)/)
  if (!m) return undefined
  return value >= parseFloat(m[1]) && value <= parseFloat(m[2])
}

// ============ Disease ============
export function buildDiseaseAlerts(drugs: DrugEntry[], diseases: string[] | undefined, rules: DiseaseRule[]): ScreeningAlert[] {
  if (!diseases || diseases.length === 0) return []
  const alerts: ScreeningAlert[] = []
  for (const d of drugs) {
    for (const r of rules) {
      if (!diseases.map((s) => s.toLowerCase()).includes(r.disease.toLowerCase())) continue
      const hitByIcode = r.drug_icode && nameEq(r.drug_icode, d.icode)
      const hitByClass = classMatches(d, r.drug_class)
      if (!hitByIcode && !hitByClass) continue
      const sev: ScreeningAlert['severity'] = r.severity === 'contraindicated' ? 'red' : r.severity === 'avoid' ? 'orange' : 'yellow'
      alerts.push({
        id: `disease_${d.icode}_${r.disease}_${r.id ?? ''}`,
        type: 'DISEASE',
        severity: sev,
        title: `โรค ${r.disease} → ${labelSeverity(r.severity)} ยา ${d.master?.drug_name ?? d.icode}`,
        detail: r.note ?? '—',
        drugs: [d.icode],
        source: r,
      })
    }
  }
  return alerts
}

function labelSeverity(s: DiseaseRule['severity']) {
  switch (s) {
    case 'contraindicated': return 'ห้ามใช้'
    case 'avoid': return 'หลีกเลี่ยง'
    case 'caution': return 'ใช้อย่างระวัง'
  }
}

// ============ Renal ============
/** แปลง dose_meta string ("eGFR>50:75%; eGFR 40-59:150mg OD") → อ่านง่ายขึ้น
 *  ("eGFR>50 → 75% · eGFR 40-59 → 150mg OD") ใช้กับ detail ของ alert เท่านั้น */
function formatDoseMetaForDisplay(meta: string): string {
  return meta
    .split(/[;\n]/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const i = p.indexOf(':')
      if (i < 0) return p
      return `${p.slice(0, i).trim()} → ${p.slice(i + 1).trim()}`
    })
    .join(' · ')
}

/** หา GFR ที่ใช้ได้: ยา basis=egfr → ใช้ค่าที่กรอกตรง, basis=crcl → คำนวณ Cockcroft-Gault */
function resolveGfr(
  rule: { renal_basis?: 'crcl' | 'egfr'; dose_meta?: string; param?: string },
  patient: PatientInput,
): { gfr: number; label: 'eGFR' | 'CrCl' } | null {
  const basis = renalBasisOf(rule)
  if (basis === 'egfr') {
    // ปรับตาม GFR → ใช้ค่า GFR ที่ lab รายงาน (QR Gf) ก่อน
    const gfr = patient.labs?.gfr ?? patient.egfr
    return gfr !== undefined ? { gfr, label: 'eGFR' } : null
  }
  // crcl — ใช้ CrCl (QR C = Cockcroft-Gault) ตรง ๆ ก่อน; ถ้าไม่มีค่อยคำนวณจาก SCr
  if (patient.egfr !== undefined) return { gfr: patient.egfr, label: 'CrCl' }
  if (patient.scr && patient.age && patient.weight && patient.sex) {
    const { crcl } = calcCrCl({ age: patient.age, weight: patient.weight, height: patient.height, sex: patient.sex, scr: patient.scr })
    return { gfr: crcl, label: 'CrCl' }
  }
  return null
}

export function buildRenalAlerts(drugs: DrugEntry[], patient: PatientInput): ScreeningAlert[] {
  const alerts: ScreeningAlert[] = []
  for (const drug of drugs) {
    const allowed = filterRulesByIndication(drug, patient)
    if (allowed.some((r) => r.renal_exempt)) continue  // ยกเว้นเกณฑ์ไต (admin ลบเกณฑ์)
    const rule = allowed.find((r) => r.dose_meta)
    if (!rule?.dose_meta) continue
    const resolved = resolveGfr(rule, patient)
    if (!resolved) continue
    const { gfr, label } = resolved
    const action = findMatchingDoseAction(rule.dose_meta, gfr)
    if (!action) continue
    // ไม่ต้องปรับ (ไตปกติ/no adjust) → ไม่ต้องเตือน (ให้ยาอยู่กลุ่มเขียว "ผ่าน")
    if (/no\s*adjust|ไม่ต้องปรับ|ไม่ปรับ|no\s*change|full\s*dose|ปกติ|100\s*%/i.test(action)) continue
    const isHardStop = /hold|avoid|contraindicat|ห้ามใช้|งด/i.test(action)
    const sev: ScreeningAlert['severity'] =
      isHardStop ? 'red' :
      /reduce|adjust|q24|q48|ลด|ปรับ/i.test(action) ? 'orange' : 'yellow'
    const drugName = drug.master?.drug_name ?? drug.icode
    const icon = isHardStop ? '🚫' : '⚠️'
    const indTag = rule.indication?.trim() ? ` 📍 ${rule.indication.trim()}` : ''
    alerts.push({
      id: `renal_${drug.icode}_${rule.indication ?? ''}`,
      type: 'RENAL',
      severity: sev,
      title: `${icon} ${drugName}${indTag}: ${action} (${label}=${gfr})`,
      detail: `${label} = ${gfr} mL/min — เกณฑ์: ${formatDoseMetaForDisplay(rule.dose_meta)}`,
      drugs: [drug.icode],
      source: rule,
      recommendation: `${action}  ·  ${label} ${gfr}`,   // โชว์ค่าไตข้างขนาดยา
    })
  }
  return alerts
}

/** ค่าไตสำหรับ renalDoseRef (คู่มือ Sanford/ACP = อิง CrCl Cockcroft-Gault) */
function patientGfr(patient: PatientInput): { gfr: number; label: 'CrCl' | 'eGFR' } | undefined {
  // QR C = CrCl (Cockcroft-Gault) → ใช้ตรง ๆ · ไม่มีก็คำนวณจาก SCr
  if (patient.egfr !== undefined) return { gfr: Math.round(patient.egfr), label: 'CrCl' }
  if (patient.scr && patient.age && patient.weight && patient.sex) {
    const { crcl } = calcCrCl({ age: patient.age, weight: patient.weight, height: patient.height, sex: patient.sex, scr: patient.scr })
    return { gfr: Math.round(crcl), label: 'CrCl' }
  }
  if (patient.labs?.gfr !== undefined) return { gfr: Math.round(patient.labs.gfr), label: 'eGFR' }
  return undefined
}

/**
 * Renal dose ref alerts — จับคู่ยาด้วย generic name กับคู่มือ (RENAL_DOSE_REF)
 * แสดง "ขนาดปกติ + ปรับตาม CrCl ผู้ป่วย + คำนวณ mg จากน้ำหนัก" ในผลคัดกรองทันที
 * ข้าม icode ที่มี LAB_RULE.dose_meta คุมอยู่แล้ว (กันเตือนซ้ำ)
 */
export function buildRenalRefAlerts(drugs: DrugEntry[], patient: PatientInput, skipIcodes?: Set<string>): ScreeningAlert[] {
  const alerts: ScreeningAlert[] = []
  const g = patientGfr(patient)
  for (const drug of drugs) {
    if (skipIcodes?.has(drug.icode)) continue
    const ref = findRenalRef(drug.master?.generic_name, drug.master?.drug_name ?? drug.drug_name)
    if (!ref) continue

    // ยังไม่มีค่า CrCl → เตือนเบา ๆ ว่ายานี้ต้องดูไต (ให้ไปกรอก SCr/น้ำหนัก)
    if (!g) {
      alerts.push({
        id: `renalref_nogfr_${drug.icode}`,
        type: 'RENAL', severity: 'yellow',
        title: `🧪 ${drug.master?.drug_name ?? drug.icode} — ปรับขนาดตามไต (ยังไม่มีค่า CrCl)`,
        detail: `${ref.normalDose ? `ขนาดปกติ: ${ref.normalDose} · ` : ''}ต้องปรับเมื่อ CrCl < ${ref.threshold} — กรอก SCr + น้ำหนัก เพื่อประเมิน`,
        drugs: [drug.icode],
        recommendation: 'กรอก SCr และน้ำหนัก เพื่อคำนวณ CrCl',
      })
      continue
    }

    // มีค่า CrCl แต่ยังไม่ต่ำถึงเกณฑ์ → ไม่ต้องเตือน
    if (g.gfr >= ref.threshold) continue

    const band = pickRenalBand(ref, g.gfr)
    const isHardStop = band ? /ห้าม|หลีกเลี่ยง|ไม่แนะนำ|avoid|contraindicat/i.test(band.text) : false

    // คำนวณ mg จากน้ำหนักจริง (ยา mg/kg)
    let wtCalc = ''
    if (ref.weightBased && ref.mgPerKgNormal && patient.weight) {
      const mg = Math.round(ref.mgPerKgNormal * patient.weight)
      wtCalc = ` · น้ำหนัก ${patient.weight} kg → ขนาดปกติ ≈ ${mg} mg (${ref.mgPerKgNormal} mg/kg)`
    }

    const detailParts = [
      ref.normalDose ? `ขนาดปกติ: ${ref.normalDose}` : null,
      band ? `แนวทางปรับ (${g.label} ${g.gfr}): ${band.text}` : null,
      ref.note ? `⚠ ${ref.note}` : null,
    ].filter(Boolean)

    alerts.push({
      id: `renalref_${drug.icode}`,
      type: 'RENAL',
      severity: isHardStop ? 'red' : 'orange',
      title: `${isHardStop ? '🚫' : '⚠️'} ${drug.master?.drug_name ?? drug.icode} — ปรับขนาดตามไต (${g.label} ${g.gfr})${wtCalc}`,
      detail: detailParts.join(' · ') + ` · อ้างอิง ${ref.source} — ตรวจสอบก่อนจ่าย`,
      drugs: [drug.icode],
      recommendation: `${band?.text ?? `ปรับขนาดเมื่อ ${g.label} < ${ref.threshold}`}  ·  ${g.label} ${g.gfr}`,
    })
  }
  return alerts
}

// ============ Pediatric ============
export function buildPediatricAlerts(drugs: DrugEntry[], patient: PatientInput): ScreeningAlert[] {
  // แสดงขนาดยาตามน้ำหนัก "เฉพาะเมื่อยืนยันว่าเป็นเด็ก (อายุ < 15 ปี)" เท่านั้น
  // ผู้ใหญ่ (≥15) หรือไม่ทราบอายุ → ใช้ขนาดยาปกติที่กำหนดไว้แล้ว ไม่ต้องคำนวณ
  if (patient.age === undefined || patient.age >= 15) return []
  const wt = patient.weight
  const ageMonths = patient.age !== undefined ? patient.age * 12 : undefined
  const alerts: ScreeningAlert[] = []
  for (const d of drugs) {
    const allowed = filterRulesByIndication(d, patient)
    const rule = allowed.find((r) =>
      r.pediatric_dose || r.min_dose_kg || r.max_dose_kg
      || r.dose_by_weight || r.dose_by_age_months,
    )
    if (!rule) continue

    // band lookup ตามน้ำหนัก / อายุ (ใช้ตัว parser เดียวกับ renal)
    const byWeight = (wt !== undefined && rule.dose_by_weight)
      ? findMatchingDoseAction(rule.dose_by_weight, wt) : null
    const byAge = (ageMonths !== undefined && rule.dose_by_age_months)
      ? findMatchingDoseAction(rule.dose_by_age_months, ageMonths) : null

    // mg/kg linear calc
    const calc = wt !== undefined ? computePediatricDose(wt, rule) : null
    const strength = d.master?.strength ? `ความแรง ${d.master.strength}` : null

    const lines: string[] = []
    if (byWeight) lines.push(`⚖️ น้ำหนัก ${wt} kg → ${byWeight}`)
    if (byAge) {
      const yLabel = patient.age !== undefined && patient.age < 2
        ? `${ageMonths} เดือน`
        : `${patient.age} ปี (${ageMonths} เดือน)`
      lines.push(`🎂 อายุ ${yLabel} → ${byAge}`)
    }
    if (calc && (calc.minMgPerDose !== undefined || calc.maxMgPerDose !== undefined)) {
      const mgRange = [calc.minMgPerDose, calc.maxMgPerDose].filter((x) => x !== undefined).join('–')
      lines.push(`📐 mg/kg: ${wt} kg → ${mgRange} mg/ครั้ง`)
      if (calc.mgPerMl && (calc.minMlPerDose !== undefined || calc.maxMlPerDose !== undefined)) {
        const mlRange = [calc.minMlPerDose, calc.maxMlPerDose].filter((x) => x !== undefined).join('–')
        lines.push(`= ${mlRange} mL/ครั้ง (ความแรง ${calc.concLabel})`)
      }
      if (calc.frequency) lines.push(`ความถี่: ${calc.frequency}`)
      if (calc.maxPerDay !== undefined) lines.push(`ไม่เกิน ${calc.maxPerDay} mg/วัน`)
    }
    if (rule.pediatric_dose) lines.push(`อ้างอิง: ${rule.pediatric_dose}`)
    if (lines.length === 0) {
      lines.push([rule.pediatric_dose, strength].filter(Boolean).join(' · ') || 'ดูขนาดยาเด็ก')
    }

    // recommendation: prefer band match → mg/kg calculated dose → undefined
    // เน้นใน 💡 "ขนาดที่แนะนำ" — เป็นคำตอบสำเร็จรูปที่เภสัชกรกดอ่านแล้วเข้าใจได้ทันที
    let recommendation: string | undefined = byWeight ?? byAge ?? undefined
    if (!recommendation && calc) {
      const parts: string[] = []
      const mlRange = [calc.minMlPerDose, calc.maxMlPerDose].filter((x) => x !== undefined).join('–')
      const mgRange = [calc.minMgPerDose, calc.maxMgPerDose].filter((x) => x !== undefined).join('–')
      if (mlRange) parts.push(`${mlRange} mL/ครั้ง`)
      else if (mgRange) parts.push(`${mgRange} mg/ครั้ง`)
      if (calc.frequency) parts.push(calc.frequency)
      if (mlRange && mgRange) parts.push(`(= ${mgRange} mg)`)
      if (calc.maxPerDay !== undefined) parts.push(`ไม่เกิน ${calc.maxPerDay} mg/วัน`)
      if (parts.length) recommendation = parts.join(' · ')
    }

    const indTag = rule.indication?.trim() ? ` (📍 ${rule.indication.trim()})` : ''
    alerts.push({
      id: `ped_${d.icode}_${rule.indication ?? ''}`,
      type: 'PED',
      severity: 'blue',
      title: `👶 ขนาดยาเด็ก: ${d.master?.drug_name ?? d.icode}${indTag}`,
      detail: lines.join(' · '),
      drugs: [d.icode],
      source: rule,
      recommendation,
    })
  }
  return alerts
}

// ============ DRP — duplicate therapy ============
/** ตรวจว่ายาเป็นรูปแบบฉีด — ฉีดมักเป็น stat dose ไม่นับซ้ำกับยากิน */
function isInjection(d: DrugEntry): boolean {
  const df = (d.master?.dosage_form ?? '').toLowerCase()
  const form = (d.master?.form ?? '').toLowerCase()
  const name = (d.master?.drug_name ?? d.drug_name ?? '').toLowerCase()
  if (/injection|injectable|inj\b|^inj/i.test(df)) return true
  if (/ฉีด/.test(form)) return true
  if (/\binj\.?\b|\binjection\b/i.test(name)) return true
  return false
}

/** คืน subset ของ list ที่ซ้ำกันจริง (ภายใน route เดียวกัน — กิน+กิน หรือ ฉีด+ฉีด)
 *  ถ้าเป็นการผสม กิน × ฉีด ของยาเดียวกัน → คืน [] เพราะ ฉีด มักเป็น stat dose */
function sameRouteDuplicates(list: DrugEntry[]): DrugEntry[] {
  if (list.length < 2) return []
  const inj = list.filter(isInjection)
  const oral = list.filter((d) => !isInjection(d))
  if (inj.length >= 2 && oral.length >= 2) return list  // ซ้ำทั้ง 2 route → flag ทั้งหมด
  if (inj.length >= 2) return inj
  if (oral.length >= 2) return oral
  return []  // มี 1 ฝั่ง 1 ตัว + อีกฝั่ง 1 ตัว → mixed, skip
}

/**
 * @param noDupClasses ถ้ากำหนด (non-empty) → เตือนยาซ้ำกลุ่มเฉพาะ class ในลิสต์นี้
 *   (ตั้งค่าได้ใน Settings — เพราะบางกลุ่มจ่ายซ้ำได้). ถ้าไม่กำหนด → เตือนทุกกลุ่ม (เดิม)
 */
export function buildDrpAlerts(drugs: DrugEntry[], noDupClasses?: string[]): ScreeningAlert[] {
  const alerts: ScreeningAlert[] = []
  const restrict = (noDupClasses ?? []).map((s) => s.trim().toLowerCase()).filter(Boolean)
  const hasRestrictList = restrict.length > 0
  // duplicate by drug_class
  const byClass = new Map<string, DrugEntry[]>()
  // duplicate by generic_name
  const byGeneric = new Map<string, DrugEntry[]>()
  for (const d of drugs) {
    const c = d.master?.drug_class
    if (c) {
      const arr = byClass.get(c) ?? []
      arr.push(d)
      byClass.set(c, arr)
    }
    const g = d.master?.generic_name
    if (g) {
      const arr = byGeneric.get(g.toLowerCase()) ?? []
      arr.push(d)
      byGeneric.set(g.toLowerCase(), arr)
    }
  }
  for (const [cls, list] of byClass) {
    // ถ้ามีลิสต์ห้ามซ้ำ → เตือนเฉพาะ class ที่อยู่ในลิสต์
    if (hasRestrictList && !restrict.some((r) => cls.toLowerCase().includes(r) || r.includes(cls.toLowerCase()))) continue
    const dup = sameRouteDuplicates(list)
    if (dup.length >= 2) {
      alerts.push({
        id: `drp_dup_${cls}`,
        type: 'DRP',
        severity: 'orange',
        title: `ยาซ้ำกลุ่ม: ${cls}`,
        detail: dup.map((d) => d.master?.drug_name ?? d.icode).join(', '),
        drugs: dup.map((d) => d.icode),
      })
    }
  }
  for (const [gen, list] of byGeneric) {
    const dup = sameRouteDuplicates(list)
    if (dup.length >= 2) {
      alerts.push({
        id: `drp_gen_${gen}`,
        type: 'DRP',
        severity: 'red',
        title: `ยาซ้ำ generic: ${gen}`,
        detail: dup.map((d) => d.master?.drug_name ?? d.icode).join(', ') + ' — เสี่ยง overdose',
        drugs: dup.map((d) => d.icode),
        recommendation: 'เลือก 1 รายการ ตัดอีกรายการออก',
      })
    }
  }
  return alerts
}

// ============ Allergy + cross-reactivity ============
/** ตารางแพ้ข้ามกลุ่มมาตรฐาน (built-in) — ทำงานโดยไม่ต้องกรอก cross_react รายตัว
 *  ถ้าผู้ป่วยแพ้ allergen ในกลุ่ม → ยาที่ class/generic เข้า crossKeys จะถูกเตือน cross-reactivity */
const CROSS_ALLERGY_GROUPS: { allergens: string[]; crossKeys: string[]; note: string }[] = [
  {
    allergens: ['penicillin', 'penicillins', 'ampicillin', 'amoxicillin', 'augmentin', 'cloxacillin', 'dicloxacillin', 'piperacillin', 'เพนนิซิลลิน', 'เพนิซิลลิน'],
    crossKeys: ['cephalosporin', 'cephalosporins', 'cefazolin', 'cefaz', 'cephalexin', 'cefalexin', 'cefdinir', 'cefixime', 'cefotaxime', 'ceftazidime', 'ceftriaxone', 'cefuroxime', 'cefepime', 'carbapenem', 'imipenem', 'meropenem', 'ertapenem', 'penicillin'],
    note: 'Beta-lactam cross-reactivity (penicillin ↔ cephalosporin ~1–3%, carbapenem)',
  },
  {
    allergens: ['sulfa', 'sulfonamide', 'sulfonamides', 'bactrim', 'co-trimoxazole', 'cotrimoxazole', 'sulfamethoxazole', 'ซัลฟา'],
    crossKeys: ['sulfamethoxazole', 'sulfasalazine', 'sulfadiazine', 'co-trimoxazole', 'cotrimoxazole', 'bactrim', 'sulfonamide'],
    note: 'Sulfonamide cross-reactivity (antibacterial sulfonamides)',
  },
  {
    allergens: ['aspirin', 'asa', 'nsaid', 'nsaids', 'ibuprofen', 'diclofenac', 'แอสไพริน'],
    crossKeys: ['nsaid', 'nsaids', 'ibuprofen', 'diclofenac', 'naproxen', 'mefenamic', 'meloxicam', 'piroxicam', 'ketorolac', 'indomethacin', 'celecoxib', 'aspirin'],
    note: 'ASA/NSAID cross-reactivity (COX inhibition — เสี่ยง bronchospasm/urticaria)',
  },
  {
    allergens: ['codeine', 'morphine', 'opioid', 'tramadol'],
    crossKeys: ['opioid', 'opioids', 'morphine', 'codeine', 'tramadol', 'fentanyl', 'pethidine', 'oxycodone'],
    note: 'Opioid cross-sensitivity (แพ้จริงพบน้อย — มักเป็น pseudoallergy)',
  },
]

export function buildAllergyAlerts(drugs: DrugEntry[], allergies: string[] | undefined): ScreeningAlert[] {
  if (!allergies || allergies.length === 0) return []
  const alerts: ScreeningAlert[] = []
  const flagged = new Set<string>()  // icode ที่เตือนแล้ว (กันซ้ำระหว่าง 2 ชั้น)
  const allergiesLower = allergies.map((a) => a.toLowerCase().trim()).filter(Boolean)
  for (const d of drugs) {
    const m = d.master
    if (!m) continue
    const drugTags = [
      ...(m.allergens ?? []),
      ...(m.cross_react ?? []),
      m.generic_name,
      m.drug_class,
      m.drug_name,
    ].filter(Boolean).map((s) => (s as string).toLowerCase())
    const hit = allergiesLower.find((al) => drugTags.some((t) => t.includes(al) || al.includes(t)))
    if (hit) {
      // ถ้า match กับ generic/drug_name = severity แดง (ยาเดียวกัน)
      // ถ้า match แค่ cross_react = ส้ม
      const directMatch = drugTags.slice(0, (m.allergens ?? []).length).some((t) => t.includes(hit))
        || (m.generic_name && m.generic_name.toLowerCase().includes(hit))
        || (m.drug_name && m.drug_name.toLowerCase().includes(hit))
      flagged.add(d.icode)
      alerts.push({
        id: `allergy_${d.icode}_${hit}`,
        type: 'ALLERGY',
        severity: directMatch ? 'red' : 'orange',
        title: `🚨 แพ้ยา: ผู้ป่วยแพ้ "${hit}" — ${m.drug_name}`,
        detail: directMatch ? 'ยานี้คือสารที่ผู้ป่วยแพ้โดยตรง — ห้ามจ่าย' : `อาจเกิด cross-reactivity (${m.cross_react?.join(', ') ?? '-'})`,
        recommendation: directMatch ? 'หยุดยา + แจ้งแพทย์เปลี่ยนยา' : 'พิจารณาความเสี่ยง cross-reactivity ก่อนจ่าย',
        drugs: [d.icode],
        source: m,
      })
    }
  }

  // ชั้นที่ 2 — แพ้ข้ามกลุ่มมาตรฐาน (built-in) สำหรับยาที่ยังไม่ถูกเตือน
  for (const d of drugs) {
    const m = d.master
    if (!m || flagged.has(d.icode)) continue
    const hay = [m.generic_name, m.drug_class, m.drug_category, m.drug_name]
      .filter(Boolean).map((s) => (s as string).toLowerCase()).join(' | ')
    for (const grp of CROSS_ALLERGY_GROUPS) {
      const patientAllergic = allergiesLower.some((al) => grp.allergens.some((a) => al.includes(a) || a.includes(al)))
      if (!patientAllergic) continue
      const drugInGroup = grp.crossKeys.some((k) => hay.includes(k))
      if (!drugInGroup) continue
      const allergenLabel = allergiesLower.find((al) => grp.allergens.some((a) => al.includes(a) || a.includes(al))) ?? ''
      flagged.add(d.icode)
      alerts.push({
        id: `allergy_cross_${d.icode}`,
        type: 'ALLERGY',
        severity: 'orange',
        title: `⚠️ แพ้ข้ามกลุ่ม: ผู้ป่วยแพ้ "${allergenLabel}" → ${m.drug_name}`,
        detail: grp.note,
        recommendation: 'ประเมินความเสี่ยง cross-reactivity ก่อนจ่าย — ถ้าประวัติแพ้รุนแรง (anaphylaxis) ให้หลีกเลี่ยง',
        drugs: [d.icode],
        source: m,
      })
      break
    }
  }
  return alerts
}

// ============ HAD (High Alert Drug) — เช็คคู่กับ HAD_RULES collection ถ้ามี ============
export function buildHadAlerts(drugs: DrugEntry[], hadRules: HadRule[] = []): ScreeningAlert[] {
  const alerts: ScreeningAlert[] = []
  for (const d of drugs) {
    if (!d.master) continue
    // match HAD rule โดยใช้ generic_name หรือ drug_name
    const nameLower = (d.master.drug_name ?? '').toLowerCase()
    const genericLower = (d.master.generic_name ?? '').toLowerCase()
    const rule = hadRules.find((r) => {
      const k = r.drug_key.trim().toLowerCase()
      if (k.length < 3) return genericLower === k || nameLower === k  // คำสั้น → ต้องตรงเป๊ะ
      const re = new RegExp(`(^|[^a-z0-9])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i')
      return re.test(genericLower) || re.test(nameLower)
    })
    if (!d.master.is_HAD && !rule) continue

    // ฐานข้อมูล HAD (bundled) — จับด้วย generic (เสริมเมื่อไม่มี HadRule ที่ admin ตั้ง)
    const ref = findHadRef(d.master.generic_name, d.master.drug_name)

    // แสดงหลัก: Dose · วิธีเตรียม · max conc · max rate (ที่เหลืออยู่ในรายละเอียด)
    const dose = rule?.max_dose ?? ref?.dose
    const prep = rule?.dilution ?? ref?.prep
    const maxConc = rule?.max_conc ?? ref?.maxConc
    const maxRate = rule?.max_rate ?? ref?.maxRate
    const antidote = rule?.antidote ?? ref?.antidote
    const note = rule?.full_note ?? ref?.note

    const detail = [
      dose && `💉 Dose: ${dose}`,
      prep && `🧪 วิธีเตรียม: ${prep}`,
      maxConc && `⚖️ Max conc: ${maxConc}`,
      maxRate && `⏱️ Max rate: ${maxRate}`,
      ref?.compatible && `✅ ผสมได้: ${ref.compatible}`,
      rule?.route_note,
      ref?.incompatible && `⛔ ห้ามผสม: ${ref.incompatible}`,
      antidote && `💊 Antidote: ${antidote}`,
      note,
      ref && `📚 อ้างอิง: ${ref.source} — ยืนยันกับ protocol รพ. ก่อนใช้`,
    ].filter(Boolean).join('\n')

    // ไม่มีข้อมูลเฉพาะ (เตรียม/ขนาด/antidote) = HAD ทั่วไป เช่น warfarin
    // → แค่ธงแดงพอ ไม่ต้องมี boilerplate "double-check dose/route/identity" (เภสัชรู้อยู่แล้ว)
    const hasMonograph = !!(dose || prep || maxConc || maxRate || antidote || note)
    if (!hasMonograph) {
      alerts.push({
        id: `had_${d.icode}`, type: 'HAD', severity: 'red',
        title: `🔴 ยาความเสี่ยงสูง (HAD): ${d.master.drug_name}`,
        detail: '', drugs: [d.icode], source: rule ?? d.master,
      })
      continue
    }

    alerts.push({
      id: `had_${d.icode}`,
      type: 'HAD' as const,
      severity: 'red' as const,
      title: `🔴 HIGH ALERT: ${d.master.drug_name}`,
      detail,
      recommendation: dose ? `💉 ${dose} · เช็คความเข้มข้น/อัตราให้ (ดูรายละเอียด)` : undefined,
      drugs: [d.icode],
      source: rule ?? d.master,
    })
  }
  return alerts
}

// ============ Duplicate therapy class (ACEI+ARB, Statin+Statin, NSAID+NSAID, etc.) ============
export function buildDupClassAlerts(drugs: DrugEntry[]): ScreeningAlert[] {
  const alerts: ScreeningAlert[] = []
  const byClass = new Map<string, DrugEntry[]>()
  for (const d of drugs) {
    const classes = d.master?.dup_class ?? []
    for (const c of classes) {
      const list = byClass.get(c) ?? []
      list.push(d)
      byClass.set(c, list)
    }
  }
  // Conflicting class combos
  const conflictPairs: [string, string, string][] = [
    ['ACEI', 'ARB', 'ห้ามใช้ ACEI + ARB ร่วมกัน — เพิ่มเสี่ยง hyperkalemia, AKI, hypotension'],
  ]
  for (const [a, b, msg] of conflictPairs) {
    const la = byClass.get(a) ?? []
    const lb = byClass.get(b) ?? []
    if (la.length && lb.length) {
      alerts.push({
        id: `dup_${a}_${b}`,
        type: 'DRP',
        severity: 'red',
        title: `🚫 Duplicate: ${a} + ${b}`,
        detail: msg + ' · พบ: ' + [...la, ...lb].map((d) => d.master?.drug_name ?? d.icode).join(', '),
        recommendation: 'เลือกใช้ตัวใดตัวหนึ่ง — consult แพทย์',
        drugs: [...la.map((d) => d.icode), ...lb.map((d) => d.icode)],
      })
    }
  }
  // Same class >= 2
  for (const [cls, list] of byClass) {
    if (cls === 'ACEI' || cls === 'ARB') continue // handled above
    const dup = sameRouteDuplicates(list)  // ฉีด+กิน same class → skip (stat dose)
    if (dup.length < 2) continue
    alerts.push({
      id: `dup_${cls}`,
      type: 'DRP',
      severity: 'orange',
      title: `🚫 Duplicate: ${cls} ${dup.length} ตัว`,
      detail: `${cls}: ${dup.map((d) => d.master?.drug_name ?? d.icode).join(', ')} — ห้ามใช้ร่วมกันตามแนวทาง รพ.`,
      recommendation: 'เลือกใช้ตัวเดียว — consult แพทย์',
      drugs: dup.map((d) => d.icode),
    })
  }
  return alerts
}

// ============ Drug timing (Levothyroxine ก่อนอาหาร 1 ชม. ฯลฯ) ============
export function buildTimingAlerts(drugs: DrugEntry[]): ScreeningAlert[] {
  return drugs
    .filter((d) => d.master?.timing_note)
    .map((d) => ({
      id: `timing_${d.icode}`,
      type: 'TIMING' as const,
      severity: 'blue' as const,
      title: `⏰ เวลากิน: ${d.master!.drug_name}`,
      detail: d.master!.timing_note!,
      recommendation: 'แจ้งผู้ป่วยเรื่องเวลากินยา',
      drugs: [d.icode],
    }))
}

// ============ DUE (Drug Use Evaluation) ============
export function buildDueAlerts(drugs: DrugEntry[]): ScreeningAlert[] {
  return drugs
    .filter((d) => d.master?.is_DUE)
    .map((d) => ({
      id: `due_${d.icode}`,
      type: 'DUE' as const,
      severity: 'orange' as const,
      title: `📋 DUE: ${d.master!.drug_name} ต้องแนบใบ DUE`,
      detail: 'ยานี้อยู่ในรายการ Drug Use Evaluation ต้องแนบแบบฟอร์มและปรึกษาอาจารย์แพทย์ภายใน 96 ชั่วโมง',
      recommendation: 'กรอกใบ DUE + รอ approve อาจารย์ — หลัง 96 ชม. ห้องยาจะหยุดจ่ายอัตโนมัติ',
      drugs: [d.icode],
    }))
}

// ============ Tube feeding (no-crush warning) ============
export function buildNoCrushAlerts(drugs: DrugEntry[], patient: PatientInput): ScreeningAlert[] {
  if (!patient.tube_feeding) return []
  const out: ScreeningAlert[] = []
  for (const d of drugs) {
    const ref = findRef(NO_CRUSH, d.master?.generic_name, d.master?.drug_name ?? d.drug_name)
    if (!d.master?.no_crush && !ref) continue
    out.push({
      id: `nocrush_${d.icode}`, type: 'NO_CRUSH', severity: 'red',
      title: `⚠️ Tube feeding + ห้ามบด: ${d.master?.drug_name ?? d.icode}`,
      detail: ref?.note ?? 'ห้ามบดเม็ดยา SR/ER — ผู้ป่วยใช้ tube feeding',
      recommendation: 'เปลี่ยนเป็น syrup / immediate-release',
      drugs: [d.icode],
    })
  }
  return out
}

// ============ LASA ============
// Two alert levels:
//   • yellow "FYI similar drug exists" — single LASA-listed drug dispensed alone
//   • red "BOTH LASA pair drugs in same Rx" — highest swap risk in real practice
export function buildLasaAlerts(drugs: DrugEntry[], allDrugs: DrugMaster[]): ScreeningAlert[] {
  const alerts: ScreeningAlert[] = []
  const rxIcodes = new Set(drugs.map((d) => d.icode))
  for (const d of drugs) {
    const lasa = d.master?.lasa_with
    if (!lasa || lasa.length === 0) continue
    // Resolve each entry (icode preferred, falls back to free-text legacy).
    const pairs = lasa.map(
      (p) =>
        allDrugs.find((x) => nameEq(x.icode, p) || nameEq(x.drug_name, p)) ??
        ({ drug_name: p, icode: p } as DrugMaster),
    )
    // Only pairs that are ALSO present in this prescription → real swap risk.
    const coOccurring = pairs.filter(
      (p) => rxIcodes.has(p.icode) && p.icode !== d.icode,
    )
    if (coOccurring.length > 0) {
      alerts.push({
        id: `lasa_swap_${d.icode}`,
        type: 'LASA',
        severity: 'red',
        title: `🚨 LASA ในใบสั่งเดียวกัน: ${d.master!.drug_name} + ${coOccurring.map((p) => p.drug_name).join(', ')}`,
        detail:
          'ใบสั่งนี้มียา LASA ที่คล้ายกันมากกว่า 1 ตัว — เสี่ยงสูงต่อการสับยา/จัดยาผิดตัว',
        recommendation:
          'แยกซองให้ชัด · ใช้ tall-man letter · double-check ก่อนจ่าย · อธิบายผู้ป่วยตอนรับยา',
        drugs: [d.icode, ...coOccurring.map((p) => p.icode)],
      })
    } else {
      alerts.push({
        id: `lasa_${d.icode}`,
        type: 'LASA',
        severity: 'yellow',
        title: `⚠️ LASA: ${d.master!.drug_name} คล้ายกับ ${pairs.map((p) => p.drug_name).join(', ')}`,
        detail: 'ชื่อ/หน้าตายาคล้ายกัน — ตรวจสอบให้แน่ใจว่าจ่ายถูกตัว',
        recommendation: 'อ่านฉลากซ้ำ + tallman letter ถ้ามี',
        drugs: [d.icode],
      })
    }
  }
  return alerts
}

// ============ Pregnancy ============
export function buildPregnancyAlerts(drugs: DrugEntry[], patient: PatientInput): ScreeningAlert[] {
  if (!patient.is_pregnant) return []
  const alerts: ScreeningAlert[] = []
  for (const d of drugs) {
    const cat = d.master?.pregnancy_category
    const wk = patient.pregnancy_weeks ? ` · อายุครรภ์ ${patient.pregnancy_weeks} สัปดาห์` : ''
    if (cat && cat !== 'A' && cat !== 'B') {
      const sev: ScreeningAlert['severity'] = cat === 'X' ? 'red' : cat === 'D' ? 'orange' : 'yellow'
      alerts.push({
        id: `preg_${d.icode}`, type: 'PREG', severity: sev,
        title: `🤰 ตั้งครรภ์ + ${d.master!.drug_name} (Pregnancy ${cat})`,
        detail: pregLabel(cat) + wk,
        recommendation: cat === 'X' ? 'ห้ามใช้ — เปลี่ยนยา' : cat === 'D' ? 'ใช้เมื่อจำเป็นเท่านั้น' : 'พิจารณา risk vs benefit',
        drugs: [d.icode], source: d.master,
      })
    } else if (!cat) {
      // ไม่มี category ในฐานข้อมูล → เทียบ built-in teratogen list (FDA/TERIS)
      const t = findRef(TERATOGEN, d.master?.generic_name, d.master?.drug_name ?? d.drug_name)
      if (t) alerts.push({
        id: `preg_${d.icode}`, type: 'PREG', severity: t.cat === 'X' ? 'red' : 'orange',
        title: `🤰 ตั้งครรภ์ + ${d.master?.drug_name ?? d.icode} (Cat ${t.cat})`,
        detail: t.note + wk,
        recommendation: t.cat === 'X' ? 'ห้ามใช้ — เปลี่ยนยา' : 'ใช้เมื่อจำเป็น/ตามไตรมาส',
        drugs: [d.icode], source: d.master,
      })
    }
  }
  return alerts
}

function pregLabel(c: 'A' | 'B' | 'C' | 'D' | 'X'): string {
  return {
    A: 'A: ปลอดภัย', B: 'B: ค่อนข้างปลอดภัย', C: 'C: ใช้ระวัง',
    D: 'D: เสี่ยง — ใช้เมื่อจำเป็น', X: 'X: ห้ามใช้',
  }[c]
}

// ============ Lactation ============
export function buildLactationAlerts(drugs: DrugEntry[], patient: PatientInput): ScreeningAlert[] {
  if (!patient.is_lactating) return []
  const out: ScreeningAlert[] = []
  for (const d of drugs) {
    const ref = findRef(LACTATION_AVOID, d.master?.generic_name, d.master?.drug_name ?? d.drug_name)
    if (d.master?.lactation_safe !== false && !ref) continue
    out.push({
      id: `lact_${d.icode}`, type: 'LACT', severity: 'orange',
      title: `🤱 ให้นมบุตร + ${d.master?.drug_name ?? d.icode}`,
      detail: ref?.note ?? 'ไม่แนะนำในระยะให้นม — อาจผ่านน้ำนมไปสู่ทารก',
      recommendation: 'พิจารณาเปลี่ยนยา หรือหยุดให้นมชั่วคราว',
      drugs: [d.icode], source: d.master,
    })
  }
  return out
}

// ============ Beers (elderly ≥65) ============
export function buildBeersAlerts(drugs: DrugEntry[], patient: PatientInput): ScreeningAlert[] {
  if (!patient.age || patient.age < 65) return []
  const out: ScreeningAlert[] = []
  for (const d of drugs) {
    const ref = findRef(BEERS_2023, d.master?.generic_name, d.master?.drug_name ?? d.drug_name)
    if (!d.master?.beers_avoid_elderly && !ref) continue
    out.push({
      id: `beers_${d.icode}`, type: 'BEERS', severity: 'orange',
      title: `👴 Beers: ${d.master?.drug_name ?? d.icode} (อายุ ${patient.age})`,
      detail: ref?.note ?? 'อยู่ในรายการ Beers ที่ควรเลี่ยงในผู้สูงอายุ ≥65',
      recommendation: 'พิจารณาเปลี่ยนเป็นยาที่ปลอดภัยกว่า',
      drugs: [d.icode], source: d.master,
    })
  }
  return out
}

// ============ G6PD ============
export function buildG6pdAlerts(drugs: DrugEntry[], patient: PatientInput): ScreeningAlert[] {
  const hasG6pd = patient.g6pd === true || patient.diseases?.some((d) => d.toUpperCase() === 'G6PD')
  // flag ในฐานข้อมูล หรือ built-in oxidant list (generic)
  const oxidantDrugs = drugs.filter((d) => d.master?.g6pd_unsafe || G6PD_UNSAFE.test(drugText(d.master?.generic_name, d.master?.drug_name ?? d.drug_name)))
  if (oxidantDrugs.length === 0) return []

  // เจาะแล้วพร่อง → ห้ามใช้ (แดง)
  if (hasG6pd) {
    return oxidantDrugs.map((d) => ({
      id: `g6pd_${d.icode}`,
      type: 'G6PD' as const,
      severity: 'red' as const,
      title: `🩸 G6PD พร่อง + ${d.master!.drug_name} — ห้ามใช้`,
      detail: 'ยานี้ทำให้เกิด hemolysis ในผู้ป่วย G6PD deficiency',
      recommendation: 'เปลี่ยนยาทันที',
      drugs: [d.icode],
      source: d.master,
    }))
  }

  // ยังไม่เจาะ G6PD (g6pd_tested === false) แต่มียา oxidant → เตือนให้เจาะก่อน (ส้ม)
  // "-" = ยังไม่เจาะ ≠ ปกติ — ต้องเตือน ไม่ใช่ปล่อยผ่าน
  if (patient.g6pd_tested === false) {
    return oxidantDrugs.map((d) => ({
      id: `g6pd_untested_${d.icode}`,
      type: 'G6PD' as const,
      severity: 'orange' as const,
      title: `🩸 ยังไม่เจาะ G6PD + ${d.master!.drug_name}`,
      detail: 'ผู้ป่วยยังไม่มีผล G6PD แต่ยานี้เป็น oxidant — เสี่ยง hemolysis ถ้าผู้ป่วยพร่อง G6PD',
      recommendation: 'เจาะ G6PD ก่อนจ่าย หรือเลือกยาที่ปลอดภัยกว่า',
      drugs: [d.icode],
      source: d.master,
    }))
  }

  return []
}

// ============ Food / Smoking / Alcohol ============
export function buildLifestyleAlerts(drugs: DrugEntry[], patient: PatientInput): ScreeningAlert[] {
  const alerts: ScreeningAlert[] = []
  for (const d of drugs) {
    const m = d.master
    if (!m) continue
    if (m.food_interaction) {
      alerts.push({
        id: `food_${d.icode}`,
        type: 'FOOD',
        severity: 'yellow',
        title: `🍽 ปฏิกิริยากับอาหาร: ${m.drug_name}`,
        detail: m.food_interaction,
        drugs: [d.icode],
      })
    }
    if (patient.smoking && m.smoking_interaction) {
      alerts.push({
        id: `smoke_${d.icode}`,
        type: 'SMOKING',
        severity: 'yellow',
        title: `🚬 สูบบุหรี่ + ${m.drug_name}`,
        detail: m.smoking_interaction,
        drugs: [d.icode],
      })
    }
    if (patient.alcohol && m.alcohol_interaction) {
      alerts.push({
        id: `alc_${d.icode}`,
        type: 'ALCOHOL',
        severity: 'orange',
        title: `🍺 ดื่มแอลกอฮอล์ + ${m.drug_name}`,
        detail: m.alcohol_interaction,
        drugs: [d.icode],
      })
    }
  }
  return alerts
}

// ============ COST — ยาราคาสูง / บัญชียาพิเศษ ============
/** บัญชียา ง และ จ (รวม จ(2)) = ยาราคาสูง/เข้าถึงยาก ตาม NLEM */
const HIGH_COST_ACCOUNTS = ['ง', 'จ']

export function buildCostAlerts(drugs: DrugEntry[], threshold?: number): ScreeningAlert[] {
  const alerts: ScreeningAlert[] = []
  for (const d of drugs) {
    const m = d.master
    if (!m) continue
    const acct = (m.drug_account ?? '').trim()
    const highAcct = HIGH_COST_ACCOUNTS.some((a) => acct.startsWith(a))
    // ราคาที่ใช้เทียบ — ใช้ราคาขายก่อน ถ้าไม่มีใช้ราคาทุน
    const price = m.unit_price ?? m.unit_cost
    const overThreshold = threshold !== undefined && threshold > 0 && price !== undefined && price >= threshold
    if (!highAcct && !overThreshold) continue
    const reasons: string[] = []
    if (overThreshold) reasons.push(`ราคา ${price} บาท/หน่วย (เกณฑ์ ≥ ${threshold})`)
    if (highAcct) reasons.push(`บัญชียา ${acct} (ราคาสูง/เข้าถึงยาก)`)
    alerts.push({
      id: `cost_${d.icode}`,
      type: 'COST',
      severity: highAcct ? 'orange' : 'yellow',
      title: `💰 ยาราคาสูง: ${m.drug_name}`,
      detail: reasons.join(' · '),
      recommendation: 'พิจารณายาทางเลือกที่คุ้มค่ากว่า หากเหมาะสม — แล้วบันทึก intervention',
      drugs: [d.icode],
      source: m,
    })
  }
  return alerts
}

// ============ Substitution — ยาเปลี่ยนบริษัท/รูปลักษณ์ ============
export function buildSubstitutionAlerts(drugs: DrugEntry[], subs: DrugSubstitution[] | undefined): ScreeningAlert[] {
  if (!subs || subs.length === 0) return []
  const byIcode = new Map(subs.filter((s) => s.active).map((s) => [s.icode, s]))
  const alerts: ScreeningAlert[] = []
  for (const d of drugs) {
    const s = byIcode.get(d.icode)
    if (!s) continue
    const change = [s.old_brand, s.new_brand].filter(Boolean).join(' → ')
    alerts.push({
      id: `subst_${d.icode}`,
      type: 'SUBST',
      severity: 'yellow',
      title: `🔄 ยาเปลี่ยนบริษัท/รูปลักษณ์: ${d.master?.drug_name ?? d.icode}`,
      detail: [change, s.note].filter(Boolean).join(' · ') || 'มีการเปลี่ยนบริษัท — ดูรูปก่อน/หลังด้านล่าง',
      recommendation: 'แจ้งผู้ป่วยว่ายาเปลี่ยนหน้าตา แต่เป็นยาเดิม เพื่อลดความสับสน',
      drugs: [d.icode],
    })
  }
  return alerts
}

export interface ScreenContext {
  drugs: DrugEntry[]
  patient: PatientInput
  ddiList: DdiOverride[]
  labRules: LabRule[]
  diseaseRules: DiseaseRule[]
  drugMasters: DrugMaster[]
  hadRules?: HadRule[]
  /** เกณฑ์ราคาต่อหน่วยที่ถือว่าแพง (บาท) — undefined/0 = เช็คเฉพาะบัญชียา ง/จ */
  expensiveThreshold?: number
  /** กลุ่มยาที่ห้ามจ่ายซ้ำ (ตั้งใน Settings) — ว่าง = เตือนทุกกลุ่ม */
  noDuplicateClasses?: string[]
  /** รายการยาที่เปลี่ยนบริษัท (active) — แสดงเตือนตอนคัดกรอง */
  substitutions?: DrugSubstitution[]
}

export function runScreening(ctx: ScreenContext): ScreeningAlert[] {
  // renal: icode-based dose_meta (ตั้งเฉพาะ รพ.) ก่อน แล้วเติม generic-ref จากคู่มือสำหรับ icode ที่ยังไม่ถูกคุม
  const renalIcode = buildRenalAlerts(ctx.drugs, ctx.patient)
  const renalCovered = new Set(renalIcode.flatMap((a) => a.drugs ?? []))
  // icode ที่ admin ยกเว้นเกณฑ์ไต → ข้าม built-in renal ref ด้วย
  for (const d of ctx.drugs) if ((d.labRules ?? []).some((r) => r.renal_exempt)) renalCovered.add(d.icode)
  const renalRef = buildRenalRefAlerts(ctx.drugs, ctx.patient, renalCovered)
  return [
    ...buildAllergyAlerts(ctx.drugs, ctx.patient.allergies),
    ...buildHadAlerts(ctx.drugs, ctx.hadRules ?? []),
    ...buildCostAlerts(ctx.drugs, ctx.expensiveThreshold),
    ...buildSubstitutionAlerts(ctx.drugs, ctx.substitutions),
    ...buildG6pdAlerts(ctx.drugs, ctx.patient),
    ...buildDdiAlerts(ctx.drugs, ctx.ddiList),
    ...buildPregnancyAlerts(ctx.drugs, ctx.patient),
    ...buildLactationAlerts(ctx.drugs, ctx.patient),
    ...buildBeersAlerts(ctx.drugs, ctx.patient),
    ...renalIcode,
    ...renalRef,
    ...buildDrpAlerts(ctx.drugs, ctx.noDuplicateClasses),
    ...buildDupClassAlerts(ctx.drugs),
    ...buildLabAlerts(ctx.drugs, ctx.labRules, ctx.patient),
    ...buildDiseaseAlerts(ctx.drugs, ctx.patient.diseases, ctx.diseaseRules),
    ...buildLasaAlerts(ctx.drugs, ctx.drugMasters),
    ...buildLifestyleAlerts(ctx.drugs, ctx.patient),
    ...buildPediatricAlerts(ctx.drugs, ctx.patient),
    ...buildTbDoseAlerts(ctx.drugs, ctx.patient),
    ...buildYSiteAlerts(ctx.drugs),
    ...buildDoseAlerts(ctx.drugs, ctx.patient),
    ...buildTimingAlerts(ctx.drugs),
    ...buildDueAlerts(ctx.drugs),
    ...buildNoCrushAlerts(ctx.drugs, ctx.patient),
    ...buildRduAlerts(ctx.drugs, ctx.patient),
    ...buildQrRuleAlerts(ctx.drugs, ctx.patient),
  ].sort((a, b) => sevRank(a.severity) - sevRank(b.severity))
}

function sevRank(s: ScreeningAlert['severity']): number {
  switch (s) {
    case 'red': return 0
    case 'orange': return 1
    case 'yellow': return 2
    case 'blue': return 3
  }
}
