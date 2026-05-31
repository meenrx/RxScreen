import { useMemo } from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { calcCrCl } from '@/features/renal/calc'
import { computeRequiredFields, isFieldFilled, type FieldId } from './requiredFields'
import { cn } from '@/lib/utils'
import type { DrugEntry, PatientInput } from '@/types/screening'

interface Props {
  drugs: DrugEntry[]
  value: PatientInput
  onChange: (v: PatientInput) => void
}

const COMMON_DISEASES = ['CKD', 'DM', 'HT', 'CAD', 'CHF', 'Asthma', 'COPD', 'Liver', 'Stroke']

export function SmartPatientForm({ drugs, value, onChange }: Props) {
  const required = useMemo(() => computeRequiredFields(drugs), [drugs])
  const requiredIds = useMemo(() => new Set(required.map((r) => r.id)), [required])

  function isRequired(id: FieldId): boolean { return requiredIds.has(id) }
  function isMissing(id: FieldId): boolean { return isRequired(id) && !isFieldFilled(value, {}, id) }

  function set<K extends keyof PatientInput>(key: K, v: PatientInput[K]) {
    onChange({ ...value, [key]: v })
  }
  function toggleDisease(item: string) {
    const cur = value.diseases ?? []
    const next = cur.includes(item) ? cur.filter((x) => x !== item) : [...cur, item]
    set('diseases', next)
  }

  const crcl = value.age && value.weight && value.sex && value.scr
    ? calcCrCl({ age: value.age, weight: value.weight, height: value.height, sex: value.sex, scr: value.scr }).crcl
    : null

  const missingCount = required.filter((r) => isMissing(r.id)).length

  if (drugs.length === 0 || required.length === 0) return null

  return (
    <Card className="soft-card">
      <CardContent className="pt-6 space-y-5">
        {/* Banner */}
        <div className="flex items-start gap-3">
          <div className={cn('size-9 shrink-0 rounded-xl grid place-items-center',
            missingCount > 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
          )}>
            {missingCount > 0 ? <AlertCircle className="size-5" /> : <CheckCircle2 className="size-5" />}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg">ข้อมูลที่ระบบขอ</h3>
            <p className="text-sm text-muted-foreground">
              {missingCount > 0
                ? `ยังต้องตอบ ${missingCount} ข้อ — ช่องกรอบเหลืองคือต้องตอบเพื่อคัดกรอง`
                : 'ครบแล้ว ✓'}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-900 p-3 space-y-1">
          <div className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider">ระบบขอข้อมูลต่อไปนี้</div>
          <div className="flex flex-wrap gap-1.5">
            {required.map((r) => (
              <Badge
                key={r.id}
                variant={isFieldFilled(value, {}, r.id) ? 'green' : r.priority === 'high' ? 'orange' : 'yellow'}
                title={r.reasons.join(' · ')}
              >
                {isFieldFilled(value, {}, r.id) ? '✓ ' : ''}
                {r.label}
              </Badge>
            ))}
          </div>
        </div>

        {(isRequired('age') || isRequired('sex') || isRequired('weight') || isRequired('height') || isRequired('scr') || isRequired('egfr') || isRequired('inr')) && (
          <Section title="ข้อมูลทางคลินิก">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {isRequired('age') && (
                <FieldBlock label="อายุ" unit="ปี" missing={isMissing('age')}>
                  <Input type="number" inputMode="numeric" value={value.age ?? ''} onChange={(e) => set('age', e.target.value ? +e.target.value : undefined)} className={cn('h-11 text-lg', isMissing('age') && 'required-input')} />
                </FieldBlock>
              )}
              {isRequired('sex') && (
                <FieldBlock label="เพศ" missing={isMissing('sex')}>
                  <Select value={value.sex ?? ''} onValueChange={(v) => set('sex', v as 'M' | 'F')}>
                    <SelectTrigger className={cn('w-full h-11', isMissing('sex') && 'required-input')}><SelectValue placeholder="-" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">ชาย</SelectItem>
                      <SelectItem value="F">หญิง</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldBlock>
              )}
              {isRequired('weight') && (
                <FieldBlock label="น้ำหนัก" unit="kg" missing={isMissing('weight')}>
                  <Input type="number" inputMode="decimal" step="0.1" value={value.weight ?? ''} onChange={(e) => set('weight', e.target.value ? +e.target.value : undefined)} className={cn('h-11 text-lg', isMissing('weight') && 'required-input')} />
                </FieldBlock>
              )}
              {isRequired('height') && (
                <FieldBlock label="ส่วนสูง" unit="cm" missing={isMissing('height')}>
                  <Input type="number" inputMode="decimal" step="0.1" value={value.height ?? ''} onChange={(e) => set('height', e.target.value ? +e.target.value : undefined)} className={cn('h-11 text-lg', isMissing('height') && 'required-input')} />
                </FieldBlock>
              )}
              {isRequired('scr') && (
                <FieldBlock label="SCr" unit="mg/dL" missing={isMissing('scr')}>
                  <Input type="number" inputMode="decimal" step="0.01" value={value.scr ?? ''} onChange={(e) => set('scr', e.target.value ? +e.target.value : undefined)} className={cn('h-11 text-lg', isMissing('scr') && 'required-input')} />
                </FieldBlock>
              )}
              {isRequired('egfr') && (
                <FieldBlock label="eGFR" unit="mL/min" missing={isMissing('egfr')}>
                  <Input type="number" inputMode="decimal" step="1" value={value.egfr ?? ''} onChange={(e) => set('egfr', e.target.value ? +e.target.value : undefined)} className={cn('h-11 text-lg', isMissing('egfr') && 'required-input')} />
                </FieldBlock>
              )}
              {isRequired('inr') && (
                <FieldBlock label="INR" missing={isMissing('inr')}>
                  <Input type="number" inputMode="decimal" step="0.1" value={value.inr ?? ''} onChange={(e) => set('inr', e.target.value ? +e.target.value : undefined)} className={cn('h-11 text-lg', isMissing('inr') && 'required-input')} />
                </FieldBlock>
              )}
            </div>
          </Section>
        )}

        {crcl !== null && (
          <div className="rounded-xl border bg-muted/30 p-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-muted-foreground">CrCl (Cockcroft-Gault)</div>
              <div className="text-2xl font-bold mt-0.5">
                <span className={crcl < 30 ? 'text-red-600' : crcl < 60 ? 'text-orange-600' : 'text-emerald-700'}>{crcl} <span className="text-base font-normal">mL/min</span></span>
              </div>
            </div>
            <Badge variant={crcl < 30 ? 'red' : crcl < 60 ? 'orange' : 'green'} className="text-sm">
              {crcl < 15 ? 'G5 ESRD' : crcl < 30 ? 'G4' : crcl < 45 ? 'G3b' : crcl < 60 ? 'G3a' : crcl < 90 ? 'G2' : 'G1'}
            </Badge>
          </div>
        )}

        {/* Yes/No questions */}
        {(isRequired('is_pregnant') || isRequired('is_lactating') || isRequired('g6pd') || isRequired('smoking') || isRequired('alcohol')) && (
          <Section title="คำถามเฉพาะตัว">
            <div className="space-y-2">
              {isRequired('is_pregnant') && (
                <YesNoRow
                  emoji="🤰"
                  label="ผู้ป่วยตั้งครรภ์หรือไม่?"
                  value={value.is_pregnant}
                  missing={isMissing('is_pregnant')}
                  onChange={(v) => set('is_pregnant', v)}
                  yesLabel="ใช่ ตั้งครรภ์"
                  noLabel="ไม่ตั้งครรภ์"
                />
              )}
              {isRequired('is_lactating') && (
                <YesNoRow
                  emoji="🤱"
                  label="ผู้ป่วยให้นมบุตรหรือไม่?"
                  value={value.is_lactating}
                  missing={isMissing('is_lactating')}
                  onChange={(v) => set('is_lactating', v)}
                  yesLabel="ใช่ ให้นมบุตร"
                  noLabel="ไม่ได้ให้นม"
                />
              )}
              {isRequired('g6pd') && (
                <YesNoRow
                  emoji="🩸"
                  label="ผู้ป่วยมีภาวะ G6PD deficiency หรือไม่?"
                  value={value.g6pd}
                  missing={isMissing('g6pd')}
                  onChange={(v) => set('g6pd', v)}
                  yesLabel="มี G6PD"
                  noLabel="ไม่มี"
                />
              )}
              {isRequired('smoking') && (
                <YesNoRow
                  emoji="🚬"
                  label="ผู้ป่วยสูบบุหรี่หรือไม่?"
                  value={value.smoking}
                  missing={isMissing('smoking')}
                  onChange={(v) => set('smoking', v)}
                  yesLabel="ใช่ สูบบุหรี่"
                  noLabel="ไม่สูบ"
                />
              )}
              {isRequired('alcohol') && (
                <YesNoRow
                  emoji="🍺"
                  label="ผู้ป่วยดื่มแอลกอฮอล์หรือไม่?"
                  value={value.alcohol}
                  missing={isMissing('alcohol')}
                  onChange={(v) => set('alcohol', v)}
                  yesLabel="ใช่ ดื่ม"
                  noLabel="ไม่ดื่ม"
                />
              )}
            </div>
          </Section>
        )}

        {/* Diseases — multi-select */}
        {isRequired('diseases') && (
          <Section title="โรคประจำตัว">
            <div className={cn('flex flex-wrap gap-1.5 p-2 -m-2 rounded-xl', isMissing('diseases') && 'ring-2 ring-amber-300 bg-amber-50/30 dark:bg-amber-950/20')}>
              {COMMON_DISEASES.map((d) => {
                const active = value.diseases?.includes(d)
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDisease(d)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition ${active ? 'bg-primary text-primary-foreground border-primary font-medium' : 'border-input hover:bg-accent'}`}
                  >
                    {active && '✓ '}{d}
                  </button>
                )
              })}
            </div>
          </Section>
        )}
      </CardContent>
    </Card>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{title}</div>
      {children}
    </div>
  )
}

function FieldBlock({ label, unit, missing, children }: { label: string; unit?: string; missing?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <Label className={cn('mb-1.5', missing && 'text-amber-700 dark:text-amber-300 font-semibold')}>
        {label} {unit && <span className="text-xs text-muted-foreground">({unit})</span>}
        {missing && <span className="text-red-500 ml-1">*</span>}
      </Label>
      {children}
    </div>
  )
}

/** ปุ่ม ใช่/ไม่ใช่ tri-state (undefined = ยังไม่ตอบ) */
function YesNoRow({ emoji, label, value, missing, onChange, yesLabel, noLabel }: {
  emoji: string
  label: string
  value: boolean | undefined
  missing?: boolean
  onChange: (v: boolean | undefined) => void
  yesLabel: string
  noLabel: string
}) {
  return (
    <div className={cn(
      'flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-xl border bg-card',
      missing && value === undefined && 'ring-2 ring-amber-300 border-amber-300 bg-amber-50/40 dark:bg-amber-950/20',
    )}>
      <div className="flex-1 flex items-center gap-2">
        <span className="text-xl shrink-0">{emoji}</span>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onChange(value === true ? undefined : true)}
          className={cn(
            'h-10 px-4 rounded-lg border text-sm font-medium transition min-w-[110px] active:scale-95',
            value === true
              ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
              : 'bg-card border-input hover:bg-accent',
          )}
        >
          {value === true && '✓ '}{yesLabel}
        </button>
        <button
          type="button"
          onClick={() => onChange(value === false ? undefined : false)}
          className={cn(
            'h-10 px-4 rounded-lg border text-sm font-medium transition min-w-[110px] active:scale-95',
            value === false
              ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
              : 'bg-card border-input hover:bg-accent',
          )}
        >
          {value === false && '✓ '}{noLabel}
        </button>
      </div>
    </div>
  )
}
