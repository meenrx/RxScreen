import { create } from 'zustand'
import type { DrugEntry, PatientInput } from '@/types/screening'

interface ScreeningState {
  patient: PatientInput
  drugs: DrugEntry[]
  aiText: string
  /** dirty = มีการเปลี่ยนแปลงหลัง save ล่าสุด → ต้อง save ก่อน reset */
  dirty: boolean
  /** id ใน DISPENSING_LOG ของ session ปัจจุบัน (ถ้าเคย save) */
  savedLogId: string | null

  setPatient: (p: PatientInput) => void
  setDrugs: (d: DrugEntry[]) => void
  setAiText: (s: string) => void
  markSaved: (id: string) => void
  reset: () => void
}

export const useScreeningStore = create<ScreeningState>((set) => ({
  patient: {},
  drugs: [],
  aiText: '',
  dirty: false,
  savedLogId: null,

  setPatient: (p) => set({ patient: p, dirty: true }),
  setDrugs: (d) => set({ drugs: d, dirty: true }),
  setAiText: (s) => set({ aiText: s, dirty: true }),
  markSaved: (id) => set({ dirty: false, savedLogId: id }),
  reset: () => set({ patient: {}, drugs: [], aiText: '', dirty: false, savedLogId: null }),
}))
