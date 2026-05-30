import { writeBatch, doc, collection, serverTimestamp, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { fetchSheetCsv, toBool, toNumber } from './csv'
import { expandSukhothaiDdi } from './seedDdi'
import {
  SUKHOTHAI_HAD, SUKHOTHAI_RENAL, SUKHOTHAI_DISEASE_RULES,
  DUPLICATE_THERAPY_CLASSES, DRUG_TIMING_RULES, DUE_DRUG_KEYS, NO_CRUSH_KEYS,
} from './seedClinical'

export interface ImportProgress {
  sheet: string
  count: number
  status: 'pending' | 'fetching' | 'writing' | 'done' | 'error'
  error?: string
}

type ProgressCb = (p: ImportProgress[]) => void

const BATCH_LIMIT = 400  // Firestore batch limit 500, ใช้ 400 เพื่อปลอดภัย

/** Batch write — split docs เป็นกลุ่มไม่เกิน BATCH_LIMIT */
async function batchWrite(coll: string, items: { id: string; data: Record<string, unknown> }[]) {
  for (let i = 0; i < items.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db)
    const slice = items.slice(i, i + BATCH_LIMIT)
    for (const { id, data } of slice) {
      batch.set(doc(collection(db, coll), id), { ...data, updatedAt: serverTimestamp() }, { merge: true })
    }
    await batch.commit()
  }
}

/** รองรับทั้ง short code (M/Mo/Mi/X) และ full name */
function normSeverity(s: string | undefined): 'major' | 'moderate' | 'minor' | 'contraindicated' {
  if (!s) return 'moderate'
  const v = s.trim().toLowerCase()
  if (v === 'm' || v === 'major') return 'major'
  if (v === 'mo' || v === 'moderate') return 'moderate'
  if (v === 'mi' || v === 'minor') return 'minor'
  if (v === 'x' || v === 'contraindicated' || v === 'ci') return 'contraindicated'
  return 'moderate'
}

function normOnset(s: string | undefined): 'R' | 'D' | undefined {
  if (!s) return undefined
  const v = s.trim().toUpperCase()
  if (v === 'R' || v === 'RAPID') return 'R'
  if (v === 'D' || v === 'DELAYED') return 'D'
  return undefined
}

function normDoc(s: string | undefined): '1' | '2' | '3' | undefined {
  if (!s) return undefined
  const v = s.trim().toLowerCase()
  if (v === '1' || v === 'established') return '1'
  if (v === '2' || v === 'probable') return '2'
  if (v === '3' || v === 'suspected') return '3'
  return undefined
}

function sanitize(o: Record<string, unknown>): Record<string, unknown> {
  // ลบ key ที่ value เป็น empty string เพื่อไม่ใช้พื้นที่ Firestore
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined) continue
    if (typeof v === 'string' && v.trim() === '') continue
    out[k] = v
  }
  return out
}

