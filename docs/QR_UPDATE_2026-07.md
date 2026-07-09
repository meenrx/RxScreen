# แจ้ง RxScreen — อัปเดต QR OPD (ก.ค. 2026)

QR บนฉลากยา **OPD** ถูกยกระดับให้ **ส่งข้อมูลครบเท่า IPD** และเปลี่ยนรูปแบบ `D:` (วินิจฉัย)
เอกสารนี้อธิบายว่าอะไรเปลี่ยน และ **RxScreen ต้องปรับอะไรบ้าง**

## สรุปสั้น: RxScreen **ไม่ต้องแก้โค้ด** — parser รองรับครบแล้ว
ทุก key ที่เพิ่มมี `case` อยู่แล้วใน `QrScanner.tsx` และ `D:` (key) ตรงกับ `buildDiseaseAlerts` อยู่แล้ว
→ แค่ **redeploy QR ฝั่ง รพ.** ระบบก็อ่านได้ครบทันที เอกสารนี้ไว้ให้ทีมเข้าใจตรงกัน

---

## 1) OPD QR เพิ่ม 5 ฟิลด์ (ให้เท่า IPD)
เดิม OPD ส่ง 16 ฟิลด์ · ตอนนี้ **21 ฟิลด์** (เพิ่ม C/Ab/Hb/T/6)

| Key | ค่า | scanner (`parseKeyedFields`) | เก็บใน |
|-----|-----|------------------------------|--------|
| `C` | **CrCl** (Cockcroft-Gault) | `case 'C'` (บรรทัด 429) | `out.crcl` |
| `Ab` | **Albumin** | `case 'Ab'` (445) | `labs.albumin` |
| `Hb` | **Hemoglobin** | `case 'Hb'` (446) | `labs.hb` |
| `T` | **Platelet** (เฉพาะ <150) | `case 'T'` (447) | `labs.plt` |
| `6` | **G6PD** | `case '6'` (453) | `g6pd` |

**เหมือน IPD ทุกอย่าง** → OPD/IPD ใช้ข้อมูลชุดเดียวกันคัดกรอง (parity)
ฟิลด์ใหม่ทั้งหมด **gate ด้วยยา** (โผล่เฉพาะเมื่อมียาที่เกี่ยวข้อง) เพื่อคุมความยาว QR

## 2) `D:` = **ICD-10 เฉพาะที่เข้าหมวด RDU** ⚠️ (จุดที่ต้องปรับ)
**เดิม:** `D:E11,I10,N18,8931,...` (ICD10 ดิบทุกตัว + รหัสหัตถการ — ยาว + ไม่ได้ใช้)
**ใหม่:** `D:` ส่ง **เฉพาะ ICD-10 ที่ตรงหมวด RDU** (URI/ท้องเสีย/คลอด/บาดแผล) — ตัวอื่นตัดทิ้ง
เช่น คนไข้ URI → `D:J069` · ท้องเสีย → `D:A000` · เบาหวานอย่างเดียว → **ไม่มี D:** (ไม่เข้า RDU)

**ทำไม:** RDU checks (`rduRules.ts`) ใช้ `patient.rdu_context` = `['URI','DIARRHEA','NORMAL_LABOR','TRAUMA']`
ซึ่ง**ปัจจุบันต้องให้ pharmacist tick เอง** (คอมเมนต์บรรทัด 7: "ระบบไม่ดึงจาก HIS")
→ QR ส่ง ICD-10 หมวด RDU มาแล้ว **ทำให้คำนวณ RDU อัตโนมัติได้ ไม่ต้อง tick**

### 🔧 RxScreen ต้องเพิ่ม: auto-map scanned ICD-10 → `rdu_context`
หลังสแกน ให้ไล่ ICD-10 ใน `out.diseases` เทียบกับ `icd10Include`/`icd10Exclude` ของแต่ละ RDU rule
ถ้าตรง → เติม `contextKey` (URI/DIARRHEA/NORMAL_LABOR/TRAUMA) ลง `patient.rdu_context` อัตโนมัติ

```ts
// pseudo — หลัง parse QR
for (const rule of RDU_CHECKS) {
  if (!rule.icd10Include) continue
  const inc = rule.icd10Include.map(norm)   // norm = ตัดจุด + uppercase
  const exc = (rule.icd10Exclude ?? []).map(norm)
  const hit = out.diseases?.some(d => {
    const c = norm(d)
    return inc.some(x => matchRange(c, x)) && !exc.some(x => matchRange(c, x))
  })
  if (hit && rule.contextKey) rdu_context.push(rule.contextKey)
}
```
**สำคัญ:** ICD-10 จาก HOSxP เป็น **no-dot** (`J069`) แต่ `icd10Include` เป็น **dotted** (`J06.9`)
→ ต้อง **normalize (ตัดจุด) ทั้งสองฝั่ง** ก่อนเทียบ · และรองรับ range (เช่น `S00-S01`, `S10.7-S10.9`)

**ข้อจำกัด:** D: แบบนี้ **ไม่มีโรคเรื้อรัง** (DM/HT/CKD/HF) → disease-drug rules (`buildDiseaseAlerts`) + แท็บ "ตามโรค"
จะไม่มีข้อมูลจาก QR (ยังใช้ eGFR/manual ได้) · ถ้าต้องการให้ครบ ขอเพิ่ม field แยกสำหรับ disease key

## 3) ฟิลด์เดิมที่ยังเหมือนเดิม
`N`=HN `R:`=icode ยา `A`=อายุ `S`=เพศ `W`=น้ำหนัก `Gf`=eGFR[stage] `I`=INR `K` `O`=AST `L`=ALT `G`=FBS `A1`=HbA1c(มีจุดทศนิยม) `Nc`=ANC `Ec`=AEC `Y`=แพ้ยา `P`=ตั้งครรภ์
(แลปทุกตัว = `<ค่า>@YYMMDD`)

## 4) ความยาว (กัน QR ล้น)
วัด 60 เคสจริง: **เฉลี่ย 163 · สูงสุด 321 ตัวอักษร** << 520 (QR v15 ecLow) → ไม่ล้น
(เพิ่ม 5 ฟิลด์แต่ยังสั้นกว่าเดิม เพราะ D: key ประหยัดกว่า ICD10 ดิบ)

## 5) เช็คลิสต์ฝั่ง RxScreen (ไม่ใช่การแก้ parser)
- [ ] ยืนยัน rule engine ใช้ `labs.albumin/hb/plt` + `crcl` + `g6pd` ไปคัดกรองจริง (มี field แล้วต้องใช้)
- [ ] ถ้ามี UI แสดง diagnoses เป็น ICD10 → รองรับ/แสดง key ด้วย
- [ ] (ถ้าต้องการ) เพิ่ม disease-rule ให้ครอบ key ใหม่ที่ยังไม่มี rule (COPD, ASTHMA, CIRRHOSIS, GLAUCOMA, BPH ฯลฯ)
