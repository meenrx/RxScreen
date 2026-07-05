import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ClipboardCheck, RotateCcw, Save, ScanLine, Pill, Stethoscope, Sparkles, ListChecks, Printer, FileText, Coins } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { CollapsibleSection } from '@/components/Collapsible'
import { SmartPatientForm } from '@/features/screening/SmartPatientForm'
import { DrugInput } from '@/features/screening/DrugInput'
import { DrugResultView } from '@/features/screening/DrugResultView'
import { ScannedLabPanel } from '@/features/screening/ScannedLabPanel'
import { MedErrorPanel, type MeStatus } from '@/features/screening/MedErrorPanel'
import { AISummaryPanel } from '@/features/screening/AISummaryPanel'
import { AllergyRiskPanel } from '@/features/screening/AllergyRiskPanel'
import { Sticker57Panel } from '@/features/screening/Sticker57'
import { CounselingChecklist } from '@/features/screening/CounselingChecklist'
import { PdfExportButton } from '@/features/screening/PdfExport'
import { QrScannerModal, parseQrPayload, type ScannedData } from '@/features/screening/QrScanner'
import { WarfarinScreenPanel, hasWarfarin } from '@/features/screening/WarfarinScreenPanel'
import { DiseaseScreeningPanel } from '@/features/disease/DiseaseScreeningPanel'
import { useScreeningData } from '@/features/screening/useScreeningData'
import { useScreeningStore } from '@/features/screening/screeningStore'
import { runScreening } from '@/features/screening/engine'
import { InterventionSection } from '@/features/intervention/InterventionSection'
import { InterventionReorderWatcher } from '@/features/intervention/InterventionReorderWatcher'
import { SubstitutionScreenPanel } from '@/features/substitution/SubstitutionScreenPanel'
import { useActiveSubstitutions } from '@/features/substitution/hooks'
import { logDispensing, updateDispensing } from '@/features/history/api'
import { useMutes, filterMuted } from '@/features/screening/alertMute'
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
  const [meStatus, setMeStatus] = useState<MeStatus>('unset')
  const [meNote, setMeNote] = useState('')

  const user = useAuthStore((s) => s.user)
  const { drugMasters, labRules, ddiList, diseaseRules, isLoading } = useScreeningData()
  const { data: screeningConfig } = useQuery({ queryKey: ['config-screening'], queryFn: () => getConfig('screening') })
  const expensiveThreshold = screeningConfig?.expensive_unit_price_threshold
  const noDuplicateClasses = screeningConfig?.duplicate_classes
  const { data: substitutions = [] } = useActiveSubstitutions()
  const { data: mutes } = useMutes()
  const mutedIds = useMemo(() => new Set((mutes ?? []).map((m) => m.id)), [mutes])

  const alerts = useMemo(() => {
    if (drugs.length === 0) return []
    const raw = runScreening({ drugs, patient, ddiList, labRules, diseaseRules, drugMasters, expensiveThreshold, noDuplicateClasses, substitutions })
    return filterMuted(raw, mutedIds)
  }, [drugs, patient, ddiList, labRules, diseaseRules, drugMasters, expensiveThreshold, noDuplicateClasses, substitutions, mutedIds])

  const counts = useMemo(() => ({
    red: alerts.filter((a) => a.severity === 'red').length,
    orange: alerts.filter((a) => a.severity === 'orange').length,
    yellow: alerts.filter((a) => a.severity === 'yellow').length,
  }), [alerts])

  // เก็บ id ของ log เคสปัจจุบัน → บันทึกครั้งแรกเป็น create, ครั้งต่อไปเป็น update (ไม่ซ้ำ)
  const caseLogId = useRef<string | undefined>(undefined)

  const buildLogEntry = useCallback(() => {
    const st = useScreeningStore.getState()
    return {
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
      me_status: meStatus === 'unset' ? undefined : meStatus,
      me_level: meStatus === 'unset' ? undefined : ('B' as const),
      me_note: meNote || undefined,
      ddi_count: alerts.filter((a) => a.type === 'DDI').length,
      drp_count: alerts.filter((a) => a.type === 'DRP').length,
      ai_summary: st.aiText,
      pharmacist_uid: user!.uid,
      pharmacist_name: user!.displayName,
      pharmacist_lic: user!.licNumber,
    }
  }, [alerts, meStatus, meNote, user])

  /** บันทึกเคสปัจจุบัน (create ครั้งแรก / update ครั้งต่อไป) — ใช้ทั้ง auto-save และปุ่มบันทึก */
  const saveCase = useCallback(async (opts?: { onlyIfDirty?: boolean; toast?: boolean }) => {
    const st = useScreeningStore.getState()
    if (!user || st.drugs.length === 0) return
    if (opts?.onlyIfDirty && !st.dirty) return
    try {
      const entry = buildLogEntry()
      if (caseLogId.current) {
        await updateDispensing(caseLogId.current, entry)
      } else {
        const ref = await logDispensing(entry)
        caseLogId.current = ref.id
      }
      useScreeningStore.getState().markSaved(caseLogId.current!)
      if (opts?.toast) toast.success('บันทึกแล้ว')
    } catch (e) {
      toast.error('บันทึกไม่สำเร็จ: ' + (e as Error).message)
    }
  }, [user, buildLogEntry])

  // ref ล่าสุดของ saveCase → เรียกจาก onQrScan ได้โดยไม่ต้องผูก dependency (กัน closure ค้าง)
  const saveCaseRef = useRef(saveCase)
  saveCaseRef.current = saveCase

  // บันทึกอัตโนมัติเมื่อเภสัชประเมิน ME แล้ว (ยืนยัน/ไม่นับ) หรือแก้หมายเหตุ — debounce กันเขียนถี่
  useEffect(() => {
    if (meStatus === 'unset') return
    const t = setTimeout(() => { void saveCase() }, 500)
    return () => clearTimeout(t)
  }, [meStatus, meNote, saveCase])

  async function reset() {
    await saveCase({ onlyIfDirty: true })
    caseLogId.current = undefined
    resetStore()
    setSelectedDiseases([])
    setLabValues({})
    setMeStatus('unset')
    setMeNote('')
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
    // QR ผู้ป่วยเต็มใบ (มี AN/อายุ/แล็บ/โรค) = ผู้ป่วยรายใหม่ → ล้างของเดิม ใช้เฉพาะข้อมูลรอบนี้
    // (สติ๊กเกอร์ยาเดี่ยวที่ไม่มีข้อมูลผู้ป่วย → ยังสะสมต่อได้)
    const fullPatient = !!data.an || data.age !== undefined || !!data.labs || !!data.diseases?.length || data.sex !== undefined
    const basePatient: typeof cur.patient = fullPatient ? {} : cur.patient
    const baseDrugs = fullPatient ? [] : cur.drugs
    // ผู้ป่วยรายใหม่ → บันทึกเคสก่อนหน้าอัตโนมัติ แล้วเริ่มเคสใหม่ (ไม่ต้องกดบันทึกเอง)
    if (fullPatient) {
      await saveCaseRef.current({ onlyIfDirty: true })
      caseLogId.current = undefined
      setSelectedDiseases(data.diseases ?? []); setLabValues({}); setAiText(''); setMeStatus('unset'); setMeNote('')
    }
    if (fullPatient || inMemory.length > 0) setDrugs([...baseDrugs, ...inMemory])
    const allergies = data.allergies?.length
      ? Array.from(new Set([...(basePatient.allergies ?? []), ...data.allergies]))
      : basePatient.allergies
    const diseases = data.diseases?.length
      ? Array.from(new Set([...(basePatient.diseases ?? []), ...data.diseases]))
      : basePatient.diseases
    const labs = data.labs ? { ...(basePatient.labs ?? {}), ...data.labs } : basePatient.labs
    const labDates = data.labDates ? { ...(basePatient.labDates ?? {}), ...data.labDates } : basePatient.labDates
    setPatient({
      ...basePatient,
      an: data.an ?? basePatient.an,
      hn: data.hn ?? basePatient.hn,
      patient_name: data.patient_name ?? basePatient.patient_name,
      age: data.age ?? basePatient.age,
      sex: data.sex ?? basePatient.sex,
      weight: data.weight ?? basePatient.weight,
      scr: data.scr ?? basePatient.scr,
      egfr: data.crcl ?? basePatient.egfr,
      inr: data.inr ?? basePatient.inr,
      labs,
      labDates,
      g6pd: data.g6pd ?? basePatient.g6pd,
      g6pd_tested: data.g6pd_tested ?? basePatient.g6pd_tested,
      is_pregnant: data.is_pregnant ?? basePatient.is_pregnant,
      is_lactating: data.is_lactating ?? data.is_pregnant ?? basePatient.is_lactating,
      allergies,
      diseases,
    })
    // ซิงค์โรคที่ QR ส่งมาเข้า panel เลือกโรค (ให้คัดกรอง disease–drug ทำงาน)
    if (data.diseases?.length) setSelectedDiseases((prev) => Array.from(new Set([...prev, ...data.diseases!])))
    // เตือนถ้ายังไม่เจาะ G6PD (— ไม่ใช่ปกติ)
    if (data.g6pd_tested === false) toast.warning('ยังไม่ได้เจาะ G6PD — ตรวจสอบก่อนจ่ายยากลุ่ม oxidant')
    // เตือนถ้าแพ้ยาหลายตัวเกินกว่าที่ QR โชว์
    if (data.allergy_truncated) toast.warning(`ผู้ป่วยแพ้ยา ${data.allergy_count ?? ''} ชนิด — QR โชว์ไม่ครบ ตรวจสอบ record เพิ่ม`)
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
  }, [drugMasters, setDrugs, setPatient, setSelectedDiseases, setLabValues, setAiText, setMeStatus, setMeNote])

  // สแกน QR ด้วยเครื่องสแกนที่คอม (คีย์บอร์ด) — payload เข้าช่องพิมพ์ยา → parse เป็น QR
  const onQrText = useCallback((raw: string) => {
    try {
      onQrScan(parseQrPayload(raw))
    } catch (e) {
      toast.error('อ่าน QR ไม่สำเร็จ: ' + (e as Error).message)
    }
  }, [onQrScan])

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
          <DrugInput drugs={drugs} onChange={setDrugs} drugMasters={drugMasters} onQrPayload={onQrText} />
          <SmartPatientForm drugs={drugs} value={patient} onChange={setPatient} />
          {hasWarfarin(drugs) && <WarfarinScreenPanel drugs={drugs} inr={patient.inr} />}

          {hasResults && (
            <>
              {/* เฝ้าดูยาที่เคย off แล้วถูกสั่งซ้ำ → เด้ง popup ถามจำนวน (mount เสมอ) */}
              <InterventionReorderWatcher drugs={drugs} patient={patient} />

              {/* แถบระบุ AN — ส่วนต้นสุด ให้รู้ชัดว่าเป็นผลคัดกรองของ AN ใด */}
              <div className="rounded-xl border-2 border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">AN</span>
                  <span className="text-2xl font-extrabold tracking-tight text-emerald-900 dark:text-emerald-100 tabular-nums">{patient.an ?? '—'}</span>
                </div>
                {patient.hn && <span className="text-sm text-muted-foreground">HN {patient.hn}</span>}
                {patient.patient_name && <span className="text-sm font-medium truncate max-w-[18ch]">{patient.patient_name}</span>}
                {(patient.age !== undefined || patient.sex) && (
                  <span className="text-sm text-muted-foreground">
                    {patient.age !== undefined ? `${patient.age} ปี` : ''}{patient.sex ? `${patient.age !== undefined ? ' · ' : ''}${patient.sex === 'M' ? 'ชาย' : 'หญิง'}` : ''}
                  </span>
                )}
              </div>

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

              {/* ประเมิน ME ขึ้นบนสุด (เด่นชัด) — บันทึกอัตโนมัติเมื่อกดยืนยัน */}
              <MedErrorPanel alerts={alerts} status={meStatus} note={meNote} onStatus={setMeStatus} onNote={setMeNote} />

              {/* รายละเอียดผลคัดกรอง — แสดงเลย ไม่มีสรุปซ้ำซ้อน */}
              <ScannedLabPanel patient={patient} />
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
                  subtitle="เฉพาะยาที่ต้องแนะนำพิเศษ"
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
            <Button size="sm" variant="ghost" onClick={() => saveCase({ toast: true })} className="rounded-full"><Save className="size-4" /> <span className="hidden sm:inline">บันทึก</span></Button>
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