export async function importFromGoogleSheet(spreadsheetId: string, onProgress: ProgressCb): Promise<ImportProgress[]> {
  const initial: ImportProgress[] = [
    { sheet: 'DRUG_MASTER', count: 0, status: 'pending' },
    { sheet: 'DRUG_COUNSELING', count: 0, status: 'pending' },
    { sheet: 'LAB_RULES', count: 0, status: 'pending' },
    { sheet: 'DDI_OVERRIDE', count: 0, status: 'pending' },
    { sheet: 'DISEASE_RULES', count: 0, status: 'pending' },
    { sheet: 'WARFARIN_INR_PROTOCOL', count: 0, status: 'pending' },
    { sheet: 'WARFARIN_TWD_TABLE', count: 0, status: 'pending' },
    { sheet: 'STICKER_PREFERENCES', count: 0, status: 'pending' },
  ]
  const progress = [...initial]
  function update(idx: number, patch: Partial<ImportProgress>) {
    progress[idx] = { ...progress[idx], ...patch }
    onProgress([...progress])
  }
  async function step<T>(idx: number, sheetName: string, transform: (rows: Record<string, string>[]) => { coll: string; items: { id: string; data: Record<string, unknown> }[] }): Promise<T | undefined> {
    try {
      update(idx, { status: 'fetching' })
      const rows = await fetchSheetCsv(spreadsheetId, sheetName)
      update(idx, { status: 'writing', count: rows.length })
      const { coll, items } = transform(rows)
      await batchWrite(coll, items)
      update(idx, { status: 'done', count: items.length })
    } catch (e) {
      update(idx, { status: 'error', error: (e as Error).message })
    }
    return undefined
  }

  // 1) DRUG_MASTER
  await step(0, 'DRUG_MASTER', (rows) => ({
    coll: 'DRUG_MASTER',
    items: rows.filter((r) => r.icode).map((r) => ({
      id: r.icode,
      data: sanitize({
        icode: r.icode,
        drug_name: r.drug_name,
        drug_class: r.drug_class,
        form: r.form,
        strength: r.strength,
        unit: r.form,
        is_HAD: toBool(r.is_high_alert),
        active: true,
      }),
    })),
  }))

  // 2) DRUG_COUNSELING
  await step(1, 'DRUG_COUNSELING', (rows) => ({
    coll: 'DRUG_COUNSELING',
    items: rows.filter((r) => r.icode).map((r, i) => ({
      id: `${r.icode}_${i}`,
      data: sanitize({
        icode: r.icode,
        drug_name: r.drug_name,
        counseling_th: r.counseling_th,
        side_effect: r.side_effect,
        when_to_er: r.when_to_er,
        food_interaction: r.food_interaction,
        special_pop: r.special_pop,
        // เก็บ counseling_th เป็น full_counseling ด้วย เพื่อให้ UI เดิมใช้งานได้
        full_counseling: r.counseling_th,
        warning: r.when_to_er,
      }),
    })),
  }))

  // 3) LAB_RULES
  await step(2, 'LAB_RULES', (rows) => ({
    coll: 'LAB_RULES',
    items: rows.filter((r) => r.icode).map((r, i) => ({
      id: `${r.icode}_${r.param || 'rule'}_${i}`,
      data: sanitize({
        icode: r.icode,
        drug_name: r.drug_name,
        param: r.param,
        unit: r.unit,
        normal_range: r.normal_range,
        priority: r.priority,
        reason: r.reason,
        dose_check: r.dose_check,
        dose_meta: r.dose_meta,
        indication: r.indication,
        min_dose_kg: r.min_dose_kg,
        max_dose_kg: r.max_dose_kg,
        max_dose_day: r.max_dose_day,
        concentration: r.concentration,
        frequency: r.frequency,
        renal_dose_rules: r.renal_dose_rules,
        pediatric_dose: r.pediatric_dose,
      }),
    })),
  }))

  // 4) DDI_OVERRIDE
  await step(3, 'DDI_OVERRIDE', (rows) => ({
    coll: 'DDI_OVERRIDE',
    items: rows.filter((r) => r.drug_a && r.drug_b).map((r) => ({
      id: `${r.drug_a}__${r.drug_b}`.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      data: sanitize({
        drug_a: r.drug_a,
        drug_b: r.drug_b,
        severity: normSeverity(r.severity),
        onset: normOnset(r.onset),
        documentation: normDoc(r.documentation || r.doc),
        mechanism: r.mechanism,
        local_note: r.local_note,
        recommendation: r.recommendation,
      }),
    })),
  }))

  // 5) DISEASE_RULES
  await step(4, 'DISEASE_RULES', (rows) => ({
    coll: 'DISEASE_RULES',
    items: rows.filter((r) => r.disease_key).map((r) => ({
      id: r.disease_key,
      data: sanitize({
        disease_key: r.disease_key,
        disease: r.disease_key,
        display_name: r.display_name,
        required_labs: r.required_labs,
        optional_labs: r.optional_labs,
        screening_notes: r.screening_notes,
      }),
    })),
  }))

  // 6) WARFARIN_INR_PROTOCOL
  await step(5, 'WARFARIN_INR_PROTOCOL', (rows) => ({
    coll: 'WARFARIN_INR_PROTOCOL',
    items: rows.filter((r) => r.inr_min).map((r, i) => ({
      id: `inr_${i}_${r.inr_min}_${r.inr_max}`,
      data: sanitize({
        inr_min: toNumber(r.inr_min),
        inr_max: toNumber(r.inr_max),
        action: r.action,
        adjust_pct: toNumber(r.adjust_pct),
        note: r.note,
        vit_k: r.vit_k,
      }),
    })),
  }))

  // 7) WARFARIN_TWD_TABLE
  await step(6, 'WARFARIN_TWD_TABLE', (rows) => ({
    coll: 'WARFARIN_TWD_TABLE',
    items: rows.filter((r) => r.strength_mg && r.twd_mg).map((r, i) => ({
      id: `twd_${r.strength_mg}_${r.twd_mg}_${i}`,
      data: sanitize({
        strength_mg: toNumber(r.strength_mg),
        twd_mg: toNumber(r.twd_mg),
        schedule_code: r.schedule_code,
        description: r.description,
      }),
    })),
  }))

  // 8) STICKER_PREFERENCES
  await step(7, 'STICKER_PREFERENCES', (rows) => ({
    coll: 'STICKER_PREFERENCES',
    items: rows.filter((r) => r.icode).map((r, i) => ({
      id: `sp_${r.icode}_${r.section || 'gen'}_${i}`,
      data: sanitize({
        icode: r.icode,
        drug_name: r.drug_name,
        section: r.section,
        text: r.text,
        usage_count: toNumber(r.usage_count),
        last_used: r.last_used,
        created_by: r.created_by,
      }),
    })),
  }))

  return progress
}

