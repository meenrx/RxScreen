/**
 * JSON Importer — รับ 4 ไฟล์ JSON จาก drug-screen-db package (Supabase seed)
 * แล้ว map + push เข้า Firestore collections ที่ระบบใช้อยู่ พร้อม backup/rollback
 *
 * Flow:
 *   1. parseSeedJson(...) — รับ File 4 ตัว → คืน { drugs, labs, ddi, clinical, errors }
 *   2. previewMapping(...) — คำนวณ unmatched generic_name vs DRUG_MASTER ปัจจุบัน
 *   3. runImport({ ..., label }) — backup ของเดิม + upsert ใหม่
 *   4. listBackups() / restoreBackup(id) — ดู/กู้คืน
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
  orderBy,
  query,
  Timestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { DrugMaster, LabRule, DdiOverride } from '@/types/drug'

// ============ Raw JSON shapes (ตรงกับ seed package) ============
export interface RawDrug {
  icode: string
  name: string
  generic_name?: string
  strength?: string
  dosage_form?: string
  drug_category?: string
  drug_note?: string
  therapeutic_group?: string
  unit_price?: number
  unit_cost?: number
  pregnancy_category?: string
  is_had?: boolean
  is_active?: boolean
}

export interface RawLabMonitoring {
  generic_name: string
  monitoring_type?: 'pre' | 'during' | 'long_term' | string
  lab_parameter: string
  lab_unit?: string
  alert_operator?: '<' | '<=' | '>' | '>=' | '='
  alert_value?: number
  alert_text?: string
  alert_severity?: 'critical' | 'high' | 'moderate' | 'low' | string
  action_required?: string
  rationale?: string
  is_critical?: boolean
}

export interface RawDdi {
  drug1_name: string
  drug2_name: string
  severity: 'major' | 'moderate' | 'minor' | string
  onset?: string
  documentation?: string
  mechanism?: string
  clinical_effect?: string
  action_required?: string
  is_contraindicated?: boolean
  local_note?: string
}

export interface RawClinical {
  generic_name: string
  info_type: string
  content: string
  priority?: number
}

// ============ Parsed seed bundle ============
export interface ParsedSeed {
  drugs: RawDrug[]
  labs: RawLabMonitoring[]
  ddi: RawDdi[]
  clinical: RawClinical[]
  errors: string[]
}

async function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result ?? ''))
    r.onerror = () => reject(r.error ?? new Error('read error'))
    r.readAsText(file)
  })
}

/** Strip // line-comments — seed files may include them (JSON5-ish) */
function stripJsonComments(s: string): string {
  return s.replace(/\/\/[^\n\r]*/g, '')
}

export async function parseSeedFiles(input: {
  drugs?: File | null
  labs?: File | null
  ddi?: File | null
  clinical?: File | null
}): Promise<ParsedSeed> {
  const errors: string[] = []
  async function parse<T>(file: File | null | undefined, name: string): Promise<T[]> {
    if (!file) return []
    try {
      const txt = stripJsonComments(await readFileText(file))
      const j = JSON.parse(txt)
      if (!Array.isArray(j)) throw new Error('expected array')
      return j as T[]
    } catch (e) {
      errors.push(`${name}: ${(e as Error).message}`)
      return []
    }
  }
  const [drugs, labs, ddi, clinical] = await Promise.all([
    parse<RawDrug>(input.drugs ?? null, '01_drugs.json'),
    parse<RawLabMonitoring>(input.labs ?? null, '02_lab_monitoring.json'),
    parse<RawDdi>(input.ddi ?? null, '03_drug_interactions.json'),
    parse<RawClinical>(input.clinical ?? null, '04_clinical_info.json'),
  ])
  return { drugs, labs, ddi, clinical, errors }
}

// ============ Mapping: JSON → Firestore shape ============

function mapPregnancyCategory(c?: string): DrugMaster['pregnancy_category'] {
  if (!c) return undefined
  const u = c.toUpperCase().trim()
  if (u === 'A' || u === 'B' || u === 'C' || u === 'D' || u === 'X') return u
  return undefined
}

