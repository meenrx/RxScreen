# RxScreen On-Prem — สเปกระบบฉบับสมบูรณ์ (สำหรับผู้พัฒนา)

> เอกสารนี้ให้ผู้สร้างระบบ (คน/AI แชทอื่น) นำไปสร้างได้ครบ ตั้งแต่ต้นจนแพ็กเป็น `.exe`
> โดยพัฒนา/ทดสอบด้วย **ฐานข้อมูลทดสอบในเครื่อง** (`test_hosxp_seed.sql`) ก่อนต่อฐานจริง
> อ่านคู่กับ: `README.md`, `hosxp_readonly.sql`, `rxscreen_db.sql`, `.env.hospital.example`, `test_hosxp_seed.sql`

---

## 1. เป้าหมาย & ขอบเขต
โปรแกรมเดสก์ท็อป **.exe เดียวจบ** ลงคอมไหนของ รพ.ก็ได้ → กรอกค่าเชื่อมต่อ → คัดกรองใบสั่งยาผู้ป่วยใน
- ดึงข้อมูลจาก **HOSxP แบบอ่านอย่างเดียว** (ผ่าน view)
- คัดกรองด้วย rules engine (offline) → แสดงผล + ให้เภสัชบันทึก intervention/ME
- บันทึกลง **ฐานกลางของ RxScreen เอง** บน LAN → ทุกเครื่องเห็น/ทำ dashboard รวมได้
- **ไม่เชื่อมต่อภายนอก/ไม่มีคลาวด์** · **PDPA ขั้นต่ำ (แค่ AN/HN + ข้อมูลคัดกรอง)**

**Non-goals:** ไม่เขียนกลับ HOSxP · ไม่เก็บชื่อ/ที่อยู่/บัตร ปชช. · ไม่ส่งข้อมูลออกอินเทอร์เน็ต

---

## 2. สถาปัตยกรรม & Tech stack

```
RxScreen.exe (Tauri)
├─ Frontend: React + TypeScript + Tailwind + shadcn/ui   ← reuse จาก repo เดิม
│   └─ Rules engine (offline) : src/features/screening/*  ← reuse ทั้งหมด
├─ Core (Rust): 2 การเชื่อมต่อฐานข้อมูล
│   ├─ HOSxP (read-only)  : SELECT บน view rxs_* เท่านั้น
│   └─ rxscreen (rw)      : เขียน/อ่าน log บนฐานกลาง (แยกเซิร์ฟเวอร์)
├─ หน้าตั้งค่า: กรอก DB + ปุ่ม "ทดสอบการเชื่อมต่อ" + เก็บรหัสผ่านเข้ารหัส (OS keychain/DPAPI)
└─ เก็บผล: ฐานกลาง rxscreen (ทางเลือกที่ 1 = เซิร์ฟเวอร์ MariaDB แยกต่างหากบน LAN)
```

- **Framework:** Tauri 2 (Rust core + WebView2). เหตุผล: .exe เล็ก, RAM ต่ำ, เซ็นโค้ดได้, ทางการ
  - ทางเลือกสำรอง: Electron + Node `mysql2` (ถ้าทีมถนัด TS ล้วน — ยอมไฟล์ใหญ่/RAM สูง)
- **DB driver (Rust):** `sqlx` หรือ `mysql_async` (MariaDB/MySQL) — ตั้ง charset **tis620** สำหรับ HOSxP
- **Reuse จาก repo:** `src/features/screening/*` (engine.ts, qrRules.ts, clinicalRefs.ts, renal/calc.ts, ตัวคำนวณขนาดยาเด็ก, DrugResultView, WarfarinScreenPanel, MedErrorPanel ฯลฯ)
- **State/data:** TanStack Query, zustand (เดิม)

> **สำคัญ:** rules engine เป็น TypeScript รันใน WebView อยู่แล้ว → ไม่ต้องเขียนใหม่
> Rust core ทำแค่ "อ่าน DB → คืน JSON" และ "เขียน log" เท่านั้น

---

