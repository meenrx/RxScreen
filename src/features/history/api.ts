import { collection, query, where, orderBy, limit as fbLimit, getDocs, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { DispensingLog } from '@/types/drug'

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue
    (out as Record<string, unknown>)[k] = v
  }
  return out
}

export async function logDispensing(entry: Omit<DispensingLog, 'id' | 'createdAt'>) {
  return addDoc(collection(db, 'DISPENSING_LOG'), {
    ...stripUndefined(entry as unknown as Record<string, unknown>),
    createdAt: serverTimestamp(),
  })
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