export function rawDrugToFirestore(r: RawDrug): DrugMaster {
  const search_keywords = r.drug_note
    ? r.drug_note.split(':').map((s) => s.trim()).filter(Boolean)
    : undefined
  return {
    icode: r.icode,
    drug_name: r.name?.trim() ?? r.icode,
    generic_name: r.generic_name?.trim(),
    strength: r.strength?.trim(),
    dosage_form: r.dosage_form?.trim(),
    drug_category: r.drug_category?.trim(),
    therapeutic: r.therapeutic_group?.trim(),
    unit_price: typeof r.unit_price === 'number' ? r.unit_price : undefined,
    unit_cost: typeof r.unit_cost === 'number' ? r.unit_cost : undefined,
    pregnancy_category: mapPregnancyCategory(r.pregnancy_category),
    is_HAD: !!r.is_had,
    active: r.is_active !== false,
    search_keywords,
  }
}

/** severity ของ lab จาก seed (critical/high/moderate/low) → priority ของระบบ */
function mapLabSeverity(s?: string): LabRule['priority'] {
  switch ((s ?? '').toLowerCase()) {
    case 'critical': return 'urgent'
    case 'high': return 'high'
    case 'moderate': return 'medium'
    case 'low': return 'low'
    default: return 'medium'
  }
}

export function rawLabToFirestore(r: RawLabMonitoring, icode: string): LabRule {
  // seed มี alert_operator + alert_value (เช่น < 3.5) → เก็บเป็น dose_meta-like ใน normal_range
  // ระบบเดิม renal-style ใช้ dose_meta แบบ "<X:action" — ที่นี่เก็บเงื่อนไขใน normal_range แทน
  // เพื่อไม่ trigger renal logic ผิดๆ
  const condStr = r.alert_operator && r.alert_value !== undefined
    ? `${r.alert_operator}${r.alert_value}${r.lab_unit ? ' ' + r.lab_unit : ''}`
    : undefined
  const reasonParts = [r.alert_text, r.rationale, r.action_required].filter(Boolean)
  return {
    icode,
    param: r.lab_parameter,
    unit: r.lab_unit,
    normal_range: condStr,
    priority: mapLabSeverity(r.alert_severity),
    reason: reasonParts.join(' · ') || undefined,
  }
}

export function rawDdiToFirestore(r: RawDdi, icodeA: string, icodeB: string): DdiOverride {
  const severity: DdiOverride['severity'] = r.is_contraindicated
    ? 'contraindicated'
    : r.severity === 'major' || r.severity === 'moderate' || r.severity === 'minor'
      ? r.severity
      : 'moderate'
  return {
    drug_a: icodeA,
    drug_b: icodeB,
    severity,
    onset: r.onset === 'rapid' ? 'R' : r.onset === 'delayed' ? 'D' : undefined,
    documentation: r.documentation === 'established' ? '1' :
                   r.documentation === 'probable' ? '2' :
                   r.documentation === 'suspected' ? '3' : undefined,
    mechanism: r.mechanism,
    local_note: [r.clinical_effect, r.local_note].filter(Boolean).join(' — ') || undefined,
    recommendation: r.action_required,
  }
}

// ============ Drug name → icode resolver ============
export interface NameResolver {
  byGeneric: Map<string, string[]>  // lowercased generic_name → icodes
  byName: Map<string, string[]>      // lowercased drug_name → icodes
}

export function buildResolver(drugs: DrugMaster[]): NameResolver {
  const byGeneric = new Map<string, string[]>()
  const byName = new Map<string, string[]>()
  for (const d of drugs) {
    if (d.generic_name) {
      const k = d.generic_name.toLowerCase().trim()
      const arr = byGeneric.get(k) ?? []
      arr.push(d.icode)
      byGeneric.set(k, arr)
    }
    if (d.drug_name) {
      const k = d.drug_name.toLowerCase().trim()
      const arr = byName.get(k) ?? []
      arr.push(d.icode)
      byName.set(k, arr)
    }
  }
  return { byGeneric, byName }
}

/** หา icode ที่ match กับ generic name (case-insensitive, partial fallback) */
export function resolveIcode(name: string, r: NameResolver): string | null {
  const k = name.toLowerCase().trim()
  const direct = r.byGeneric.get(k) ?? r.byName.get(k)
  if (direct && direct.length > 0) return direct[0]
  // partial match — substring in either generic or name
  for (const [key, icodes] of r.byGeneric) {
    if (key.includes(k) || k.includes(key)) return icodes[0]
  }
  for (const [key, icodes] of r.byName) {
    if (key.includes(k) || k.includes(key)) return icodes[0]
  }
  return null
}

// ============ Preview (dry-run summary) ============
export interface ImportPreview {
  drugs: { total: number }
  labs: { total: number; matched: number; unmatched: string[] }
  ddi: { total: number; matched: number; unmatched: string[] }
  clinical: { total: number; matched: number; unmatched: string[] }
}