## 3. การไหลของข้อมูล (flow)
1. เภสัชเปิดโปรแกรม → (ครั้งแรก) กรอกค่าเชื่อมต่อในหน้าตั้งค่า → ทดสอบ → บันทึก (เข้ารหัส)
2. สแกน/พิมพ์ **AN** → Rust core `SELECT` จาก view `rxs_*` (read-only) → รวมเป็น JSON
3. Frontend แปลง JSON → `PatientInput` + `DrugEntry[]` → เรียก `runScreening()` (engine เดิม)
4. แสดงผล: แถบ AN, alert แยกระดับ, ขนาดยาไต/เด็ก, HAD, ME (ระดับ B), warfarin ฯลฯ
5. เภสัชบันทึก intervention/ME → Rust core `INSERT/UPDATE` ลงฐาน `rxscreen` (rw)
6. เมนู Dashboard/History → อ่านจากฐาน `rxscreen` (ทุกเครื่องเห็นชุดเดียวกัน)

---

## 4. การเชื่อมต่อฐานข้อมูล (2 connection แยกกัน)

| | ฐาน | user | สิทธิ์ | charset |
|---|---|---|---|---|
| A | HOSxP (จริง) / `hos_test` (ทดสอบ) | `rxscreen_ro` | **SELECT view เท่านั้น** | tis620 (จริง) |
| B | `rxscreen` (ฐานกลาง แยกเซิร์ฟเวอร์) | `rxscreen_rw` | SELECT/INSERT/UPDATE เฉพาะ `rxscreen.*` | utf8mb4 |

- ค่าเชื่อมต่อทั้งหมดกรอกในหน้าตั้งค่า (ดูฟิลด์ใน `.env.hospital.example`) เก็บเข้ารหัสในเครื่อง
- **ทางเลือกที่ 1 (ที่เลือก):** ฐาน `rxscreen` อยู่บน **MariaDB เซิร์ฟเวอร์แยก** (ไม่ใช่เครื่อง HOSxP) → RxScreen ไม่แตะเซิร์ฟเวอร์ HOSxP เลยแม้แต่การเขียน

### 4.1 View ที่อ่านจาก HOSxP (ดู `hosxp_readonly.sql`)
| view | คอลัมน์ | ใช้ทำ |
|---|---|---|
| `rxs_admission` | an, hn, ward, regdate, dchdate, spclty, **age_years, sex, weight_kg** | ตัวตน/วอร์ด + คำนวณไต/เด็ก/Beers |
| `rxs_drug_order` | an, hn, icode, drug_name, **generic_name**, strength, qty, unit_code, usage_code, order_date | รายการยา (engine ผูกด้วย generic_name) |
| `rxs_lab` | an, hn, lab_name, result, normal_value, report_date | ค่าแลปคัดกรอง |
| `rxs_allergy` | hn, agent, symptom, report_date | แพ้ยา/ข้ามกลุ่ม |
| `rxs_diagnosis` | an, hn, icd10, diagtype | drug–disease |

### 4.2 การ map → โครงสร้างที่ engine ใช้
- `PatientInput`: { an, hn, age(=age_years), sex('1'→'M','2'→'F'), weight(kg), scr(จาก rxs_lab 'Cr'), egfr(จาก 'eGFR'/'CrCl'), inr, labs{k,ast,alt,hb,...}, allergies[], diseases[](map icd10→คีย์โรค), is_pregnant(จาก Z34/สูติ) }
- `DrugEntry[]`: { icode, drug_name, generic (จาก generic_name), strength, sig(usage_code) } + โหลด labRules ตาม icode
- แลป: อ่าน `rxs_lab` ย้อนหลังตาม `LAB_LOOKBACK_DAYS`, เอา report ล่าสุดต่อ lab_name, แปลงหน่วย/ชื่อให้ตรงคีย์ engine (k, cr, egfr, inr, ast, alt, hb, plt, na, mg, albumin, fbs, hba1c ...)

---

## 5. ฐานกลาง rxscreen (บันทึกอะไรบ้าง) — ดู `rxscreen_db.sql`
- `screening_log` — ผลคัดกรองแต่ละครั้ง (นับ red/orange/yellow, alert_types, ME status/level/note, เภสัช, วอร์ด)
- `intervention` — off/ปรับ/เปลี่ยน/เพิ่มยา/counsel + เหตุผล + มูลค่าประหยัด + แพทย์รับ/ไม่รับ
- `screening_alert` — รายละเอียด alert สำคัญ (ไว้ dashboard/สืบย้อน)
- `v_daily_summary` — สรุปรายวันสำหรับ dashboard

---

