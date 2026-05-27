import { AlertTriangle, AlertCircle, Info, Lightbulb, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { AlertType, ScreeningAlert } from '@/types/screening'

const iconBySeverity = { red: AlertTriangle, orange: AlertCircle, yellow: Info, blue: Lightbulb }

/** กลุ่ม alert ตามหมวด — เรียงตามความสำคัญ */
const CATEGORIES: { type: AlertType; label: string; emoji: string }[] = [
  { type: 'ALLERGY', label: 'แพ้ยา / Cross-reactivity', emoji: '🚨' },
  { type: 'HAD', label: 'High Alert Drug (ยาเสี่ยงสูง)', emoji: '🔴' },
  { type: 'G6PD', label: 'G6PD-unsafe', emoji: '🩸' },
  { type: 'DDI', label: 'ปฏิกิริยาระหว่างยา (DDI)', emoji: '⚠️' },
  { type: 'PREG', label: 'ตั้งครรภ์', emoji: '🤰' },
  { type: 'LACT', label: 'ให้นมบุตร', emoji: '🤱' },
  { type: 'BEERS', label: 'Beers Criteria (ผู้สูงอายุ)', emoji: '👴' },
  { type: 'RENAL', label: 'ปรับขนาดตามไต (Renal)', emoji: '🫘' },
  { type: 'DRP', label: 'ยาซ้ำ (Duplicate)', emoji: '🔁' },
  { type: 'LAB', label: 'ค่า LAB ที่ต้อง monitor', emoji: '📋' },
  { type: 'DISEASE', label: 'โรคประจำตัว', emoji: '🏥' },
  { type: 'PED', label: 'ขนาดยาเด็ก (Pediatric)', emoji: '👶' },
  { type: 'LASA', label: 'LASA (ชื่อ/หน้าตาคล้าย)', emoji: '🔤' },
  { type: 'FOOD', label: 'ปฏิกิริยากับอาหาร', emoji: '🍽' },
  { type: 'SMOKING', label: 'สูบบุหรี่', emoji: '🚬' },
  { type: 'ALCOHOL', label: 'แอลกอฮอล์', emoji: '🍺' },
  { type: 'TDM', label: 'TDM (ระดับยาในเลือด)', emoji: '🧪' },
]

export function GroupedAlertList({ alerts }: { alerts: ScreeningAlert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="alert-green border rounded-xl p-5 flex items-center gap-3">
        <div className="size-10 rounded-full bg-emerald-100 grid place-items-center text-emerald-700">
          <CheckCircle2 className="size-5" />
        </div>
        <div>
          <div className="font-semibold text-lg">ผ่านการคัดกรอง</div>
          <div className="text-sm">ไม่พบความเสี่ยงสำคัญ — สามารถจ่ายยาได้</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 fade-up-stagger">
      {CATEGORIES.map(({ type, label, emoji }) => {
        const list = alerts.filter((a) => a.type === type)
        if (list.length === 0) return null
        const topSev = list.reduce<ScreeningAlert['severity']>((s, a) => sevRank(a.severity) < sevRank(s) ? a.severity : s, 'blue')
        return (
          <section key={type} className="rounded-2xl border overflow-hidden">
            <header className={cn('flex items-center gap-2 px-4 py-2.5 border-b font-semibold text-sm',
              topSev === 'red' && 'bg-red-50 dark:bg-red-950/30 text-red-900 dark:text-red-200',
              topSev === 'orange' && 'bg-orange-50 dark:bg-orange-950/30 text-orange-900 dark:text-orange-200',
              topSev === 'yellow' && 'bg-yellow-50 dark:bg-yellow-950/30 text-yellow-900 dark:text-yellow-200',
              topSev === 'blue' && 'bg-sky-50 dark:bg-sky-950/30 text-sky-900 dark:text-sky-200',
            )}>
              <span>{emoji}</span>
              <span>{label}</span>
              <Badge variant={topSev} className="ml-auto">{list.length}</Badge>
            </header>
            <div className="p-2 space-y-1.5 bg-card">
              {list.map((a) => <AlertItem key={a.id} alert={a} />)}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function AlertItem({ alert: a }: { alert: ScreeningAlert }) {
  const Icon = iconBySeverity[a.severity]
  return (
    <div className={cn('rounded-xl border p-3 transition-all', `alert-${a.severity}`)}>
      <div className="flex items-start gap-3">
        <div className={cn('size-8 shrink-0 rounded-lg grid place-items-center',
          a.severity === 'red' && 'bg-red-100 text-red-700',
          a.severity === 'orange' && 'bg-orange-100 text-orange-700',
          a.severity === 'yellow' && 'bg-yellow-100 text-yellow-700',
          a.severity === 'blue' && 'bg-sky-100 text-sky-700',
        )}>
          <Icon className="size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">{a.title}</div>
          <div className="text-xs mt-1 whitespace-pre-wrap leading-relaxed">{a.detail}</div>
          {a.recommendation && (
            <div className="text-xs mt-2 font-medium rounded-md bg-white/60 dark:bg-slate-800/60 px-2 py-1 inline-block">💡 {a.recommendation}</div>
          )}
        </div>
      </div>
    </div>
  )
}

function sevRank(s: ScreeningAlert['severity']): number {
  return s === 'red' ? 0 : s === 'orange' ? 1 : s === 'yellow' ? 2 : 3
}