export function buildPreview(parsed: ParsedSeed, existingDrugs: DrugMaster[]): ImportPreview {
  // หลัง import drugs ใหม่จาก seed ก็จะมีในระบบ — สร้าง resolver จาก union
  const projected: DrugMaster[] = [
    ...existingDrugs,
    ...parsed.drugs.map(rawDrugToFirestore),
  ]
  const resolver = buildResolver(projected)
  function check(items: { name: string }[]): { matched: number; unmatched: string[] } {
    const unmatched = new Set<string>()
    let matched = 0
    for (const it of items) {
      if (resolveIcode(it.name, resolver)) matched++
      else unmatched.add(it.name)
    }
    return { matched, unmatched: [...unmatched] }
  }
  return {
    drugs: { total: parsed.drugs.length },
    labs: check(parsed.labs.map((l) => ({ name: l.generic_name }))) as any,
    ddi: (() => {
      const names = new Set<string>()
      for (const d of parsed.ddi) {
        names.add(d.drug1_name)
        names.add(d.drug2_name)
      }
      let matched = 0
      const unmatched: string[] = []
      for (const n of names) {
        if (resolveIcode(n, resolver)) matched++
        else unmatched.push(n)
      }
      return { total: parsed.ddi.length, matched, unmatched }
    })(),
    clinical: check(parsed.clinical.map((c) => ({ name: c.generic_name }))) as any,
  }
}

// ============ Backup + Import + Restore ============
interface BackupItem {
  collection: string
  docId: string
  before: Record<string, unknown> | null  // null = ไม่มีของเดิม → restore = ลบ
}

export interface BackupHeader {
  id: string
  label: string
  createdAt: Date
  summary: {
    drugs: number
    labs: number
    ddi: number
    clinical: number
  }
  restoredAt?: Date | null
}

const BACKUPS_COL = 'IMPORT_BACKUPS'
const SNAPSHOTS_SUB = 'snapshots'

async function snapshotBefore(items: { collection: string; docId: string }[]): Promise<BackupItem[]> {
  const out: BackupItem[] = []
  // อ่านทีละตัว — Firestore ไม่มี batch get ใน web SDK
  for (const it of items) {
    const s = await getDoc(doc(db, it.collection, it.docId))
    out.push({ collection: it.collection, docId: it.docId, before: s.exists() ? s.data() : null })
  }
  return out
}

async function writeSnapshotsToBackup(backupId: string, items: BackupItem[]) {
  // batch write — 500 ops max ต่อ batch
  const CHUNK = 400
  for (let i = 0; i < items.length; i += CHUNK) {
    const batch = writeBatch(db)
    for (const it of items.slice(i, i + CHUNK)) {
      const ref = doc(db, BACKUPS_COL, backupId, SNAPSHOTS_SUB, `${it.collection}__${it.docId}`)
      batch.set(ref, {
        collection: it.collection,
        docId: it.docId,
        before: it.before,
      })
    }
    await batch.commit()
  }
}

export interface RunImportOptions {
  parsed: ParsedSeed
  existingDrugs: DrugMaster[]
  label: string
  /** progress callback */
  onProgress?: (msg: string) => void
}

export interface ImportResult {
  backupId: string
  drugsWritten: number
  labsWritten: number
  ddiWritten: number
  clinicalWritten: number
  labsSkipped: number
  ddiSkipped: number
  clinicalSkipped: number
}

/** Sanitize เพื่อกัน undefined ใน Firestore (Firestore ไม่รับ undefined) */
function clean<T extends Record<string, unknown>>(o: T): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of Object.keys(o)) {
    const v = o[k]
    if (v !== undefined) out[k] = v
  }
  return out
}

