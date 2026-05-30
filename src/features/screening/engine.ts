import type { DdiOverride, DiseaseRule, DrugMaster, HadRule, LabRule } from '@/types/drug'
import type { DrugEntry, PatientInput, ScreeningAlert } from '@/types/screening'
import { calcCrCl, findMatchingDoseAction } from '@/features/renal/calc'

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
    const rules = labRules.filter((r) => r.icode === drug.icode)
    for (const r of rules) {
      const sev: ScreeningAlert['severity'] = r.priority === 'high' ? 'red' : r.priority === 'medium' ? 'orange' : 'yellow'
      const paramValue = readPatientLab(patient, r.param)
      const inRange = isInNormalRange(paramValue, r.normal_range)
      const outOfRange = paramValue !== undefined && inRange === false
      if (paramValue === undefined && r.priority !== 'high') continue
      alerts.push({
        id: `lab_${drug.icode}_${r.param}_${r.id ?? ''}`,
        type: 'LAB',
        severity: outOfRange ? 'red' : sev,
        title: `LAB monitor: ${drug.master?.drug_name ?? drug.icode} — ${r.param ?? '-'}${paramValue !== undefined ? ` = ${paramValue}` : ''}`,
        detail: [
          r.normal_range ? `ค่าปกติ: ${r.normal_range} ${r.unit ?? ''}` : null,
          r.reason ? `เหตุผล: ${r.reason}` : null,
          outOfRange ? '⚠ ค่าผิดปกติ' : (paramValue === undefined ? 'ยังไม่ได้ใส่ค่า' : 'อยู่ในเกณฑ์ปกติ'),
        ].filter(Boolean).join(' · '),
        drugs: [drug.icode],
        source: r,
      })
    }
  }
  return alerts
}

function readPatientLab(p: PatientInput, param?: string): number | undefined {
  if (!param) return undefined
  const k = param.toLowerCase()
  if (k.includes('scr') || k.includes('creat')) return p.scr
  if (k === 'inr') return p.inr
  return undefined
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
export function buildRenalAlerts(drugs: DrugEntry[], patient: PatientInput): ScreeningAlert[] {
  if (!patient.scr || !patient.age || !patient.weight || !patient.sex) return []
  const { crcl } = calcCrCl({
    age: patient.age, weight: patient.weight, height: patient.height, sex: patient.sex, scr: patient.scr,
  })
  const alerts: ScreeningAlert[] = []
  for (const drug of drugs) {
    const rule = drug.labRules?.find((r) => r.dose_meta)
    if (!rule?.dose_meta) continue
    const action = findMatchingDoseAction(rule.dose_meta, crcl)
    if (!action) continue
    const sev: ScreeningAlert['severity'] =
      /hold|avoid|contraindicat/i.test(action) ? 'red' :
      /reduce|adjust|q24|q48/i.test(action) ? 'orange' : 'yellow'
    alerts.push({
      id: `renal_${drug.icode}`,
      type: 'RENAL',
      severity: sev,
      title: `⚠️ CrCl = ${crcl} mL/min → ปรับ ${drug.master?.drug_name ?? drug.icode}`,
      detail: `แนะนำ: ${action}`,
      drugs: [drug.icode],
      source: rule,
      recommendation: action,
    })
  }
  return alerts
}

// ============ Pediatric ============
export function buildPediatricAlerts(drugs: DrugEntry[], patient: PatientInput): ScreeningAlert[] {
  if (!patient.age || patient.age >= 15) return []
  const alerts: ScreeningAlert[] = []
  for (const d of drugs) {
    const rule = d.labRules?.find((r) => r.pediatric_dose)
    if (!rule?.pediatric_dose) continue
    const weightInfo = patient.weight ? ` (น้ำหนัก ${patient.weight} kg)` : ''
    alerts.push({
      id: `ped_${d.icode}`,
      type: 'PED',
      severity: 'blue',
      title: `ขนาดยาเด็ก: ${d.master?.drug_name ?? d.icode}${weightInfo}`,
      detail: rule.pediatric_dose,
      drugs: [d.icode],
      source: rule,
    })
  }
  return alerts
}

// ============ DRP — duplicate therapy ============
export function buildDrpAlerts(drugs: DrugEntry[]): ScreeningAlert[] {
  const alerts: ScreeningAlert[] = []
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
    if (list.length >= 2) {
      alerts.push({
        id: `drp_dup_${cls}`,
        type: 'DRP',
        severity: 'orange',
        title: `ยาซ้ำกลุ่ม: ${cls}`,
        detail: list.map((d) => d.master?.drug_name ?? d.icode).join(', '),
        drugs: list.map((d) => d.icode),
      })
    }
  }
  for (const [gen, list] of byGeneric) {
    if (list.length >= 2) {
      alerts.push({
        id: `drp_gen_${gen}`,
        type: 'DRP',
        severity: 'red',
        title: `ยาซ้ำ generic: ${gen}`,
        detail: list.map((d) => d.master?.drug_name ?? d.icode).join(', ') + ' — เสี่ยง overdose',
        drugs: list.map((d) => d.icode),
        recommendation: 'เลือก 1 รายการ ตัดอีกรายการออก',
      })
    }
  }
  return alerts
}

