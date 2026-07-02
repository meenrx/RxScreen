import { useEffect, useState } from 'react'
import { Eye, EyeOff, KeyRound, Save, X, Plus } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { getAnthropicConfig } from '@/features/ai/summary'
import { saveConfig } from '@/features/catalog/api'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { toast } from 'sonner'
import { SettingsGate } from '@/components/SettingsGate'

export default function SettingsPage() {
  return (
    <SettingsGate>
      <SettingsContent />
    </SettingsGate>
  )
}

function SettingsContent() {
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('claude-haiku-4-5-20251001')
  const [showKey, setShowKey] = useState(false)
  const [hospitalName, setHospitalName] = useState('โรงพยาบาลรือเสาะ')
  const [hospitalAddress, setHospitalAddress] = useState('')
  const [expensiveThreshold, setExpensiveThreshold] = useState('')
  const [dupList, setDupList] = useState<string[]>([])
  const [dupInput, setDupInput] = useState('')
  const [saving, setSaving] = useState(false)

  function addDupClass(raw: string) {
    const v = raw.trim().toUpperCase()
    if (v && !dupList.includes(v)) setDupList((p) => [...p, v])
    setDupInput('')
  }

  useEffect(() => {
    (async () => {
      try {
        const c = await getAnthropicConfig()
        if (c.key) setApiKey(c.key)
        if (c.model) setModel(c.model)
        const hospSnap = await getDoc(doc(db, 'CONFIG', 'hospital'))
        if (hospSnap.exists()) {
          const d = hospSnap.data()
          setHospitalName(d.hospital_name ?? 'โรงพยาบาลรือเสาะ')
          setHospitalAddress(d.hospital_address ?? '')
        }
        const scrSnap = await getDoc(doc(db, 'CONFIG', 'screening'))
        if (scrSnap.exists()) {
          const t = scrSnap.data().expensive_unit_price_threshold
          if (typeof t === 'number') setExpensiveThreshold(String(t))
          const dc = scrSnap.data().duplicate_classes
          if (Array.isArray(dc)) setDupList(dc.map((s: string) => String(s).trim().toUpperCase()).filter(Boolean))
        }
      } catch (e) {
        console.error(e)
      }
    })()
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      await saveConfig('anthropic', { anthropic_api_key: apiKey, anthropic_model: model })
      await saveConfig('hospital', { hospital_name: hospitalName, hospital_address: hospitalAddress })
      const thr = Number(expensiveThreshold)
      await saveConfig('screening', {
        // 0 = ปิดการเช็คตามราคา (เช็คเฉพาะบัญชี ง/จ)
        expensive_unit_price_threshold: expensiveThreshold.trim() !== '' && Number.isFinite(thr) && thr > 0 ? thr : 0,
        duplicate_classes: dupList,
      })
      toast.success('บันทึกการตั้งค่าเรียบร้อย')
    } catch (e) {
      toast.error('บันทึกไม่สำเร็จ: ' + (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold">ตั้งค่าระบบ</h1>
        <p className="text-sm text-muted-foreground">เฉพาะผู้ดูแลระบบเท่านั้นที่บันทึกได้</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="size-4" /> Anthropic API (Claude Haiku)</CardTitle>
          <CardDescription>
            ใช้สำหรับสร้าง AI Summary ในหน้าคัดกรองใบสั่งยา
            — <span className="text-orange-600">⚠ key จะเรียกจาก browser โดยตรง (ผู้ใช้ที่ login เป็น pharmacist/admin จะเห็น key ได้ผ่าน DevTools — ใช้เฉพาะภายในโรงพยาบาล)</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>API Key</Label>
            <div className="flex gap-2">
              <Input type={showKey ? 'text' : 'password'} value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-ant-..." />
              <Button variant="outline" size="icon" onClick={() => setShowKey((v) => !v)}>
                {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </div>
          </div>
          <div>
            <Label>Model</Label>
            <Input value={model} onChange={(e) => setModel(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">แนะนำ: claude-haiku-4-5-20251001 (เร็ว ราคาประหยัด)</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ข้อมูลโรงพยาบาล</CardTitle>
          <CardDescription>ใช้ใน header ของใบคัดกรอง PDF</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div><Label>ชื่อโรงพยาบาล</Label><Input value={hospitalName} onChange={(e) => setHospitalName(e.target.value)} /></div>
          <div><Label>ที่อยู่</Label><Input value={hospitalAddress} onChange={(e) => setHospitalAddress(e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>เกณฑ์ยาราคาสูง (Cost alert)</CardTitle>
          <CardDescription>
            ถ้ายามีราคาต่อหน่วย (ขาย/ทุน) ≥ ค่านี้ จะขึ้นเตือน 💰 ตอนคัดกรอง — เลือกปุ่มด่วน หรือพิมพ์เอง
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* ปุ่มเลือกด่วน — แตะเลือกได้เลย ไม่ต้องพิมพ์ */}
          <div className="flex flex-wrap gap-2">
            {['0', '20', '50', '100', '200', '500'].map((v) => {
              const active = (expensiveThreshold.trim() === '' ? '0' : expensiveThreshold.trim()) === v
              return (
                <Button
                  key={v}
                  type="button"
                  variant={active ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setExpensiveThreshold(v)}
                >
                  {v === '0' ? 'ปิด (เฉพาะ ง/จ)' : `≥ ${v} บาท`}
                </Button>
              )
            })}
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">หรือระบุเอง (บาท)</Label>
            <Input
              type="number" min={0} value={expensiveThreshold}
              onChange={(e) => setExpensiveThreshold(e.target.value)}
              placeholder="เช่น 75"
              className="max-w-[160px]"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>กลุ่มยาที่ห้ามจ่ายซ้ำ (Duplicate)</CardTitle>
          <CardDescription>
            เตือน "ยาซ้ำกลุ่ม" เฉพาะกลุ่มที่ระบุ (ว่าง = เตือนทุกกลุ่ม) · ยาซ้ำ generic เตือนเสมอ
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* chip กลุ่มที่เลือกไว้ — กด × เพื่อลบ */}
          <div className="flex flex-wrap gap-1.5 min-h-[2rem]">
            {dupList.length === 0 && <span className="text-sm text-muted-foreground italic">ยังไม่ได้เลือก — เตือนทุกกลุ่ม</span>}
            {dupList.map((c) => (
              <Badge key={c} variant="secondary" className="gap-1 pr-1">
                {c}
                <button type="button" onClick={() => setDupList((p) => p.filter((x) => x !== c))} className="hover:text-red-500" aria-label={`ลบ ${c}`}>
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
          {/* พิมพ์เพิ่ม (Enter/comma) */}
          <div className="flex gap-2">
            <Input
              value={dupInput}
              onChange={(e) => setDupInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addDupClass(dupInput) } }}
              placeholder="พิมพ์ชื่อกลุ่มแล้วกด Enter เช่น NSAIDS"
              className="flex-1"
            />
            <Button type="button" variant="outline" size="icon" onClick={() => addDupClass(dupInput)} disabled={!dupInput.trim()}>
              <Plus className="size-4" />
            </Button>
          </div>
          {/* กลุ่มยอดนิยม — แตะเพิ่มเร็ว */}
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs text-muted-foreground self-center">แนะนำ:</span>
            {['NSAIDS', 'PENICILLINS', 'PROTON PUMP INHIBITORS', 'BENZODIAZEPINES', 'OPIOIDS', 'STATINS']
              .filter((c) => !dupList.includes(c))
              .map((c) => (
                <button key={c} type="button" onClick={() => addDupClass(c)} className="text-xs px-2 py-0.5 rounded-full border border-dashed hover:bg-muted transition-colors">
                  + {c}
                </button>
              ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}><Save className="size-4" /> {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}</Button>
      </div>
    </div>
  )
}