export async function runImport(opts: RunImportOptions): Promise<ImportResult> {
  const { parsed, existingDrugs, label, onProgress } = opts
  const log = (m: string) => { onProgress?.(m); console.log('[import]', m) }

  const backupId = `bk_${new Date().toISOString().replace(/[:.]/g, '-')}`
  log(`สร้าง backup id: ${backupId}`)

  // ===== 1) Drugs — upsert by icode =====
  const drugsMapped = parsed.drugs.map(rawDrugToFirestore)
  log(`กำลัง backup ${drugsMapped.length} drug docs...`)
  const drugSnapshots = await snapshotBefore(
    drugsMapped.map((d) => ({ collection: 'DRUG_MASTER', docId: d.icode })),
  )

  // ===== Build resolver จากทั้งของเดิม + ของใหม่ =====
  const projected = [...existingDrugs.map((d) => ({ ...d })), ...drugsMapped]
  // override duplicates: ของใหม่ทับของเดิมตาม icode
  const seen = new Set<string>()
  const dedup: DrugMaster[] = []
  for (let i = projected.length - 1; i >= 0; i--) {
    const d = projected[i]
    if (seen.has(d.icode)) continue
    seen.add(d.icode)
    dedup.push(d)
  }
  const resolver = buildResolver(dedup)

  // ===== 2) Labs — resolve generic_name → icode, gen rule id, upsert =====
  const labWrites: { docId: string; rule: LabRule }[] = []
  let labsSkipped = 0
  for (const r of parsed.labs) {
    const icode = resolveIcode(r.generic_name, resolver)
    if (!icode) { labsSkipped++; continue }
    const rule = rawLabToFirestore(r, icode)
    // id ที่ deterministic เพื่อให้ idempotent
    const idKey = `${icode}__${(r.lab_parameter ?? 'param').replace(/[^a-z0-9]/gi, '_')}__${(r.monitoring_type ?? 'pre')}`
    labWrites.push({ docId: idKey, rule })
  }
  log(`กำลัง backup ${labWrites.length} lab docs...`)
  const labSnapshots = await snapshotBefore(
    labWrites.map((w) => ({ collection: 'LAB_RULES', docId: w.docId })),
  )

  // ===== 3) DDI — resolve both names → icode pair, dedupe =====
  const ddiWrites: { docId: string; ddi: DdiOverride }[] = []
  let ddiSkipped = 0
  for (const r of parsed.ddi) {
    const a = resolveIcode(r.drug1_name, resolver)
    const b = resolveIcode(r.drug2_name, resolver)
    if (!a || !b || a === b) { ddiSkipped++; continue }
    const [x, y] = a < b ? [a, b] : [b, a]  // เรียงให้ pair stable
    const ddi = rawDdiToFirestore(r, x, y)
    ddiWrites.push({ docId: `${x}__${y}`, ddi })
  }
  log(`กำลัง backup ${ddiWrites.length} DDI docs...`)
  const ddiSnapshots = await snapshotBefore(
    ddiWrites.map((w) => ({ collection: 'DDI_OVERRIDE', docId: w.docId })),
  )

  // ===== 4) Clinical info — collection ใหม่ DRUG_CLINICAL_INFO =====
  const clinicalWrites: { docId: string; data: Record<string, unknown> }[] = []
  let clinicalSkipped = 0
  for (let i = 0; i < parsed.clinical.length; i++) {
    const c = parsed.clinical[i]
    const icode = resolveIcode(c.generic_name, resolver)
    if (!icode) { clinicalSkipped++; continue }
    const docId = `${icode}__${(c.info_type ?? 'info').replace(/[^a-z0-9]/gi, '_')}__${i}`
    clinicalWrites.push({
      docId,
      data: clean({
        icode,
        generic_name: c.generic_name,
        info_type: c.info_type,
        content: c.content,
        priority: c.priority,
      }),
    })
  }
  log(`กำลัง backup ${clinicalWrites.length} clinical docs...`)
  const clinicalSnapshots = await snapshotBefore(
    clinicalWrites.map((w) => ({ collection: 'DRUG_CLINICAL_INFO', docId: w.docId })),
  )

  // ===== เขียน backup header + snapshots =====
  await setDoc(doc(db, BACKUPS_COL, backupId), {
    id: backupId,
    label: label || backupId,
    createdAt: serverTimestamp(),
    summary: {
      drugs: drugSnapshots.length,
      labs: labSnapshots.length,
      ddi: ddiSnapshots.length,
      clinical: clinicalSnapshots.length,
    },
  })
  log('บันทึก backup header')

  const allSnaps = [...drugSnapshots, ...labSnapshots, ...ddiSnapshots, ...clinicalSnapshots]
  await writeSnapshotsToBackup(backupId, allSnaps)
  log(`บันทึก backup snapshots ${allSnaps.length} ตัว`)

  // ===== ลงข้อมูลจริง =====
  log('เริ่มเขียน DRUG_MASTER...')
  for (let i = 0; i < drugsMapped.length; i += 400) {
    const batch = writeBatch(db)
    for (const d of drugsMapped.slice(i, i + 400)) {
      batch.set(doc(db, 'DRUG_MASTER', d.icode), { ...clean(d as any), updatedAt: serverTimestamp() }, { merge: true })
    }
    await batch.commit()
  }
  log(`✓ DRUG_MASTER ${drugsMapped.length} rows`)

  log('เริ่มเขียน LAB_RULES...')
  for (let i = 0; i < labWrites.length; i += 400) {
    const batch = writeBatch(db)
    for (const w of labWrites.slice(i, i + 400)) {
      batch.set(doc(db, 'LAB_RULES', w.docId), { ...clean(w.rule as any), updatedAt: serverTimestamp() }, { merge: true })
    }
    await batch.commit()
  }
  log(`✓ LAB_RULES ${labWrites.length} rows (skip ${labsSkipped} ที่ map icode ไม่ได้)`)

  log('เริ่มเขียน DDI_OVERRIDE...')
  for (let i = 0; i < ddiWrites.length; i += 400) {
    const batch = writeBatch(db)
    for (const w of ddiWrites.slice(i, i + 400)) {
      batch.set(doc(db, 'DDI_OVERRIDE', w.docId), { ...clean(w.ddi as any), updatedAt: serverTimestamp() }, { merge: true })
    }
    await batch.commit()
  }
  log(`✓ DDI_OVERRIDE ${ddiWrites.length} rows (skip ${ddiSkipped})`)

  log('เริ่มเขียน DRUG_CLINICAL_INFO...')
  for (let i = 0; i < clinicalWrites.length; i += 400) {
    const batch = writeBatch(db)
    for (const w of clinicalWrites.slice(i, i + 400)) {
      batch.set(doc(db, 'DRUG_CLINICAL_INFO', w.docId), { ...w.data, updatedAt: serverTimestamp() }, { merge: true })
    }
    await batch.commit()
  }
  log(`✓ DRUG_CLINICAL_INFO ${clinicalWrites.length} rows (skip ${clinicalSkipped})`)

  return {
    backupId,
    drugsWritten: drugsMapped.length,
    labsWritten: labWrites.length,
    ddiWritten: ddiWrites.length,
    clinicalWritten: clinicalWrites.length,
    labsSkipped, ddiSkipped, clinicalSkipped,
  }
}

