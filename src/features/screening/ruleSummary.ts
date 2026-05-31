import type { DrugEntry, PatientInput, ScreeningAlert } from '@/types/screening'

/**
 * Rule-based summary — สรุปผลคัดกรองจาก alerts + ข้อมูลผู้ป่วย
 * ไม่ต้องใช้ AI — เป็น text สังเคราะห์เอง
 */
export interface RuleSummary {
  headline: string
  keyPoints: string[]
  actions: string[]
  monitorList: string[]
  notes: string[]
}

export function buildRuleSummary(patient: PatientInput, drugs: DrugEntry[], alerts: ScreeningAlert[]): RuleSummary {
  const red = alerts.filter((a) => a.severity === 'red')
  const orange = alerts.filter((a) => a.severity === 'orange')
  const yellow = alerts.filter((a) => a.severity === 'yellow')

  const keyPoints: string[] = []
  const actions: string[] = []
  const monitorList: string[] = []
  const notes: string[] = []

  // ===== Headline =====
  let headline = ''
  if (red.length > 0) {
    headline = `🔴 พบ ${red.length} ประเด็นสำคัญมาก — ${alerts.length} alerts รวม — ตรวจสอบก่อนจ่าย`
  } else if (orange.length > 0) {
    headline = `🟠 พบ ${orange.length} ประเด็นสำคัญ — แนะนำให้ปรับ/monitor`
  } else if (yellow.length > 0) {
    headline = `🟡 พบ ${yellow.length} ประเด็นเฝ้าระวัง`
  } else {
    headline = drugs.length > 0 ? `✅ ผ่านการคัดกรอง (ไม่พบ alert)` : `ยังไม่มีรายการยา`
  }

  // ===== Allergy alerts → top priority =====
  const allergyAlerts = alerts.filter((a) => a.type === 'ALLERGY')
  if (allergyAlerts.length > 0) {
    keyPoints.push(`🚨 ผู้ป่วยแพ้ยา ${patient.allergies?.join(', ') ?? ''} — มี ${allergyAlerts.length} รายการที่อาจตรงหรือ cross-react`)
    allergyAlerts.forEach((a) => {
      actions.push(`หยุด/เปลี่ยนยา: ${a.title.replace('🚨 แพ้ยา: ', '')}`)
    })
  }

  // ===== HAD =====
  const hadList = alerts.filter((a) => a.type === 'HAD').map((a) => a.title.replace('🔴 HIGH ALERT DRUG: ', ''))
  if (hadList.length > 0) {
    keyPoints.push(`🔴 มียาเสี่ยงสูง ${hadList.length} ตัว: ${hadList.join(', ')} — ต้อง double-check`)
    actions.push('Double-check dose, route, patient identity ของยา HAD ก่อนจ่าย')
  }

  // ===== G6PD =====
  const g6pdAlerts = alerts.filter((a) => a.type === 'G6PD')
  if (g6pdAlerts.length > 0) {
    keyPoints.push(`🩸 ผู้ป่วย G6PD + ยาที่ก่อ hemolysis ${g6pdAlerts.length} ตัว — ต้องเปลี่ยน`)
    g6pdAlerts.forEach((a) => actions.push(`เปลี่ยนยา: ${a.title.replace('🩸 G6PD + ', '').replace(' — ห้ามใช้', '')}`))
  }

  // ===== DDI — แสดงชื่อยาคู่ที่เกิดปฏิกิริยา =====
  const ddiRed = alerts.filter((a) => a.type === 'DDI' && a.severity === 'red')
  const ddiOrange = alerts.filter((a) => a.type === 'DDI' && a.severity === 'orange')
  function ddiPairLabel(a: ScreeningAlert): string {
    // title format: "DDI {severity}: {drug A} ↔ {drug B}"
    const m = a.title.match(/:\s*(.+?)\s*↔\s*(.+)$/)
    if (m) return `${m[1].trim()} ↔ ${m[2].trim()}`
    return a.drugs?.join(' + ') ?? ''
  }
  if (ddiRed.length > 0) {
    if (ddiRed.length === 1) {
      keyPoints.push(`⚠️ DDI รุนแรง: ${ddiPairLabel(ddiRed[0])} — ห้าม/หลีกเลี่ยงการใช้ร่วม`)
    } else {
      keyPoints.push(`⚠️ DDI รุนแรง ${ddiRed.length} คู่ — ห้าม/หลีกเลี่ยงการใช้ร่วม:`)
      ddiRed.forEach((a) => keyPoints.push(`   • ${ddiPairLabel(a)}`))
    }
    ddiRed.forEach((a) => {
      const pair = ddiPairLabel(a)
      if (a.recommendation) actions.push(`DDI [${pair}]: ${a.recommendation}`)
    })
  }
  if (ddiOrange.length > 0) {
    const pairList = ddiOrange.map(ddiPairLabel).join(' · ')
    notes.push(`มี DDI ปานกลาง ${ddiOrange.length} คู่ — monitor ใกล้ชิด: ${pairList}`)
  }

  // ===== Renal =====
  const renalAlerts = alerts.filter((a) => a.type === 'RENAL')
  if (renalAlerts.length > 0) {
    if (patient.scr) {
      keyPoints.push(`🫘 SCr = ${patient.scr} mg/dL — ต้องปรับขนาดยา ${renalAlerts.length} ตัว`)
    }
    renalAlerts.forEach((a) => {
      const drugName = a.title.match(/ปรับ (.+)$/)?.[1] ?? a.drugs?.[0] ?? ''
      if (a.recommendation) actions.push(`ปรับขนาด ${drugName}: ${a.recommendation}`)
    })
  }

  // helper: ดึงชื่อยาจาก alert
  function drugNamesOf(a: ScreeningAlert): string {
    if (a.drugs && a.drugs.length > 0) {
      const names = a.drugs.map((ic) => drugs.find((d) => d.icode === ic)?.master?.drug_name ?? ic)
      return names.join(', ')
    }
    return ''
  }

  // ===== Pregnancy =====
  if (patient.is_pregnant) {
    const pregAlerts = alerts.filter((a) => a.type === 'PREG')
    if (pregAlerts.length > 0) {
      const names = pregAlerts.map(drugNamesOf).filter(Boolean).join(', ')
      keyPoints.push(`🤰 ผู้ป่วยตั้งครรภ์ + ยาเสี่ยง: ${names || pregAlerts.length + ' ตัว'}`)
      pregAlerts.forEach((a) => {
        if (a.recommendation) actions.push(`Pregnancy [${drugNamesOf(a)}]: ${a.recommendation}`)
      })
    }
  }

  // ===== Lactation =====
  if (patient.is_lactating) {
    const lactAlerts = alerts.filter((a) => a.type === 'LACT')
    if (lactAlerts.length > 0) {
      const names = lactAlerts.map(drugNamesOf).filter(Boolean).join(', ')
      keyPoints.push(`🤱 ผู้ป่วยให้นมบุตร + ยาไม่แนะนำ: ${names || lactAlerts.length + ' ตัว'}`)
    }
  }

  // ===== Beers =====
  const beersAlerts = alerts.filter((a) => a.type === 'BEERS')
  if (beersAlerts.length > 0 && patient.age) {
    const names = beersAlerts.map(drugNamesOf).filter(Boolean).join(', ')
    keyPoints.push(`👴 ผู้สูงอายุ (${patient.age} ปี) + Beers list: ${names || beersAlerts.length + ' ตัว'} — พิจารณาเปลี่ยน`)
  }

  // ===== Duplicate therapy =====
  const drpAlerts = alerts.filter((a) => a.type === 'DRP')
  if (drpAlerts.length > 0) {
    drpAlerts.forEach((a) => {
      // title format ของ dup class: "🚫 Duplicate: {class}" หรือ "ยาซ้ำ generic: ..."
      keyPoints.push(`🔁 ${a.title.replace(/^🚫\s*|^/, '')}`)
      if (a.recommendation) actions.push(a.recommendation)
    })
  }

  // ===== LAB monitoring =====
  const labAlerts = alerts.filter((a) => a.type === 'LAB')
  labAlerts.forEach((a) => {
    const param = a.title.match(/— ([^=]+?)(?:\s*=|\s*$)/)?.[1]?.trim()
    if (param) monitorList.push(param)
  })

  // ===== TDM =====
  const tdmAlerts = alerts.filter((a) => a.type === 'TDM')
  tdmAlerts.forEach((a) => monitorList.push(a.title))

  // ===== Pediatric =====
  const pedAlerts = alerts.filter((a) => a.type === 'PED')
  if (pedAlerts.length > 0 && patient.age) {
    keyPoints.push(`👶 ผู้ป่วยเด็ก (${patient.age} ปี) — ต้องตรวจขนาดยาเด็ก ${pedAlerts.length} รายการ`)
  }

  // ===== Disease alerts =====
  const diseaseAlerts = alerts.filter((a) => a.type === 'DISEASE')
  if (diseaseAlerts.length > 0) {
    keyPoints.push(`🏥 โรคประจำตัว + ยาที่ต้องระวัง ${diseaseAlerts.length} รายการ`)
  }

  // Generic action fallback
  if (actions.length === 0 && red.length > 0) {
    red.forEach((a) => {
      if (a.recommendation) actions.push(a.recommendation)
    })
  }
  if (actions.length === 0 && orange.length > 0) {
    orange.slice(0, 3).forEach((a) => {
      if (a.recommendation) actions.push(a.recommendation)
    })
  }

  if (keyPoints.length === 0 && drugs.length > 0 && alerts.length === 0) {
    keyPoints.push('ระบบไม่พบความเสี่ยงสำคัญจากเกณฑ์ที่ตั้งไว้ในฐานข้อมูล')
    keyPoints.push('สามารถจ่ายยาตามใบสั่งได้ — ให้ counseling ตามปกติ')
  }

  return {
    headline,
    keyPoints,
    actions: [...new Set(actions)],  // unique
    monitorList: [...new Set(monitorList)],
    notes,
  }
}

/** Format summary เป็น Markdown สำหรับแสดง/copy/PDF */
export function summaryToText(s: RuleSummary): string {
  const sec = (title: string, items: string[]) => items.length === 0 ? '' : `\n**${title}**\n${items.map((x) => `• ${x}`).join('\n')}\n`
  return [
    s.headline,
    sec('🎯 ประเด็นสำคัญ', s.keyPoints),
    sec('✅ Action สำหรับเภสัชกร', s.actions),
    sec('📋 ต้อง monitor', s.monitorList),
    sec('📝 หมายเหตุ', s.notes),
  ].filter(Boolean).join('\n')
}
