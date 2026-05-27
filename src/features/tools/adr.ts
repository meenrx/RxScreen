/**
 * WHO-UMC Causality Assessment Criteria
 * https://who-umc.org/media/164200/who-umc-causality-assessment_new-logo.pdf
 *
 * 6 categories:
 *  1. Certain        — แน่นอน
 *  2. Probable/Likely — น่าจะใช่
 *  3. Possible       — เป็นไปได้
 *  4. Unlikely       — ไม่น่าใช่
 *  5. Conditional    — รอข้อมูลเพิ่ม
 *  6. Unassessable   — ประเมินไม่ได้
 */

export type WhoCategory = 'certain' | 'probable' | 'possible' | 'unlikely' | 'conditional' | 'unassessable'

export interface WhoCategoryInfo {
  key: WhoCategory
  label: string
  color: 'red' | 'orange' | 'yellow' | 'blue' | 'green'
  criteria: string[]
}

export const WHO_CATEGORIES: WhoCategoryInfo[] = [
  {
    key: 'certain',
    label: 'Certain (แน่นอน)',
    color: 'red',
    criteria: [
      'ความสัมพันธ์เชิงเวลาเหมาะสม (temporal sequence ชัดเจน)',
      'ไม่สามารถอธิบายด้วยโรคหรือยาตัวอื่น',
      'อาการดีขึ้นเมื่อหยุดยา (dechallenge positive)',
      'อาการกลับมาเมื่อให้ยาซ้ำ (rechallenge positive)',
      'ปฏิกิริยาเป็นที่ทราบกันทางเภสัชวิทยาหรือมีรายงานมาก่อน',
    ],
  },
  {
    key: 'probable',
    label: 'Probable / Likely (น่าจะใช่)',
    color: 'orange',
    criteria: [
      'ความสัมพันธ์เชิงเวลาเหมาะสม',
      'ไม่น่าจะอธิบายด้วยโรค/ยาตัวอื่น',
      'อาการดีขึ้นเมื่อหยุดยา',
      'ไม่ได้ให้ยาซ้ำ (rechallenge ไม่ได้ทำ) หรือทำแล้วผลเป็น +',
    ],
  },
  {
    key: 'possible',
    label: 'Possible (เป็นไปได้)',
    color: 'yellow',
    criteria: [
      'ความสัมพันธ์เชิงเวลาเหมาะสม',
      'อาจอธิบายด้วยโรค/ยาตัวอื่นได้',
      'ข้อมูลการหยุดยาไม่ชัด หรือไม่ได้หยุดยา',
    ],
  },
  {
    key: 'unlikely',
    label: 'Unlikely (ไม่น่าใช่)',
    color: 'blue',
    criteria: [
      'ความสัมพันธ์เชิงเวลาไม่น่าจะเป็นไปได้',
      'มีคำอธิบายอื่นจากโรคหรือยาตัวอื่นที่น่าจะใช่กว่า',
    ],
  },
  {
    key: 'conditional',
    label: 'Conditional / Unclassified (รอข้อมูลเพิ่ม)',
    color: 'blue',
    criteria: [
      'ต้องการข้อมูลเพิ่มเติม',
      'หรือกำลังรอผลตรวจเพิ่มเติม',
    ],
  },
  {
    key: 'unassessable',
    label: 'Unassessable / Unclassifiable (ประเมินไม่ได้)',
    color: 'green',
    criteria: [
      'ข้อมูลไม่เพียงพอ',
      'หรือข้อมูลขัดแย้งกัน ไม่สามารถสรุปได้',
    ],
  },
]

export interface WhoQuestion {
  id: string
  text: string
  options: { value: string; label: string }[]
}

export const WHO_QUESTIONS: WhoQuestion[] = [
  {
    id: 'temporal',
    text: 'ความสัมพันธ์เชิงเวลาระหว่างให้ยา ↔ เกิด ADR',
    options: [
      { value: 'plausible', label: 'เหมาะสม / สอดคล้อง' },
      { value: 'reasonable', label: 'พอเป็นไปได้' },
      { value: 'improbable', label: 'ไม่น่าจะเป็นไปได้' },
      { value: 'unknown', label: 'ไม่ทราบ' },
    ],
  },
  {
    id: 'other_cause',
    text: 'มีคำอธิบายอื่น (โรค/ยาตัวอื่น) ที่อธิบายอาการได้?',
    options: [
      { value: 'none', label: 'ไม่มี / ไม่น่าจะใช่' },
      { value: 'maybe', label: 'อาจมี' },
      { value: 'likely', label: 'มีคำอธิบายอื่นที่น่าจะใช่กว่า' },
      { value: 'unknown', label: 'ไม่ทราบ' },
    ],
  },
  {
    id: 'dechallenge',
    text: 'อาการดีขึ้นเมื่อหยุดยา (dechallenge)?',
    options: [
      { value: 'positive', label: 'ใช่ — ดีขึ้น' },
      { value: 'negative', label: 'ไม่ดีขึ้น' },
      { value: 'not_done', label: 'ไม่ได้หยุดยา' },
      { value: 'unknown', label: 'ไม่ทราบ' },
    ],
  },
  {
    id: 'rechallenge',
    text: 'อาการกลับมาเมื่อให้ยาซ้ำ (rechallenge)?',
    options: [
      { value: 'positive', label: 'ใช่ — กลับมา' },
      { value: 'negative', label: 'ไม่กลับมา' },
      { value: 'not_done', label: 'ไม่ได้ทำ rechallenge' },
      { value: 'unknown', label: 'ไม่ทราบ' },
    ],
  },
  {
    id: 'known_reaction',
    text: 'ปฏิกิริยานี้เป็นที่ทราบทางเภสัชวิทยา / มีรายงานมาก่อน?',
    options: [
      { value: 'yes', label: 'ใช่' },
      { value: 'no', label: 'ไม่ใช่' },
      { value: 'unknown', label: 'ไม่ทราบ' },
    ],
  },
]

export type WhoAnswers = Record<string, string | undefined>

/** Algorithm คำนวณ category ที่แนะนำจากคำตอบ — เภสัชกร override ได้ */
export function suggestWhoCategory(a: WhoAnswers): WhoCategory {
  const t = a.temporal
  const o = a.other_cause
  const de = a.dechallenge
  const re = a.rechallenge
  const known = a.known_reaction

  // ข้อมูลไม่เพียงพอ
  const answeredCount = [t, o, de, known].filter(Boolean).length
  if (answeredCount < 2) return 'unassessable'

  // Unlikely
  if (t === 'improbable' || o === 'likely') return 'unlikely'

  // Certain — ทุกข้อชัด
  if (t === 'plausible' && o === 'none' && de === 'positive' && re === 'positive' && known === 'yes') {
    return 'certain'
  }

  // Probable
  if (t === 'plausible' && (o === 'none' || o === 'maybe') && de === 'positive') {
    return 'probable'
  }

  // Possible
  if ((t === 'plausible' || t === 'reasonable') && (de === 'not_done' || de === 'unknown' || o === 'maybe')) {
    return 'possible'
  }

  // Conditional — มีอย่างน้อยข้อ unknown หลายข้อ
  if (t === 'unknown' || de === 'unknown') return 'conditional'

  return 'possible'
}

export function getCategoryInfo(key: WhoCategory): WhoCategoryInfo {
  return WHO_CATEGORIES.find((c) => c.key === key)!
}
