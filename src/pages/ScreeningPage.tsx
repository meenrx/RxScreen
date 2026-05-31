import { useMemo, useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ClipboardCheck, RotateCcw, Save, ScanLine, Pill, Stethoscope, Sparkles, ListChecks, Printer, FileText, Coins } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { CollapsibleSection } from '@/components/Collapsible'
import { SmartPatientForm } from '@/features/screening/SmartPatientForm'
import { DrugInput } from '@/features/screening/DrugInput'
import { GroupedAlertList } from '@/features/screening/GroupedAlertList'
import { AISummaryPanel } from '@/features/screening/AISummaryPanel'
import { RuleSummaryPanel } from '@/features/screening/RuleSummaryPanel'
import { Sticker57Panel } from '@/features/screening/Sticker57'
import { CounselingChecklist } from '@/features/screening/CounselingChecklist'
import { PdfExportButton } from '@/features/screening/PdfExport'
import { QrScannerModal, type ScannedData } from '@/features/screening/QrScanner'
import { WarfarinScreenPanel, hasWarfarin } from '@/features/screening/WarfarinScreenPanel'
import { DiseaseScreeningPanel } from '@/features/disease/DiseaseScreeningPanel'
import { useScreeningData } from '@/features/screening/useScreeningData'
import { useScreeningStore } from '@/features/screening/screeningStore'
import { runScreening } from '@/features/screening/engine'
import { InterventionSection } from '@/features/intervention/InterventionSection'
import { InterventionReorderWatcher } from '@/features/intervention/InterventionReorderWatcher'
import { logDispensing } from '@/features/history/api'
import { useAuthStore } from '@/features/auth/authStore'
import { getConfig, getDrugByIcode, listLabRulesByIcode } from '@/features/catalog/api'
import { toast } from 'sonner'
import type { DrugEntry } from '@/types/screening'

