import { useEffect, useState } from 'react'
import { Eye, EyeOff, KeyRound, Save } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  const [saving, setSaving] = useState(false)

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
            ตอนคัดกรอง ถ้ายามีราคาต่อหน่วย (ขาย/ทุน) ≥ ค่านี้ จะขึ้นแจ้งเตือน 💰 — เว้นว่างหรือ 0 = เช็คเฉพาะบัญชียา ง/จ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Label>ราคาต่อหน่วยที่ถือว่าแพง (บาท)</Label>
          <Input
            type="number" min={0} value={expensiveThreshold}
            onChange={(e) => setExpensiveThreshold(e.target.value)}
            placeholder="เช่น 50"
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}><Save className="size-4" /> {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}</Button>
      </div>
    </div>
  )
}
