/**
 * Renal dose reference — จับคู่ด้วย "generic name" (ไม่ผูก icode รายโรงพยาบาล)
 * ที่มา: Dose adjustment in renal impairment patient handbook
 *   - Sanford Guide to Antimicrobial Therapy 2010
 *   - Pharmacologic approach to renal insufficiency: ACP medicine 2007
 *
 * ใช้เสริมกับ LAB_RULES.dose_meta (ผูก icode) — ตัวนี้ทำงานทันทีเมื่อยามี generic_name ตรง
 *
 * ⚠️ ข้อมูลเป็น "แนวทาง" — เภสัชกรต้องยืนยันขนาดจริงกับคู่มือ/บริบทผู้ป่วยก่อนจ่าย
 *
 * โครงสร้าง band: เรียงจาก CrCl ต่ำ→สูง (max = ขอบบนของช่วง, ผู้ป่วยเข้าช่วงแรกที่ crcl <= max)
 */
export interface RenalDoseBand {
  /** ขอบบนของช่วง CrCl (mL/min) — ผู้ป่วยเข้าช่วงนี้ถ้า crcl <= max */
  max: number
  /** คำแนะนำขนาด/ระยะห่างสำหรับช่วงนี้ */
  text: string
}

export interface RenalDoseRef {
  /** generic name หลัก (lowercase) */
  generic: string
  /** คำพ้อง/ตัวสะกดอื่นสำหรับ match (lowercase) */
  aliases?: string[]
  /** ขนาดปกติ (ไตปกติ) */
  normalDose?: string
  /** CrCl (mL/min) ที่ต่ำกว่านี้ต้องเริ่มปรับขนาด — ใช้ trigger alert */
  threshold: number
  /** แนวทางปรับตาม CrCl (เรียง max ต่ำ→สูง) */
  bands: RenalDoseBand[]
  /** ยาคิดขนาดตามน้ำหนัก (mg/kg) */
  weightBased?: boolean
  /** ขนาดปกติต่อ kg (mg/kg/dose) — ใช้คำนวณ mg จากน้ำหนักจริง */
  mgPerKgNormal?: number
  /** หมายเหตุ/ข้อควรระวัง */
  note?: string
  source: string
}

const SANFORD = 'Sanford Guide 2010'
const ACP = 'ACP Medicine 2007'