// ============ Allergy + cross-reactivity ============
export function buildAllergyAlerts(drugs: DrugEntry[], allergies: string[] | undefined): ScreeningAlert[] {
  if (!allergies || allergies.length === 0) return []
  const alerts: ScreeningAlert[] = []
  const allergiesLower = allergies.map((a) => a.toLowerCase().trim())
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
      const k = r.drug_key.toLowerCase()
      return nameLower.includes(k) || genericLower.includes(k)
    })
    if (!d.master.is_HAD && !rule) continue
    const ruleDetail = rule ? [
      rule.full_note,
      rule.max_dose && `Max dose: ${rule.max_dose}`,
      rule.max_rate && `Max rate: ${rule.max_rate}`,
      rule.max_conc && `Max conc: ${rule.max_conc}`,
      rule.dilution,
      rule.route_note,
      rule.antidote && `Antidote: ${rule.antidote}`,
    ].filter(Boolean).join(' · ') : 'ยานี้อยู่ในรายการ High Alert Drug — ต้อง double check ก่อนจ่าย'
    alerts.push({
      id: `had_${d.icode}`,
      type: 'HAD' as const,
      severity: 'red' as const,
      title: `🔴 HIGH ALERT DRUG: ${d.master.drug_name}`,
      detail: ruleDetail,
      recommendation: 'ตรวจสอบ dose / route / patient identity ซ้ำ (double-check)',
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
    if (list.length < 2) continue
    if (cls === 'ACEI' || cls === 'ARB') continue // handled above
    alerts.push({
      id: `dup_${cls}`,
      type: 'DRP',
      severity: 'orange',
      title: `🚫 Duplicate: ${cls} ${list.length} ตัว`,
      detail: `${cls}: ${list.map((d) => d.master?.drug_name ?? d.icode).join(', ')} — ห้ามใช้ร่วมกันตามแนวทาง รพ.`,
      recommendation: 'เลือกใช้ตัวเดียว — consult แพทย์',
      drugs: list.map((d) => d.icode),
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
  return drugs
    .filter((d) => d.master?.no_crush)
    .map((d) => ({
      id: `nocrush_${d.icode}`,
      type: 'NO_CRUSH' as const,
      severity: 'red' as const,
      title: `⚠️ Tube feeding + SR tablet: ${d.master!.drug_name}`,
      detail: 'ห้ามบดเม็ดยา SR/ER · ผู้ป่วยใช้ tube feeding — ต้อง consult แพทย์เปลี่ยนรูปแบบ',
      recommendation: 'เปลี่ยนเป็น syrup หรือ immediate-release แทน',
      drugs: [d.icode],
    }))
}

// ============ LASA ============
export function buildLasaAlerts(drugs: DrugEntry[], allDrugs: DrugMaster[]): ScreeningAlert[] {
  const alerts: ScreeningAlert[] = []
  for (const d of drugs) {
    const lasa = d.master?.lasa_with
    if (!lasa || lasa.length === 0) continue
    const pairs = lasa.map((p) => allDrugs.find((x) => nameEq(x.icode, p) || nameEq(x.drug_name, p)) ?? { drug_name: p, icode: p } as DrugMaster)
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
  return alerts
}

// ============ Pregnancy ============
export function buildPregnancyAlerts(drugs: DrugEntry[], patient: PatientInput): ScreeningAlert[] {
  if (!patient.is_pregnant) return []
  const alerts: ScreeningAlert[] = []
  for (const d of drugs) {
    const cat = d.master?.pregnancy_category
    if (!cat) continue
    const sev: ScreeningAlert['severity'] = cat === 'X' ? 'red' : cat === 'D' ? 'orange' : cat === 'C' ? 'yellow' : 'blue'
    if (cat === 'A' || cat === 'B') continue  // ปลอดภัย ไม่ต้องเตือน
    alerts.push({
      id: `preg_${d.icode}`,
      type: 'PREG',
      severity: sev,
      title: `🤰 ตั้งครรภ์ + ${d.master!.drug_name} (Pregnancy ${cat})`,
      detail: pregLabel(cat) + (patient.pregnancy_weeks ? ` · อายุครรภ์ ${patient.pregnancy_weeks} สัปดาห์` : ''),
      recommendation: cat === 'X' ? 'ห้ามใช้ — เปลี่ยนยา' : cat === 'D' ? 'ใช้เมื่อจำเป็นเท่านั้น' : 'พิจารณา risk vs benefit',
      drugs: [d.icode],
      source: d.master,
    })
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
  return drugs
    .filter((d) => d.master?.lactation_safe === false)
    .map((d) => ({
      id: `lact_${d.icode}`,
      type: 'LACT' as const,
      severity: 'orange' as const,
      title: `🤱 ให้นมบุตร + ${d.master!.drug_name}`,
      detail: 'ยานี้ไม่แนะนำในระยะให้นม — อาจผ่านน้ำนมไปสู่ทารก',
      recommendation: 'พิจารณาเปลี่ยนยา หรือหยุดให้นมชั่วคราว',
      drugs: [d.icode],
      source: d.master,
    }))
}

// ============ Beers (elderly ≥65) ============
export function buildBeersAlerts(drugs: DrugEntry[], patient: PatientInput): ScreeningAlert[] {
  if (!patient.age || patient.age < 65) return []
  return drugs
    .filter((d) => d.master?.beers_avoid_elderly)
    .map((d) => ({
      id: `beers_${d.icode}`,
      type: 'BEERS' as const,
      severity: 'orange' as const,
      title: `👴 Beers Criteria: ${d.master!.drug_name} (อายุ ${patient.age} ปี)`,
      detail: 'ยานี้อยู่ในรายการ Beers ที่ควรหลีกเลี่ยงในผู้สูงอายุ ≥65 ปี',
      recommendation: 'พิจารณาเปลี่ยนยาเป็นกลุ่มที่ปลอดภัยกว่า',
      drugs: [d.icode],
      source: d.master,
    }))
}

// ============ G6PD ============
export function buildG6pdAlerts(drugs: DrugEntry[], patient: PatientInput): ScreeningAlert[] {
  const hasG6pd = patient.g6pd === true || patient.diseases?.some((d) => d.toUpperCase() === 'G6PD')
  if (!hasG6pd) return []
  return drugs
    .filter((d) => d.master?.g6pd_unsafe)
    .map((d) => ({
      id: `g6pd_${d.icode}`,
      type: 'G6PD' as const,
      severity: 'red' as const,
      title: `🩸 G6PD + ${d.master!.drug_name} — ห้ามใช้`,
      detail: 'ยานี้ทำให้เกิด hemolysis ในผู้ป่วย G6PD deficiency',
      recommendation: 'เปลี่ยนยาทันที',
      drugs: [d.icode],
      source: d.master,
    }))
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

export interface ScreenContext {
  drugs: DrugEntry[]
  patient: PatientInput
  ddiList: DdiOverride[]
  labRules: LabRule[]
  diseaseRules: DiseaseRule[]
  drugMasters: DrugMaster[]
  hadRules?: HadRule[]
}

export function runScreening(ctx: ScreenContext): ScreeningAlert[] {
  return [
    ...buildAllergyAlerts(ctx.drugs, ctx.patient.allergies),
    ...buildHadAlerts(ctx.drugs, ctx.hadRules ?? []),
    ...buildG6pdAlerts(ctx.drugs, ctx.patient),
    ...buildDdiAlerts(ctx.drugs, ctx.ddiList),
    ...buildPregnancyAlerts(ctx.drugs, ctx.patient),
    ...buildLactationAlerts(ctx.drugs, ctx.patient),
    ...buildBeersAlerts(ctx.drugs, ctx.patient),
    ...buildRenalAlerts(ctx.drugs, ctx.patient),
    ...buildDrpAlerts(ctx.drugs),
    ...buildDupClassAlerts(ctx.drugs),
    ...buildLabAlerts(ctx.drugs, ctx.labRules, ctx.patient),
    ...buildDiseaseAlerts(ctx.drugs, ctx.patient.diseases, ctx.diseaseRules),
    ...buildLasaAlerts(ctx.drugs, ctx.drugMasters),
    ...buildLifestyleAlerts(ctx.drugs, ctx.patient),
    ...buildPediatricAlerts(ctx.drugs, ctx.patient),
    ...buildTimingAlerts(ctx.drugs),
    ...buildDueAlerts(ctx.drugs),
    ...buildNoCrushAlerts(ctx.drugs, ctx.patient),
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
