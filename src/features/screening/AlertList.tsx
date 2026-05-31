import { AlertTriangle, AlertCircle, Info, Lightbulb, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ScreeningAlert } from '@/types/screening'

const iconBySeverity = {
  red: AlertTriangle,
  orange: AlertCircle,
  yellow: Info,
  blue: Lightbulb,
}

const labelByType: Record<ScreeningAlert['type'], string> = {
  DDI: 'DDI',
  LAB: 'LAB',
  DISEASE: 'โรค',
  DRP: 'DRP',
  RENAL: 'RENAL',
  PED: 'PED',
  ALLERGY: 'แพ้ยา',
  HAD: 'HAD',
  LASA: 'LASA',
  PREG: 'ตั้งครรภ์',
  LACT: 'ให้นม',
  BEERS: 'Beers',
  G6PD: 'G6PD',
  FOOD: 'อาหาร',
  SMOKING: 'บุหรี่',
  ALCOHOL: 'แอลกอฮอล์',
  TDM: 'TDM',
  TIMING: 'เวลากิน',
  DUE: 'DUE',
  NO_CRUSH: 'ห้ามบด',
  COST: 'ยาแพง',
}

export function AlertList({ alerts }: { alerts: ScreeningAlert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="alert-green border rounded-xl p-5 flex items-center gap-3">
        <div className="size-10 rounded-full bg-emerald-100 grid place-items-center text-emerald-700">
          <CheckCircle2 className="size-5" />
        </div>
        <div>
          <div className="font-semibold">ผ่านการคัดกรอง</div>
          <div className="text-xs">ไม่พบความเสี่ยงสำคัญจากระบบ — สามารถจ่ายยาได้</div>
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-2 fade-up-stagger">
      {alerts.map((a) => {
        const Icon = iconBySeverity[a.severity]
        return (
          <div key={a.id} className={cn('border rounded-xl p-3.5 transition-all hover:shadow-sm', `alert-${a.severity}`)}>
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
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={a.severity} className="text-[10px]">{labelByType[a.type]}</Badge>
                  <span className="font-semibold text-sm">{a.title}</span>
                </div>
                <div className="text-xs mt-1 whitespace-pre-wrap leading-relaxed">{a.detail}</div>
                {a.recommendation && (
                  <div className="text-xs mt-2 font-medium rounded-md bg-white/50 px-2 py-1 inline-block">💡 {a.recommendation}</div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