export const RENAL_DOSE_REF: RenalDoseRef[] = [
  // ===== Aminoglycosides (once-daily, mg/kg — คิดตามน้ำหนัก) =====
  {
    generic: 'gentamicin', aliases: ['tobramycin'],
    normalDose: '5.1 mg/kg q24h (once-daily)', threshold: 60, weightBased: true, mgPerKgNormal: 5.1,
    bands: [
      { max: 10, text: 'ยืดระยะห่าง (มัก q48–72h) + วัด level — 2 mg/kg' },
      { max: 40, text: '≈2.5 mg/kg q24h หรือยืดเป็น q48h' },
      { max: 60, text: '≈3.5 mg/kg q24h' },
      { max: 80, text: '≈4 mg/kg q24h' },
    ],
    note: 'ต้อง monitor peak/trough + SCr — narrow therapeutic index', source: SANFORD,
  },
  {
    generic: 'amikacin', aliases: ['streptomycin', 'kanamycin'],
    normalDose: '15 mg/kg q24h (once-daily)', threshold: 60, weightBased: true, mgPerKgNormal: 15,
    bands: [
      { max: 10, text: 'ยืดระยะห่าง (มัก q48–72h) + วัด level — 3 mg/kg' },
      { max: 40, text: '≈4 mg/kg q24h หรือยืดเป็น q48h' },
      { max: 60, text: '≈7.5 mg/kg q24h' },
      { max: 80, text: '≈12 mg/kg q24h' },
    ],
    note: 'ต้อง monitor peak/trough + SCr', source: SANFORD,
  },

  // ===== Glycopeptide =====
  {
    generic: 'vancomycin',
    normalDose: '1 g q12h (หรือ 15–20 mg/kg)', threshold: 50, weightBased: true, mgPerKgNormal: 15,
    bands: [
      { max: 29, text: 'q72–96h ตาม level (trough)' },
      { max: 50, text: 'ยืดระยะห่าง เช่น q24h — ปรับตาม trough level' },
    ],
    note: 'ปรับตาม trough level เป็นหลัก · monitor SCr', source: SANFORD,
  },

  // ===== Beta-lactams (ปรับ dose/ยืดระยะห่างเมื่อ CrCl < 50) =====
  { generic: 'amoxicillin', aliases: ['ampicillin'], normalDose: '500 mg–1 g q8h', threshold: 50,
    bands: [{ max: 10, text: 'q24h' }, { max: 30, text: 'q12h' }, { max: 50, text: 'q8–12h' }], source: SANFORD },
  { generic: 'cefazolin', normalDose: '1–2 g q8h', threshold: 50,
    bands: [{ max: 10, text: 'q24–48h' }, { max: 50, text: 'q12h' }], source: SANFORD },
  { generic: 'cefepime', normalDose: '2 g q8–12h', threshold: 50,
    bands: [{ max: 10, text: '1 g q24h' }, { max: 50, text: '2 g q12–24h' }], source: SANFORD },
  { generic: 'cefotaxime', normalDose: '1–2 g q8h', threshold: 50,
    bands: [{ max: 10, text: 'q24h' }, { max: 50, text: 'q12–24h' }], source: SANFORD },
  { generic: 'ceftazidime', normalDose: '1–2 g q8h', threshold: 50,
    bands: [{ max: 10, text: 'q24–48h' }, { max: 50, text: 'q12–24h' }], source: SANFORD },
  { generic: 'piperacillin', aliases: ['piperacillin/tazobactam', 'tazocin'], normalDose: '3–4 g q4–6h', threshold: 50,
    bands: [{ max: 20, text: 'q8h' }, { max: 50, text: 'q6–8h' }], source: SANFORD },
  { generic: 'imipenem', normalDose: '0.5 g q6h', threshold: 50,
    bands: [{ max: 10, text: '125–250 mg q12h (เสี่ยงชัก — ระวัง)' }, { max: 50, text: '250 mg q6–12h' }], source: SANFORD },
  { generic: 'meropenem', normalDose: '1 g q8h', threshold: 50,
    bands: [{ max: 10, text: '0.5 g q24h' }, { max: 25, text: '0.5–1 g q12h' }, { max: 50, text: '1 g q12h' }], source: SANFORD },
  { generic: 'ertapenem', normalDose: '1 g q24h', threshold: 30,
    bands: [{ max: 30, text: '0.5 g q24h' }], source: SANFORD },
  { generic: 'doripenem', normalDose: '0.5 g q8h', threshold: 50,
    bands: [{ max: 30, text: '250 mg q12h' }, { max: 50, text: '250 mg q8h' }], source: SANFORD },
  { generic: 'penicillin g', normalDose: '0.5–4 MU q4h', threshold: 50,
    bands: [{ max: 10, text: '20–50% ของขนาดปกติ' }, { max: 50, text: '75%' }], source: SANFORD },

  // ===== Fluoroquinolones =====
  { generic: 'ciprofloxacin', normalDose: '400 mg IV q12h / 500 mg PO q12h', threshold: 50,
    bands: [{ max: 30, text: '50% ของขนาดปกติ' }, { max: 50, text: '50–75%' }], source: SANFORD },
  { generic: 'levofloxacin', normalDose: '750 mg q24h', threshold: 50,
    bands: [{ max: 20, text: '750 mg ครั้งแรก แล้ว 500 mg q48h' }, { max: 49, text: '750 mg q48h' }], source: SANFORD },

  // ===== Macrolide =====
  { generic: 'clarithromycin', normalDose: '500 mg q12h', threshold: 50,
    bands: [{ max: 30, text: '50%' }, { max: 50, text: '50–75%' }], source: SANFORD },

  // ===== Antifungal =====
  { generic: 'fluconazole', normalDose: '100–400 mg q24h', threshold: 50,
    bands: [{ max: 50, text: '50% ของขนาดปกติ (loading dose ปกติ)' }], source: SANFORD },

  // ===== Antiviral =====
  { generic: 'acyclovir', normalDose: '5–12.4 mg/kg q8h (IV)', threshold: 50, weightBased: true, mgPerKgNormal: 5,
    bands: [{ max: 10, text: '50% q24h' }, { max: 25, text: '100% q24h' }, { max: 50, text: '100% q12h' }],
    note: 'hydrate ให้พอ — เสี่ยง crystal nephropathy', source: SANFORD },
  { generic: 'oseltamivir', aliases: ['tamiflu'], normalDose: '75 mg PO BID', threshold: 30,
    bands: [{ max: 30, text: '75 mg OD' }], source: SANFORD },
  { generic: 'lamivudine', normalDose: '300 mg q24h', threshold: 50,
    bands: [{ max: 15, text: '25–50 mg q24h' }, { max: 50, text: '50–150 mg q24h' }], source: SANFORD },
  { generic: 'tenofovir', normalDose: '300 mg q24h', threshold: 50,
    bands: [{ max: 30, text: 'ปรึกษา — ปรับระยะห่าง' }, { max: 49, text: '300 mg q48h' }], source: SANFORD },
  { generic: 'zidovudine', aliases: ['azt'], normalDose: '300 mg q12h', threshold: 15,
    bands: [{ max: 15, text: '100 mg q8h' }], source: SANFORD },

  // ===== Anti-TB =====
  { generic: 'ethambutol', normalDose: '15–25 mg/kg q24h', threshold: 50, weightBased: true, mgPerKgNormal: 20,
    bands: [{ max: 10, text: 'q48h' }, { max: 50, text: 'q24–36h' }], source: SANFORD },
  { generic: 'pyrazinamide', normalDose: '25 mg/kg q24h', threshold: 10, weightBased: true, mgPerKgNormal: 25,
    bands: [{ max: 10, text: '50–100% q24h (บางแนวทางให้ 3 ครั้ง/สัปดาห์)' }], source: SANFORD },

  // ===== Others (metronidazole, sulfa) =====
  { generic: 'metronidazole', aliases: ['flagyl'], normalDose: '7.5 mg/kg q6h', threshold: 10, weightBased: true, mgPerKgNormal: 7.5,
    bands: [{ max: 10, text: '50% ของขนาดปกติ' }], source: SANFORD },
  { generic: 'co-trimoxazole', aliases: ['bactrim', 'trimethoprim', 'sulfamethoxazole', 'trimethoprim/sulfamethoxazole'],
    normalDose: '5–20 mg/kg/day (คิดจาก TMP) แบ่ง q6–12h', threshold: 30, weightBased: true, mgPerKgNormal: 5,
    bands: [{ max: 15, text: 'ไม่แนะนำ (CrCl < 15)' }, { max: 30, text: '5–10 mg/kg/day (TMP) q12–24h' }], source: SANFORD },
  { generic: 'colistin', normalDose: '80–160 mg q8h', threshold: 90,
    bands: [{ max: 30, text: '160 mg q36h' }, { max: 50, text: '160 mg q24h' }, { max: 90, text: '160 mg q12h' }],
    note: 'nephrotoxic — monitor SCr', source: SANFORD },
  { generic: 'tetracycline', normalDose: '250–500 mg q6h', threshold: 90,
    bands: [{ max: 50, text: 'q12–24h (เลี่ยงถ้าได้ — ยกเว้น doxycycline)' }, { max: 90, text: 'q8–12h' }], source: SANFORD },

  // ===== Non-antimicrobials (ACP) =====
  { generic: 'allopurinol', normalDose: '300 mg q24h', threshold: 50,
    bands: [{ max: 10, text: '25% (≈100 mg q24h)' }, { max: 50, text: '50% (≈200 mg q24h)' }], source: ACP },
  { generic: 'colchicine', normalDose: '0.6 mg q24h (gout prophylaxis)', threshold: 50,
    bands: [{ max: 10, text: '50% หรือหลีกเลี่ยง' }, { max: 50, text: '75%' }],
    note: 'สะสม — เสี่ยง toxicity ในไตเสื่อม', source: ACP },
  { generic: 'enalapril', normalDose: 'เริ่ม 2.5–5 mg/day', threshold: 50,
    bands: [{ max: 10, text: '25% — monitor K+/SCr' }, { max: 50, text: '50–100% — monitor K+/SCr' }],
    note: 'ACEI — เฝ้าระวัง K+ สูง + SCr ขึ้น', source: ACP },
  { generic: 'gabapentin', normalDose: '300 mg TID (ไตปกติ)', threshold: 50,
    bands: [{ max: 15, text: '≈300 mg/day' }, { max: 30, text: '300 mg q24h' }, { max: 50, text: '50% ของขนาดปกติ' }], source: ACP },
  { generic: 'glibenclamide', aliases: ['glyburide'], normalDose: '2.5–5 mg/day', threshold: 50,
    bands: [{ max: 50, text: 'หลีกเลี่ยง — เสี่ยง hypoglycemia นาน (ใช้ตัวอื่นแทน)' }],
    note: 'active metabolite สะสม → เลี่ยงในไตเสื่อม', source: ACP },
  { generic: 'metformin', normalDose: '500–1000 mg BID', threshold: 45,
    bands: [{ max: 30, text: 'ห้ามใช้ (เสี่ยง lactic acidosis)' }, { max: 45, text: 'ไม่เกิน 1000 mg/day + ประเมินซ้ำ' }],
    note: 'หยุดเมื่อ CrCl < 30 หรือมีภาวะ hypoxia/sepsis', source: ACP },
  { generic: 'atenolol', normalDose: '25–100 mg/day', threshold: 50,
    bands: [{ max: 15, text: '25 mg/day หรือ q48h' }, { max: 35, text: '50% ' }], source: ACP },
  { generic: 'enoxaparin', aliases: ['clexane', 'lmwh'], normalDose: '1 mg/kg q12h', threshold: 30, weightBased: true, mgPerKgNormal: 1,
    bands: [{ max: 30, text: '1 mg/kg q24h (ลดความถี่) — พิจารณา anti-Xa' }],
    note: 'สะสมในไตเสื่อม → เสี่ยงเลือดออก', source: 'GlobalRPh' },
  { generic: 'ranitidine', normalDose: '150 mg BID PO / 50 mg q8h IV', threshold: 50,
    bands: [{ max: 10, text: '25%' }, { max: 50, text: '50%' }], source: ACP },

  // ===== Trigger-only (อยู่ในรายการต้องปรับ แต่ handbook ไม่ระบุ %ชัด → เตือนให้ตรวจสอบ) =====
  { generic: 'rifampicin', normalDose: '600 mg/day', threshold: 50, bands: [{ max: 50, text: 'ปกติไม่ต้องปรับมาก — ตรวจสอบตับ/ไตร่วม' }], source: SANFORD },
  { generic: 'quinine', normalDose: '650 mg q8h', threshold: 50, bands: [{ max: 50, text: '50–100% / ยืดระยะห่าง q8–12h' }], source: SANFORD },
  { generic: 'didanosine', threshold: 50, bands: [{ max: 29, text: 'ลดขนาด — ดูตามน้ำหนัก' }, { max: 50, text: 'ลดขนาด' }], source: SANFORD },
  { generic: 'stavudine', threshold: 50, bands: [{ max: 50, text: '50% q12–24h' }], source: SANFORD },
  { generic: 'diclofenac', aliases: ['nsaid'], normalDose: '', threshold: 50,
    bands: [{ max: 50, text: 'หลีกเลี่ยง NSAID ในไตเสื่อม — เสี่ยง AKI/K+สูง' }], note: 'เลี่ยงในไตเสื่อม', source: ACP },
  { generic: 'glipizide', normalDose: '', threshold: 50, bands: [{ max: 10, text: '50%' }, { max: 50, text: '75%' }], source: ACP },
]

