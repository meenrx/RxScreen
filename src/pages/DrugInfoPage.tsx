import { useState, useMemo } from 'react'
import { Search, BookOpen, ArrowLeft, Sparkles, Loader2, Pill, Coins } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/PageHeader'
import { useDrugs, useLabRules, useCounseling, useDdiOverrides, useDiseaseRules } from '@/features/catalog/hooks'
import { generateDrugMonograph } from '@/features/ai/monograph'
import { toast } from 'sonner'
import type { DrugMaster, LabRule, DrugCounseling, DdiOverride, DiseaseRule } from '@/types/drug'

export default function DrugInfoPage() {
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<DrugMaster | null>(null)
  const { data: drugs = [] } = useDrugs()
  const { data: labRules = [] } = useLabRules()
  const { data: counseling = [] } = useCounseling()
  const { data: ddi = [] } = useDdiOverrides()
  const { data: diseases = [] } = useDiseaseRules()

  const filtered = useMemo(() => {
    if (!q.trim()) return drugs.slice(0, 30)
    const s = q.toLowerCase()
    return drugs.filter((d) =>
      d.icode.toLowerCase().includes(s)
      || d.drug_name.toLowerCase().includes(s)
      || d.generic_name?.toLowerCase().includes(s)
      || d.drug_class?.toLowerCase().includes(s)
      || d.search_keywords?.some((k) => k.toLowerCase().includes(s)),
    ).slice(0, 50)
  }, [drugs, q])

  if (selected) {
    return (
      <Monograph
        drug={selected}
        labRules={labRules.filter((r) => r.icode === selected.icode)}
        counsel={counseling.find((c) => c.icode === selected.icode)}
        ddi={ddi.filter((x) => x.drug_a === selected.icode || x.drug_b === selected.icode
          || x.drug_a.toLowerCase() === selected.drug_name.toLowerCase() || x.drug_b.toLowerCase() === selected.drug_name.toLowerCase())}
        diseases={diseases.filter((x) => x.drug_icode === selected.icode || (x.drug_class && x.drug_class === selected.drug_class))}
        onBack={() => setSelected(null)}
      />
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <PageHeader
        icon={BookOpen}
        iconColor="from-sky-500 to-blue-600"
        title="ค้นข้อมูลยา (Drug Monograph)"
        description="พิมพ์ชื่อยาแล้วเลือก 1 รายการ เพื่อดู monograph ครบทุกด้าน"
      />

      <Card className="soft-card">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
            <Input
              className="h-12 pl-10 text-lg"
              placeholder="พิมพ์ icode / ชื่อยา / generic / class / คำค้น"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid sm:grid-cols-2 gap-2 fade-up-stagger">
        {filtered.length === 0 && <p className="text-muted-foreground italic text-sm">ไม่พบ — ลองคำอื่น</p>}
        {filtered.map((d) => (
          <button
            key={d.id ?? d.icode}
            type="button"
            onClick={() => setSelected(d)}
            className="text-left rounded-xl border bg-card p-3 hover:shadow-sm hover:border-primary/40 transition flex items-start gap-3"
          >
            <span className="size-9 shrink-0 rounded-lg bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 grid place-items-center">
              <Pill className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm truncate flex items-center gap-1.5">
                {d.drug_name}
                {d.is_HAD && <span className="had-badge text-[9px] px-1">HAD</span>}
              </div>
              <div className="text-[11px] text-muted-foreground truncate">
                {[d.generic_name, d.drug_class].filter(Boolean).join(' · ')}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

type MonographProps = {
  drug: DrugMaster
  labRules: LabRule[]
  counsel: DrugCounseling | undefined
  ddi: DdiOverride[]
  diseases: DiseaseRule[]
  onBack: () => void
}

function Monograph({ drug: d, labRules, counsel, ddi, diseases, onBack }: MonographProps) {
  const [aiText, setAiText] = useState('')
  const [loading, setLoading] = useState(false)

  async function runAi() {
    setLoading(true)
    try {
      const text = await generateDrugMonograph(d, labRules)
      setAiText(text)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <Button variant="ghost" onClick={onBack} className="-ml-2"><ArrowLeft className="size-4" /> กลับไปค้นหา</Button>

      <Card className="soft-card overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center gap-2 text-xl">
            <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{d.icode}</span>
            <span>{d.drug_name}</span>
            {d.is_HAD && <span className="had-badge">HAD</span>}
            {d.pregnancy_category && <Badge variant={d.pregnancy_category === 'X' ? 'red' : d.pregnancy_category === 'D' ? 'orange' : 'yellow'}>Pregnancy {d.pregnancy_category}</Badge>}
            {d.beers_avoid_elderly && <Badge variant="orange">Beers</Badge>}
            {d.g6pd_unsafe && <Badge variant="red">G6PD unsafe</Badge>}
            {d.lasa_with && d.lasa_with.length > 0 && <span className="lasa-badge">LASA</span>}
          </CardTitle>
          <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-0.5">
            {d.generic_name && <span>Generic: <b className="text-foreground/80">{d.generic_name}</b></span>}
            {d.drug_class && <span>Class: {d.drug_class}</span>}
            {d.strength && <span>ความแรง: {d.strength}</span>}
            {d.form && <span>รูปแบบ: {d.form}</span>}
            {d.drug_account && <span>บัญชี: {d.drug_account}</span>}
          </div>
          {(d.unit_cost !== undefined || d.unit_price !== undefined) && (
            <div className="flex items-center gap-2 text-sm mt-1">
              <Coins className="size-4 text-amber-500" />
              {d.unit_cost !== undefined && <span>ทุน {d.unit_cost.toLocaleString()} ฿</span>}
              {d.unit_price !== undefined && <span>· ขาย {d.unit_price.toLocaleString()} ฿</span>}
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {d.therapeutic && <Section title="ข้อบ่งใช้ (รพ.)">{d.therapeutic}</Section>}
          {d.search_keywords && d.search_keywords.length > 0 && (
            <Section title="ชื่อเรียกอื่น / คำค้น">{d.search_keywords.join(', ')}</Section>
          )}

          {labRules.length > 0 && (
            <Section title="ขนาดยา & การ monitor">
              <ul className="space-y-1">
                {labRules.map((r) => (
                  <li key={r.id}>
                    {r.param && <b>{r.param}: </b>}
                    {r.normal_range && <>ปกติ {r.normal_range} {r.unit}</>}
                    {r.dose_meta && <><br />ปรับตามไต: <code className="text-xs">{r.dose_meta}</code></>}
                    {(r.min_dose_kg || r.max_dose_kg) && <><br />เด็ก: {[r.min_dose_kg, r.max_dose_kg].filter(Boolean).join('–')} mg/kg/dose{r.conc_per_5ml ? ` · ความแรง ${r.conc_per_5ml}` : ''}</>}
                    {r.pediatric_dose && <><br />อ้างอิงเด็ก: {r.pediatric_dose}</>}
                    {r.max_dose_day && <><br />Max: {r.max_dose_day} mg/วัน</>}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {counsel && (
            <Section title="Counseling">
              {counsel.short_label && <p><b>Label:</b> {counsel.short_label}</p>}
              {(counsel.full_counseling || counsel.counseling_th) && <p className="whitespace-pre-wrap">{counsel.full_counseling || counsel.counseling_th}</p>}
              {counsel.side_effect && <p>อาการข้างเคียง: {counsel.side_effect}</p>}
              {counsel.when_to_er && <p className="text-red-600">⚠ พบแพทย์: {counsel.when_to_er}</p>}
              {counsel.storage && <p className="text-muted-foreground text-xs">การเก็บ: {counsel.storage}</p>}
            </Section>
          )}

          {ddi.length > 0 && (
            <Section title={`ปฏิกิริยาระหว่างยา (${ddi.length})`}>
              <ul className="space-y-1">
                {ddi.slice(0, 12).map((x) => (
                  <li key={x.id}>
                    <Badge variant={x.severity === 'major' || x.severity === 'contraindicated' ? 'red' : x.severity === 'moderate' ? 'orange' : 'yellow'} className="mr-2">{x.severity}</Badge>
                    กับ {x.drug_a === d.icode ? x.drug_b : x.drug_a}
                    {x.local_note && <span className="text-xs text-muted-foreground"> — {x.local_note}</span>}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {diseases.length > 0 && (
            <Section title="โรคที่ต้องระวัง">
              <ul className="space-y-1">
                {diseases.map((x) => (
                  <li key={x.id}>
                    <Badge variant={x.severity === 'contraindicated' ? 'red' : x.severity === 'avoid' ? 'orange' : 'yellow'}>{x.disease}</Badge>
                    <span className="ml-2">{x.note}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {(d.food_interaction || d.smoking_interaction || d.alcohol_interaction) && (
            <Section title="Lifestyle / อาหาร">
              {d.food_interaction && <p>🍽 อาหาร: {d.food_interaction}</p>}
              {d.smoking_interaction && <p>🚬 บุหรี่: {d.smoking_interaction}</p>}
              {d.alcohol_interaction && <p>🍺 แอลกอฮอล์: {d.alcohol_interaction}</p>}
            </Section>
          )}

          {d.note && <Section title="หมายเหตุ">{d.note}</Section>}
        </CardContent>
      </Card>

      {/* AI supplement */}
      <Card className="soft-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="size-7 rounded-lg bg-violet-100 dark:bg-violet-950/40 text-violet-600 grid place-items-center"><Sparkles className="size-4" /></span>
            สรุปเพิ่มด้วย AI (กลไก / ADR / counseling)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!aiText && (
            <Button onClick={runAi} disabled={loading} className="bg-gradient-to-r from-violet-500 to-purple-600">
              {loading ? <><Loader2 className="size-4 animate-spin" /> กำลังสรุป...</> : <><Sparkles className="size-4" /> ให้ AI ช่วยสรุป monograph</>}
            </Button>
          )}
          {aiText && (
            <>
              <div className="prose-sm whitespace-pre-wrap text-sm leading-relaxed rounded-xl border bg-muted/20 p-3">{aiText}</div>
              <Button variant="outline" size="sm" onClick={runAi} disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} สรุปใหม่
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{title}</div>
      <div>{children}</div>
    </div>
  )
}
