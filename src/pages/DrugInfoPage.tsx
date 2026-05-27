import { useState, useMemo } from 'react'
import { Search, BookOpen } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/PageHeader'
import { useDrugs, useLabRules, useCounseling, useDdiOverrides, useDiseaseRules } from '@/features/catalog/hooks'

export default function DrugInfoPage() {
  const [q, setQ] = useState('')
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
      || d.drug_class?.toLowerCase().includes(s),
    ).slice(0, 50)
  }, [drugs, q])

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <PageHeader
        icon={BookOpen}
        iconColor="from-sky-500 to-blue-600"
        title="ค้นข้อมูลยา (Drug Info)"
        description="ดูข้อมูลครบทุกด้านของยา 1 รายการ — class, dose, DDI, counseling, ข้อระวัง"
      />

      <Card className="soft-card">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
            <Input
              className="h-12 pl-10 text-lg"
              placeholder="พิมพ์ icode / ชื่อยา / generic / class"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3 fade-up-stagger">
        {filtered.length === 0 && <p className="text-muted-foreground italic text-sm">ไม่พบ — ลองคำอื่น</p>}
        {filtered.map((d) => {
          const cRules = labRules.filter((r) => r.icode === d.icode)
          const cCounsel = counseling.find((c) => c.icode === d.icode)
          const cDdi = ddi.filter((x) => x.drug_a === d.icode || x.drug_b === d.icode
            || x.drug_a.toLowerCase() === d.drug_name.toLowerCase() || x.drug_b.toLowerCase() === d.drug_name.toLowerCase())
          const cDis = diseases.filter((x) => x.drug_icode === d.icode || (x.drug_class && x.drug_class === d.drug_class))
          return (
            <Card key={d.id} className="soft-card overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{d.icode}</span>
                  <span>{d.drug_name}</span>
                  {d.is_HAD && <span className="had-badge">HAD</span>}
                  {d.pregnancy_category && <Badge variant={d.pregnancy_category === 'X' ? 'red' : d.pregnancy_category === 'D' ? 'orange' : 'yellow'}>Pregnancy {d.pregnancy_category}</Badge>}
                  {d.beers_avoid_elderly && <Badge variant="orange">Beers</Badge>}
                  {d.g6pd_unsafe && <Badge variant="red">G6PD unsafe</Badge>}
                  {d.lasa_with && d.lasa_with.length > 0 && <span className="lasa-badge">LASA</span>}
                </CardTitle>
                <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4">
                  {d.generic_name && <span>Generic: {d.generic_name}</span>}
                  {d.drug_class && <span>Class: {d.drug_class}</span>}
                  {d.unit && <span>Unit: {d.unit}</span>}
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {cRules.length > 0 && (
                  <Section title="Dose & Monitoring">
                    <ul className="space-y-1">
                      {cRules.map((r) => (
                        <li key={r.id} className="text-sm">
                          {r.param && <b>{r.param}: </b>}
                          {r.normal_range && <>ปกติ {r.normal_range} {r.unit}</>}
                          {r.dose_meta && <><br />Renal: <code className="text-xs">{r.dose_meta}</code></>}
                          {r.pediatric_dose && <><br />Pediatric: {r.pediatric_dose}</>}
                          {r.max_daily_dose && <><br />Max: {r.max_daily_dose}</>}
                          {r.tdm_range && <><br />TDM range: {r.tdm_range}</>}
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}
                {cCounsel && (
                  <Section title="Counseling">
                    {cCounsel.short_label && <p><b>Label:</b> {cCounsel.short_label}</p>}
                    {cCounsel.full_counseling && <p className="whitespace-pre-wrap">{cCounsel.full_counseling}</p>}
                    {cCounsel.warning && <p className="text-red-600">⚠ {cCounsel.warning}</p>}
                    {cCounsel.storage && <p className="text-muted-foreground text-xs">การเก็บ: {cCounsel.storage}</p>}
                  </Section>
                )}
                {cDdi.length > 0 && (
                  <Section title={`DDI (${cDdi.length})`}>
                    <ul className="space-y-1">
                      {cDdi.slice(0, 8).map((x) => (
                        <li key={x.id}>
                          <Badge variant={x.severity === 'major' || x.severity === 'contraindicated' ? 'red' : x.severity === 'moderate' ? 'orange' : 'yellow'} className="mr-2">{x.severity}</Badge>
                          กับ {x.drug_a === d.icode ? x.drug_b : x.drug_a}
                          {x.local_note && <span className="text-xs text-muted-foreground"> — {x.local_note}</span>}
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}
                {cDis.length > 0 && (
                  <Section title="โรคที่ต้องระวัง">
                    <ul>
                      {cDis.map((x) => (
                        <li key={x.id}>
                          <Badge variant={x.severity === 'contraindicated' ? 'red' : x.severity === 'avoid' ? 'orange' : 'yellow'}>{x.disease}</Badge>
                          <span className="ml-2 text-sm">{x.note}</span>
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}
                {(d.food_interaction || d.smoking_interaction || d.alcohol_interaction) && (
                  <Section title="Lifestyle">
                    {d.food_interaction && <p>🍽 อาหาร: {d.food_interaction}</p>}
                    {d.smoking_interaction && <p>🚬 บุหรี่: {d.smoking_interaction}</p>}
                    {d.alcohol_interaction && <p>🍺 แอลกอฮอล์: {d.alcohol_interaction}</p>}
                  </Section>
                )}
                {d.note && <Section title="Note">{d.note}</Section>}
              </CardContent>
            </Card>
          )
        })}
      </div>
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