// index ตาม generic (lowercase) รวม aliases เพื่อ lookup เร็ว
const REF_INDEX = new Map<string, RenalDoseRef>()
for (const r of RENAL_DOSE_REF) {
  REF_INDEX.set(r.generic, r)
  for (const a of r.aliases ?? []) REF_INDEX.set(a, r)
}

/** หา renal ref จากชื่อ generic/ชื่อยา (จับคู่แบบ substring — "Amoxicillin/Clavulanate" ก็เจอ amoxicillin) */
export function findRenalRef(generic?: string, drugName?: string): RenalDoseRef | undefined {
  const hay = `${generic ?? ''} ${drugName ?? ''}`.toLowerCase()
  if (!hay.trim()) return undefined
  // exact key ก่อน
  const direct = REF_INDEX.get((generic ?? '').trim().toLowerCase())
  if (direct) return direct
  // substring match — ชื่อยาที่ยาวสุดก่อน กันชนกัน
  let best: RenalDoseRef | undefined
  let bestLen = 0
  for (const [key, ref] of REF_INDEX) {
    if (hay.includes(key) && key.length > bestLen) { best = ref; bestLen = key.length }
  }
  return best
}

/** เลือก band ที่ตรงกับ CrCl ของผู้ป่วย (band แรกที่ crcl <= max) */
export function pickRenalBand(ref: RenalDoseRef, crcl: number): RenalDoseBand | undefined {
  const sorted = [...ref.bands].sort((a, b) => a.max - b.max)
  return sorted.find((b) => crcl <= b.max)
}
