import Anthropic from '@anthropic-ai/sdk'
import { getAnthropicConfig } from './summary'
import type { DrugMaster, LabRule } from '@/types/drug'

/** ให้ Claude ช่วยร่าง drug monograph เสริมส่วนที่ระบบไม่มีข้อมูล */
export async function generateDrugMonograph(drug: DrugMaster, labRules: LabRule[]): Promise<string> {
  const { key, model } = await getAnthropicConfig()
  if (!key) throw new Error('ยังไม่ได้ตั้งค่า Anthropic API key — ตั้งค่าในหน้า Settings')

  const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true })

  const ctx = [
    `ชื่อยา: ${drug.drug_name}`,
    drug.generic_name ? `Generic: ${drug.generic_name}` : '',
    drug.drug_class ? `กลุ่มยา: ${drug.drug_class}` : '',
    drug.strength ? `ความแรง: ${drug.strength}` : '',
    drug.form ? `รูปแบบ: ${drug.form}` : '',
    drug.therapeutic ? `ข้อบ่งใช้ (รพ.): ${drug.therapeutic}` : '',
    drug.pregnancy_category ? `Pregnancy category: ${drug.pregnancy_category}` : '',
    drug.is_HAD ? 'เป็น High Alert Drug' : '',
    labRules.map((r) => r.dose_meta ? `Renal adjust: ${r.dose_meta}` : '').filter(Boolean).join('; '),
    labRules.map((r) => r.pediatric_dose ? `ขนาดเด็ก: ${r.pediatric_dose}` : '').filter(Boolean).join('; '),
  ].filter(Boolean).join('\n')

  const prompt = `เขียน drug monograph ภาษาไทย กระชับ สำหรับเภสัชกรโรงพยาบาลรัฐ ใช้ข้อมูลที่ให้ร่วมกับความรู้มาตรฐาน
แสดงเป็นหัวข้อสั้น ๆ ใช้ bullet:

# กลไกการออกฤทธิ์
# ข้อบ่งใช้หลัก
# ขนาดยาทั่วไป (ผู้ใหญ่)
# ผลข้างเคียงสำคัญ
# ข้อควรระวัง / ข้อห้าม
# คำแนะนำผู้ป่วย

แต่ละหัวข้อ 2-4 bullet สั้น ๆ. ปิดท้ายด้วยบรรทัดเดียว:
"⚠ ข้อมูลทั่วไป — ตรวจสอบกับเอกสารกำกับยา/แหล่งอ้างอิงก่อนใช้จริง"

ข้อมูลยาจากระบบ:
${ctx}`

  const res = await client.messages.create({
    model,
    max_tokens: 900,
    messages: [{ role: 'user', content: prompt }],
  })
  return res.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('\n')
}
