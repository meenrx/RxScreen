# ข้อความส่งต่อสำหรับแชทใหม่ (Build RxScreen On-Prem)

> คัดลอกส่วนด้านล่างนี้ไปวางในแชทใหม่เป็นข้อความแรก (พร้อมเปิด repo นี้ให้แชทนั้นเข้าถึง)

---

## 📋 Prompt สำหรับวางในแชทใหม่

```
ช่วยสร้างโปรแกรม RxScreen เวอร์ชัน on-prem (desktop .exe) สำหรับคัดกรองใบสั่งยา
ผู้ป่วยในของโรงพยาบาล โดยอ่านสเปกและไฟล์ทั้งหมดในโฟลเดอร์ docs/onprem/ ก่อนเริ่ม:

  - docs/onprem/SYSTEM_SPEC.md        ← สเปกหลัก อ่านให้จบก่อน (สถาปัตยกรรม→build→acceptance)
  - docs/onprem/README.md             ← หลักการ + หลักประกัน IT
  - docs/onprem/hosxp_readonly.sql    ← view อ่านอย่างเดียวของ HOSxP (ที่จะ query)
  - docs/onprem/rxscreen_db.sql       ← สคีมาฐานกลาง (เก็บผลคัดกรอง/intervention)
  - docs/onprem/rxscreen_rules_seed.sql ← ฐานกฎจริง (drug_master/lab_rules/had/disease/...)
  - docs/onprem/test_hosxp_seed.sql   ← ฐานทดสอบในเครื่อง (5 เคส) ใช้พัฒนา

ข้อกำหนดที่ห้ามผิด (hard constraints):
  1. ❌ ไม่มี AI / ไม่มี API ภายนอก / ไม่ต่ออินเทอร์เน็ตเลย — คัดกรองด้วย rules engine offline ล้วน
  2. ✅ HOSxP = อ่านอย่างเดียว ผ่าน view rxs_* เท่านั้น (ห้ามเขียน/แก้ HOSxP)
  3. ✅ เก็บข้อมูลขั้นต่ำ PDPA — แค่ AN/HN + ข้อมูลคัดกรอง (ไม่มีชื่อ/ที่อยู่/บัตร ปชช.; อายุเป็นตัวเลข)
  4. ✅ รันในเครื่อง/LAN, bind 127.0.0.1, ไม่มี network egress
  5. ✅ ฐานกลาง rxscreen อยู่บนเซิร์ฟเวอร์ MariaDB "แยกต่างหาก" (ทางเลือกที่ 1) — ทุกเครื่องต่อตัวเดียวกัน

เทคโนโลยี:
  - Tauri 2 (Rust core + WebView2) → แพ็กเป็น .exe เซ็นโค้ด (ทางเลือกสำรอง: Electron ถ้าถนัด TS ล้วน)
  - Frontend + rules engine ใช้ของเดิมใน repo นี้ (src/features/screening/*, src/features/renal/calc.ts)
    → reuse ทั้งหมด ไม่ต้องเขียน engine ใหม่
  - Rust core ทำแค่ 2 อย่าง: (A) อ่าน HOSxP view → JSON, (B) เขียน log ลงฐาน rxscreen
  - ถอด Firebase/Auth คลาวด์ + โค้ด AI summary ออก, เปลี่ยนล็อกอินเป็นในเครื่อง (PIN/LDAP)

ขั้นตอนพัฒนา (เริ่มด้วยฐานทดสอบในเครื่องนี้):
  1. ติดตั้ง MariaDB ในเครื่อง → รัน test_hosxp_seed.sql (ได้ hos_test + 5 เคส)
     + rxscreen_db.sql (ฐานกลาง) + rxscreen_rules_seed.sql (ฐานกฎ)
  2. ทำหน้าตั้งค่าเชื่อมต่อ (กรอก DB A/B + ปุ่มทดสอบ + เก็บรหัสเข้ารหัสด้วย OS)
  3. ทำ flow: ใส่ AN → อ่าน view → map เป็น PatientInput/DrugEntry → runScreening() → แสดงผล
  4. บันทึก screening/intervention/ME ลงฐานกลาง + หน้า Dashboard รวม + History
  5. เพิ่มการคัดกรองให้ครบตาม SYSTEM_SPEC.md ข้อ 7 (hepatic, cumulative max dose, stewardship, TDM ...)
  6. แพ็กเป็น .exe เซ็นโค้ด + installer (โลโก้/เวอร์ชัน/About)

เกณฑ์ผ่าน: ทดสอบ AN 6800001–6800005 ต้องได้ผลตามที่ระบุท้าย test_hosxp_seed.sql
  (DDI/เลือดออก, metformin ห้ามในไตเสื่อม+K สูง, ขนาดยาเด็ก, digoxin+K ต่ำ, ตั้งครรภ์+แพ้ยาข้ามกลุ่ม)
  และคอมอื่นต้องเห็นผลที่บันทึกในฐานกลางทันที

เริ่มจากอ่าน SYSTEM_SPEC.md แล้ววางแผนโครงสร้างโปรเจกต์ก่อนลงมือ
```

---

## 🔑 สิ่งที่ต้องเตรียม/บอกเพิ่ม (นอกเหนือจาก prompt)

1. **ให้แชทใหม่เข้าถึง repo นี้** (meenrx/RxScreen) — โค้ด frontend/engine + docs/onprem/ อยู่ครบแล้ว
2. **ค่าเชื่อมต่อฐานจริง** ยังไม่ต้องให้ — พัฒนาด้วยฐานทดสอบในเครื่องก่อน ค่อยให้ IT กรอกตอนใช้จริง
3. **ตัดสินใจ Tauri vs Electron** — แนะนำ Tauri (เล็ก/ทางการ) แต่ถ้าอยากเร็ว/TS ล้วนเลือก Electron ได้
4. **ยืนยันเวอร์ชัน HOSxP** ของ รพ. — เผื่อชื่อคอลัมน์ใน view (`hosxp_readonly.sql`) ต้องปรับ
5. **ห้ามใส่ AI/บริการภายนอกใด ๆ** — ย้ำให้ชัด (ฐานกฎที่ export มาไม่มี key/secret แล้ว)
6. **เรื่องความปลอดภัยที่ค้าง** (ทำก่อนเริ่มก็ได้): revoke Anthropic API key เดิม + ลบ CONFIG/anthropic ออกจาก Firestore
```
