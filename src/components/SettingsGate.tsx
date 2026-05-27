import { useState } from 'react'
import { Lock, Eye, EyeOff } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

const SETTINGS_PASSWORD = 'meen2539'
const STORAGE_KEY = 'rxscreen_settings_unlocked'

/** Password gate สำหรับ Settings — รหัสคงที่ในโค้ด */
export function SettingsGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(STORAGE_KEY) === '1')
  const [pwd, setPwd] = useState('')
  const [show, setShow] = useState(false)

  function tryUnlock(e?: React.FormEvent) {
    e?.preventDefault()
    if (pwd === SETTINGS_PASSWORD) {
      sessionStorage.setItem(STORAGE_KEY, '1')
      setUnlocked(true)
      toast.success('ปลดล็อกหน้าตั้งค่าเรียบร้อย')
    } else {
      toast.error('รหัสไม่ถูกต้อง')
      setPwd('')
    }
  }

  if (unlocked) return <>{children}</>

  return (
    <div className="max-w-md mx-auto mt-12">
      <Card className="soft-card">
        <CardHeader>
          <div className="size-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 grid place-items-center text-white mb-2">
            <Lock className="size-6" />
          </div>
          <CardTitle>หน้าตั้งค่าถูกล็อก</CardTitle>
          <CardDescription>กรอกรหัสผ่านเพื่อเข้าหน้า Settings</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={tryUnlock} className="space-y-4">
            <div>
              <Label className="mb-1.5">รหัสผ่าน</Label>
              <div className="flex gap-2">
                <Input
                  type={show ? 'text' : 'password'}
                  value={pwd}
                  onChange={(e) => setPwd(e.target.value)}
                  autoFocus
                  className="h-12 text-lg"
                  placeholder="••••••••"
                />
                <Button type="button" variant="outline" size="icon" className="h-12 w-12" onClick={() => setShow((v) => !v)}>
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
            </div>
            <Button type="submit" className="w-full h-11" disabled={!pwd}>ปลดล็อก</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
