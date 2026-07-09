// แปลง ICD-10 (HOSxP ส่งแบบ "ไม่มีจุด" เช่น I500) → key โรคที่ DISEASE_RULES ใช้ + ชื่อไทยไว้แสดง
// ใช้ร่วมกันทั้ง QR (OPD/IPD) และไฟล์ Excel (batch)

/** "I500" → "I50.0" · "N18" → "N18" (HOSxP no-dot → ใส่จุดหลังตัวที่ 3) */
export function formatIcd(code: string): string {
  const c = (code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  return c.length <= 3 ? c : `${c.slice(0, 3)}.${c.slice(3)}`
}

/** key ต้องตรงกับ DISEASE_RULES.disease (เทียบแบบ case-insensitive) */
export const ICD_TO_KEY: [RegExp, string][] = [
  [/^N1[89]/, 'CKD'],
  [/^N17/, 'Renal_Impairment'],
  [/^E1[0-4]/, 'DM'],
  [/^I1[0-5]/, 'HT'],
  [/^(I50|I110|I13[02])/, 'HF'],
  [/^I48/, 'AF'],
  [/^J4[1-6]/, 'Asthma_COPD'],
  [/^(D5[0-3]|D64)/, 'Anemia'],
  [/^G4[01]/, 'Epilepsy'],
  [/^(M10|E79)/, 'Gout'],
  [/^(B2[0-4]|Z21)/, 'HIV_ARV'],
  [/^E05/, 'Hyperthyroid'],
  [/^E03/, 'Hypothyroid'],
  [/^A1[5-9]/, 'TB'],
  [/^(A41|R65)/, 'Infection_Sepsis'],
  [/^(O1[346])/, 'HTN_Pregnancy'],
  [/^(O\d|Z34|Z3A)/, 'PREGNANCY'],
  [/^K7[04]/, 'CIRRHOSIS'],
]

/** ชื่อไทยของ key — ใช้แสดง "Pdx: I50.0 หัวใจล้มเหลว" */
export const KEY_LABEL: Record<string, string> = {
  CKD: 'โรคไตเรื้อรัง', Renal_Impairment: 'ไตบกพร่องเฉียบพลัน', DM: 'เบาหวาน',
  HT: 'ความดันโลหิตสูง', HF: 'หัวใจล้มเหลว', AF: 'หัวใจเต้นผิดจังหวะ (AF)',
  Asthma_COPD: 'หอบหืด/ปอดอุดกั้นเรื้อรัง', Anemia: 'โลหิตจาง', Epilepsy: 'ลมชัก',
  Gout: 'เกาต์', HIV_ARV: 'ติดเชื้อ HIV', Hyperthyroid: 'ไทรอยด์เป็นพิษ',
  Hypothyroid: 'ไทรอยด์ต่ำ', TB: 'วัณโรค', Infection_Sepsis: 'ติดเชื้อ/ภาวะพิษเหตุติดเชื้อ',
  HTN_Pregnancy: 'ความดันสูงขณะตั้งครรภ์', PREGNANCY: 'ตั้งครรภ์/คลอด', CIRRHOSIS: 'ตับแข็ง',
}

/** ICD-10 หลายรหัส → key โรค (unique) ให้ buildDiseaseAlerts จับได้ */
export function icdToDiseaseKeys(codes: string[] | undefined): string[] {
  const set = new Set<string>()
  for (const raw of codes ?? []) {
    const c = (raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (!c) continue
    for (const [re, key] of ICD_TO_KEY) if (re.test(c)) set.add(key)
  }
  return [...set]
}

/** ตั้งครรภ์จาก ICD (O.. / Z34 / Z3A) */
export function icdIsPregnant(codes: string[] | undefined): boolean {
  return (codes ?? []).some((raw) => /^(O\d|Z34|Z3A)/.test((raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')))
}

/** "I500" → "I50.0 หัวใจล้มเหลว" (ถ้าไม่รู้จักชื่อ → คืนรหัสมีจุด) */
export function icdDisplay(code: string): string {
  const c = (code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!c) return ''
  const key = icdToDiseaseKeys([c])[0]
  const label = key ? KEY_LABEL[key] : undefined
  return label ? `${formatIcd(c)} ${label}` : formatIcd(c)
}

/** CKD stage จาก Gf "47[3]" → ตัวเลข (3a/3b → 3) */
export function ckdStageNum(stage?: string): number | undefined {
  if (!stage) return undefined
  const m = String(stage).match(/^(\d)/)
  return m ? Number(m[1]) : undefined
}
