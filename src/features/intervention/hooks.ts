import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from './api'
import type { Intervention } from '@/types/drug'
import { toast } from 'sonner'

/** intervention ทั้งหมด (Dashboard) */
export function useInterventions() {
  return useQuery({ queryKey: ['interventions'], queryFn: api.listInterventions })
}

/** intervention ของผู้ป่วยรายหนึ่ง — เปิด query เมื่อมี hn */
export function useInterventionsByHn(hn: string | undefined) {
  return useQuery({
    queryKey: ['interventions', 'hn', hn],
    queryFn: () => api.listInterventionsByHn(hn as string),
    enabled: !!hn && hn.trim() !== '',
  })
}

export function useSaveIntervention() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (i: Parameters<typeof api.saveIntervention>[0]) => api.saveIntervention(i),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['interventions'] })
      toast.success('บันทึก intervention เรียบร้อย')
    },
    onError: (e) => toast.error('บันทึกไม่สำเร็จ: ' + (e as Error).message),
  })
}

export function useLogReorderSaving() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: Parameters<typeof api.logReorderSaving>[0]) => api.logReorderSaving(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['interventions'] })
    },
    onError: (e) => toast.error('บันทึกมูลค่าประหยัดไม่สำเร็จ: ' + (e as Error).message),
  })
}

export function useDeleteIntervention() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteIntervention(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['interventions'] })
      toast.success('ลบ intervention เรียบร้อย')
    },
    onError: (e) => toast.error('ลบไม่สำเร็จ: ' + (e as Error).message),
  })
}

/** รวมยอดมูลค่าประหยัดทั้งหมด */
export function sumSaved(list: Intervention[]): number {
  return list.reduce((s, i) => s + (i.total_saved ?? 0), 0)
}
