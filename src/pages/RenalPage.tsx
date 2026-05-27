import { useState, useMemo } from 'react'
import { Activity, Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { calcCrCl, findMatchingDoseAction, parseDoseMeta } from '@/features/renal/calc'
import { useLabRules, useDrugs } from '@/features/catalog/hooks'

export default function RenalPage() {
  const [age, setAge] = useState<number | ''>('')
  const [weight, setWeight] = useState<number | ''>('')
  const [height, setHeight] = useState<number | ''>('')
  const [sex, setSex] = useState<'M' | 'F'>('M')
  const [scr, setScr] = useState<number | ''>('')
  const [icode, setIcode] = useState('')

  const { data: labRules = [] } = useLabRules()
  const { data: drugs = [] } = useDrugs()

  const result = useMemo(() => {
    if (!age || !weight || !scr) return null
    return calcCrCl({ age: +age, weight: +weight, height: height ? +height : undefined, sex, scr: +scr })
  }, [age, weight, height, sex, scr])

  const matchedRules = useMemo(() => {
    if (!icode.trim()) return []
    return labRules.filter((r) => r.icode.toLowerCase() === icode.trim().toLowerCase() && r.dose_meta)
  }, [icode, labRules])

  const matchedDrug = useMemo(() => drugs.find((d) => d.icode.toLowerCase() === icode.trim().toLowerCase()), [icode, drugs])

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Activity className="size-6 text-primary" /> Renal Dose Calculator</h1>
        <p className="text-sm text-muted-foreground">Cockcroft-Gault + IBW (Devine) + parse dose_meta จาก LAB_RULES</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ข้อมูลผู้ป่วย</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div><Label>อายุ (ปี)</Label><Input type="number" value={age} onChange={(e) => setAge(e.target.value ? +e.target.value : '')} /></div>
            <div>
              <Label>เพศ</Label>
              <Select value={sex} onValueChange={(v) => setSex(v as 'M' | 'F')}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">ชาย</SelectItem>
                  <SelectItem value="F">หญิง</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>น้ำหนัก (kg)</Label><Input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value ? +e.target.value : '')} /></div>
            <div><Label>ส่วนสูง (cm)</Label><Input type="number" step="0.1" value={height} onChange={(e) => setHeight(e.target.value ? +e.target.value : '')} /></div>
            <div><Label>SCr (mg/dL)</Label><Input type="number" step="0.01" value={scr} onChange={(e) => setScr(e.target.value ? +e.target.value : '')} /></div>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader><CardTitle>ผลลัพธ์</CardTitle><CardDescription>{result.formula}</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold flex items-center gap-3">
              CrCl = <span className={result.crcl < 30 ? 'text-red-600' : result.crcl < 60 ? 'text-orange-600' : 'text-green-700'}>{result.crcl} mL/min</span>
              <span className="text-sm text-muted-foreground font-normal">({stageLabel(result.crcl)})</span>
            </div>
            <div className="text-sm">
              {result.ibw !== null && <div>IBW: <b>{result.ibw} kg</b> (Devine)</div>}
              <div>น้ำหนักที่ใช้คำนวณ: <b>{result.weightUsed} kg</b> ({result.weightBasis})</div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Search className="size-5" /> ดูคำแนะนำขนาดยา</CardTitle>
          <CardDescription>กรอก icode ยา ระบบจะ parse dose_meta จาก LAB_RULES และเลือก rule ที่ตรงกับ CrCl ของผู้ป่วย</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>icode</Label>
            <Input value={icode} onChange={(e) => setIcode(e.target.value)} placeholder="เช่น CEFTAZ" list="drug-list-renal" />
            <datalist id="drug-list-renal">
              {drugs.slice(0, 200).map((d) => <option key={d.id} value={d.icode}>{d.drug_name}</option>)}
            </datalist>
          </div>
          {matchedDrug && <div className="text-sm">{matchedDrug.drug_name} {matchedDrug.drug_class && <span className="text-muted-foreground">({matchedDrug.drug_class})</span>}</div>}
          {matchedRules.length === 0 && icode.trim() && <p className="text-sm text-muted-foreground">ไม่พบ dose_meta สำหรับ icode "{icode}"</p>}
          {matchedRules.map((r) => {
            const rules = parseDoseMeta(r.dose_meta)
            const matched = result ? findMatchingDoseAction(r.dose_meta, result.crcl) : null
            return (
              <div key={r.id} className="border rounded-md p-3 space-y-2">
                <div className="text-xs text-muted-foreground">dose_meta: <code className="text-xs">{r.dose_meta}</code></div>
                {result && matched && (
                  <div className="alert-orange border rounded p-2 text-sm">
                    ⚠️ CrCl = {result.crcl} mL/min → <b>{matched}</b>
                  </div>
                )}
                <ul className="text-sm space-y-0.5">
                  {rules.map((rule, i) => (
                    <li key={i} className={result && rule.matches(result.crcl) ? 'font-semibold' : 'text-muted-foreground'}>
                      • {rule.condition}: {rule.action}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}

function stageLabel(crcl: number) {
  if (crcl >= 90) return 'Normal/G1'
  if (crcl >= 60) return 'Mild/G2'
  if (crcl >= 45) return 'Mild-Mod/G3a'
  if (crcl >= 30) return 'Moderate/G3b'
  if (crcl >= 15) return 'Severe/G4'
  return 'ESRD/G5'
}
