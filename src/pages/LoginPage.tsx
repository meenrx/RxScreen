import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Pill, ShieldCheck, Sparkles, Stethoscope, KeyRound, Delete, Loader2 } from 'lucide-react'
import { signInWithPin } from '@/features/auth/api'
import { findInitialUser } from '@/lib/initialUsers'
import { toast } from 'sonner'

const PIN_LENGTH = 5

export default function LoginPage() {
  const navigate = useNavigate()
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const matched = pin.length >= 4 ? findInitialUser(pin) : undefined

  async function doLogin(p: string) {
    if (!p.trim() || loading) return
    setLoading(true)
    setError(null)
    try {
      await signInWithPin(p)
      toast.success('เข้าสู่ระบบสำเร็จ')
      navigate('/')
    } catch (err) {
      const msg = (err as Error).message
      setError(msg)
      toast.error(msg)
      setPin('')  // ล้าง PIN เพื่อให้ลองใหม่
    } finally {
      setLoading(false)
    }
  }

  // 🚀 Auto-login เมื่อ PIN ครบ 5 หลัก
  useEffect(() => {
    if (pin.length === PIN_LENGTH && !loading) {
      const t = setTimeout(() => doLogin(pin), 200)  // delay 200ms ให้ user เห็นตัวเลขสุดท้าย
      return () => clearTimeout(t)
    }
  }, [pin]) // eslint-disable-line react-hooks/exhaustive-deps

  function press(key: string) {
    if (loading) return
    if (key === 'del') setPin((p) => p.slice(0, -1))
    else if (key === 'clr') setPin('')
    else setPin((p) => (p + key).slice(0, PIN_LENGTH))
  }

  return (
    <div className="min-h-screen hero-gradient flex items-center justify-center p-4 dark:bg-slate-950">
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-6 items-center fade-up">
        {/* Brand panel */}
        <div className="hidden md:flex flex-col gap-6 p-8">
          <div className="flex items-center gap-3">
            <div className="size-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-sky-600 grid place-items-center text-white shadow-lg shadow-cyan-200">
              <Pill className="size-7" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">RxScreen</h1>
              <p className="text-sm text-muted-foreground">โรงพยาบาลรือเสาะ</p>
            </div>
          </div>
          <h2 className="text-3xl font-bold leading-tight">
            ระบบคัดกรองใบสั่งยา<br />
            <span className="text-primary">ขับเคลื่อนด้วย AI</span>
          </h2>
          <p className="text-base text-muted-foreground">
            สแกน QR สติ๊กเกอร์ยา → ระบบดึงรายการยา + บอกข้อมูลที่ต้องการ → คัดกรองครบทุกหมวด
          </p>
          <ul className="space-y-3">
            <Feature icon={ShieldCheck} title="login รวดเร็ว" desc="ใส่เลขใบประกอบ 5 หลัก ระบบ login อัตโนมัติ" />
            <Feature icon={Stethoscope} title="คัดกรองครบทุกหมวด" desc="DDI, Renal, Allergy, Beers, Pregnancy, TDM ในหน้าเดียว" />
            <Feature icon={Sparkles} title="AI Summary" desc="Claude Haiku สรุปประเด็น + action items ในไม่กี่วินาที" />
          </ul>
        </div>

        {/* PIN login card */}
        <Card className="glass border-0">
          <CardContent className="p-6 sm:p-8">
            <div className="md:hidden flex items-center gap-3 mb-5">
              <div className="size-11 rounded-xl bg-gradient-to-br from-cyan-500 to-sky-600 grid place-items-center text-white shadow-md">
                <Pill className="size-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold">RxScreen</h1>
                <p className="text-xs text-muted-foreground">โรงพยาบาลรือเสาะ</p>
              </div>
            </div>

            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-700 text-xs font-medium dark:bg-cyan-950/50 dark:border-cyan-800 dark:text-cyan-300">
                <KeyRound className="size-3.5" />
                ใส่ PIN 5 หลัก ระบบจะ login อัตโนมัติ
              </div>
              <h3 className="text-2xl font-bold mt-3">เลขใบประกอบฯ</h3>
              <p className="text-sm text-muted-foreground mt-1">PIN 5 หลัก</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pin" className="sr-only">PIN</Label>
                <Input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH))}
                  autoComplete="off"
                  autoFocus
                  disabled={loading}
                  className="h-20 text-center text-5xl font-bold tracking-[0.5em] required-input"
                  placeholder="• • • • •"
                />
                {loading && (
                  <div className="text-center text-base text-primary fade-up flex items-center justify-center gap-2">
                    <Loader2 className="size-5 animate-spin" />
                    กำลังเข้าสู่ระบบ...
                  </div>
                )}
                {!loading && matched && pin.length === PIN_LENGTH && (
                  <div className="text-center text-base text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 fade-up dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                    👋 สวัสดี <b>{matched.name}</b>
                  </div>
                )}
                {error && !loading && (
                  <div className="text-center text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800">
                    {error}
                  </div>
                )}
              </div>

              {/* Number pad */}
              <div className="grid grid-cols-3 gap-2">
                {['1','2','3','4','5','6','7','8','9'].map((n) => (
                  <PadButton key={n} onClick={() => press(n)} disabled={loading}>{n}</PadButton>
                ))}
                <PadButton onClick={() => press('clr')} variant="muted" disabled={loading}>C</PadButton>
                <PadButton onClick={() => press('0')} disabled={loading}>0</PadButton>
                <PadButton onClick={() => press('del')} variant="muted" disabled={loading}>
                  <Delete className="size-5" />
                </PadButton>
              </div>

              <Button
                type="button"
                onClick={() => doLogin(pin)}
                className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-600 hover:to-sky-700"
                disabled={loading || pin.length !== PIN_LENGTH}
              >
                {loading ? 'กำลังเข้าสู่ระบบ...' : pin.length === PIN_LENGTH ? 'เข้าสู่ระบบ →' : `ใส่อีก ${PIN_LENGTH - pin.length} หลัก`}
              </Button>
            </div>

            <div className="mt-5 pt-4 border-t text-center text-xs text-muted-foreground">
              ไม่มี PIN? ติดต่อหัวหน้ากลุ่มงานเภสัชกรรม
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Feature({ icon: Icon, title, desc }: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string }) {
  return (
    <li className="flex gap-3">
      <div className="size-10 shrink-0 rounded-xl bg-white/70 dark:bg-slate-800 grid place-items-center text-primary shadow-sm">
        <Icon className="size-5" />
      </div>
      <div>
        <div className="font-semibold">{title}</div>
        <div className="text-sm text-muted-foreground">{desc}</div>
      </div>
    </li>
  )
}

function PadButton({ children, onClick, variant = 'default', disabled }: { children: React.ReactNode; onClick: () => void; variant?: 'default' | 'muted'; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-14 rounded-xl font-semibold text-2xl transition-all active:scale-95 border disabled:opacity-50 ${
        variant === 'muted'
          ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700'
          : 'bg-white hover:bg-slate-50 border-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 dark:border-slate-700'
      }`}
    >
      {children}
    </button>
  )
}
