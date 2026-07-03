/**
 * ฐานข้อมูล High Alert Drug (IV) — จับคู่ด้วย generic name
 * เรียบเรียงจากแหล่งอ้างอิงมาตรฐาน:
 *   - Trissel's Handbook on Injectable Drugs
 *   - ISMP List of High-Alert Medications
 *   - Micromedex / Lexicomp IV Compatibility
 *   - Australian Injectable Drugs Handbook (AIDH)
 *
 * ⚠️ เป็นข้อมูลอ้างอิงทั่วไป — เภสัชกร/พยาบาลต้องยืนยันกับ protocol ของ รพ. + สภาพผู้ป่วยก่อนใช้จริง
 *
 * แสดงในผลคัดกรอง (หลัก): Dose · วิธีเตรียม · max conc · max rate
 * ที่เหลือ (compatible/incompatible/antidote/note) อยู่ในรายละเอียด
 */
export interface HadRef {
  generic: string
  aliases?: string[]
  /** ขนาดยาโดยทั่วไป */
  dose?: string
  /** วิธีเตรียม/เจือจาง */
  prep?: string
  /** ความเข้มข้นสูงสุด */
  maxConc?: string
  /** อัตราเร็วสูงสุด */
  maxRate?: string
  /** สารน้ำ/ยาที่ผสมได้ */
  compatible?: string
  /** ห้ามผสม */
  incompatible?: string
  antidote?: string
  note?: string
  source: string
}

const SRC = 'Trissel/ISMP/Micromedex'

