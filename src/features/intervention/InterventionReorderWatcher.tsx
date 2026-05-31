import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useAuthStore } from '@/features/auth/authStore'
import type { DrugEntry, PatientInput } from '@/types/screening'
import type { Intervention } from '@/types/drug'
import { useInterventionsByHn, useLogReorderSaving } from './hooks'
import { InterventionReorderDialog } from './InterventionReorderDialog'

/**
 * เฝ้าดูว่ายาในใบสั่งรอบนี้ มีตัวใดที่เคยบันทึก intervention (off/เปลี่ยน) ของ HN นี้ไว้
 * ถ้ามี → เด้ง popup ถามจำนวนที่หมอสั่ง เพื่อคำนวณมูลค่าประหยัด
 * ต้อง mount แยกจาก section ที่ collapse ได้ เพื่อให้ popup เด้งอัตโนมัติเสมอ
 */
export function InterventionReorderWatcher({ drugs, patient }: { drugs: DrugEntry[]; patient: PatientInput }) {
  const hn = patient.hn?.trim()
  const user = useAuthStore((s) => s.user)
  const { data: existing = [] } = useInterventionsByHn(hn)
  const reorderMut = useLogReorderSaving()

  const reorderTargets = useMemo(() => {
    const byIcode = new Map(existing.map((i) => [i.icode, i]))
    return drugs.map((d) => byIcode.get(d.icode)).filter((i): i is Intervention => !!i)
  }, [existing, drugs])

  const [handled, setHandled] = useState<Set<string>>(new Set())
  useEffect(() => { setHandled(new Set()) }, [hn])

  const pending = reorderTargets.filter((i) => !handled.has(i.icode))
  const currentTarget = pending[0] ?? null

  function finishTarget(icode: string) {
    setHandled((p) => new Set(p).add(icode))
  }

  async function confirmReorder(qty: number) {
    if (!currentTarget || !hn) return
    const saved = await reorderMut.mutateAsync({
      hn,
      icode: currentTarget.icode,
      qty,
      unitCost: currentTarget.unit_cost ?? 0,
      pharmacistName: user?.displayName,
    })
    toast.success(`บันทึกประหยัด ${saved.toLocaleString()} บาท (${currentTarget.drug_name})`)
    finishTarget(currentTarget.icode)
  }

  return (
    <InterventionReorderDialog
      open={!!currentTarget}
      intervention={currentTarget}
      onConfirm={confirmReorder}
      onSkip={() => currentTarget && finishTarget(currentTarget.icode)}
    />
  )
}
