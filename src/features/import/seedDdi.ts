/**
 * DDI seed data — คู่ยาอันตรกิริยาจากแนวทาง รพ.สุโขทัย (IPD prescribing screening)
 *
 * Severity: major = M (รุนแรง, Fatal), moderate = Mo, minor = Mi, contraindicated = X
 * Onset: R = Rapid (<24h), D = Delayed (วัน-สัปดาห์)
 * Documentation: 1=Established, 2=Probable, 3=Suspected
 */

import type { DdiOverride } from '@/types/drug'

interface SeedPair {
  drugs_a: string[]
  drugs_b: string[]
  severity: DdiOverride['severity']
  onset: DdiOverride['onset']
  documentation: DdiOverride['documentation']
  mechanism: string
  local_note: string
  recommendation: string
}

const SEED: SeedPair[] = [
  // 1) Ergot + Protease inhibitors → Fatal, ห้ามใช้ร่วม
  {
    drugs_a: ['Ergotamine', 'Methylergonovine'],
    drugs_b: ['Ritonavir', 'Indinavir', 'Lopinavir'],
    severity: 'contraindicated', onset: 'D', documentation: '2',
    mechanism: 'PI = Strong CYP3A4 inhibitor → รบกวน hepatic metabolism ของ Ergot → ergotism',
    local_note: '🚨 Fatal drug interaction — vasoconstriction → peripheral gangrene',
    recommendation: 'ห้ามใช้ร่วมกัน — consult แพทย์เปลี่ยนเป็นยาตัวอื่น',
  },
  // 2) Ergot + NNRTI (Efavirenz)
  {
    drugs_a: ['Ergotamine', 'Methylergonovine'],
    drugs_b: ['Efavirenz'],
    severity: 'contraindicated', onset: 'D', documentation: '3',
    mechanism: 'Moderate CYP3A4 inhibition → ergot toxicity',
    local_note: '🚨 Fatal drug interaction',
    recommendation: 'ห้ามใช้ร่วมกัน — consult แพทย์',
  },
  // 3) Ergot + Macrolides → Fatal
  {
    drugs_a: ['Ergotamine', 'Methylergonovine'],
    drugs_b: ['Clarithromycin', 'Erythromycin', 'Azithromycin', 'Roxithromycin'],
    severity: 'contraindicated', onset: 'R', documentation: '2',
    mechanism: 'Macrolide = Strong/Moderate CYP3A4 inhibitor (Roxithromycin = weak)',
    local_note: '🚨 Fatal — ergotism, peripheral vasoconstriction → gangrene',
    recommendation: 'ห้ามใช้ร่วมกัน — Roxithromycin แม้ weak ยังต้องเลี่ยง',
  },
  // 4) Sildenafil + Nitrates
  {
    drugs_a: ['Sildenafil'],
    drugs_b: ['Nitroglycerin', 'Isosorbide mononitrate', 'Isosorbide dinitrate'],
    severity: 'contraindicated', onset: 'R', documentation: '3',
    mechanism: 'Synergistic vasodilation',
    local_note: '🚨 ความดันโลหิตลดต่ำลงอย่างรวดเร็ว — shock หรือเสียชีวิตได้',
    recommendation: 'ห้ามใช้ร่วมกันเด็ดขาด',
  },
  // 5) Tamoxifen + SSRI (potent CYP2D6 inhibitors)
  {
    drugs_a: ['Tamoxifen'],
    drugs_b: ['Fluoxetine', 'Sertraline'],
    severity: 'contraindicated', onset: 'D', documentation: '2',
    mechanism: 'Strong/Moderate CYP2D6 inhibition → ลด conversion ไป Endoxifen (active metabolite)',
    local_note: '🚨 ลดประสิทธิภาพ Tamoxifen → เพิ่มความเสี่ยงตายจาก breast cancer',
    recommendation: 'ห้ามใช้ร่วม — consult เปลี่ยนเป็น SSRI ตัวอื่น (Citalopram, Escitalopram, Venlafaxine)',
  },
  // 6) Irinotecan + Azole antifungals
  {
    drugs_a: ['Irinotecan'],
    drugs_b: ['Ketoconazole', 'Itraconazole', 'Fluconazole'],
    severity: 'contraindicated', onset: 'D', documentation: '2',
    mechanism: 'Azole = Strong/Moderate CYP3A4 inhibitor → Irinotecan toxicity',
    local_note: '🚨 Hematologic toxicity รุนแรง — หยุด azole อย่างน้อย 2 สัปดาห์ก่อน Irinotecan',
    recommendation: 'ห้ามใช้ร่วม — consult เปลี่ยนยา',
  },
  // 7) Warfarin + Rifampicin (decrease effect)
  {
    drugs_a: ['Warfarin'],
    drugs_b: ['Rifampicin'],
    severity: 'major', onset: 'D', documentation: '3',
    mechanism: 'CYP induction → ลดผล anticoagulant',
    local_note: 'ลดผล warfarin',
    recommendation: 'เริ่ม Rifampicin → เพิ่ม warfarin 100-200% ครั้งละ 2.5 mg/วัน ใน 1-2 สัปดาห์แรก · หยุด Rifampicin → ลด warfarin 50% · ติดตาม INR ใกล้ชิด',
  },
  // 8) Warfarin + Dicloxacillin
  {
    drugs_a: ['Warfarin'],
    drugs_b: ['Dicloxacillin'],
    severity: 'major', onset: 'D', documentation: '3',
    mechanism: 'CYP induction',
    local_note: 'ลด INR ~17% — เริ่มเห็นผล 4-5 วัน คงอยู่ 2-4 สัปดาห์หลังหยุดยา',
    recommendation: 'ติดตาม INR เป็นระยะทั้งช่วงใช้ร่วมและหลังหยุดยา · ปรับเพิ่ม warfarin ถ้า INR ต่ำกว่าเป้า',
  },
  // 9) Warfarin + Amiodarone
  {
    drugs_a: ['Warfarin'],
    drugs_b: ['Amiodarone'],
    severity: 'major', onset: 'D', documentation: '1',
    mechanism: 'CYP2C9/CYP3A4 inhibition',
    local_note: 'เพิ่มผล anticoagulant → bleeding risk',
    recommendation: 'ติดตาม INR ก่อนและขณะใช้ร่วม ปรับขนาดยาอย่างสม่ำเสมอ',
  },
  // 10) Warfarin + Azole antifungals
  {
    drugs_a: ['Warfarin'],
    drugs_b: ['Fluconazole', 'Ketoconazole', 'Itraconazole'],
    severity: 'major', onset: 'D', documentation: '1',
    mechanism: 'Strong CYP2C9 inhibition',
    local_note: 'เพิ่มผล warfarin — bleeding risk สูง',
    recommendation: 'ติดตาม INR + อาการ bleeding (จุดจ้ำเลือด, ปัสสาวะสี, บาดแผลเลือดไม่หยุด) — กลับมาพบแพทย์ทันทีถ้าผิดปกติ',
  },
  // 11) Warfarin + Metronidazole
  {
    drugs_a: ['Warfarin'],
    drugs_b: ['Metronidazole'],
    severity: 'major', onset: 'D', documentation: '1',
    mechanism: 'CYP2C9 inhibition',
    local_note: 'เพิ่มผล warfarin — bleeding risk',
    recommendation: 'ติดตาม INR + อาการ bleeding — กลับมาพบแพทย์ทันทีถ้ามีจุดจ้ำเลือด/ปัสสาวะผิดปกติ',
  },
  // 12) Warfarin + Fluoroquinolones
  {
    drugs_a: ['Warfarin'],
    drugs_b: ['Ciprofloxacin', 'Norfloxacin', 'Ofloxacin', 'Levofloxacin'],
    severity: 'major', onset: 'D', documentation: '2',
    mechanism: 'CYP inhibition + เปลี่ยน gut flora ที่สร้าง vitamin K',
    local_note: 'เพิ่มผล warfarin',
    recommendation: 'ติดตาม INR + อาการ bleeding',
  },
  // 13) Warfarin + Macrolides
  {
    drugs_a: ['Warfarin'],
    drugs_b: ['Clarithromycin', 'Erythromycin', 'Azithromycin'],
    severity: 'major', onset: 'D', documentation: '2',
    mechanism: 'CYP3A4 inhibition',
    local_note: 'เพิ่มผล warfarin',
    recommendation: 'ติดตาม INR + อาการ bleeding',
  },
  // 14) Warfarin + Fluorouracil/Capecitabine
  {
    drugs_a: ['Warfarin'],
    drugs_b: ['Fluorouracil', '5-FU', 'Capecitabine'],
    severity: 'major', onset: 'D', documentation: '3',
    mechanism: 'CYP2C9 inhibition',
    local_note: 'เพิ่มผล warfarin',
    recommendation: 'ติดตาม INR + อาการ bleeding',
  },
  // 15) Warfarin + Cotrimoxazole
  {
    drugs_a: ['Warfarin'],
    drugs_b: ['Sulfamethoxazole', 'Trimethoprim', 'Cotrimoxazole', 'Bactrim'],
    severity: 'major', onset: 'D', documentation: '1',
    mechanism: 'Strong CYP2C9 inhibition + displace protein binding',
    local_note: 'เพิ่มผล warfarin มาก — bleeding risk สูง',
    recommendation: 'ติดตาม INR ใกล้ชิด + อาการ bleeding',
  },
  // 16) Chlorpromazine + Propranolol
  {
    drugs_a: ['Chlorpromazine'],
    drugs_b: ['Propranolol'],
    severity: 'major', onset: 'D', documentation: '2',
    mechanism: 'Mutual metabolism inhibition (first-pass) → ระดับยาทั้งคู่สูงขึ้น',
    local_note: 'เพิ่มเสี่ยงพิษ — หัวใจเต้นผิดจังหวะ/หยุดเต้น',
    recommendation: 'ลดขนาดยา · ติดตาม pulse rate (60-100) · EKG ถ้าผิดปกติ',
  },
]

function slugifyDdiId(a: string, b: string): string {
  return `${a}__${b}`.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 200)
}

/** Expand seed pairs into individual { drug_a, drug_b } DDI documents */
export function expandSukhothaiDdi(): { id: string; data: DdiOverride }[] {
  const out: { id: string; data: DdiOverride }[] = []
  for (const seed of SEED) {
    for (const a of seed.drugs_a) {
      for (const b of seed.drugs_b) {
        out.push({
          id: slugifyDdiId(a, b),
          data: {
            drug_a: a,
            drug_b: b,
            severity: seed.severity,
            onset: seed.onset,
            documentation: seed.documentation,
            mechanism: seed.mechanism,
            local_note: seed.local_note,
            recommendation: seed.recommendation,
          },
        })
      }
    }
  }
  return out
}
