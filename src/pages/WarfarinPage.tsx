import { useState, useMemo } from 'react'
import { Pill } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { calcWarfarin, distributeWeeklyDose } from '@/features/warfarin/calc'

const DAYS = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.']

export default function WarfarinPage() {
  const [weekly, setWeekly] = useState<number | ''>(35)
  const [inr, setInr] = useState<number | ''>('')
  const [targetMin, setTargetMin] = useState(2.0)
  const [targetMax, setTargetMax] = useState(3.0)
  const [bleeding, setBleeding] = useState(false)
  const [strength, setStrength] = useState(2)

  const result = useMemo(() => {
    if (!weekly || !inr) return null
    return calcWarfarin({ currentWeeklyDose: +weekly, currentINR: +inr, targetINRMin: targetMin, targetINRMax: targetMax, bleeding })
  }, [weekly, inr, targetMin, targetMax, bleeding])

  const dayPlan = useMemo(() => {
    if (!result?.newWeeklyDose || result.newWeeklyDose <= 0) return null
    return distributeWeeklyDose(result.newWeeklyDose, strength)
  }, [result, strength])

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Pill className="size-6 text-primary" /> Warfarin Dose Calculator</h1>
        <p className="text-sm text-muted-foreground">คำนวณ weekly dose จาก INR ปัจจุบัน + INR target + ขนาดยาเดิม</p>
      </div>

      <Card>
        <CardHeader><CardTitle>ข้อมูลผู้ป่วย</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div><Label>Weekly dose เดิม (mg/week)</Label><Input type="number" step="0.5" value={weekly} onChange={(e) => setWeekly(e.target.value ? +e.target.value : '')} /></div>
          <div><Label>INR ปัจจุบัน</Label><Input type="number" step="0.1" value={inr} onChange={(e) => setInr(e.target.value ? +e.target.value : '')} /></div>
          <div>
            <Label>ขนาดต่อเม็ด (mg)</Label>
            <Select value={String(strength)} onValueChange={(v) => setStrength(+v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 mg</SelectItem>
                <SelectItem value="2">2 mg</SelectItem>
                <SelectItem value="3">3 mg</SelectItem>
                <SelectItem value="5">5 mg</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Target INR ต่ำสุด</Label><Input type="number" step="0.1" value={targetMin} onChange={(e) => setTargetMin(+e.target.value)} /></div>
          <div><Label>Target INR สูงสุด</Label><Input type="number" step="0.1" value={targetMax} onChange={(e) => setTargetMax(+e.target.value)} /></div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={bleeding} onChange={(e) => setBleeding(e.target.checked)} />
              <span className="text-sm">มีเลือดออก</span>
            </label>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant={Math.abs(result.changePercent ?? 0) === 0 ? 'green' : Math.abs(result.changePercent ?? 0) <= 10 ? 'yellow' : 'orange'}>
                {result.changePercent === 0 ? 'คงขนาดเดิม' : `${result.changePercent! > 0 ? '+' : ''}${result.changePercent}%`}
              </Badge>
              <span>คำแนะนำ</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-base font-medium">{result.recommendation}</div>
            <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
              {result.notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><Label className="text-xs">Weekly dose ใหม่</Label><div className="text-lg font-semibold">{result.newWeeklyDose} mg</div></div>
              <div><Label className="text-xs">หยุดยา</Label><div className="text-lg font-semibold">{result.holdDays > 0 ? `${result.holdDays} วัน` : '-'}</div></div>
              <div><Label className="text-xs">นัด INR</Label><div className="text-lg font-semibold">{result.nextINRDays} วัน</div></div>
            </div>
            {dayPlan && (
              <div>
                <Label className="text-xs">แผนรายวัน (mg/วัน)</Label>
                <div className="grid grid-cols-7 gap-1 mt-1">
                  {dayPlan.map((d, i) => (
                    <div key={i} className="text-center border rounded p-2">
                      <div className="text-[10px] text-muted-foreground">{DAYS[i]}</div>
                      <div className="font-semibold">{d}</div>
                      <div className="text-[10px] text-muted-foreground">{(d / strength).toFixed(2)} เม็ด</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
