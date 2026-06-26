import { useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { calcCrCl } from '@/features/renal/calc'
import { computeRequiredFields, isFieldFilled, type FieldId } from './requiredFields'
import { getActiveRduTriggers, RDU_CONTEXT_OPTIONS, type RduContextKey } from './rduRules'
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

  const rduTriggers = useMemo(() => getActiveRduTriggers(drugs), [drugs])

  function toggleRduContext(key: RduContextKey) {
    const cur = value.rdu_context ?? []
    const next = cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key]
    set('rdu_context', next)
  }

  // เปิด/ปิดแถวอธิบาย "ทำไมต้องกรอก field นี้" (diagnostic — ใช้หา rule ที่ trigger เกินจำเป็น)
  const [showReasons, setShowReasons] = useState(false)

  if (drugs.length === 0 || (required.length === 0 && !rduTriggers.needsContext)) return null

  // ฟิลด์ตัวเลข (อายุ/น้ำหนัก/SCr/INR/...) — บรรทัดเดียว, fixed width กัน Input default w-full
  const numField = (id: FieldId, ph: string, key: keyof PatientInput, step: string = '0.1', widthCls = 'w-[120px]') => {
    if (!isRequired(id)) return null
    const reasons = required.find((r) => r.id === id)?.reasons.join('\n• ') ?? ''
    return (
      <Input
        key={id}
        type="number"
        inputMode="decimal"
        step={step}
        value={(value[key] as number | undefined) ?? ''}
        onChange={(e) => set(key, (e.target.value ? +e.target.value : undefined) as PatientInput[typeof key])}
        placeholder={ph + (isMissing(id) ? ' *' : '')}
        className={cn('h-10', widthCls, isMissing(id) && 'required-input')}
        title={`ขอเพราะ:\n• ${reasons}`}
      />
    )
  }

  return (
    <Card className="soft-card">
      <CardContent className="pt-3 pb-3 space-y-2">
        {/* แถวเดียว: input ตัวเลข + select เพศ + yes/no ทุกข้อ
            HN + ชื่อผู้ป่วย → กรอกใน Intervention panel (ใช้แค่ตอนบันทึก) */}
        <div className="flex flex-wrap gap-1.5 items-center">
          {numField('age', 'อายุ (ปี)', 'age', '1', 'w-[90px]')}
          {isRequired('sex') && (
            <Select value={value.sex ?? ''} onValueChange={(v) => set('sex', v as 'M' | 'F')}>
              <SelectTrigger className={cn('h-10 w-[85px]', isMissing('sex') && 'required-input')}>
                <SelectValue placeholder={'เพศ' + (isMissing('sex') ? ' *' : '')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="M">ชาย</SelectItem>
                <SelectItem value="F">หญิง</SelectItem>
              </SelectContent>
            </Select>
          )}
          {numField('weight', 'น้ำหนัก (kg)', 'weight', '0.1', 'w-[110px]')}
          {numField('height', 'ส่วนสูง (cm)', 'height', '0.1', 'w-[110px]')}
          {numField('scr', 'SCr (mg/dL)', 'scr', '0.01', 'w-[110px]')}
          {numField('egfr', 'eGFR', 'egfr', '1', 'w-[90px]')}
          {numField('inr', 'INR', 'inr', '0.1', 'w-[80px]')}

          {isRequired('is_pregnant') && <YesNoChip emoji="🤰" label="ตั้งครรภ์" value={value.is_pregnant} missing={isMissing('is_pregnant')} onChange={(v) => set('is_pregnant', v)} />}
          {isRequired('is_lactating') && <YesNoChip emoji="🤱" label="ให้นม" value={value.is_lactating} missing={isMissing('is_lactating')} onChange={(v) => set('is_lactating', v)} />}
          {isRequired('g6pd') && <YesNoChip emoji="🩸" label="G6PD" value={value.g6pd} missing={isMissing('g6pd')} onChange={(v) => set('g6pd', v)} />}
          {isRequired('smoking') && <YesNoChip emoji="🚬" label="สูบบุหรี่" value={value.smoking} missing={isMissing('smoking')} onChange={(v) => set('smoking', v)} />}
          {isRequired('alcohol') && <YesNoChip emoji="🍺" label="แอลกอฮอล์" value={value.alcohol} missing={isMissing('alcohol')} onChange={(v) => set('alcohol', v)} />}

          {crcl !== null && (
            <span className={cn(
              'inline-flex items-center gap-1.5 h-10 px-2.5 rounded-md border text-sm bg-muted/40',
              crcl < 30 ? 'text-red-700 border-red-200' : crcl < 60 ? 'text-orange-700 border-orange-200' : 'text-emerald-700 border-emerald-200',
            )}>
              <span className="text-[10px] opacity-70">CrCl</span>
              <span className="font-bold">{crcl}</span>
              <Badge variant={crcl < 30 ? 'red' : crcl < 60 ? 'orange' : 'green'} className="text-[10px] px-1">
                {crcl < 15 ? 'G5' : crcl < 30 ? 'G4' : crcl < 45 ? 'G3b' : crcl < 60 ? 'G3a' : crcl < 90 ? 'G2' : 'G1'}
              </Badge>
            </span>
          )}
        </div>

        {/* "ทำไมต้องกรอก?" — เปิดดู rule ที่ trigger field แต่ละตัว (diagnostic) */}
        {required.length > 0 && (
          <div className="text-[11px]">
            <button
              type="button"
              onClick={() => setShowReasons((v) => !v)}
              className="text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              {showReasons ? '▼ ซ่อนเหตุผล' : '▶ ทำไมต้องกรอก?'} ({required.length} ฟิลด์)
            </button>
            {showReasons && (
              <ul className="mt-1 space-y-0.5 rounded-md border bg-muted/30 p-2 max-h-40 overflow-y-auto">
                {required.map((r) => (
                  <li key={r.id} className="flex gap-1.5">
                    <span className="font-semibold w-[120px] shrink-0">{r.label}{r.unit ? ` (${r.unit})` : ''}</span>
                    <span className="text-muted-foreground">{r.reasons.join(' · ')}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* RDU context — โผล่เมื่อมียา ATB ในใบสั่ง ให้ติ๊กว่ามาด้วยอาการอะไร */}
        {rduTriggers.needsContext && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">📋 RDU:</span>
            {RDU_CONTEXT_OPTIONS.map((opt) => {
              const active = value.rdu_context?.includes(opt.key)
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => toggleRduContext(opt.key)}
                  title={opt.hint}
                  className={cn(
                    'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition',
                    active ? 'bg-amber-500 text-white border-amber-500 font-medium' : 'border-input hover:bg-accent',
                  )}
                >
                  <span>{opt.emoji}</span>
                  {active && '✓ '}{opt.label}
                </button>
              )
            })}
          </div>
        )}

        {/* โรคประจำตัว — บรรทัดเดียวแบบ chips */}
        {isRequired('diseases') && (
          <div className={cn('flex flex-wrap gap-1', isMissing('diseases') && 'ring-1 ring-amber-300 rounded-md p-1 bg-amber-50/30 dark:bg-amber-950/20')}>
            {COMMON_DISEASES.map((d) => {
              const active = value.diseases?.includes(d)
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDisease(d)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs border transition',
                    active ? 'bg-primary text-primary-foreground border-primary font-medium' : 'border-input hover:bg-accent',
                  )}
                >
                  {active && '✓ '}{d}
                </button>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** ใช่/ไม่ใช่ แบบ chip 1 บรรทัด — กดเลือก ?/✓/✕ ในตัวเดียวกัน */
function YesNoChip({ emoji, label, value, missing, onChange }: {
  emoji: string
  label: string
  value: boolean | undefined
  missing?: boolean
  onChange: (v: boolean | undefined) => void
}) {
  const next = value === undefined ? true : value === true ? false : undefined
  const tone =
    value === true ? 'bg-amber-500 text-white border-amber-500' :
    value === false ? 'bg-emerald-500 text-white border-emerald-500' :
    'bg-card border-input hover:bg-accent'
  const mark = value === true ? '✓' : value === false ? '✕' : '?'
  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      title={`${label} — กดเพื่อสลับ ใช่/ไม่ใช่/ยังไม่ตอบ`}
      className={cn(
        'inline-flex items-center gap-1.5 h-10 px-2.5 rounded-md border text-sm font-medium transition active:scale-95',
        tone,
        missing && value === undefined && 'ring-2 ring-amber-300 border-amber-300 bg-amber-50/40 dark:bg-amber-950/20',
      )}
    >
      <span>{emoji}</span>
      <span>{label}</span>
      <span className="ml-0.5 w-4 grid place-items-center rounded bg-black/10 dark:bg-white/10 text-[11px] font-bold">{mark}</span>
    </button>
  )
}
