import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  increment,
  arrayUnion,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Intervention, InterventionEvent } from '@/types/drug'

const COLL = 'INTERVENTION'

/** doc id = hn + icode (unique ต่อผู้ป่วย+ยา) — sanitize ให้ปลอดภัย */
export function interventionId(hn: string, icode: string): string {
  return `${hn}__${icode}`.replace(/[^a-zA-Z0-9ก-๙_]/g, '_')
}

function toDate(v: unknown): Date {
  const x = v as { toDate?: () => Date } | undefined
  return x?.toDate?.() ?? new Date()
}

function mapDoc(id: string, data: Record<string, unknown>): Intervention {
  return {
    id,
    ...(data as object),
    createdAt: toDate(data.createdAt),
    updatedAt: data.updatedAt ? toDate(data.updatedAt) : undefined,
  } as Intervention
}

/** สร้าง/อัปเดต intervention (mark off หรือ switched) */
export async function saveIntervention(
  input: Omit<Intervention, 'id' | 'createdAt' | 'reorder_count' | 'total_qty' | 'total_saved' | 'events'>,
): Promise<string> {
  const id = interventionId(input.hn, input.icode)
  const ref = doc(db, COLL, id)
  const snap = await getDoc(ref)
  const base: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined || v === '') continue
    base[k] = v
  }
  if (snap.exists()) {
    // คงยอดสะสมเดิม แค่ปรับสถานะ/เหตุผล
    await updateDoc(ref, { ...base, updatedAt: serverTimestamp() })
  } else {
    await setDoc(ref, {
      ...base,
      reorder_count: 0,
      total_qty: 0,
      total_saved: 0,
      events: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }
  return id
}

/** บันทึกว่าหมอสั่งซ้ำรอบนี้กี่หน่วย → สะสมมูลค่าประหยัด */
export async function logReorderSaving(params: {
  hn: string
  icode: string
  qty: number
  unitCost: number
  pharmacistName?: string
}): Promise<number> {
  const { hn, icode, qty, unitCost, pharmacistName } = params
  const id = interventionId(hn, icode)
  const saved = qty * unitCost
  const event: InterventionEvent = {
    date: new Date().toISOString(),
    qty,
    saved,
    ...(pharmacistName ? { pharmacist_name: pharmacistName } : {}),
  }
  await updateDoc(doc(db, COLL, id), {
    reorder_count: increment(1),
    total_qty: increment(qty),
    total_saved: increment(saved),
    events: arrayUnion(event),
    updatedAt: serverTimestamp(),
  })
  return saved
}

export async function getIntervention(hn: string, icode: string): Promise<Intervention | null> {
  const snap = await getDoc(doc(db, COLL, interventionId(hn, icode)))
  if (!snap.exists()) return null
  return mapDoc(snap.id, snap.data())
}

/** intervention ทั้งหมด (สำหรับ Dashboard) */
export async function listInterventions(): Promise<Intervention[]> {
  const snap = await getDocs(query(collection(db, COLL), orderBy('updatedAt', 'desc')))
  return snap.docs.map((d) => mapDoc(d.id, d.data()))
}

/** intervention ของผู้ป่วยรายนี้ (เพื่อเช็คตอนคัดกรอง) */
export async function listInterventionsByHn(hn: string): Promise<Intervention[]> {
  const snap = await getDocs(query(collection(db, COLL), where('hn', '==', hn)))
  return snap.docs.map((d) => mapDoc(d.id, d.data()))
}

export async function deleteIntervention(id: string): Promise<void> {
  await deleteDoc(doc(db, COLL, id))
}
