import { CheckSquare, Target, Eye, FileText, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import type { DrugEntry, PatientInput, ScreeningAlert } from '@/types/screening'
import { buildRuleSummary } from './ruleSummary'

interface Props {
  patient: PatientInput
  drugs: DrugEntry[]
  alerts: ScreeningAlert[]
}

/** สรุปแบบ rule-based — สังเคราะห์จากเกณฑ์ที่ตั้งไว้ในฐานข้อมูล ไม่ใช่ AI */
export function RuleSummaryPanel({ patient, drugs, alerts }: Props) {
  if (drugs.length === 0) return null
  const s = buildRuleSummary(patient, drugs, alerts)

  return (
    <Card className="soft-card border-cyan-200 dark:border-cyan-900">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="size-7 rounded-lg bg-gradient-to-br from-cyan-500 to-sky-600 text-white grid place-items-center">
            <FileText className="size-3.5" />
          </span>
          สรุปผลคัดกรอง (จากเกณฑ์ที่ตั้งไว้)
        </CardTitle>
        <CardDescription className="text-xs">{s.headline}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {s.keyPoints.length > 0 && (
            <Section icon={Target} title="ประเด็นสำคัญ" tone="red" items={s.keyPoints} />
          )}
          {s.actions.length > 0 && (
            <Section icon={CheckSquare} title="Action สำหรับเภสัชกร" tone="emerald" items={s.actions} />
          )}
          {s.monitorList.length > 0 && (
            <Section icon={Eye} title="ค่าที่ต้อง monitor" tone="amber" items={s.monitorList} />
          )}
          {s.notes.length > 0 && (
            <Section icon={AlertCircle} title="หมายเหตุ" tone="slate" items={s.notes} />
          )}
        </div>
        {s.keyPoints.length === 0 && s.actions.length === 0 && s.monitorList.length === 0 && (
          <p className="text-sm text-muted-foreground italic">ไม่มีประเด็นสำคัญที่ต้องสรุป</p>
        )}
      </CardContent>
    </Card>
  )
}

function Section({ icon: Icon, title, tone, items }: { icon: React.ComponentType<{ className?: string }>; title: string; tone: 'red' | 'emerald' | 'amber' | 'slate'; items: string[] }) {
  const toneClass = {
    red: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900 text-red-700 dark:text-red-300',
    emerald: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300',
    amber: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900 text-amber-700 dark:text-amber-300',
    slate: 'bg-slate-50 border-slate-200 dark:bg-slate-900 dark:border-slate-700 text-slate-700 dark:text-slate-300',
  }[tone]
  return (
    <div className={`rounded-lg border p-2.5 ${toneClass}`}>
      <div className="flex items-center gap-1.5 font-semibold mb-1 text-sm">
        <Icon className="size-3.5" />
        {title} <span className="text-[10px] opacity-70">({items.length})</span>
      </div>
      <ul className="space-y-0.5 text-xs text-foreground">
        {items.map((x, i) => <li key={i} className="flex gap-1.5 leading-snug"><span className="opacity-60 shrink-0">•</span><span>{x}</span></li>)}
      </ul>
    </div>
  )
}
