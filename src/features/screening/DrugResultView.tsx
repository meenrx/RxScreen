import { useState } from 'react'
import { CheckCircle2, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { AlertType, DrugEntry, ScreeningAlert } from '@/types/screening'

/** emoji + ป้ายสั้น ต่อชนิด alert — ใช้เป็น chip ในการ์ดยา */
const TYPE_META: Record<AlertType, { emoji: string; label: string }> = {
  ALLERGY: { emoji: '🚨', label: 'แพ้ยา' },
  HAD: { emoji: '🔴', label: 'HAD' },
  G6PD: { emoji: '🩸', label: 'G6PD' },
  DDI: { emoji: '⚠️', label: 'DDI' },
  PREG: { emoji: '🤰', label: 'ตั้งครรภ์' },
  LACT: { emoji: '🤱', label: 'ให้นม' },
  BEERS: { emoji: '👴', label: 'Beers' },
  RENAL: { emoji: '🫘', label: 'ไต' },
  DRP: { emoji: '🔁', label: 'ยาซ้ำ' },
  COST: { emoji: '💰', label: 'ราคาสูง' },
  SUBST: { emoji: '🔄', label: 'เปลี่ยนบริษัท' },
  LAB: { emoji: '📋', label: 'LAB' },
  DISEASE: { emoji: '🏥', label: 'โรค' },
  PED: { emoji: '👶', label: 'เด็ก' },
  LASA: { emoji: '🔤', label: 'LASA' },
  FOOD: { emoji: '🍽', label: 'อาหาร' },
  SMOKING: { emoji: '🚬', label: 'บุหรี่' },
  ALCOHOL: { emoji: '🍺', label: 'แอลกอฮอล์' },
  TDM: { emoji: '🧪', label: 'TDM' },
  TIMING: { emoji: '⏰', label: 'เวลากิน' },
  DUE: { emoji: '📋', label: 'DUE' },
  NO_CRUSH: { emoji: '⚠️', label: 'ห้ามบด' },
  RDU: { emoji: '📋', label: 'RDU' },
  OMIT: { emoji: '💊', label: 'ควรได้เพิ่ม' },
}

type Severity = ScreeningAlert['severity']
function sevRank(s: Severity): number {
  return s === 'red' ? 0 : s === 'orange' ? 1 : s === 'yellow' ? 2 : 3
}
function worstSev(list: ScreeningAlert[]): Severity {
  return list.reduce<Severity>((s, a) => (sevRank(a.severity) < sevRank(s) ? a.severity : s), 'blue')
}
/** ข้อความ action ต่อ 1 alert — เน้น recommendation ก่อน ไม่งั้นใช้บรรทัดแรกของ detail */
function actionText(a: ScreeningAlert): string {
  return a.recommendation || a.detail.split('\n')[0] || a.title
}

/** ไอคอนไต (SVG) — ชัดเจนกว่า emoji ถั่ว */
function KidneyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-label="ไต" role="img">
      <path d="M15.5 2C11 2 8 5.5 8 10c0 1.8.6 3 1.2 4.2.5 1 1 1.9 1 3.3 0 1.4-.9 2.5-2.2 2.5C5.7 22 3.5 19 3.5 15 3.5 8 8 3 14 3c2.2 0 4 .8 5.2 2.2.5.6-.1 1.5-.9 1.4C16.8 4.5 15.6 4 14.2 4" />
    </svg>
  )
}
/** แสดงสัญลักษณ์ชนิด alert — RENAL ใช้รูปไต SVG, ที่เหลือใช้ emoji */
function TypeGlyph({ type, className }: { type: AlertType; className?: string }) {
  if (type === 'RENAL') return <KidneyIcon className={cn('inline align-[-2px] size-[1.05em] text-rose-500', className)} />
  return <span>{TYPE_META[type].emoji}</span>
}