export const HAD_REF: HadRef[] = [
  {
    generic: 'epinephrine', aliases: ['adrenaline'],
    dose: 'Cardiac arrest 1 mg IV q3–5 min · Anaphylaxis 0.3–0.5 mg IM · Infusion 0.01–0.5 mcg/kg/min',
    prep: 'Infusion: เจือจางใน D5W หรือ NS เช่น 4 mg/250 mL = 16 mcg/mL',
    maxConc: 'peripheral ≤ 64 mcg/mL (central เข้มข้นกว่าได้)',
    maxRate: 'titrate ตาม BP/HR',
    incompatible: 'สารด่าง (sodium bicarbonate), aminophylline',
    antidote: 'Extravasation → phentolamine',
    note: 'infusion ควรให้ทาง central line · monitor EKG/BP',
    source: SRC,
  },
  {
    generic: 'norepinephrine', aliases: ['levophed', 'noradrenaline'],
    dose: '0.01–3 mcg/kg/min (หรือ 2–20 mcg/min) titrate',
    prep: '4 mg/250 mL D5W หรือ D5NS = 16 mcg/mL',
    maxConc: 'peripheral ≤ 64 mcg/mL · central ≤ 128 mcg/mL',
    maxRate: 'titrate ตาม MAP',
    incompatible: 'สารด่าง (bicarbonate), thiopental, insulin',
    antidote: 'Extravasation → phentolamine',
    note: 'central line preferred · monitor BP ต่อเนื่อง',
    source: SRC,
  },
  {
    generic: 'dopamine',
    dose: '2–20 mcg/kg/min titrate',
    prep: '400 mg/250 mL D5W/NS = 1600 mcg/mL',
    maxConc: '≤ 3200 mcg/mL (central)',
    maxRate: 'titrate',
    incompatible: 'สารด่าง (sodium bicarbonate), amphotericin',
    antidote: 'Extravasation → phentolamine',
    note: 'central line preferred',
    source: SRC,
  },
  {
    generic: 'dobutamine',
    dose: '2–20 mcg/kg/min',
    prep: '250 mg/250 mL D5W/NS = 1000 mcg/mL',
    maxConc: '≤ 5000 mcg/mL',
    maxRate: 'titrate',
    incompatible: 'สารด่าง (bicarbonate), heparin, cefazolin',
    note: 'monitor BP/HR',
    source: SRC,
  },
  {
    generic: 'amiodarone',
    dose: 'Loading 150 mg over 10 min → 1 mg/min ×6h → 0.5 mg/min ×18h',
    prep: 'ใช้ D5W เท่านั้น · Load 150 mg/100 mL · Maint 900 mg/500 mL D5W',
    maxConc: 'peripheral ≤ 2 mg/mL · central ≤ 6 mg/mL (>2 mg/mL ต้อง central)',
    maxRate: 'bolus ไม่เร็วกว่า 150 mg/10 min (เร็วไป → hypotension)',
    compatible: 'D5W',
    incompatible: 'NS (ตกตะกอน), heparin, sodium bicarbonate',
    note: 'ใช้ in-line filter · non-PVC สำหรับ infusion นาน · monitor EKG/BP',
    source: SRC,
  },
  {
    generic: 'adenosine',
    dose: '6 mg rapid IV push → ถ้าไม่ได้ผล 12 mg (ซ้ำได้ 1 ครั้ง)',
    prep: 'ให้ undiluted · rapid IV push 1–2 วินาที ทางหลอดเลือดใหญ่ + flush NS 20 mL ทันที',
    maxConc: '3 mg/mL',
    maxRate: 'rapid push (ครึ่งชีวิตสั้น <10 วินาที)',
    note: 'ยกแขนสูงหลังฉีด · เตรียมพร้อม EKG monitor',
    source: SRC,
  },
  {
    generic: 'digoxin',
    dose: 'Loading 0.25 mg IV q6h (รวม 0.75–1 mg) · Maint ตาม level',
    prep: 'ให้ undiluted หรือเจือจาง ≥4 เท่าใน NS/D5W/SWFI · ฉีดช้า ≥5 นาที',
    maxConc: '0.25 mg/mL (undiluted)',
    maxRate: 'ฉีดช้า ≥5 นาที',
    incompatible: 'เจือจาง <4 เท่า → ตกตะกอน',
    antidote: 'Digoxin immune Fab (DigiFab)',
    note: 'monitor EKG · ระวัง K⁺ ผิดปกติ',
    source: SRC,
  },
  {
    generic: 'nicardipine',
    dose: '5 mg/h → titrate +2.5 mg/h ทุก 5–15 min (max 15 mg/h)',
    prep: 'เจือจาง 25 mg/240 mL = 0.1 mg/mL (D5W/NS)',
    maxConc: '0.1–0.2 mg/mL',
    maxRate: '15 mg/h',
    incompatible: 'sodium bicarbonate, LR',
    note: 'central line preferred · เปลี่ยนตำแหน่ง IV ทุก 12 ชม. ถ้า peripheral',
    source: SRC,
  },
  {
    generic: 'nitroglycerin', aliases: ['ntg', 'glyceryl trinitrate', 'gtn'],
    dose: '5 mcg/min → titrate +5 mcg/min ทุก 3–5 min',
    prep: 'D5W/NS · ใช้ขวดแก้ว + สาย non-PVC (ดูดซับกับ PVC) · 50 mg/250 mL = 200 mcg/mL',
    maxConc: '≤ 400 mcg/mL',
    maxRate: 'titrate ตาม BP/อาการ',
    note: 'monitor BP · ระวัง hypotension',
    source: SRC,
  },
  {
    generic: 'heparin',
    dose: 'Bolus 80 u/kg → 18 u/kg/h titrate ตาม aPTT',
    prep: '25,000 u/250 mL D5W/NS = 100 u/mL',
    maxConc: '—',
    maxRate: 'ตาม aPTT',
    antidote: 'Protamine sulfate (1 mg ต่อ heparin 100 u)',
    note: 'monitor aPTT/platelet (HIT)',
    source: SRC,
  },
  {
    generic: 'insulin', aliases: ['insulin regular', 'insulin human', 'ri'],
    dose: 'DKA: 0.1 u/kg/h infusion (เฉพาะ regular insulin IV)',
    prep: '100 u ใน NS 100 mL = 1 u/mL · flush สายก่อน (insulin ดูดซับกับพลาสติก)',
    maxConc: '1 u/mL (infusion)',
    maxRate: 'titrate ตามน้ำตาล',
    note: 'IV ได้เฉพาะ regular/short-acting · monitor glucose + K⁺',
    source: SRC,
  },
  {
    generic: 'potassium chloride', aliases: ['kcl', 'potassium'],
    dose: 'ทดแทนตามระดับ K⁺ (มัก 10–20 mEq ต่อครั้ง)',
    prep: 'ต้องเจือจางเสมอ · peripheral ≤ 10 mEq/100 mL · central ถึง 20 mEq/100 mL',
    maxConc: 'peripheral 0.1 mEq/mL (40 mEq/L) · central 0.2 mEq/mL',
    maxRate: 'peripheral ≤ 10 mEq/h · central ≤ 20–40 mEq/h (ต้อง EKG monitor)',
    incompatible: 'ห้าม IV push เด็ดขาด (เสี่ยง cardiac arrest)',
    note: 'monitor EKG + K⁺ · ยิ่งเข้มข้น/เร็ว = เสี่ยง arrhythmia',
    source: SRC,
  },
  {
    generic: 'magnesium sulfate', aliases: ['mgso4', 'magnesium'],
    dose: '1–2 g over 15–60 min · Eclampsia load 4–6 g then 1–2 g/h',
    prep: 'เจือจางใน D5W/NS · ความเข้มข้น ≤ 20% (200 mg/mL)',
    maxConc: '20% (200 mg/mL)',
    maxRate: '≤ 150 mg/min (loading ให้ ≥20 min) · maint 1–2 g/h',
    note: 'monitor DTR/RR/BP · เกินขนาด → หยุด + calcium gluconate',
    antidote: 'Calcium gluconate',
    source: SRC,
  },
  {
    generic: 'calcium gluconate',
    dose: '1–2 g IV (hypocalcemia/hyperK)',
    prep: 'เจือจางใน D5W/NS · ฉีดช้า',
    maxConc: '—',
    maxRate: '≤ 200 mg/min (1 g ให้ ≥5 min) · EKG monitor',
    incompatible: 'sodium bicarbonate, phosphate (ตกตะกอน), ceftriaxone',
    note: 'central preferred สำหรับเข้มข้น · ระวัง extravasation (necrosis)',
    source: SRC,
  },
  {
    generic: 'phenytoin',
    dose: 'Loading 15–20 mg/kg IV',
    prep: 'ใช้ NS เท่านั้น (ตกตะกอนใน D5W) · in-line filter · ฉีดช้า',
    maxConc: '≤ 6.7 mg/mL',
    maxRate: '≤ 50 mg/min (ผู้สูงอายุ ≤ 25 mg/min) — เร็วไป → hypotension/arrhythmia',
    incompatible: 'D5W, สารอื่นเกือบทั้งหมด (ให้แยกสาย)',
    note: 'monitor EKG/BP · ระวัง purple glove syndrome',
    source: SRC,
  },
  {
    generic: 'sodium bicarbonate', aliases: ['nahco3'],
    dose: 'ตาม base deficit / ภาวะ (8.4% = 1 mEq/mL)',
    prep: 'เจือจางสำหรับ infusion · central preferred สำหรับเข้มข้น',
    maxConc: '8.4% (1 mEq/mL) undiluted เฉพาะ code',
    maxRate: 'ช้า',
    incompatible: 'calcium, catecholamines (adrenaline/NE/dopamine), ตกตะกอนกับหลายตัว',
    note: 'ระวัง extravasation · ให้แยกสายจาก catecholamine',
    source: SRC,
  },
  {
    generic: 'hydralazine',
    dose: '5–10 mg IV q20–30 min (ความดันสูงวิกฤต)',
    prep: 'ให้ undiluted ฉีดช้า หรือเจือจางใน NS',
    maxConc: '20 mg/mL (undiluted)',
    maxRate: 'ฉีดช้า · monitor BP',
    incompatible: 'D5W (เสื่อมสภาพ), aminophylline',
    note: 'monitor BP/HR · ออกฤทธิ์ใน 10–20 นาที',
    source: SRC,
  },
  {
    generic: 'morphine',
    dose: '2–4 mg IV titrate q5–15 min',
    prep: 'เจือจาง (เช่น 1 mg/mL ใน NS) · ฉีดช้า',
    maxConc: '—',
    maxRate: 'ฉีดช้า 4–5 นาที',
    antidote: 'Naloxone',
    note: 'monitor RR/sedation/BP',
    source: SRC,
  },
]

