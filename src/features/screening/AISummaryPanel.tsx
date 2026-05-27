import { useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { generateAISummary } from '@/features/ai/summary'
import { toast } from 'sonner'
import type { PatientInput, ScreeningAlert, DrugEntry } from '@/types/screening'

interface Props {
  patient: PatientInput
  drugs: DrugEntry[]
  alerts: ScreeningAlert[]
  onResult?: (text: string) => void
}

export function AISummaryPanel({ patient, drugs, alerts, onResult }: Props) {
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState('')

  async function run() {
    if (drugs.length === 0) {
      toast.error('ยังไม่มียา')
      return
    }
    setLoading(true)
    try {
      const t = await generateAISummary({ patient, drugs, alerts })
      setText(t)
      onResult?.(t)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2"><Sparkles className="size-4 text-violet-500" /> สรุปด้วย AI (Claude Haiku)</h3>
          <Button size="sm" onClick={run} disabled={loading}>
            {loading ? <><Loader2 className="size-4 animate-spin" /> กำลังสรุป...</> : <><Sparkles className="size-4" /> สรุป</>}
          </Button>
        </div>
        {text ? (
          <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed border rounded-md p-3 bg-violet-50/40">
            {text}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">กดปุ่ม "สรุป" เพื่อให้ AI วิเคราะห์ประเด็นและสร้าง action items ให้เภสัชกร</p>
        )}
      </CardContent>
    </Card>
  )
}
