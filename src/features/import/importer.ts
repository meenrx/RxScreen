import { writeBatch, doc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { fetchSheetCsv, toBool, toNumber } from './csv'

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
        severity: (r.severity || 'moderate').toLowerCase(),
        local_note: r.local_note,
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
