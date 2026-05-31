import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from './api'
import type { DrugMaster, LabRule, DdiOverride, DrugCounseling, DiseaseRule, HadRule } from '@/types/drug'
import { toast } from 'sonner'

export function useDrugs() {
  return useQuery({ queryKey: ['drugs'], queryFn: api.listDrugs })
}

export function useLabRules() {
  return useQuery({ queryKey: ['lab-rules'], queryFn: api.listLabRules })
}

export function useDdiOverrides() {
  return useQuery({ queryKey: ['ddi'], queryFn: api.listDdiOverrides })
}

export function useCounseling() {
  return useQuery({ queryKey: ['counseling'], queryFn: api.listCounseling })
}

export function useDiseaseRules() {
  return useQuery({ queryKey: ['disease'], queryFn: api.listDiseaseRules })
}

export function useSaveDrug() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (d: DrugMaster) => api.saveDrug(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['drugs'] })
      toast.success('บันทึกยาเรียบร้อย')
    },
    onError: (e) => toast.error('บันทึกไม่สำเร็จ: ' + (e as Error).message),
  })
}

export function useSaveLabRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (r: LabRule) => api.saveLabRule(r),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lab-rules'] })
      toast.success('บันทึกกฎ Lab เรียบร้อย')
    },
    onError: (e) => toast.error('บันทึกไม่สำเร็จ: ' + (e as Error).message),
  })
}

export function useSaveDdi() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (d: DdiOverride) => api.saveDdiOverride(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ddi'] })
      toast.success('บันทึก DDI เรียบร้อย')
    },
    onError: (e) => toast.error('บันทึกไม่สำเร็จ: ' + (e as Error).message),
  })
}

export function useSaveCounseling() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (c: DrugCounseling) => api.saveCounseling(c),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['counseling'] })
      toast.success('บันทึก Counseling เรียบร้อย')
    },
    onError: (e) => toast.error('บันทึกไม่สำเร็จ: ' + (e as Error).message),
  })
}

export function useSaveDiseaseRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (r: DiseaseRule) => api.saveDiseaseRule(r),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['disease'] })
      toast.success('บันทึก Disease rule เรียบร้อย')
    },
    onError: (e) => toast.error('บันทึกไม่สำเร็จ: ' + (e as Error).message),
  })
}

export function useHadRules() {
  return useQuery({ queryKey: ['had'], queryFn: api.listHadRules })
}

export function useSaveHadRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (h: HadRule) => api.saveHadRule(h),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['had'] })
      toast.success('บันทึก HAD rule เรียบร้อย')
    },
    onError: (e) => toast.error('บันทึกไม่สำเร็จ: ' + (e as Error).message),
  })
}

export function useDelete(kind: 'drug' | 'lab' | 'ddi' | 'counseling' | 'disease' | 'had') {
  const qc = useQueryClient()
  const fn = {
    drug: api.deleteDrug,
    lab: api.deleteLabRule,
    ddi: api.deleteDdiOverride,
    counseling: api.deleteCounseling,
    disease: api.deleteDiseaseRule,
    had: api.deleteHadRule,
  }[kind]
  const keyMap = { drug: 'drugs', lab: 'lab-rules', ddi: 'ddi', counseling: 'counseling', disease: 'disease', had: 'had' }
  return useMutation({
    mutationFn: (id: string) => fn(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [keyMap[kind]] })
      toast.success('ลบเรียบร้อย')
    },
    onError: (e) => toast.error('ลบไม่สำเร็จ: ' + (e as Error).message),
  })
}