// ============================================================================
// Drug Account Sheet (บัญชียา) — schema คนละแบบกับ DRUG_MASTER เดิม
// Header ใน Sheet:
//   icode, name, strength, units, dosageform, drugaccount,
//   drugcategory, therapeutic, unitcost, unitprice, pregnancy, generic_name
// หมายเหตุ: icode ซ้ำกันได้ (1 icode = หลายรายการต่างรูปแบบ/strength)
//          ใช้ deterministic ID จาก icode + slug(name) เพื่อ re-import ได้
// ============================================================================

function normPreg(v: string | undefined): 'A' | 'B' | 'C' | 'D' | 'X' | undefined {
  if (!v) return undefined
  const u = v.trim().toUpperCase()
  if (u === 'A' || u === 'B' || u === 'C' || u === 'D' || u === 'X') return u
  return undefined
}

export interface DrugAccountImportProgress {
  total: number
  written: number
  status: 'pending' | 'fetching' | 'writing' | 'done' | 'error'
  error?: string
}

/**
 * ดึงข้อมูลจาก Sheet "บัญชียา" (Hospital drug account) เข้า DRUG_MASTER
 * - icode ซ้ำ → id = `${icode}_${slug(name)}` ทำให้ re-import ทับเดิมตัวเอง
 * - merge: true → คง field เดิม (เช่น is_HAD, lasa_with) ที่ผู้ใช้แก้ไว้ใน UI
 */