## 6. หน้าจอ/ฟีเจอร์ (screens)
1. **หน้าตั้งค่าเชื่อมต่อ** — ฟอร์ม DB (A+B) + ปุ่มทดสอบ + สถานะ + บันทึกเข้ารหัส + แบดจ์ "อ่านอย่างเดียว/ในเครื่อง/PDPA"
2. **หน้าคัดกรอง** — ช่องใส่ AN → ผลคัดกรอง (reuse UI เดิม: DrugResultView, ScannedLabPanel, WarfarinScreenPanel, MedErrorPanel, AN banner)
3. **บันทึก intervention/ME** — ฟอร์มบันทึกลงฐานกลาง (reuse InterventionSection, MedErrorPanel)
4. **Dashboard รวม** — สรุปทั้ง รพ. (จำนวนคัดกรอง, ME ระดับ B, intervention, มูลค่าประหยัด, ตามวอร์ด/ช่วงเวลา)
5. **History/ค้นย้อนหลัง** — ค้นตาม AN/วันที่/เภสัช
6. **จัดการฐานข้อมูลกฎ** (ถ้าต้องการ) — reuse admin เดิม (Lab/Dose, HAD, DDI, Disease) เก็บใน rxscreen
7. **About/หลักประกัน** — เวอร์ชัน, ผู้พัฒนา, ลิงก์เอกสาร IT assurance

---

## 7. ขอบเขตการคัดกรอง — ที่มี + ที่ควรเพิ่มให้ครบ

**มีแล้วใน engine (reuse):**
DDI · drug–disease · renal dose (CrCl/eGFR) · lab×drug alerts (มีทิศทาง) · HAD · allergy + cross-allergy ·
pregnancy/lactation · G6PD · **pediatric weight/age dosing** · Beers (สูงอายุ) · therapeutic duplication ·
no-crush (SR) · LASA · RDU (CKD stage3 ฯลฯ) · Triple Whammy · bleeding stack · QT · warfarin protocol · ME ระดับ B

**แนะนำเพิ่มให้ครบถ้วน (จัดลำดับ):**
1. **Hepatic dose adjustment** — ปรับ/เลี่ยงยาตามระดับ Child-Pugh/LFT (ตอนนี้แค่เตือน AST/ALT สูง)
2. **Max cumulative dose ข้ามรายการ** — โดยเฉพาะ **paracetamol รวมทุกแหล่ง** ≤ 4 g/day (หรือ 75 mg/kg/day เด็ก)
3. **Renal สำหรับผู้ใหญ่ที่ต้องคำนวณน้ำหนัก** — enoxaparin, aminoglycoside (ตอนนี้ weight-dose เฉพาะเด็ก)
4. **Antimicrobial stewardship** — วันหยุดยา/duration, IV→PO switch, ความซ้ำซ้อนของ coverage, DUE ครบ
5. **TDM/narrow index** — vancomycin/digoxin/phenytoin/valproate: เตือนให้เจาะระดับ + จังหวะเจาะ
6. **Drug–electrolyte replacement protocol** — K/Mg/PO4/Ca ต่ำ → แนะนำ replacement ตามน้ำหนัก/ระดับ
7. **Timing/administration** — levothyroxine ท้องว่าง, bisphosphonate, ยาห่างนม/ยาลดกรด, ยาต้องกับอาหาร
8. **Pregnancy รายไตรมาส** — แยกความเสี่ยงตามไตรมาส (ACEI/ARB ไตรมาส 2-3 ฯลฯ)
9. **Duplicate จากยาสูตรผสม** — ตรวจ component ซ้ำ (เช่น paracetamol ในยาสูตรผสม + เดี่ยว)
10. **IV compatibility (Y-site)** — เตือนคู่ที่เข้ากันไม่ได้ (ตารางความเข้ากันได้)
11. **Alert tiering / กัน alert fatigue** — จัดลำดับ, ยุบซ้ำ, บันทึกเหตุผลเมื่อ override
12. **Medication reconciliation** — เทียบยาเดิม (ประวัติยา/admission ก่อน) หา ซ้ำ/ตกหล่น/เปลี่ยน

> ข้อ 1–5 คือที่ให้ผลลัพธ์ทางคลินิกสูงสุด ควรทำก่อน

---

