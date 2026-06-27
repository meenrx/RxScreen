import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ClipboardCheck, Activity, Pill, Baby, AlertTriangle, Database, TrendingUp, Users, Sparkles, ArrowRight, Stethoscope, PiggyBank, Coins,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useDrugs, useDdiOverrides } from '@/features/catalog/hooks'
import { useInterventions, sumSaved } from '@/features/intervention/hooks'
import { listAllHistory } from '@/features/history/api'
import { useAuthStore } from '@/features/auth/authStore'
import { formatBE, formatBEDateTime } from '@/lib/format'

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const { data: drugs = [] } = useDrugs()
  const { data: ddi = [] } = useDdiOverrides()
  const { data: history = [] } = useQuery({ queryKey: ['history-all'], queryFn: () => listAllHistory(200) })
  const { data: interventions = [] } = useInterventions()

  const totalSaved = useMemo(() => sumSaved(interventions), [interventions])
  const topInterventions = useMemo(
    () => [...interventions].sort((a, b) => (b.total_saved ?? 0) - (a.total_saved ?? 0)).slice(0, 6),
    [interventions],
  )

  const today = useMemo(() => new Date(), [])
  const todayList = useMemo(() => history.filter((h) => sameDay(h.createdAt, today)), [history, today])
  const myToday = useMemo(() => todayList.filter((h) => h.pharmacist_uid === user?.uid).length, [todayList, user])
  const totalAlerts = useMemo(() => history.reduce((s, h) => s + (h.alerts_count ?? 0), 0), [history])
  const redAlertsToday = useMemo(() => todayList.reduce((s, h) => s + (h.alerts_count ?? 0), 0), [todayList])

  const topDrugs = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>()
    for (const h of history) {
      for (const d of h.drugs ?? []) {
        const ex = map.get(d.icode)
        if (ex) ex.count++
        else map.set(d.icode, { name: d.drug_name, count: 1 })
      }
    }
    return [...map.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 5)
  }, [history])

  const maxCount = topDrugs[0]?.[1].count ?? 1

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-4">
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-cyan-500 via-sky-600 to-blue-700 dark:from-cyan-700 dark:via-sky-800 dark:to-blue-900 text-white p-6 md:p-8">
        <div className="absolute -right-12 -top-12 size-48 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -right-8 bottom-0 size-64 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-cyan-100 text-sm">
              <Stethoscope className="size-4" />
              <span>วันนี้ {formatBE(today, 'D MMMM BBBB')}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mt-1.5">สวัสดี {user?.displayName} 👋</h1>
            <p className="text-cyan-50 text-sm mt-1">พร้อมคัดกรองใบสั่งยาให้ผู้ป่วยอย่างปลอดภัย</p>
          </div>
          <Link to="/screening">
            <Button className="bg-white text-cyan-700 hover:bg-cyan-50 shadow-lg shadow-cyan-900/20 h-11 px-5 font-semibold dark:bg-slate-100 dark:text-cyan-800">
              <ClipboardCheck className="size-4" />
              เริ่มคัดกรองเลย
              <ArrowRight className="size-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 fade-up-stagger">
        <StatCard label="คัดกรองวันนี้" sub="ทั้งโรงพยาบาล" value={todayList.length} icon={ClipboardCheck} grad="stat-grad-cyan" iconColor="text-cyan-600" />
        <StatCard label="ของฉันวันนี้" sub="โดยคุณ" value={myToday} icon={Users} grad="stat-grad-emerald" iconColor="text-emerald-600" />
        <StatCard label="Alerts วันนี้" sub="พบสัญญาณ" value={redAlertsToday} icon={AlertTriangle} grad="stat-grad-amber" iconColor="text-amber-600" />
        <StatCard label="ยาในระบบ" sub={`DDI ${ddi.length} คู่`} value={drugs.length} icon={Pill} grad="stat-grad-violet" iconColor="text-violet-600" />
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-base font-semibold mb-2 flex items-center gap-2">
          <Sparkles className="size-4 text-violet-500" /> ใช้งานบ่อย
        </h2>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2.5 fade-up-stagger">
          <QuickLink to="/screening" label="คัดกรอง" icon={ClipboardCheck} color="from-emerald-500 to-teal-600" />
          <QuickLink to="/renal" label="Renal Dose" icon={Activity} color="from-rose-500 to-pink-600" />
          <QuickLink to="/warfarin" label="Warfarin" icon={Pill} color="from-violet-500 to-purple-600" />
          <QuickLink to="/pediatric" label="ขนาดยาเด็ก" icon={Baby} color="from-amber-500 to-orange-600" />
          <QuickLink to="/ddi" label="ตรวจ DDI" icon={AlertTriangle} color="from-orange-500 to-red-600" />
          <QuickLink to="/admin" label="ฐานข้อมูล" icon={Database} color="from-slate-500 to-slate-700" />
        </div>
      </div>

      {/* Top + Today */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="soft-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="size-7 rounded-lg bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300 grid place-items-center">
                <TrendingUp className="size-4" />
              </span>
              ยาที่คัดกรองบ่อย <span className="text-muted-foreground font-normal text-xs">Top 5</span>
            </CardTitle>
            <CardDescription>นับจากประวัติ 200 รายการล่าสุด</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {topDrugs.length === 0 && <p className="text-sm text-muted-foreground italic">ยังไม่มีข้อมูล — เริ่มคัดกรองครั้งแรกได้เลย</p>}
            {topDrugs.map(([icode, info], i) => {
              const pct = (info.count / maxCount) * 100
              return (
                <div key={icode} className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className={`size-7 rounded-lg grid place-items-center text-xs font-bold ${rankColor(i)}`}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-sm">{info.name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{icode}</div>
                    </div>
                    <Badge variant="secondary" className="text-xs">{info.count}</Badge>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden ml-10">
                    <div className="h-full bg-gradient-to-r from-cyan-400 to-sky-600 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card className="soft-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="size-7 rounded-lg bg-emerald-100 text-emerald-700 grid place-items-center">
                <ClipboardCheck className="size-4" />
              </span>
              กิจกรรมวันนี้
            </CardTitle>
            <CardDescription>{todayList.length} รายการ</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {todayList.length === 0 && <p className="text-sm text-muted-foreground italic">ยังไม่มีกิจกรรมวันนี้</p>}
            {todayList.slice(0, 6).map((h) => (
              <div key={h.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                <div className="size-8 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 grid place-items-center text-slate-700 font-semibold text-xs">
                  {(h.pharmacist_name ?? '?').charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{h.patient_name ?? h.hn ?? 'ไม่ระบุชื่อ'}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {h.drugs?.length ?? 0} ยา · {h.pharmacist_name} · {formatBEDateTime(h.createdAt)}
                  </div>
                </div>
                <Badge variant={h.alerts_count > 0 ? 'orange' : 'green'} className="shrink-0">{h.alerts_count}</Badge>
              </div>
            ))}
            {todayList.length > 6 && (
              <Link to="/history" className="block text-center text-xs text-primary hover:underline pt-1">
                ดูทั้งหมด ({todayList.length} รายการ) →
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Intervention & มูลค่าประหยัด */}
      <Card className="soft-card overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="size-7 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 grid place-items-center">
              <PiggyBank className="size-4" />
            </span>
            มูลค่าประหยัดจาก Intervention
          </CardTitle>
          <CardDescription>จากการ off / เปลี่ยนยา แล้วหมอสั่งซ้ำ (จำนวน × ราคาทุน)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-5 flex items-center gap-4">
            <Coins className="size-9 opacity-90" />
            <div>
              <div className="text-emerald-50 text-xs">ประหยัดได้รวมทั้งหมด</div>
              <div className="text-3xl font-bold leading-tight">
                {totalSaved.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท
              </div>
              <div className="text-emerald-100 text-xs mt-0.5">{interventions.length} รายการ intervention</div>
            </div>
          </div>

          {topInterventions.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              ยังไม่มี intervention — บันทึกได้จากหน้าคัดกรอง (ส่วน "Intervention & มูลค่าประหยัด")
            </p>
          ) : (
            <div className="space-y-1.5">
              {topInterventions.map((i) => (
                <div key={i.id} className="flex items-center gap-2 py-2 border-b last:border-0">
                  <Badge variant={i.status === 'off' ? 'red' : 'orange'} className="shrink-0">
                    {i.status === 'off' ? 'off' : 'เปลี่ยน'}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{i.drug_name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      HN {i.hn} · สั่งซ้ำ {i.reorder_count} ครั้ง · {i.total_qty} หน่วย
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-semibold text-emerald-700 dark:text-emerald-300 text-sm">
                      {(i.total_saved ?? 0).toLocaleString()} ฿
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* System status */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <SystemStat label="DDI" value={ddi.length} unit="คู่" />
        <SystemStat label="ยาในฐาน" value={drugs.length} unit="รายการ" />
        <SystemStat label="Alerts สะสม" value={totalAlerts} unit="" />
        <SystemStat label="ประวัติคัดกรอง" value={history.length} unit="" />
      </div>
    </div>
  )
}

function rankColor(i: number) {
  const colors = [
    'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
    'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300',
    'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300',
    'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300',
  ]
  return colors[i] ?? 'bg-muted text-muted-foreground'
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function StatCard({ label, sub, value, icon: Icon, grad, iconColor }: { label: string; sub: string; value: number; icon: React.ComponentType<{ className?: string }>; grad: string; iconColor: string }) {
  return (
    <Card className={`${grad} border-0 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5`}>
      <CardContent className="pt-6 pb-5">
        <div className="flex items-start gap-3">
          <div className={`size-10 rounded-xl bg-white/80 dark:bg-slate-900/60 grid place-items-center ${iconColor} shadow-sm`}>
            <Icon className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-2xl md:text-3xl font-bold leading-none">{value}</div>
            <div className="text-xs font-medium mt-1">{label}</div>
            <div className="text-[10px] text-muted-foreground">{sub}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function QuickLink({ to, label, icon: Icon, color }: { to: string; label: string; icon: React.ComponentType<{ className?: string }>; color: string }) {
  return (
    <Link to={to} className="tap-card">
      <div className={`size-10 rounded-xl bg-gradient-to-br ${color} grid place-items-center text-white shadow-sm`}>
        <Icon className="size-5" />
      </div>
      <span className="text-[11px] font-medium leading-tight">{label}</span>
    </Link>
  )
}

function SystemStat({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-xl border bg-card/60 backdrop-blur-sm p-3">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-lg font-bold mt-0.5">{value} <span className="text-xs font-normal text-muted-foreground">{unit}</span></div>
    </div>
  )
}
