import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { WarfarinInrProtocol, WarfarinTwdTable } from '@/types/drug'

export async function listInrProtocol(): Promise<WarfarinInrProtocol[]> {
  try {
    const snap = await getDocs(collection(db, 'WARFARIN_INR_PROTOCOL'))
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as WarfarinInrProtocol) }))
      .sort((a, b) => (a.inr_min ?? 0) - (b.inr_min ?? 0))
  } catch (e) {
    console.error('listInrProtocol failed:', e)
    return []
  }
}

export async function listTwdTable(): Promise<WarfarinTwdTable[]> {
  try {
    const snap = await getDocs(collection(db, 'WARFARIN_TWD_TABLE'))
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as WarfarinTwdTable) }))
      .sort((a, b) => {
        const s = (a.strength_mg ?? 0) - (b.strength_mg ?? 0)
        return s !== 0 ? s : (a.twd_mg ?? 0) - (b.twd_mg ?? 0)
      })
  } catch (e) {
    console.error('listTwdTable failed:', e)
    return []
  }
}

export interface AdjustResult {
  rule?: WarfarinInrProtocol
  action: string
  adjustPct: number
  newTwd: number
  schedule?: WarfarinTwdTable
  closestSchedules: WarfarinTwdTable[]
  note: string
  vitK: string
}

export function adjustWarfarin(
  inr: number,
  currentTwd: number,
  strength: number,
  protocol: WarfarinInrProtocol[],
  twdTable: WarfarinTwdTable[],
): AdjustResult {
  const rule = protocol.find((r) => inr >= r.inr_min && inr <= r.inr_max)
  const adjustPct = rule?.adjust_pct ?? 0
  let newTwd = currentTwd
  if (rule?.action === 'increase') newTwd = currentTwd * (1 + adjustPct / 100)
  else if (rule?.action === 'decrease') newTwd = currentTwd * (1 - adjustPct / 100)
  else if (rule?.action === 'hold_1d' || rule?.action === 'omit_vitk') {
    newTwd = currentTwd * (1 + adjustPct / 100)
  }

  const sameStrength = twdTable.filter((t) => Math.abs((t.strength_mg ?? 0) - strength) < 0.01)
  const sortedByDiff = [...sameStrength].sort((a, b) => Math.abs((a.twd_mg ?? 0) - newTwd) - Math.abs((b.twd_mg ?? 0) - newTwd))
  const closest = sortedByDiff.slice(0, 3)

  return {
    rule,
    action: rule?.action ?? 'maintain',
    adjustPct,
    newTwd: +newTwd.toFixed(1),
    schedule: closest[0],
    closestSchedules: closest,
    note: rule?.note ?? '',
    vitK: rule?.vit_k ?? '',
  }
}
