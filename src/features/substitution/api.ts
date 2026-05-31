import {
  collection, doc, getDocs, setDoc, deleteDoc, query, where, orderBy, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { DrugSubstitution } from '@/types/drug'

/**
 * แปลงลิงก์รูปให้แสดงใน <img> ได้ — รองรับ Google Drive share link
 * (ต้องตั้งแชร์ไฟล์เป็น "ทุกคนที่มีลิงก์ดูได้")
 */
export function toDisplayImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  const u = url.trim()
  if (u.includes('drive.google.com')) {
    const m = u.match(/(?:\/file\/d\/|[?&]id=|\/d\/)([A-Za-z0-9_-]{20,})/)
    if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1000`
  }
  return u
}

const COLL = 'DRUG_SUBSTITUTION'

function toDate(v: unknown): Date | undefined {
  const x = v as { toDate?: () => Date } | undefined
  return x?.toDate?.()
}

function mapDoc(id: string, data: Record<string, unknown>): DrugSubstitution {
  return { id, ...(data as object), createdAt: toDate(data.createdAt), updatedAt: toDate(data.updatedAt) } as DrugSubstitution
}

export async function listSubstitutions(): Promise<DrugSubstitution[]> {
  const snap = await getDocs(query(collection(db, COLL), orderBy('updatedAt', 'desc')))
  return snap.docs.map((d) => mapDoc(d.id, d.data()))
}

/** เฉพาะที่ active — ใช้ตอนคัดกรอง */
export async function listActiveSubstitutions(): Promise<DrugSubstitution[]> {
  const snap = await getDocs(query(collection(db, COLL), where('active', '==', true)))
  return snap.docs.map((d) => mapDoc(d.id, d.data()))
}

function clean(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === '') continue
    out[k] = v
  }
  return out
}

export async function saveSubstitution(s: DrugSubstitution): Promise<string> {
  const id = s.id ?? s.icode
  const { id: _omit, createdAt: _c, updatedAt: _u, ...rest } = s
  await setDoc(
    doc(db, COLL, id),
    { ...clean(rest as Record<string, unknown>), active: s.active ?? true, updatedAt: serverTimestamp(), createdAt: serverTimestamp() },
    { merge: true },
  )
  return id
}

export async function deleteSubstitution(s: DrugSubstitution): Promise<void> {
  await deleteDoc(doc(db, COLL, s.id ?? s.icode))
}
