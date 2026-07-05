// ปิดเตือน "กรณีที่เภสัชพิจารณาว่าไม่ใช่ปัญหา" (เช่น oxytocin/misoprostol ในคนไข้เร่งคลอด)
// คีย์ = ชนิด alert + ยา (icode) ที่เกี่ยว → เข้าเกณฑ์เดียวกันจะถูกซ่อนทุกครั้ง · เก็บใน Firestore (un-mute ได้)
import { collection, getDocs, setDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useQuery } from '@tanstack/react-query'
import type { ScreeningAlert } from '@/types/screening'

export interface AlertMute {
  id: string          // = muteKey
  type: string        // ชนิด alert
  drugs: string[]     // icode ที่เกี่ยว
  label: string       // ตัวอย่างหัวข้อ (ตอนกดปิด) — ไว้แสดงในจัดการฐานข้อมูล
  note?: string
  createdBy?: string
  createdAt?: unknown
}

/** ระบุ "กรณีแบบเดียวกัน" = ชนิด alert + ชุดยา (icode) */
export function muteKey(a: ScreeningAlert): string {
  return `${a.type}|${[...(a.drugs ?? [])].sort().join(',')}`
}

export async function listMutes(): Promise<AlertMute[]> {
  const snap = await getDocs(collection(db, 'ALERT_MUTES'))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AlertMute, 'id'>) }))
}
export async function addMute(m: Pick<AlertMute, 'id' | 'type' | 'drugs' | 'label' | 'note'>, uid?: string): Promise<void> {
  await setDoc(doc(db, 'ALERT_MUTES', m.id), {
    type: m.type, drugs: m.drugs, label: m.label, note: m.note ?? '', createdBy: uid ?? '', createdAt: serverTimestamp(),
  })
}
export async function removeMute(id: string): Promise<void> {
  await deleteDoc(doc(db, 'ALERT_MUTES', id))
}

export function useMutes() {
  return useQuery({ queryKey: ['alert-mutes'], queryFn: listMutes, staleTime: 60_000 })
}

/** กรอง alert ที่ถูกปิดเตือนออก */
export function filterMuted(alerts: ScreeningAlert[], mutedIds: Set<string>): ScreeningAlert[] {
  return alerts.filter((a) => !mutedIds.has(muteKey(a)))
}