const HAD_INDEX = new Map<string, HadRef>()
for (const r of HAD_REF) {
  HAD_INDEX.set(r.generic, r)
  for (const a of r.aliases ?? []) HAD_INDEX.set(a, r)
}

/** หา HAD ref จาก generic/ชื่อยา (substring match — ชื่อยาวสุดก่อน) */
/** match key แบบ "ทั้งคำ" (word boundary) — กัน 'ri' (insulin) ไปโดน "warfaRIn" */
function wordMatch(hay: string, key: string): boolean {
  const k = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9])${k}([^a-z0-9]|$)`, 'i').test(hay)
}

export function findHadRef(generic?: string, drugName?: string): HadRef | undefined {
  const hay = `${generic ?? ''} ${drugName ?? ''}`.toLowerCase()
  if (!hay.trim()) return undefined
  const direct = HAD_INDEX.get((generic ?? '').trim().toLowerCase())
  if (direct) return direct
  let best: HadRef | undefined
  let bestLen = 0
  for (const [key, ref] of HAD_INDEX) {
    // ต้องตรงทั้งคำ + key ยาว ≥ 3 (กันคำสั้นชนกลางคำ) — เลือก key ที่ยาวสุด
    if (key.length >= 3 && key.length > bestLen && wordMatch(hay, key)) { best = ref; bestLen = key.length }
  }
  return best
}
