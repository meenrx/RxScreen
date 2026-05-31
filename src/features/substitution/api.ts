import {
  collection, doc, getDocs, setDoc, deleteDoc, query, where, orderBy, serverTimestamp,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from '@/lib/firebase'
import type { DrugSubstitution } from '@/types/drug'

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

/** อัปโหลดรูป → คืน download URL */
export async function uploadSubstitutionImage(icode: string, kind: 'before' | 'after', file: File): Promise<string> {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `substitution/${icode}/${kind}_${safe}`
  const r = ref(storage, path)
  await uploadBytes(r, file)
  return getDownloadURL(r)
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
  // ลบรูปใน Storage ด้วย (ถ้ามี) — ไม่ให้ error ถ้าลบไม่ได้
  for (const url of [s.before_image, s.after_image]) {
    if (!url) continue
    try { await deleteObject(ref(storage, url)) } catch { /* ignore */ }
  }
  await deleteDoc(doc(db, COLL, s.id ?? s.icode))
}
