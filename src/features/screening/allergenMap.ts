/**
 * แผนที่ตัวย่อยาแพ้ (6 ตัวอักษรแรก จาก QR) → กลุ่มยา + ชื่อกลาง
 * ที่มา: allergen_class_map (ข้อกำหนด QR IPD)
 * ใช้แปลง Y6:AMOXIC,... → กลุ่ม เพื่อคัดกรอง cross-reactivity
 */
export interface AllergenClass {
  /** รหัสกลุ่มสั้น เช่น PCN, CEPH */
  class: string
  /** ชื่อกลางที่ engine ใช้ match กับ drug_class/generic เช่น "penicillin" */
  name: string
}

const GROUPS: { class: string; name: string; abbrs: string[] }[] = [
  { class: 'PCN', name: 'penicillin', abbrs: ['AMOXIC', 'AMPICI', 'CLOXAC', 'DICLOX', 'PENICI', 'PIPERA', 'BENZAT', 'AMOXYC'] },
  { class: 'CEPH', name: 'cephalosporin', abbrs: ['CEFTRI', 'CEFAZO', 'CEFOTA', 'CEFEPI', 'CEFDIN'] },
  { class: 'NSAID', name: 'nsaid', abbrs: ['IBUPRO', 'DICLOF', 'PIROXI', 'NAPROX', 'CELECO'] },
  { class: 'SULFA', name: 'sulfa', abbrs: ['CO-TRI', 'SULFAS', 'SILVER', 'SULFAM'] },
  { class: 'ASA', name: 'aspirin', abbrs: ['ASPIRI'] },
  { class: 'PARA', name: 'paracetamol', abbrs: ['PARACE'] },
  { class: 'QNL', name: 'quinolone', abbrs: ['CIPROF', 'NORFLO', 'OFLOX'] },
  { class: 'TET', name: 'tetracycline', abbrs: ['DOXYCY', 'TETRAC'] },
  { class: 'OPI', name: 'opioid', abbrs: ['TRAMAD', 'MORPHI', 'CODEIN'] },
  { class: 'CLI', name: 'clindamycin', abbrs: ['CLINDA'] },
  { class: 'MAC', name: 'macrolide', abbrs: ['ERYTHR', 'AZITHR', 'CLARIT', 'ROXITH'] },
  { class: 'AMG', name: 'aminoglycoside', abbrs: ['GENTA', 'AMIKA', 'STREPT'] },
]

const ABBR_INDEX = new Map<string, AllergenClass>()
for (const g of GROUPS) {
  // รับทั้งตัวย่อ 6 ตัว (AMOXIC) และรหัสกลุ่มตรง ๆ (PCN)
  ABBR_INDEX.set(g.class.toUpperCase(), { class: g.class, name: g.name })
  for (const a of g.abbrs) ABBR_INDEX.set(a.toUpperCase(), { class: g.class, name: g.name })
}
// รหัสกลุ่มเพิ่มเติมที่ QR อาจส่งมาตรง ๆ (นอกเหนือจาก 6-char)
const EXTRA_CLASS: Record<string, string> = {
  CARB: 'carbapenem', CBZ: 'carbamazepine', PHT: 'phenytoin', ACEI: 'acei',
  ARB: 'arb', THIAZ: 'thiazide', SU: 'sulfonylurea', VANCO: 'vancomycin',
  ALLOP: 'allopurinol', HEPARIN: 'heparin',
}
for (const [code, name] of Object.entries(EXTRA_CLASS)) ABBR_INDEX.set(code, { class: code, name })

/** แปลงตัวย่อ (6 ตัว หรือรหัสกลุ่ม PCN/SULFA/...) → กลุ่มยา (null ถ้า map ไม่ได้) */
export function mapAllergen(abbr: string): AllergenClass | null {
  const a = abbr.trim().toUpperCase().replace(/\*/g, '')
  return ABBR_INDEX.get(a) ?? null
}
