import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from './api'
import type { DrugSubstitution } from '@/types/drug'
import { toast } from 'sonner'

export function useSubstitutions() {
  return useQuery({ queryKey: ['substitutions'], queryFn: api.listSubstitutions })
}

export function useActiveSubstitutions() {
  return useQuery({ queryKey: ['substitutions', 'active'], queryFn: api.listActiveSubstitutions })
}

export function useSaveSubstitution() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (s: DrugSubstitution) => api.saveSubstitution(s),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['substitutions'] })
      toast.success('บันทึกการเปลี่ยนบริษัทยาเรียบร้อย')
    },
    onError: (e) => toast.error('บันทึกไม่สำเร็จ: ' + (e as Error).message),
  })
}

export function useDeleteSubstitution() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (s: DrugSubstitution) => api.deleteSubstitution(s),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['substitutions'] })
      toast.success('ลบเรียบร้อย')
    },
    onError: (e) => toast.error('ลบไม่สำเร็จ: ' + (e as Error).message),
  })
}
