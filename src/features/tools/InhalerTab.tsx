import { useState } from 'react'
import { Wind, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

interface Step {
  title: string
  detail?: string
}

const MDI_STEPS: Step[] = [
  { title: 'เขย่ายาก่อนใช้ 3-5 ครั้ง', detail: 'เพื่อให้ propellant + ตัวยาผสมเข้ากัน' },
  { title: 'เปิดฝา + ตรวจช่อง mouthpiece', detail: 'ไม่มีฝุ่น/สิ่งสกปรก' },
  { title: 'หายใจออกให้สุด (ออกข้างปาก)' },
  { title: 'คาบ mouthpiece ระหว่างฟัน + ปิดริมฝีปาก' },
  { title: 'เริ่มหายใจเข้าช้าๆ + กดยา 1 ครั้ง', detail: 'หายใจเข้าและกดยาพร้อมกัน — ช้าและลึก' },
  { title: 'หายใจเข้าจนสุด + กลั้นหายใจ 10 วินาที' },
  { title: 'หายใจออกช้าๆ + บ้วนปากด้วยน้ำสะอาด', detail: 'โดยเฉพาะ ICS เพื่อลด candidiasis' },
  { title: 'รอ 30-60 วินาที ก่อน puff ถัดไป' },
]

const MDI_SPACER_STEPS: Step[] = [
  { title: 'เขย่ายา 3-5 ครั้ง' },
  { title: 'ต่อ inhaler เข้ากับ spacer' },
  { title: 'หายใจออกให้สุด' },
  { title: 'คาบ mouthpiece spacer + ปิดริมฝีปาก' },
  { title: 'กดยา 1 ครั้ง → หายใจเข้าช้าๆ ลึกๆ 4-5 ครั้ง', detail: 'ใช้ spacer ดีกว่า MDI ตรง สำหรับเด็ก/ผู้สูงอายุ' },
  { title: 'กลั้นหายใจ 10 วินาที' },
  { title: 'บ้วนปากด้วยน้ำสะอาด' },
]

const DPI_STEPS: Step[] = [
  { title: 'เปิด/บรรจุยา ตามวิธีของแต่ละยี่ห้อ', detail: 'Accuhaler: เลื่อนคันโยก / Turbuhaler: หมุนฐาน' },
  { title: 'หายใจออกให้สุด (ห่างจาก mouthpiece)' },
  { title: 'คาบ mouthpiece + ปิดริมฝีปากแน่น' },
  { title: 'สูดยาเข้าให้ลึกและแรง', detail: '⚠ DPI ต่างจาก MDI — ต้องสูดแรง ไม่ช้า' },
  { title: 'กลั้นหายใจ 10 วินาที' },
  { title: 'บ้วนปากด้วยน้ำสะอาด' },
]

export function InhalerTab() {
  return (
    <Card className="soft-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Wind className="size-5 text-cyan-600" />Inhaler Technique Checklist</CardTitle>
        <CardDescription>ใช้ counseling ผู้ป่วยให้ใช้ inhaler ถูกวิธี — ติ๊กตามที่อธิบายแล้ว</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="mdi">
          <TabsList>
            <TabsTrigger value="mdi">MDI</TabsTrigger>
            <TabsTrigger value="mdi-spacer">MDI + Spacer</TabsTrigger>
            <TabsTrigger value="dpi">DPI</TabsTrigger>
          </TabsList>
          <TabsContent value="mdi" className="mt-4"><Checklist steps={MDI_STEPS} /></TabsContent>
          <TabsContent value="mdi-spacer" className="mt-4"><Checklist steps={MDI_SPACER_STEPS} /></TabsContent>
          <TabsContent value="dpi" className="mt-4"><Checklist steps={DPI_STEPS} /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

function Checklist({ steps }: { steps: Step[] }) {
  const [checked, setChecked] = useState<Set<number>>(new Set())
  function toggle(i: number) {
    setChecked((prev) => {
      const n = new Set(prev)
      if (n.has(i)) n.delete(i)
      else n.add(i)
      return n
    })
  }
  return (
    <div className="space-y-1.5">
      {steps.map((s, i) => {
        const on = checked.has(i)
        return (
          <button
            key={i}
            type="button"
            onClick={() => toggle(i)}
            className={cn(
              'w-full text-left rounded-xl border p-3 flex gap-3 items-start transition',
              on ? 'bg-emerald-50 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800' : 'hover:bg-accent',
            )}
          >
            <div className={cn('size-7 shrink-0 rounded-full grid place-items-center text-sm font-bold mt-0.5',
              on ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground',
            )}>
              {on ? <CheckCircle2 className="size-4" /> : i + 1}
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm">{s.title}</div>
              {s.detail && <div className="text-xs text-muted-foreground mt-0.5">{s.detail}</div>}
            </div>
          </button>
        )
      })}
      <div className="text-xs text-muted-foreground text-center pt-2">
        ✓ ติ๊กแล้ว {checked.size}/{steps.length} ขั้น
      </div>
    </div>
  )
}