export async function importDrugAccountSheet(
  spreadsheetId: string,
  sheetName: string,
  onProgress: (p: DrugAccountImportProgress) => void,
): Promise<DrugAccountImportProgress> {
  const state: DrugAccountImportProgress = { total: 0, written: 0, status: 'fetching' }
  onProgress({ ...state })
  try {
    const rows = await fetchSheetCsv(spreadsheetId, sheetName)
    state.total = rows.length
    state.status = 'writing'
    onProgress({ ...state })

    // ใช้ icode เป็น doc id โดยตรง → re-import ทับตัวเอง (idempotent)
    // ถ้า Sheet มี icode ซ้ำ → row สุดท้ายชนะ (Firestore batch.set ล่าสุดทับ)
    const items = rows
      .filter((r) => r.icode && r.icode.trim() !== '')
      .map((r) => {
        const icode = r.icode.trim()
        const name = (r.name || '').trim()
        return {
          id: icode,
          data: sanitize({
            icode,
            drug_name: name,
            generic_name: r.generic_name?.trim(),
            strength: r.strength?.trim(),
            pack_unit: r.units?.trim(),
            dosage_form: r.dosageform?.trim(),
            form: r.dosageform?.trim(),
            drug_account: r.drugaccount?.trim(),
            drug_category: r.drugcategory?.trim(),
            drug_class: r.drugcategory?.trim(),
            therapeutic: r.therapeutic?.trim(),
            unit_cost: toNumber(r.unitcost),
            unit_price: toNumber(r.unitprice),
            pregnancy_category: normPreg(r.pregnancy),
            active: true,
          }),
        }
      })

    await batchWrite('DRUG_MASTER', items)
    state.written = items.length
    state.status = 'done'
    onProgress({ ...state })
    return state
  } catch (e) {
    state.status = 'error'
    state.error = (e as Error).message
    onProgress({ ...state })
    return state
  }
}

// ============================================================================
// Dedupe DRUG_MASTER: ลบเอกสารที่ icode ซ้ำกัน เหลือ 1 ตัวต่อ icode
// เลือกตัวที่จะเก็บ: (1) มี generic_name (2) updatedAt ล่าสุด (3) ID สั้นที่สุด
// ============================================================================

export interface DedupeResult {
  scanned: number
  groups: number
  deleted: number
  kept: number
  errors: string[]
}

export async function dedupeDrugMaster(
  onProgress?: (msg: string) => void,
): Promise<DedupeResult> {
  const result: DedupeResult = { scanned: 0, groups: 0, deleted: 0, kept: 0, errors: [] }
  onProgress?.('กำลังโหลด DRUG_MASTER ทั้งหมด...')

  const snap = await getDocs(collection(db, 'DRUG_MASTER'))
  result.scanned = snap.size
  onProgress?.(`พบ ${result.scanned} เอกสาร — จัดกลุ่มตาม icode...`)

  // group docs by icode
  const groups = new Map<string, { id: string; data: Record<string, unknown> }[]>()
  for (const docSnap of snap.docs) {
    const data = docSnap.data() as Record<string, unknown>
    const icode = (data.icode as string | undefined)?.trim()
    if (!icode) continue
    const list = groups.get(icode) ?? []
    list.push({ id: docSnap.id, data })
    groups.set(icode, list)
  }
  result.groups = groups.size

  // เลือก winner ต่อ icode + รวบรวมตัวที่จะลบ
  const toDelete: string[] = []
  for (const [, docs] of groups) {
    if (docs.length === 1) {
      result.kept++
      continue
    }
    // sort: มี generic_name ก่อน → updatedAt ล่าสุด → id สั้นสุด
    docs.sort((a, b) => {
      const aGen = a.data.generic_name ? 1 : 0
      const bGen = b.data.generic_name ? 1 : 0
      if (aGen !== bGen) return bGen - aGen
      const aUp = (a.data.updatedAt as { seconds?: number } | undefined)?.seconds ?? 0
      const bUp = (b.data.updatedAt as { seconds?: number } | undefined)?.seconds ?? 0
      if (aUp !== bUp) return bUp - aUp
      return a.id.length - b.id.length
    })
    const [winner, ...losers] = docs
    result.kept++
    for (const loser of losers) {
      if (loser.id !== winner.id) toDelete.push(loser.id)
    }
  }

  onProgress?.(`เตรียมลบ ${toDelete.length} เอกสารซ้ำ...`)

  for (let i = 0; i < toDelete.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db)
    const slice = toDelete.slice(i, i + BATCH_LIMIT)
    for (const id of slice) {
      batch.delete(doc(collection(db, 'DRUG_MASTER'), id))
    }
    try {
      await batch.commit()
      result.deleted += slice.length
      onProgress?.(`ลบแล้ว ${result.deleted}/${toDelete.length}`)
    } catch (e) {
      result.errors.push((e as Error).message)
    }
  }

  onProgress?.(`เสร็จสิ้น — เก็บ ${result.kept} icode (ลบ ${result.deleted} ซ้ำ)`)
  return result
}

