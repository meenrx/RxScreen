import Anthropic from '@anthropic-ai/sdk'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { PatientInput, ScreeningAlert, DrugEntry } from '@/types/screening'

interface AISummaryInput {
  patient: PatientInput
  drugs: DrugEntry[]
  alerts: ScreeningAlert[]
}

export async function getAnthropicConfig(): Promise<{ key?: string; model: string }> {
  const snap = await getDoc(doc(db, 'CONFIG', 'anthropic'))
  if (!snap.exists()) return { model: 'claude-haiku-4-5-20251001' }
  const d = snap.data() as { anthropic_api_key?: string; anthropic_model?: string }
  return { key: d.anthropic_api_key, model: d.anthropic_model ?? 'claude-haiku-4-5-20251001' }
}

export async function generateAISummary(input: AISummaryInput): Promise<string> {
  const { key, model } = await getAnthropicConfig()
  if (!key) {
    throw new Error('ยังไม่ได้ตั้งค่า Anthropic API key — กรุณาตั้งค่าในหน้า Settings')
  }

  const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true })

  const drugList = input.drugs
    .map((d, i) => `${i + 1}. ${d.master?.drug_name ?? d.icode}${d.sig ? ` (sig: ${d.sig})` : ''}`)
    .join('\n')

  const alertList = input.alerts
    .map((a) => `- [${a.severity.toUpperCase()}/${a.type}] ${a.title}: ${a.detail}${a.recommendation ? ` → ${a.recommendation}` : ''}`)
    .join('\n')

  const p = input.patient
  const patientLines = [
    p.hn ? `HN: ${p.hn}` : null,
    p.patient_name ? `ผู้ป่วย: ${p.patient_name}` : null,
    p.age !== undefined ? `อายุ: ${p.age} ปี` : null,
    p.weight !== undefined ? `น้ำหนัก: ${p.weight} kg` : null,
    p.scr !== undefined ? `SCr: ${p.scr} mg/dL` : null,
    p.inr !== undefined ? `INR: ${p.inr}` : null,
    p.diseases?.length ? `โรคประจำตัว: ${p.diseases.join(', ')}` : null,
  ].filter(Boolean).join('\n')

  const prompt = `คุณเป็นผู้ช่วยเภสัชกรในโรงพยาบาลรัฐบาลไทย ช่วยสรุปประเด็นการคัดกรองใบสั่งยา
เป็นภาษาไทย **สั้น กระชับมาก** ใช้ bullet points สั้น ๆ (ห้ามยืดเยื้อ) แสดงแค่ 2 ส่วนนี้เท่านั้น:

# 🎯 ประเด็นสำคัญ (2-3 ข้อ สั้น ๆ)
# ✅ สิ่งที่เภสัชกรควรทำ (2-4 ข้อ — เน้น action ที่ทำได้จริง)

ห้ามมีส่วน "บันทึก/ติดตาม" หรือ checklist ใด ๆ. แต่ละ bullet ไม่เกิน 1 บรรทัด.

---
ข้อมูลผู้ป่วย:
${patientLines || '(ไม่ระบุ)'}

รายการยา:
${drugList || '(ไม่มี)'}

Alerts จากระบบคัดกรอง:
${alertList || '(ไม่มี alert)'}
---
สรุปสั้น ๆ:`

  const response = await client.messages.create({
    model,
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('\n')
  return text
}
