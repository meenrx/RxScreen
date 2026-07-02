import { useMemo, useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ClipboardCheck, RotateCcw, Save, ScanLine, Pill, Stethoscope, Sparkles, ListChecks, Printer, FileText, Coins } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { CollapsibleSection } from '@/components/Collapsible'
import { SmartPatientForm } from '@/features/screening/SmartPatientForm'
import { DrugInput } from '@/features/screening/DrugInput'
import { DrugResultView } from '@/features/screening/DrugResultView'
import { AISummaryPanel } from '@/features/screening/AISummaryPanel'
import { AllergyRiskPanel } from '@/features/screening/AllergyRiskPanel'
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
import { SubstitutionScreenPanel } from '@/features/substitution/SubstitutionScreenPanel'
import { useActiveSubstitutions } from '@/features/substitution/hooks'
import { logDispensing } from '@/features/history/api'
import { useAuthStore } from '@/features/auth/authStore'
import { getConfig, getDrugByIcode, listLabRulesForDrug } from '@/features/catalog/api'
import { toast } from 'sonner'
import type { DrugEntry, ScreeningAlert } from '@/types/screening'
import type { LabRule } from '@/types/drug'

/** สรุปด้วย AI — ปิดชั่วคราว (ตั้ง true เพื่อเปิดกลับ) */
const SHOW_AI = false