export function DrugResultView({ drugs, alerts }: { drugs: DrugEntry[]; alerts: ScreeningAlert[] }) {
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

  // ข้ามยา = alert ที่พาดพิงยา ≥2 ตัว (DDI / ยาซ้ำ / LASA คู่) หรือไม่ผูกกับยาตัวใดเลย
  const crossDrug = alerts.filter((a) => (a.drugs?.length ?? 0) !== 1)

  // จับ alert รายตัว (1 icode) เข้าการ์ดของยาแต่ละตัว
  const byDrug = new Map<string, ScreeningAlert[]>()
  for (const a of alerts) {
    if (a.drugs?.length === 1) {
      const ic = a.drugs[0]
      const arr = byDrug.get(ic) ?? []
      arr.push(a)
      byDrug.set(ic, arr)
    }
  }
  // alert รายตัวที่หา icode ในรายการยาไม่เจอ → โยนไปกล่องข้ามยา กันตกหล่น
  const knownIcodes = new Set(drugs.map((d) => d.icode))
  const orphan = alerts.filter((a) => a.drugs?.length === 1 && !knownIcodes.has(a.drugs[0]))
  const crossAll = [...crossDrug, ...orphan].sort((a, b) => sevRank(a.severity) - sevRank(b.severity))

  const withAlerts = drugs
    .map((d) => ({ drug: d, list: byDrug.get(d.icode) ?? [] }))
    .filter((x) => x.list.length > 0)
    .sort((a, b) => sevRank(worstSev(a.list)) - sevRank(worstSev(b.list)))
  const clean = drugs.filter((d) => (byDrug.get(d.icode) ?? []).length === 0)

  return (
    <div className="space-y-3 fade-up-stagger">
      {/* ── ประเด็นข้ามยา ── */}
      {crossAll.length > 0 && (
        <section className="rounded-2xl border overflow-hidden">
          <header className={cn('flex items-center gap-2 px-4 py-2.5 border-b font-semibold text-sm', headerTone(worstSev(crossAll)))}>
            <span>🔗</span>
            <span>ประเด็นข้ามยา</span>
            <Badge variant={worstSev(crossAll)} className="ml-auto">{crossAll.length}</Badge>
          </header>
          <div className="p-2 space-y-1.5 bg-card">
            {crossAll.map((a) => (
              <div key={a.id} className={cn('rounded-xl border p-2.5', `alert-${a.severity}`)}>
                <div className="flex items-start gap-2">
                  <span className="shrink-0"><TypeGlyph type={a.type} /></span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm leading-snug">{a.title}</div>
                    {a.recommendation
                      ? <div className="text-xs font-medium mt-0.5">💡 {a.recommendation}</div>
                      : <div className="text-xs opacity-80 mt-0.5 whitespace-pre-wrap">{a.detail}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── รายตัวยา ── */}
      {withAlerts.map(({ drug, list }) => <DrugCard key={drug.icode} drug={drug} list={list} />)}

      {/* ── ยาที่ผ่าน (ไม่มี alert) ── */}
      {clean.length > 0 && (
        <div className="alert-green border rounded-xl px-3 py-2 flex items-start gap-2 text-sm">
          <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-600" />
          <div>
            <b>ผ่าน ({clean.length})</b>
            <span className="text-muted-foreground"> · {clean.map((d) => d.drug_name).join(' · ')}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function DrugCard({ drug, list }: { drug: DrugEntry; list: ScreeningAlert[] }) {
  const [open, setOpen] = useState(true)  // แสดงรายละเอียดเลย ไม่ต้องกด
  const sorted = [...list].sort((a, b) => sevRank(a.severity) - sevRank(b.severity))
  const worst = worstSev(sorted)
  const types = [...new Set(sorted.map((a) => a.type))]

  return (
    <div className={cn('rounded-xl border overflow-hidden', `alert-${worst}`)}>
      {/* หัวการ์ด: จุดสี + ชื่อยา + chip ชนิดปัญหา */}
      <div className="flex items-center gap-2 px-3 py-2">
        <span className={cn('size-2.5 rounded-full shrink-0', dotTone(worst))} />
        <span className="font-semibold text-sm truncate">{drug.drug_name}</span>
        {drug.master?.strength && <span className="text-[11px] text-muted-foreground shrink-0">{drug.master.strength}</span>}
        <div className="ml-auto flex flex-wrap gap-1 justify-end">
          {types.map((t) => (
            <span key={t} className="text-[11px] px-1.5 py-0.5 rounded-full border bg-card/70 whitespace-nowrap inline-flex items-center gap-0.5">
              <TypeGlyph type={t} /> {TYPE_META[t].label}
            </span>
          ))}
        </div>
      </div>

      {/* action ต่อประเด็น — เน้นขนาด/สิ่งที่ต้องทำ */}
      <div className="px-3 pb-2 space-y-1">
        {sorted.map((a) => (
          <div key={a.id} className="flex gap-1.5 text-sm">
            <span className="shrink-0"><TypeGlyph type={a.type} /></span>
            <span className={cn('min-w-0', a.recommendation ? 'font-semibold' : 'text-muted-foreground')}>
              {actionText(a)}
            </span>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground pt-0.5"
        >
          <ChevronDown className={cn('size-3 transition-transform', open && 'rotate-180')} />
          {open ? 'ซ่อนรายละเอียด' : 'ดูรายละเอียด'}
        </button>
        {open && (
          <div className="space-y-1.5 pt-1 border-t mt-1">
            {sorted.map((a) => (
              <div key={a.id} className="text-xs">
                <div className="font-medium">{a.title}</div>
                <div className="opacity-80 whitespace-pre-wrap leading-relaxed">{a.detail}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function headerTone(s: Severity): string {
  return s === 'red' ? 'bg-red-50 dark:bg-red-950/30 text-red-900 dark:text-red-200'
    : s === 'orange' ? 'bg-orange-50 dark:bg-orange-950/30 text-orange-900 dark:text-orange-200'
    : s === 'yellow' ? 'bg-yellow-50 dark:bg-yellow-950/30 text-yellow-900 dark:text-yellow-200'
    : 'bg-sky-50 dark:bg-sky-950/30 text-sky-900 dark:text-sky-200'
}
function dotTone(s: Severity): string {
  return s === 'red' ? 'bg-red-500' : s === 'orange' ? 'bg-orange-500' : s === 'yellow' ? 'bg-yellow-500' : 'bg-sky-500'
}
