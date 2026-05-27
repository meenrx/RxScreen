import { useMemo } from 'react'
import { useDrugs, useLabRules, useDdiOverrides, useDiseaseRules } from '@/features/catalog/hooks'

/** Wrapper hook ที่ดึงข้อมูลที่ screening engine ต้องใช้ */
export function useScreeningData() {
  const drugs = useDrugs()
  const labRules = useLabRules()
  const ddi = useDdiOverrides()
  const diseases = useDiseaseRules()

  const isLoading = drugs.isLoading || labRules.isLoading || ddi.isLoading || diseases.isLoading
  const error = drugs.error ?? labRules.error ?? ddi.error ?? diseases.error

  const data = useMemo(() => ({
    drugMasters: drugs.data ?? [],
    labRules: labRules.data ?? [],
    ddiList: ddi.data ?? [],
    diseaseRules: diseases.data ?? [],
  }), [drugs.data, labRules.data, ddi.data, diseases.data])

  return { ...data, isLoading, error }
}