export default function ScreeningPage() {
  const patient = useScreeningStore((s) => s.patient)
  const drugs = useScreeningStore((s) => s.drugs)
  const aiText = useScreeningStore((s) => s.aiText)
  const setPatient = useScreeningStore((s) => s.setPatient)
  const setDrugs = useScreeningStore((s) => s.setDrugs)
  const setAiText = useScreeningStore((s) => s.setAiText)
  const resetStore = useScreeningStore((s) => s.reset)

  const [mode, setMode] = useState<'drug' | 'disease'>('drug')
  const [qrOpen, setQrOpen] = useState(false)
  const [selectedDiseases, setSelectedDiseases] = useState<string[]>([])
  const [labValues, setLabValues] = useState<Record<string, number | undefined>>({})

  const user = useAuthStore((s) => s.user)
  const { drugMasters, labRules, ddiList, diseaseRules, isLoading } = useScreeningData()
  const { data: screeningConfig } = useQuery({ queryKey: ['config-screening'], queryFn: () => getConfig('screening') })
  const expensiveThreshold = screeningConfig?.expensive_unit_price_threshold

  const alerts = useMemo(() => {
    if (drugs.length === 0) return []
    return runScreening({ drugs, patient, ddiList, labRules, diseaseRules, drugMasters, expensiveThreshold })
  }, [drugs, patient, ddiList, labRules, diseaseRules, drugMasters, expensiveThreshold])

  const counts = useMemo(() => ({
    red: alerts.filter((a) => a.severity === 'red').length,
    orange: alerts.filter((a) => a.severity === 'orange').length,
    yellow: alerts.filter((a) => a.severity === 'yellow').length,
  }), [alerts])

  async function autoSaveIfNeeded(): Promise<void> {
    const st = useScreeningStore.getState()
    if (!user || !st.dirty || st.drugs.length === 0) return
    try {
      const ref = await logDispensing({
        hn: st.patient.hn,
        patient_name: st.patient.patient_name,
        age: st.patient.age,
        weight: st.patient.weight,
        scr: st.patient.scr,
        allergies: st.patient.allergies,
        is_pregnant: st.patient.is_pregnant,
        drugs: st.drugs.map((d) => ({ icode: d.icode, drug_name: d.drug_name, sig: d.sig })),
        alerts_count: alerts.length,
        ddi_count: alerts.filter((a) => a.type === 'DDI').length,
        drp_count: alerts.filter((a) => a.type === 'DRP').length,
        ai_summary: st.aiText,
        pharmacist_uid: user.uid,
        pharmacist_name: user.displayName,
        pharmacist_lic: user.licNumber,
      })
      useScreeningStore.getState().markSaved(ref.id)
      toast.success('บันทึกอัตโนมัติ')
    } catch (e) {
      toast.error('Auto-save ไม่สำเร็จ: ' + (e as Error).message)
    }
  }

  async function reset() {
    await autoSaveIfNeeded()
    resetStore()
    setSelectedDiseases([])
    setLabValues({})
  }

  const onQrScan = useCallback(async (data: ScannedData) => {
    const newDrugs: DrugEntry[] = []
    const notFound: string[] = []
    for (const d of data.drugs) {
      const master = drugMasters.find((m) => m.icode.toLowerCase() === d.icode.toLowerCase())
        ?? await getDrugByIcode(d.icode).catch(() => null)
      if (!master) { notFound.push(d.icode); continue }
      const rules = await listLabRulesByIcode(master.icode).catch(() => [])
      newDrugs.push({ icode: master.icode, drug_name: master.drug_name, sig: d.sig, master, labRules: rules })
    }
    const cur = useScreeningStore.getState()
    setDrugs([...cur.drugs, ...newDrugs])
    setPatient({
      ...cur.patient,
      hn: data.hn ?? cur.patient.hn,
      patient_name: data.patient_name ?? cur.patient.patient_name,
      age: data.age ?? cur.patient.age,
      sex: data.sex ?? cur.patient.sex,
    })
    if (newDrugs.length > 0) toast.success(`สแกนได้ ${newDrugs.length} รายการยา`)
    if (notFound.length > 0) toast.warning(`ไม่พบ icode: ${notFound.join(', ')}`)
  }, [drugMasters, setDrugs, setPatient])

  async function saveLog() {
    if (!user) return
    try {
      const ref = await logDispensing({
        hn: patient.hn,
        patient_name: patient.patient_name,
        age: patient.age,
        weight: patient.weight,
        scr: patient.scr,
        allergies: patient.allergies,
        is_pregnant: patient.is_pregnant,
        drugs: drugs.map((d) => ({ icode: d.icode, drug_name: d.drug_name, sig: d.sig })),
        alerts_count: alerts.length,
        ddi_count: alerts.filter((a) => a.type === 'DDI').length,
        drp_count: alerts.filter((a) => a.type === 'DRP').length,
        ai_summary: aiText,
        pharmacist_uid: user.uid,
        pharmacist_name: user.displayName,
        pharmacist_lic: user.licNumber,
      })
      useScreeningStore.getState().markSaved(ref.id)
      toast.success('บันทึกประวัติเรียบร้อย')
    } catch (e) {
      toast.error('บันทึกไม่สำเร็จ: ' + (e as Error).message)
    }
  }

  const hasResults = drugs.length > 0

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-24 md:pb-4">
      {/* Compact header */}
      <header className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="size-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 grid place-items-center text-white shadow-sm">
            <ClipboardCheck className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">คัดกรองใบสั่งยา</h1>
            <p className="text-xs text-muted-foreground">สแกน QR หรือพิมพ์ชื่อยา · ระบบจะถามข้อมูลที่จำเป็น</p>
          </div>
        </div>
        <div className="flex gap-1.5">
          <Button
            size="default"
            className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
            onClick={() => setQrOpen(true)}
          >
            <ScanLine className="size-4" /> สแกน QR
          </Button>
          <Button variant="outline" size="default" onClick={reset}>
            <RotateCcw className="size-4" /> เริ่มใหม่
          </Button>
        </div>
      </header>

      {/* Mode tabs */}
      <Tabs value={mode} onValueChange={(v) => setMode(v as 'drug' | 'disease')}>
        <TabsList className="bg-card border h-10">
          <TabsTrigger value="drug" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-600 data-[state=active]:text-white px-4">
            <Pill className="size-4" /> ตามยาที่ได้รับ
          </TabsTrigger>
          <TabsTrigger value="disease" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-rose-500 data-[state=active]:to-pink-600 data-[state=active]:text-white px-4">
            <Stethoscope className="size-4" /> ตามโรค
          </TabsTrigger>
        </TabsList>

        <TabsContent value="drug" className="mt-4 space-y-4">
          <DrugInput drugs={drugs} onChange={setDrugs} drugMasters={drugMasters} />
          <SmartPatientForm drugs={drugs} value={patient} onChange={setPatient} />
          {hasWarfarin(drugs) && <WarfarinScreenPanel drugs={drugs} inr={patient.inr} />}

          {hasResults && (
            <>
              {/* เฝ้าดูยาที่เคย off แล้วถูกสั่งซ้ำ → เด้ง popup ถามจำนวน (mount เสมอ) */}
              <InterventionReorderWatcher drugs={drugs} patient={patient} />

              {/* Results header */}
              <div className="flex items-center justify-between gap-2 pt-2">
                <h2 className="text-base font-bold flex items-center gap-2">
                  📊 ผลคัดกรอง
                  <span className="flex items-center gap-1">
                    {counts.red > 0 && <Badge variant="red">{counts.red} สำคัญ</Badge>}
                    {counts.orange > 0 && <Badge variant="orange">{counts.orange}</Badge>}
                    {counts.yellow > 0 && <Badge variant="yellow">{counts.yellow}</Badge>}
                    {alerts.length === 0 && <Badge variant="green">ปกติ</Badge>}
                  </span>
                </h2>
                {isLoading && <span className="text-xs text-muted-foreground">โหลด...</span>}
              </div>

              <RuleSummaryPanel patient={patient} drugs={drugs} alerts={alerts} />

              <CollapsibleSection
                title="รายละเอียดผลคัดกรองทุกหมวด"
                subtitle={`${alerts.length} alerts แยกตามหมวด`}
                icon={<div className="size-8 rounded-lg bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 grid place-items-center"><ListChecks className="size-4" /></div>}
                defaultOpen={alerts.length > 0 && alerts.length <= 5}
                badge={alerts.length > 0 ? <Badge variant="outline" className="ml-1">{alerts.length}</Badge> : null}
              >
                <GroupedAlertList alerts={alerts} />
              </CollapsibleSection>

              <CollapsibleSection
                title="สรุปด้วย AI (Claude Haiku)"
                subtitle={aiText ? '✓ สรุปเรียบร้อย' : 'กดปุ่ม "สรุปด้วย AI" เพื่อให้ Claude วิเคราะห์'}
                icon={<div className="size-8 rounded-lg bg-violet-100 dark:bg-violet-950/40 text-violet-600 grid place-items-center"><Sparkles className="size-4" /></div>}
                defaultOpen={!!aiText}
              >
                <AISummaryPanel patient={patient} drugs={drugs} alerts={alerts} onResult={setAiText} />
              </CollapsibleSection>

              <CollapsibleSection
                title="Counseling Checklist"
                subtitle="ติ๊กเมื่ออธิบายผู้ป่วยแล้ว"
                icon={<div className="size-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 grid place-items-center"><ListChecks className="size-4" /></div>}
                defaultOpen={false}
              >
                <CounselingChecklist drugs={drugs} />
              </CollapsibleSection>

              <CollapsibleSection
                title="Intervention & มูลค่าประหยัด"
                subtitle="บันทึก off/เปลี่ยนยา · ยาที่เคย off แล้วสั่งซ้ำจะเด้ง popup ถามจำนวน"
                icon={<div className="size-8 rounded-lg bg-amber-100 dark:bg-amber-950/40 text-amber-600 grid place-items-center"><Coins className="size-4" /></div>}
                defaultOpen={false}
              >
                <InterventionSection drugs={drugs} patient={patient} />
              </CollapsibleSection>

              <CollapsibleSection
                title="สติ๊กเกอร์ 5×7 cm"
                subtitle="ปริ้นต์ติดซองยา (กรอก HN/ชื่อตอนพิมพ์)"
                icon={<div className="size-8 rounded-lg bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 grid place-items-center"><Printer className="size-4" /></div>}
                defaultOpen={false}
              >
                <Sticker57Panel drugs={drugs} patient={patient} />
              </CollapsibleSection>
            </>
          )}
        </TabsContent>

        <TabsContent value="disease" className="mt-4 space-y-4">
          <DiseaseScreeningPanel
            selectedKeys={selectedDiseases}
            onSelectedChange={setSelectedDiseases}
            labValues={labValues}
            onLabValuesChange={setLabValues}
          />
        </TabsContent>
      </Tabs>

      {/* Compact sticky bottom — ใช้พื้นที่น้อย */}
      {hasResults && (
        <div className="no-print sticky bottom-16 md:bottom-2 z-20 flex justify-end">
          <div className="flex gap-1.5 bg-card/95 backdrop-blur-md rounded-full border shadow-lg p-1.5">
            <Button size="sm" variant="ghost" onClick={saveLog} className="rounded-full"><Save className="size-4" /> <span className="hidden sm:inline">บันทึก</span></Button>
            <span className="w-px bg-border" />
            <PdfExportPill patient={patient} drugs={drugs} alerts={alerts} aiSummary={aiText} />
          </div>
        </div>
      )}

      <QrScannerModal open={qrOpen} onOpenChange={setQrOpen} onScan={onQrScan} />
    </div>
  )
}

// Compact PDF button (uses original component but smaller wrapper)
function PdfExportPill(props: React.ComponentProps<typeof PdfExportButton>) {
  return (
    <div className="[&>button]:rounded-full [&>button]:h-9 [&>button]:px-3 inline-flex">
      <PdfExportButton {...props} />
      <span className="sr-only"><FileText /></span>
    </div>
  )
}
