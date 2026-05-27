import { useEffect, useMemo } from 'react'
import { Stethoscope, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useDiseaseRules } from '@/features/catalog/hooks'
import { extractLabFields, matchScreeningRules, type DiseaseRuleHit } from './diseaseScreening'

interface Props {
  /** เลือกหลายโรคได้ */
  selectedKeys: string[]
  onSelectedChange: (keys: string[]) => void
  /** ค่า lab ที่ผู้ใช้กรอก */
  labValues: Record<string, number | undefined>
  onLabValuesChange: (v: Record<string, number | undefined>) => void
}

export function DiseaseScreeningPanel({ selectedKeys, onSelectedChange, labValues, onLabValuesChange }: Props) {
  const { data: diseases = [] } = useDiseaseRules()
  const selectedDiseases = useMemo(() => diseases.filter((d) => selectedKeys.includes(d.disease_key ?? d.disease)), [diseases, selectedKeys])

  // รวม lab fields จากทุกโรคที่เลือก
  const allRequired = useMemo(() => {
    const set = new Set<string>()
    selectedDiseases.forEach((d) => extractLabFields(d).required.forEach((r) => set.add(r)))
    return [...set]
  }, [selectedDiseases])
  const allOptional = useMemo(() => {
    const set = new Set<string>()
    selectedDiseases.forEach((d) => extractLabFields(d).optional.forEach((r) => set.add(r)))
    return [...set]
  }, [selectedDiseases])

  // Match rules → แสดงผล
  const hitsByDisease = useMemo(() => {
    return selectedDiseases.map((d) => ({
      disease: d,
      hits: matchScreeningRules(d.screening_notes, labValues),
    }))
  }, [selectedDiseases, labValues])

  function toggleDisease(key: string) {
    if (selectedKeys.includes(key)) onSelectedChange(selectedKeys.filter((x) => x !== key))
    else onSelectedChange([...selectedKeys, key])
  }

  function setLab(name: string, v: string) {
    const next = { ...labValues }
    if (!v) delete next[name]
    else next[name] = parseFloat(v)
    onLabValuesChange(next)
  }

  return (
    <div className="space-y-4">
      {/* Disease selector */}
      <Card className="soft-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="size-8 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 text-white grid place-items-center">
              <Stethoscope className="size-4" />
            </span>
            เลือกโรค
          </CardTitle>
          <CardDescription>เลือก 1 หรือมากกว่า — ระบบจะแสดง lab ที่ต้องดู</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {diseases.map((d) => {
              const key = d.disease_key ?? d.disease
              const active = selectedKeys.includes(key)
              return (
                <button
                  key={d.id ?? key}
                  type="button"
                  onClick={() => toggleDisease(key)}
                  className={cn(
                    'px-3 py-2 rounded-xl border text-sm transition font-medium',
                    active
                      ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white border-transparent shadow-md'
                      : 'border-input hover:bg-accent',
                  )}
                >
                  {active && '✓ '}{d.display_name ?? key}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Lab inputs */}
      {selectedDiseases.length > 0 && (allRequired.length > 0 || allOptional.length > 0) && (
        <Card className="soft-card">
          <CardHeader>
            <CardTitle>ค่าที่ระบบขอ</CardTitle>
            <CardDescription>กรอกค่า lab → ระบบเปรียบเทียบกับเกณฑ์ในฐานข้อมูล</CardDescription>
          </CardHeader>
          <CardContent>
            {allRequired.length > 0 && (
              <div className="mb-3">
                <Label className="text-xs uppercase tracking-wider text-amber-700 dark:text-amber-300 font-semibold">ค่าที่ต้องการ</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1.5">
                  {allRequired.map((p) => (
                    <div key={p}>
                      <Label className="mb-1 text-sm">{p}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        value={labValues[p] ?? ''}
                        onChange={(e) => setLab(p, e.target.value)}
                        className={cn('h-11 text-lg', labValues[p] === undefined && 'required-input')}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {allOptional.length > 0 && (
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">ค่าเสริม (ไม่บังคับ)</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1.5">
                  {allOptional.map((p) => (
                    <div key={p}>
                      <Label className="mb-1 text-sm">{p}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        value={labValues[p] ?? ''}
                        onChange={(e) => setLab(p, e.target.value)}
                        className="h-11 text-lg"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Results per disease */}
      {hitsByDisease.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xl font-bold flex items-center gap-2">📊 ผลคัดกรองตามโรค</h2>
          {hitsByDisease.map(({ disease, hits }) => (
            <Card key={disease.id ?? disease.disease_key}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {hits.length === 0 ? (
                    <CheckCircle2 className="size-5 text-emerald-600" />
                  ) : hits.some((h) => h.severity === 'red') ? (
                    <AlertTriangle className="size-5 text-red-600" />
                  ) : (
                    <AlertTriangle className="size-5 text-orange-600" />
                  )}
                  {disease.display_name ?? disease.disease_key}
                  <Badge variant={hits.length > 0 ? 'orange' : 'green'} className="ml-auto">{hits.length} hits</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {hits.length === 0 && <p className="text-sm text-muted-foreground italic">ไม่พบเงื่อนไขที่ตรงกับค่า lab — หรือยังกรอกไม่ครบ</p>}
                {hits.map((h, i) => (
                  <HitRow key={i} hit={h} />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function HitRow({ hit }: { hit: DiseaseRuleHit }) {
  return (
    <div className={`rounded-xl border p-3 alert-${hit.severity}`}>
      <div className="flex items-start gap-2">
        <Badge variant={hit.severity}>{hit.condition}</Badge>
        <div className="text-sm flex-1">{hit.action}</div>
      </div>
    </div>
  )
}

/** Hook สำหรับใช้งานนอก component */
export function useDiseaseLabRequired(selectedKeys: string[]) {
  const { data: diseases = [] } = useDiseaseRules()
  return useMemo(() => {
    const set = new Set<string>()
    diseases
      .filter((d) => selectedKeys.includes(d.disease_key ?? d.disease))
      .forEach((d) => extractLabFields(d).required.forEach((r) => set.add(r)))
    return [...set]
  }, [diseases, selectedKeys])
}

// Suppress unused warning ใน some setups
void useEffect
