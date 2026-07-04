import { collection, query, where, orderBy, limit as fbLimit, getDocs, addDoc, setDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { DispensingLog } from '@/types/drug'

/** ลบค่า undefined แบบ recursive (รวม array + nested object) — Firestore ไม่รับ undefined */
function deepStripUndefined(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => deepStripUndefined(v))
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue
      out[k] = deepStripUndefined(v)
    }
    return out
  }
  return value
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return deepStripUndefined(obj) as Partial<T>
}

export async function logDispensing(entry: Omit<DispensingLog, 'id' | 'createdAt'>) {
  return addDoc(collection(db, 'DISPENSING_LOG'), {
    ...stripUndefined(entry as unknown as Record<string, unknown>),
    createdAt: serverTimestamp(),
  })
}

/** อัปเดต log เดิม (เช่น เมื่อเภสัชปรับผล ME/หมายเหตุ หลังบันทึกอัตโนมัติแล้ว) */
export async function updateDispensing(id: string, patch: Partial<DispensingLog>) {
  await setDoc(doc(db, 'DISPENSING_LOG', id), stripUndefined(patch as unknown as Record<string, unknown>), { merge: true })
}

export async function listMyHistory(uid: string, limit = 50): Promise<DispensingLog[]> {
  const q = query(
    collection(db, 'DISPENSING_LOG'),
    where('pharmacist_uid', '==', uid),
    orderBy('createdAt', 'desc'),
    fbLimit(limit),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      ...data,
      createdAt: data.createdAt?.toDate?.() ?? new Date(),
    } as DispensingLog
  })
}

export async function listAllHistory(limit = 100): Promise<DispensingLog[]> {
  const q = query(collection(db, 'DISPENSING_LOG'), orderBy('createdAt', 'desc'), fbLimit(limit))
  const snap = await getDocs(q)
  return snap.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      ...data,
      createdAt: data.createdAt?.toDate?.() ?? new Date(),
    } as DispensingLog
  })
}
