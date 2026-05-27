/**
 * Warfarin dose adjustment helper
 *
 * อ้างอิงหลัก Van Spall/Jacobson algorithm + standard CHEST guideline
 * - target INR 2.0-3.0 (default) — ผู้ใช้ปรับได้
 * - ปรับเป็น % ของ weekly dose ตาม INR ปัจจุบัน
 */

export interface WarfarinInput {
  currentWeeklyDose: number   // mg/week (ผลรวม 7 วัน)
  currentINR: number
  targetINRMin: number        // เช่น 2.0
  targetINRMax: number        // เช่น 3.0
  bleeding?: boolean
}

export interface WarfarinResult {
  recommendation: string
  newWeeklyDose: number | null
  changePercent: number | null
  nextINRDays: number
  holdDays: number
  notes: string[]
}

export function calcWarfarin(input: WarfarinInput): WarfarinResult {
  const { currentWeeklyDose, currentINR, targetINRMin, targetINRMax, bleeding } = input
  const notes: string[] = []

  if (bleeding) {
    notes.push('มีเลือดออก — ส่งพบแพทย์ทันที พิจารณา Vitamin K')
    return {
      recommendation: 'หยุดยา + ส่งพบแพทย์ทันที',
      newWeeklyDose: 0,
      changePercent: -100,
      nextINRDays: 1,
      holdDays: -1,
      notes,
    }
  }

  // กรณี INR สูงมาก
  if (currentINR > 10) {
    notes.push('INR > 10 — พิจารณา Vitamin K 2.5-5 mg PO + ส่งพบแพทย์')
    return {
      recommendation: 'หยุดยา 1-2 วัน + Vitamin K PO + นัด INR ใน 24-48 ชม.',
      newWeeklyDose: round05(currentWeeklyDose * 0.8),
      changePercent: -20,
      nextINRDays: 1,
      holdDays: 2,
      notes,
    }
  }
  if (currentINR > 5 && currentINR <= 10) {
    notes.push('INR 5-10 — หยุด 1-2 dose พิจารณา Vitamin K 1-2.5 mg PO ถ้ามี risk')
    return {
      recommendation: 'หยุด 1-2 dose, INR นัด 3-5 วัน',
      newWeeklyDose: round05(currentWeeklyDose * 0.9),
      changePercent: -10,
      nextINRDays: 4,
      holdDays: 2,
      notes,
    }
  }
  if (currentINR > targetINRMax && currentINR <= 5) {
    notes.push('INR เกิน target เล็กน้อย — ลด weekly dose 5-10%')
    return {
      recommendation: 'ลดขนาดยา 5-10% นัด INR 1-2 สัปดาห์',
      newWeeklyDose: round05(currentWeeklyDose * 0.925),
      changePercent: -7.5,
      nextINRDays: 10,
      holdDays: 0,
      notes,
    }
  }
  if (currentINR >= targetINRMin && currentINR <= targetINRMax) {
    notes.push('INR อยู่ในช่วง target — คงขนาดเดิม')
    return {
      recommendation: 'คงขนาดเดิม นัด INR 4 สัปดาห์',
      newWeeklyDose: currentWeeklyDose,
      changePercent: 0,
      nextINRDays: 28,
      holdDays: 0,
      notes,
    }
  }
  if (currentINR < targetINRMin && currentINR >= 1.5) {
    notes.push('INR ต่ำกว่า target — เพิ่ม weekly dose 5-15%')
    return {
      recommendation: 'เพิ่มขนาดยา 5-15% นัด INR 1-2 สัปดาห์',
      newWeeklyDose: round05(currentWeeklyDose * 1.1),
      changePercent: 10,
      nextINRDays: 10,
      holdDays: 0,
      notes,
    }
  }
  // INR ต่ำมาก
  notes.push('INR < 1.5 — เพิ่มขนาดมากกว่า 15% หรือพิจารณา loading dose')
  return {
    recommendation: 'เพิ่มขนาดยา 15-20% นัด INR 1 สัปดาห์',
    newWeeklyDose: round05(currentWeeklyDose * 1.175),
    changePercent: 17.5,
    nextINRDays: 7,
    holdDays: 0,
    notes,
  }
}

function round05(n: number): number {
  return Math.round(n * 2) / 2
}

/** แตก weekly dose เป็น daily plan แบบสมดุล (mg/day, 7 วัน) */
export function distributeWeeklyDose(weekly: number, tabletStrength = 2): number[] {
  // tablet strength: 1 tab = 2 mg (default Coumadin 2 mg) — ผู้ใช้ปรับได้
  const totalTabs = Math.round((weekly / tabletStrength) * 2) / 2
  const base = Math.floor(totalTabs / 7)
  const extra = +(totalTabs - base * 7).toFixed(1)
  // แจกของเหลือไปวันที่ห่างกัน (Mon, Thu)
  const days = Array(7).fill(base)
  let pointer = 0
  let remaining = extra
  while (remaining > 0) {
    days[pointer % 7] += 0.5
    remaining -= 0.5
    pointer += 3
  }
  return days.map((d) => +(d * tabletStrength).toFixed(2))
}