// ============ List + Restore ============
export async function listBackups(): Promise<BackupHeader[]> {
  const snap = await getDocs(query(collection(db, BACKUPS_COL), orderBy('createdAt', 'desc')))
  return snap.docs.map((d) => {
    const data = d.data() as {
      id: string
      label: string
      createdAt?: Timestamp
      restoredAt?: Timestamp
      summary: BackupHeader['summary']
    }
    return {
      id: data.id ?? d.id,
      label: data.label,
      createdAt: data.createdAt?.toDate() ?? new Date(0),
      summary: data.summary,
      restoredAt: data.restoredAt?.toDate() ?? null,
    }
  })
}

export async function restoreBackup(
  backupId: string,
  onProgress?: (msg: string) => void,
): Promise<{ restored: number; deleted: number }> {
  const log = (m: string) => { onProgress?.(m); console.log('[restore]', m) }
  log(`อ่าน snapshots ของ ${backupId}...`)
  const snap = await getDocs(collection(db, BACKUPS_COL, backupId, SNAPSHOTS_SUB))
  const items = snap.docs.map((d) => d.data() as BackupItem)
  log(`พบ ${items.length} snapshot — กำลังกู้คืน`)
  let restored = 0
  let deleted = 0
  for (let i = 0; i < items.length; i += 400) {
    const batch = writeBatch(db)
    for (const it of items.slice(i, i + 400)) {
      const ref = doc(db, it.collection, it.docId)
      if (it.before === null) {
        batch.delete(ref); deleted++
      } else {
        batch.set(ref, it.before); restored++
      }
    }
    await batch.commit()
  }
  await setDoc(doc(db, BACKUPS_COL, backupId), { restoredAt: serverTimestamp() }, { merge: true })
  log(`✓ คืน ${restored} ตัว, ลบ ${deleted} ตัว`)
  return { restored, deleted }
}

export async function deleteBackup(backupId: string): Promise<void> {
  const snap = await getDocs(collection(db, BACKUPS_COL, backupId, SNAPSHOTS_SUB))
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = writeBatch(db)
    for (const d of snap.docs.slice(i, i + 400)) batch.delete(d.ref)
    await batch.commit()
  }
  await deleteDoc(doc(db, BACKUPS_COL, backupId))
}