/** สรุป alert แยกระดับ + ชนิด (dedupe) สำหรับบันทึกลง log → ใช้ทำรายงาน dashboard */
function alertSummary(alerts: ScreeningAlert[]) {
  return {
    red_count: alerts.filter((a) => a.severity === 'red').length,
    orange_count: alerts.filter((a) => a.severity === 'orange').length,
    yellow_count: alerts.filter((a) => a.severity === 'yellow').length,
    alert_types: Array.from(new Set(alerts.map((a) => a.type))),
  }
}

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
  const noDuplicateClasses = screeningConfig?.duplicate_classes
  const { data: substitutions = [] } = useActiveSubstitutions()

  const alerts = useMemo(() => {
    if (drugs.length === 0) return []
    return runScreening({ drugs, patient, ddiList, labRules, diseaseRules, drugMasters, expensiveThreshold, noDuplicateClasses, substitutions })
  }, [drugs, patient, ddiList, labRules, diseaseRules, drugMasters, expensiveThreshold, noDuplicateClasses, substitutions])

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
        an: st.patient.an,
        patient_name: st.patient.patient_name,
        age: st.patient.age,
        weight: st.patient.weight,
        scr: st.patient.scr,
        allergies: st.patient.allergies,
        is_pregnant: st.patient.is_pregnant,
        drugs: st.drugs.map((d) => ({ icode: d.icode, drug_name: d.drug_name, sig: d.sig })),
        alerts_count: alerts.length,
        ...alertSummary(alerts),
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
    // 1) จับคู่ icode จากรายการ in-memory ก่อน (ทันที ไม่ต้องยิง Firestore)
    const byIcode = new Map(drugMasters.map((m) => [m.icode.toLowerCase(), m]))
    const inMemory: DrugEntry[] = []
    const needFetch: { icode: string; sig?: string }[] = []
    for (const d of data.drugs) {
      const master = byIcode.get(d.icode.toLowerCase())
      if (master) inMemory.push({ icode: master.icode, drug_name: master.drug_name, sig: d.sig, master, labRules: [] })
      else needFetch.push({ icode: d.icode, sig: d.sig })
    }

    // 2) ใส่ยา (ที่จับคู่ได้ทันที) + ข้อมูลคนไข้เข้า store เดี๋ยวนั้น → chips + ฟอร์มโผล่เลย
    const cur = useScreeningStore.getState()
    if (inMemory.length > 0) setDrugs([...cur.drugs, ...inMemory])
    // รวมค่าที่ติดมากับ QR เข้ากับของเดิม (dedupe ไม่ทับ)
    const allergies = data.allergies?.length
      ? Array.from(new Set([...(cur.patient.allergies ?? []), ...data.allergies]))
      : cur.patient.allergies
    const diseases = data.diseases?.length
      ? Array.from(new Set([...(cur.patient.diseases ?? []), ...data.diseases]))
      : cur.patient.diseases
    const labs = data.labs ? { ...(cur.patient.labs ?? {}), ...data.labs } : cur.patient.labs
    setPatient({
      ...cur.patient,
      an: data.an ?? cur.patient.an,
      hn: data.hn ?? cur.patient.hn,
      patient_name: data.patient_name ?? cur.patient.patient_name,
      age: data.age ?? cur.patient.age,
      sex: data.sex ?? cur.patient.sex,
      weight: data.weight ?? cur.patient.weight,
      scr: data.scr ?? cur.patient.scr,
      egfr: data.crcl ?? cur.patient.egfr,
      inr: data.inr ?? cur.patient.inr,
      labs,
      g6pd: data.g6pd ?? cur.patient.g6pd,
      g6pd_tested: data.g6pd_tested ?? cur.patient.g6pd_tested,
      is_pregnant: data.is_pregnant ?? cur.patient.is_pregnant,
      // QR field "Pg" รวมตั้งครรภ์+ให้นม → Y ถือว่าเสี่ยงทั้งสองอย่าง (คัดกรองครบ ไม่ตกหล่น lactation)
      is_lactating: data.is_lactating ?? data.is_pregnant ?? cur.patient.is_lactating,
      allergies,
      diseases,
    })
    // ซิงค์โรคที่ QR ส่งมาเข้า panel เลือกโรค (ให้คัดกรอง disease–drug ทำงาน)
    if (data.diseases?.length) setSelectedDiseases((prev) => Array.from(new Set([...prev, ...data.diseases!])))
    // เตือนถ้ายังไม่เจาะ G6PD (— ไม่ใช่ปกติ)
    if (data.g6pd_tested === false) toast.warning('ยังไม่ได้เจาะ G6PD — ตรวจสอบก่อนจ่ายยากลุ่ม oxidant')
    if (inMemory.length > 0) toast.success(`สแกนได้ ${inMemory.length} รายการยา`)

    // 3) เบื้องหลัง (ขนานทั้งหมด): โหลด labRules ของยาที่ add แล้ว + หา master ของยาที่ยังไม่เจอใน memory
    const [rulesForInMem, fetched] = await Promise.all([
      Promise.all(inMemory.map((e) => listLabRulesForDrug(e.master!).catch(() => []))),
      Promise.all(needFetch.map(async (d): Promise<{ entry?: DrugEntry; notFound?: string }> => {
        const master = await getDrugByIcode(d.icode).catch(() => null)
        if (!master) return { notFound: d.icode }
        const labRules = await listLabRulesForDrug(master).catch(() => [])
        return { entry: { icode: master.icode, drug_name: master.drug_name, sig: d.sig, master, labRules } }
      })),
    ])

    // patch labRules เข้า entry เดิม (อ้างอิงด้วย object reference) + เพิ่มยาที่เพิ่งหาเจอจาก Firestore
    const rulesByEntry = new Map<DrugEntry, LabRule[]>(inMemory.map((e, i) => [e, rulesForInMem[i]]))
    const fetchedEntries: DrugEntry[] = []
    const notFound: string[] = []
    for (const f of fetched) {
      if (f.entry) fetchedEntries.push(f.entry)
      else if (f.notFound) notFound.push(f.notFound)
    }
    const after = useScreeningStore.getState().drugs
    const patched = after.map((d) => {
      const rules = rulesByEntry.get(d)
      return rules ? { ...d, labRules: rules } : d
    })
    setDrugs([...patched, ...fetchedEntries])

    if (fetchedEntries.length > 0) toast.success(`เพิ่มอีก ${fetchedEntries.length} รายการยา`)
    if (notFound.length > 0) toast.warning(`ไม่พบ icode: ${notFound.join(', ')}`)
    // อ่าน QR ได้ แต่ไม่มีทั้งยาที่เพิ่มและ icode ที่ไม่พบ → อย่าเงียบ
    if (inMemory.length === 0 && fetchedEntries.length === 0 && notFound.length === 0) {
      toast.warning('อ่าน QR ได้ แต่ไม่พบรายการยาในข้อมูล — ตรวจรูปแบบ QR หรือใช้ช่อง "วาง/พิมพ์"')
    }
  }, [drugMasters, setDrugs, setPatient, setSelectedDiseases])

  async function saveLog() {
    if (!user) return
    try {
      const ref = await logDispensing({
        hn: patient.hn,
        an: patient.an,
        patient_name: patient.patient_name,
        age: patient.age,
        weight: patient.weight,
        scr: patient.scr,
        allergies: patient.allergies,
        is_pregnant: patient.is_pregnant,
        drugs: drugs.map((d) => ({ icode: d.icode, drug_name: d.drug_name, sig: d.sig })),
        alerts_count: alerts.length,
        ...alertSummary(alerts),
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
    <div className="space-y-4 max-w-6xl xl:max-w-[88rem] mx-auto pb-24 md:pb-4">
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

              {/* รายละเอียดผลคัดกรอง — แสดงเลย ไม่มีสรุปซ้ำซ้อน */}
              <AllergyRiskPanel drugs={drugs} />
              <SubstitutionScreenPanel drugs={drugs} />
              <DrugResultView drugs={drugs} alerts={alerts} />

              {/* ส่วนรอง — จัด 2 คอลัมน์บนจอกว้าง ใช้พื้นที่คุ้ม (มือถือเรียงเดี่ยว) */}
              <div className="grid lg:grid-cols-2 gap-3 items-start">
                {/* สรุปด้วย AI — ซ่อนไว้ก่อน (เปลี่ยน SHOW_AI เป็น true เพื่อเปิดกลับ) */}
                {SHOW_AI && (
                  <CollapsibleSection
                    title="สรุปด้วย AI (Claude Haiku)"
                    subtitle={aiText ? '✓ สรุปเรียบร้อย' : 'กดปุ่ม "สรุปด้วย AI" เพื่อให้ Claude วิเคราะห์'}
                    icon={<div className="size-8 rounded-lg bg-violet-100 dark:bg-violet-950/40 text-violet-600 grid place-items-center"><Sparkles className="size-4" /></div>}
                    defaultOpen={!!aiText}
                  >
                    <AISummaryPanel patient={patient} drugs={drugs} alerts={alerts} onResult={setAiText} />
                  </CollapsibleSection>
                )}

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
              </div>
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

      {/* ปุ่ม Clear ลอย — กดเริ่มใหม่ได้ตลอด */}
      {(drugs.length > 0 || Object.keys(patient).length > 0) && (
        <button
          type="button"
          onClick={reset}
          title="ล้างทั้งหมด เริ่มคัดกรองใหม่"
          className="no-print fixed left-3 bottom-20 md:bottom-4 z-30 inline-flex items-center gap-1.5 h-11 px-4 rounded-full border bg-card/95 backdrop-blur-md shadow-lg text-sm font-medium hover:bg-accent active:scale-95 transition"
        >
          <RotateCcw className="size-4" /> เริ่มใหม่
        </button>
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