// ============================================================================
// Seed Clinical Data จากแนวทาง รพ.สุโขทัย + พระจอมเกล้า 2560
// ============================================================================

export interface ClinicalSeedResult {
  ddi_pairs: number
  had_rules: number
  renal_rules: number
  disease_rules: number
  drugs_tagged_dup: number
  drugs_tagged_timing: number
  drugs_tagged_due: number
  drugs_tagged_no_crush: number
  errors: string[]
}

function ddiId(a: string, b: string): string {
  return `${a}__${b}`.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 200)
}

/** Match DRUG_MASTER docs ตาม keyword ใน drug_name/generic_name */
function matchDrugDocs(
  allDrugs: { id: string; data: Record<string, unknown> }[],
  keys: string[],
): { id: string; data: Record<string, unknown> }[] {
  const keysLower = keys.map((k) => k.toLowerCase())
  return allDrugs.filter((d) => {
    const name = (d.data.drug_name as string | undefined)?.toLowerCase() ?? ''
    const generic = (d.data.generic_name as string | undefined)?.toLowerCase() ?? ''
    return keysLower.some((k) => name.includes(k) || generic.includes(k))
  })
}

export async function seedSukhothaiClinical(
  onProgress?: (msg: string) => void,
): Promise<ClinicalSeedResult> {
  const result: ClinicalSeedResult = {
    ddi_pairs: 0, had_rules: 0, renal_rules: 0, disease_rules: 0,
    drugs_tagged_dup: 0, drugs_tagged_timing: 0, drugs_tagged_due: 0, drugs_tagged_no_crush: 0,
    errors: [],
  }

  // ---------- 1) DDI ----------
  onProgress?.('1/7 กำลังนำเข้าคู่ DDI...')
  try {
    const ddiItems = expandSukhothaiDdi().map((p) => ({
      id: ddiId(p.data.drug_a, p.data.drug_b),
      data: p.data as unknown as Record<string, unknown>,
    }))
    await batchWrite('DDI_OVERRIDE', ddiItems)
    result.ddi_pairs = ddiItems.length
  } catch (e) { result.errors.push('DDI: ' + (e as Error).message) }

  // ---------- 2) HAD ----------
  onProgress?.('2/7 กำลังนำเข้า HAD_RULES...')
  try {
    const hadItems = SUKHOTHAI_HAD.map((h) => ({
      id: h.drug_key.replace(/[^a-z0-9]/gi, '_'),
      data: sanitize(h as unknown as Record<string, unknown>),
    }))
    await batchWrite('HAD_RULES', hadItems)
    result.had_rules = hadItems.length
  } catch (e) { result.errors.push('HAD: ' + (e as Error).message) }

  // ---------- 3) Renal → LAB_RULES (เก็บ dose_meta) ----------
  onProgress?.('3/7 กำลังนำเข้า Renal dose adjustments...')
  try {
    const renalItems = SUKHOTHAI_RENAL.map((r) => ({
      id: `renal_${r.drug_key.replace(/[^a-z0-9]/gi, '_')}`,
      data: sanitize({
        icode: r.drug_key,
        drug_name: r.drug_name,
        param: 'CrCl',
        priority: 'high',
        reason: 'ปรับขนาดยาตามการทำงานของไต (พระจอมเกล้า 2560)',
        dose_meta: r.dose_meta,
        renal_dose_rules: r.dose_meta,
      }),
    }))
    await batchWrite('LAB_RULES', renalItems)
    result.renal_rules = renalItems.length
  } catch (e) { result.errors.push('Renal: ' + (e as Error).message) }

  // ---------- 4) Disease rules ----------
  onProgress?.('4/7 กำลังนำเข้า DISEASE_RULES...')
  try {
    const diseaseItems = SUKHOTHAI_DISEASE_RULES.map((r) => ({
      id: r.disease_key!,
      data: sanitize(r as unknown as Record<string, unknown>),
    }))
    await batchWrite('DISEASE_RULES', diseaseItems)
    result.disease_rules = diseaseItems.length
  } catch (e) { result.errors.push('Disease: ' + (e as Error).message) }

  // ---------- 5-7) Tag DRUG_MASTER: dup_class / timing_note / is_DUE / no_crush ----------
  onProgress?.('5/7 กำลังโหลด DRUG_MASTER เพื่อแท็ก...')
  let allDrugs: { id: string; data: Record<string, unknown> }[] = []
  try {
    const snap = await getDocs(collection(db, 'DRUG_MASTER'))
    allDrugs = snap.docs.map((d) => ({ id: d.id, data: d.data() }))
  } catch (e) {
    result.errors.push('Load DRUG_MASTER: ' + (e as Error).message)
    onProgress?.(`เสร็จสิ้น (มี error: ${result.errors.length})`)
    return result
  }

  // 5) Duplicate therapy class tagging
  onProgress?.('6/7 กำลังแท็ก duplicate therapy classes...')
  const dupUpdates = new Map<string, string[]>()
  for (const cls of DUPLICATE_THERAPY_CLASSES) {
    const matched = matchDrugDocs(allDrugs, cls.drug_keys)
    for (const m of matched) {
      const existing = dupUpdates.get(m.id) ?? (m.data.dup_class as string[] | undefined) ?? []
      if (!existing.includes(cls.class_name)) existing.push(cls.class_name)
      dupUpdates.set(m.id, existing)
    }
  }
  result.drugs_tagged_dup = dupUpdates.size

  // Drug timing
  const timingUpdates = new Map<string, string>()
  for (const r of DRUG_TIMING_RULES) {
    const matched = matchDrugDocs(allDrugs, [r.key])
    for (const m of matched) timingUpdates.set(m.id, r.timing_note)
  }
  result.drugs_tagged_timing = timingUpdates.size

  // DUE flag
  const dueIds = new Set<string>()
  const dueMatched = matchDrugDocs(allDrugs, DUE_DRUG_KEYS)
  for (const m of dueMatched) dueIds.add(m.id)
  result.drugs_tagged_due = dueIds.size

  // no_crush flag
  const noCrushIds = new Set<string>()
  const ncMatched = matchDrugDocs(allDrugs, NO_CRUSH_KEYS)
  for (const m of ncMatched) noCrushIds.add(m.id)
  result.drugs_tagged_no_crush = noCrushIds.size

  // Apply all DRUG_MASTER updates in one batched merge
  onProgress?.('7/7 กำลังอัปเดต DRUG_MASTER tags...')
  const updateIds = new Set<string>([
    ...dupUpdates.keys(), ...timingUpdates.keys(), ...dueIds, ...noCrushIds,
  ])
  const updates: { id: string; data: Record<string, unknown> }[] = []
  for (const id of updateIds) {
    const patch: Record<string, unknown> = {}
    const dup = dupUpdates.get(id); if (dup) patch.dup_class = dup
    const timing = timingUpdates.get(id); if (timing) patch.timing_note = timing
    if (dueIds.has(id)) patch.is_DUE = true
    if (noCrushIds.has(id)) patch.no_crush = true
    updates.push({ id, data: patch })
  }
  try {
    await batchWrite('DRUG_MASTER', updates)
  } catch (e) {
    result.errors.push('Tag DRUG_MASTER: ' + (e as Error).message)
  }

  onProgress?.('เสร็จสิ้น')
  return result
}
