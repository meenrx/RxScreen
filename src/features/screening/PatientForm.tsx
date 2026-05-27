import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { calcCrCl } from '@/features/renal/calc'
import type { PatientInput } from '@/types/screening'
import { useState } from 'react'

interface Props {
  value: PatientInput
  onChange: (v: PatientInput) => void
}

const COMMON_DISEASES = ['CKD', 'DM', 'HT', 'CAD', 'CHF', 'G6PD', 'Asthma', 'COPD', 'Liver', 'Stroke']
const COMMON_ALLERGENS = ['Penicillin', 'Sulfa', 'NSAID', 'Aspirin', 'Cephalosporin', 'ASA', 'Iodine']

export function PatientForm({ value, onChange }: Props) {
  const [allergyInput, setAllergyInput] = useState('')

  function set<K extends keyof PatientInput>(key: K, v: PatientInput[K]) {
    onChange({ ...value, [key]: v })
  }
  function toggle<T extends 'diseases' | 'allergies'>(field: T, item: string) {
    const cur = (value[field] as string[] | undefined) ?? []
    const next = cur.includes(item) ? cur.filter((x) => x !== item) : [...cur, item]
    set(field, next as PatientInput[T])
  }
  function addAllergy() {
    if (!allergyInput.trim()) return
    const cur = value.allergies ?? []
    if (cur.includes(allergyInput.trim())) return
    set('allergies', [...cur, allergyInput.trim()])
    setAllergyInput('')
  }
  function removeAllergy(a: string) {
    set('allergies', (value.allergies ?? []).filter((x) => x !== a))
  }

  const crcl = value.age && value.weight && value.sex && value.scr
    ? calcCrCl({ age: value.age, weight: value.weight, height: value.height, sex: value.sex, scr: value.scr }).crcl
    : null

  return (
    <Card className="soft-card">
      <CardContent className="pt-6 space-y-5">
        <h3 className="font-semibold text-lg">ข้อมูลผู้ป่วย</h3>

        {/* Identification */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="col-span-2 md:col-span-2">
            <Label className="mb-1.5">HN</Label>
            <Input value={value.hn ?? ''} onChange={(e) => set('hn', e.target.value)} className="h-11" />
          </div>
          <div className="col-span-2 md:col-span-4">
            <Label className="mb-1.5">ชื่อ-นามสกุล</Label>
            <Input value={value.patient_name ?? ''} onChange={(e) => set('patient_name', e.target.value)} className="h-11" />
          </div>
        </div>

        {/* Vitals */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div>
            <Label className="mb-1.5">อายุ (ปี)</Label>
            <Input type="number" inputMode="numeric" value={value.age ?? ''} onChange={(e) => set('age', e.target.value ? +e.target.value : undefined)} className="h-11 text-lg" />
          </div>
          <div>
            <Label className="mb-1.5">เพศ</Label>
            <Select value={value.sex ?? ''} onValueChange={(v) => set('sex', v as 'M' | 'F')}>
              <SelectTrigger className="w-full h-11"><SelectValue placeholder="-" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="M">ชาย</SelectItem>
                <SelectItem value="F">หญิง</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5">น้ำหนัก (kg)</Label>
            <Input type="number" inputMode="decimal" step="0.1" value={value.weight ?? ''} onChange={(e) => set('weight', e.target.value ? +e.target.value : undefined)} className="h-11 text-lg" />
          </div>
          <div>
            <Label className="mb-1.5">ส่วนสูง (cm)</Label>
            <Input type="number" inputMode="decimal" step="0.1" value={value.height ?? ''} onChange={(e) => set('height', e.target.value ? +e.target.value : undefined)} className="h-11 text-lg" />
          </div>
          <div>
            <Label className="mb-1.5">SCr (mg/dL)</Label>
            <Input type="number" inputMode="decimal" step="0.01" value={value.scr ?? ''} onChange={(e) => set('scr', e.target.value ? +e.target.value : undefined)} className="h-11 text-lg" />
          </div>
          <div>
            <Label className="mb-1.5">INR</Label>
            <Input type="number" inputMode="decimal" step="0.1" value={value.inr ?? ''} onChange={(e) => set('inr', e.target.value ? +e.target.value : undefined)} className="h-11 text-lg" />
          </div>
        </div>

        {/* CrCl display */}
        <div className="rounded-xl border bg-muted/30 p-3 flex items-center justify-between gap-3">
          <div className="text-sm">
            <div className="text-muted-foreground text-xs">CrCl คำนวณอัตโนมัติ (Cockcroft-Gault)</div>
            <div className="text-2xl font-bold mt-0.5">
              {crcl !== null ? (
                <span className={crcl < 30 ? 'text-red-600' : crcl < 60 ? 'text-orange-600' : 'text-emerald-700'}>{crcl} <span className="text-base font-normal">mL/min</span></span>
              ) : <span className="text-muted-foreground">—</span>}
            </div>
          </div>
          {crcl !== null && (
            <Badge variant={crcl < 30 ? 'red' : crcl < 60 ? 'orange' : 'green'} className="text-sm">
              {crcl < 15 ? 'G5 ESRD' : crcl < 30 ? 'G4 Severe' : crcl < 45 ? 'G3b' : crcl < 60 ? 'G3a' : crcl < 90 ? 'G2' : 'G1 Normal'}
            </Badge>
          )}
        </div>

        {/* Special status */}
        <div className="space-y-3">
          <Label className="text-base">สถานะพิเศษ</Label>
          <div className="flex flex-wrap gap-2">
            <CheckPill label="🤰 ตั้งครรภ์" active={value.is_pregnant} onClick={() => set('is_pregnant', !value.is_pregnant)} />
            <CheckPill label="🤱 ให้นมบุตร" active={value.is_lactating} onClick={() => set('is_lactating', !value.is_lactating)} />
            <CheckPill label="🚬 สูบบุหรี่" active={value.smoking} onClick={() => set('smoking', !value.smoking)} />
            <CheckPill label="🍺 ดื่มแอลกอฮอล์" active={value.alcohol} onClick={() => set('alcohol', !value.alcohol)} />
          </div>
          {value.is_pregnant && (
            <div className="max-w-xs">
              <Label className="mb-1">อายุครรภ์ (สัปดาห์)</Label>
              <Input type="number" inputMode="numeric" value={value.pregnancy_weeks ?? ''} onChange={(e) => set('pregnancy_weeks', e.target.value ? +e.target.value : undefined)} className="h-10" />
            </div>
          )}
        </div>

        {/* Allergies */}
        <div className="space-y-2">
          <Label className="text-base flex items-center gap-2">
            <span className="text-red-600">🚨</span>
            ประวัติแพ้ยา
          </Label>
          <div className="flex gap-2">
            <Input
              value={allergyInput}
              onChange={(e) => setAllergyInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAllergy() } }}
              placeholder="พิมพ์ชื่อสาร/กลุ่มยา แล้วกด Enter"
              className="h-10"
            />
            <button type="button" onClick={addAllergy} className="px-4 rounded-md border bg-white text-sm hover:bg-accent">เพิ่ม</button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {COMMON_ALLERGENS.map((a) => {
              const active = value.allergies?.includes(a)
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggle('allergies', a)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition ${active ? 'bg-red-100 border-red-300 text-red-900 font-medium' : 'border-input hover:bg-accent'}`}
                >
                  {active && '✓ '}{a}
                </button>
              )
            })}
          </div>
          {value.allergies && value.allergies.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {value.allergies.map((a) => (
                <Badge key={a} variant="red" className="cursor-pointer text-sm" onClick={() => removeAllergy(a)}>
                  {a} ✕
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Diseases */}
        <div className="space-y-2">
          <Label className="text-base">โรคประจำตัว / Comorbidity</Label>
          <div className="flex flex-wrap gap-1.5">
            {COMMON_DISEASES.map((d) => {
              const active = value.diseases?.includes(d)
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggle('diseases', d)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition ${active ? 'bg-primary text-primary-foreground border-primary font-medium' : 'border-input hover:bg-accent'}`}
                >
                  {active && '✓ '}{d}
                </button>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function CheckPill({ label, active, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-xl border text-sm transition font-medium ${active ? 'bg-amber-100 border-amber-300 text-amber-900' : 'bg-white border-input hover:bg-accent'}`}
    >
      {active && '✓ '}{label}
    </button>
  )
}