## 8. ฐานข้อมูลทดสอบในเครื่องนี้ (ใช้พัฒนาก่อนต่อจริง)
1. ติดตั้ง MariaDB/MySQL ในเครื่อง
2. รัน `test_hosxp_seed.sql` → ได้ฐาน `hos_test` + view-shaped tables `rxs_*` + **5 เคสทดสอบ**
3. รัน `rxscreen_db.sql` → ได้ฐานกลาง `rxscreen`
4. ตั้งค่าแอปให้ชี้: A=`hos_test`, B=`rxscreen` (localhost)
5. ทดสอบ AN 6800001–6800005 → ต้องได้ผลตามที่ระบุท้าย `test_hosxp_seed.sql`

| AN | คาดหวัง |
|---|---|
| 6800001 | DDI warfarin+NSAID, INR 4.5 สูง, bleeding stack |
| 6800002 | Metformin ห้าม (eGFR 22<30), K 5.8 สูง+ACEI/spironolactone (hyperK) |
| 6800003 | ขนาดยาเด็ก amox/para/dicloxacillin ตามน้ำหนัก 14 kg (แสดง mg + mL) |
| 6800004 | K 3.0 ต่ำ + digoxin (toxicity), QT, warfarin |
| 6800005 | warfarin teratogen (ตั้งครรภ์), แพ้ penicillin → เตือน amoxicillin ข้ามกลุ่ม |

---

## 9. Build & แพ็กเป็น .exe
- `tauri build` → ได้ `.exe` + installer (MSI/NSIS)
- **Code signing** ด้วยใบรับรอง (ทำให้ Windows แสดงผู้เผยแพร่ = น่าเชื่อถือ)
- Installer: โลโก้ รพ.รือเสาะ, ชื่อ "RxScreen", เลขเวอร์ชัน, หน้า About/License
- WebView2: Win11 มีอยู่แล้ว; Win10 ให้ installer ตรวจ/ติดตั้งให้
- ตั้ง `APP_BIND_HOST=127.0.0.1`, ปิด network egress ทุกช่องทาง

---

## 10. ความปลอดภัย/PDPA/หลักประกัน IT (บังคับ)
- HOSxP: user `SELECT` บน view เท่านั้น (ดู `hosxp_readonly.sql`) — เขียน/แก้ HOSxP ไม่ได้
- rxscreen: user เขียนเฉพาะฐานตัวเอง, ไม่มี DELETE/DROP
- เก็บรหัสผ่าน DB เข้ารหัสด้วย OS (DPAPI/keychain) — ห้าม plaintext
- Log ทุก query (ในเครื่อง) เพื่อ audit; ไม่มี egress ออกเน็ต
- เก็บเฉพาะ AN/HN + ข้อมูลคัดกรอง (ไม่มีชื่อ/ที่อยู่/บัตร ปชช.) — age เป็นตัวเลข ไม่ใช่ DOB
- ทุกอย่างรันในเครื่อง/LAN; รองรับ air-gap

---

## 11. เกณฑ์ยอมรับ (Acceptance)
- [ ] กรอกค่า DB + ทดสอบเชื่อมต่อผ่าน (A read-only, B rw) จากคอมใดก็ได้
- [ ] ใส่ AN → ดึงข้อมูลถูกต้อง → คัดกรองครบทุกมิติในข้อ 7 (เคสทดสอบ 6800001–5 ผ่าน)
- [ ] บันทึก screening/intervention/ME ลงฐานกลาง → **คอมอื่นเห็นทันที**
- [ ] Dashboard รวมแสดงถูกต้อง
- [ ] ยืนยัน read-only: ลองสั่งเขียน HOSxP ต้องถูกปฏิเสธ (สิทธิ์ไม่มี)
- [ ] ไม่มี network egress ออกภายนอก (ตรวจด้วย firewall/monitor)
- [ ] แพ็กเป็น .exe เซ็นโค้ด + installer ทำงานบน Win10/11

---

## 12. อ้างอิงโค้ดเดิม (repo)
- Engine: `src/features/screening/engine.ts`, `qrRules.ts`, `clinicalRefs.ts`, `rduRules.ts`, `hadRef.ts`
- คำนวณ: `src/features/renal/calc.ts` (Cockcroft-Gault, ขนาดยาเด็ก)
- UI: `src/features/screening/*` (DrugResultView, ScannedLabPanel, WarfarinScreenPanel, MedErrorPanel, DrugInput)
- ฐานกฎปัจจุบันอยู่ Firestore (DRUG_MASTER, LAB_RULES, HAD_RULES, DISEASE_RULES ...) →
  **ย้ายเป็นตารางในฐาน rxscreen** (หรือ import ครั้งเดียว) เพื่อ on-prem เต็มรูปแบบ
