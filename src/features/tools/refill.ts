import { collection, query, where, orderBy, limit as fbLimit, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { DispensingLog } from '@/types/drug'

export interface DrugRefillInfo {
  icode: string
  drug_name: string
  dispensed: { date: Date; daysSupply?: number }[]
  totalDispenses: number
  lastDate?: Date
  firstDate?: Date
  /** MPR = days supply ที่ได้รับ / จำนวนวันทั้งหมด */
  mpr?: number
  /** Status */
  status: 'unknown' | 'compliant' | 'over_supply' | 'under_supply'
}

/** ดึงประวัติยาของ HN + คำนวณ refill pattern */
export async function getPatientRefillHistory(hn: string, daysWindow = 365): Promise<DrugRefillInfo[]> {
  const q = query(
    collection(db, 'DISPENSING_LOG'),
    where('hn', '==', hn.trim()),
    orderBy('createdAt', 'desc'),
    fbLimit(200),
  )
  const snap = await getDocs(q)
  const logs = snap.docs.map((d) => {
    const data = d.data()
    return { id: d.id, ...data, createdAt: data.createdAt?.toDate?.() ?? new Date() } as DispensingLog
  })

  const cutoff = new Date(Date.now() - daysWindow * 24 * 60 * 60 * 1000)
  const recent = logs.filter((l) => l.createdAt >= cutoff)

  const map = new Map<string, DrugRefillInfo>()
  for (const log of recent) {
    for (const dr of log.drugs ?? []) {
      const ex = map.get(dr.icode) ?? {
        icode: dr.icode,
        drug_name: dr.drug_name,
        dispensed: [],
        totalDispenses: 0,
        status: 'unknown' as const,
      }
      ex.dispensed.push({ date: log.createdAt })
      ex.totalDispenses++
      map.set(dr.icode, ex)
    }
  }

  for (const info of map.values()) {
    info.dispensed.sort((a, b) => a.date.getTime() - b.date.getTime())
    info.firstDate = info.dispensed[0]?.date
    info.lastDate = info.dispensed[info.dispensed.length - 1]?.date
    // ประเมิน MPR แบบหยาบ: สมมติแต่ละ refill = 30 วัน supply
    if (info.firstDate && info.lastDate) {
      const totalDays = Math.max(1, Math.round((info.lastDate.getTime() - info.firstDate.getTime()) / (86400000)))
      const supplied = info.totalDispenses * 30
      info.mpr = +(supplied / totalDays).toFixed(2)
      if (info.mpr > 1.2) info.status = 'over_supply'
      else if (info.mpr < 0.8) info.status = 'under_supply'
      else info.status = 'compliant'
    }
  }

  return [...map.values()].sort((a, b) => (b.lastDate?.getTime() ?? 0) - (a.lastDate?.getTime() ?? 0))
}
