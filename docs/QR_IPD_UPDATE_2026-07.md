# แจ้ง RxScreen — QR IPD (ก.ค. 2026): Principal Diagnosis + ใช้ข้อมูลให้ครบ

QR บนสติ๊กเกอร์ยา **IPD** (2 ดวง: `TwoDBarCode1`=AN-keyed, `TwoDBarCode2`=HN-keyed) มีการเปลี่ยนฟิลด์ `D:`
และมีข้อมูลบางตัวที่ QR ส่งมาแต่ระบบ **ยังไม่ได้เอาไปใช้**

---

## 1) `D:` = **Principal Diagnosis (Pdx) ตัวเดียว** ⚠️

**เดิม:** `D:I500,I259,J209,M1000` (Pdx + comorbid + complication ทั้งหมด)
**ใหม่:** `D:I500` — **เฉพาะ Pdx** (`iptdiag.diagtype='1'` เรียงตาม `diag_no`)

เหตุผล: IPD ไม่เข้าเกณฑ์ RDU (ยกเว้น "ATB ในคลอดปกติ" ซึ่งใช้ **Pdx เท่านั้น** อยู่แล้ว) → ส่ง Pdx พอ · สั้นลงมาก

ตัวอย่างจริง:
| AN | D: (Pdx) | ความหมาย |
|----|----------|----------|
| 480004893 | `I500` | หัวใจล้มเหลว |
| 690002400 | `O800` | **คลอดปกติ → RDU normal-labor** |
| 690002405 | `O211` | แพ้ท้องรุนแรง |

### 🔧 RxScreen ต้องทำ 3 อย่างกับ Pdx

**(a) แสดงผล** — `out.diseases` จะได้ `["I500"]` (array 1 ตัว) → โชว์เป็น "Pdx: I50.0 หัวใจล้มเหลว"
> ICD-10 จาก HOSxP เป็น **no-dot** (`I500`) — ถ้าจะ lookup ชื่อโรค ต้อง normalize (ใส่จุดหลังตัวที่ 3) ก่อน

**(b) map Pdx → disease key** เพื่อให้ `buildDiseaseAlerts` (engine.ts:311) ยิง alert ได้
เพราะ rule match `r.disease` ที่เป็น **key** (`CKD`,`HF`,`COPD`...) ไม่ใช่ ICD-10
```ts
const ICD_TO_KEY: [RegExp, string][] = [
  [/^N1[89]/, 'CKD'],      [/^E1[0-4]/, 'DM'],       [/^I1[0-5]/, 'HT'],
  [/^I50|^I110|^I13[02]/, 'HF'], [/^I2[0-5]/, 'CAD'], [/^I48/, 'AF'],
  [/^I6|^G4[56]/, 'CVA'],  [/^J4[1-4]/, 'COPD'],     [/^J4[56]/, 'ASTHMA'],
  [/^K7[04]/, 'CIRRHOSIS'],[/^B1[5-9]|^K73/, 'HEPATITIS'], [/^G4[01]/, 'EPILEPSY'],
  [/^F3[23]/, 'DEPRESSION'],[/^M10|^M1A/, 'GOUT'],   [/^N40/, 'BPH'],
  [/^H4[0-2]/, 'GLAUCOMA'],[/^B2[0-4]|^Z21/, 'HIV'], [/^A1[5-9]/, 'TB'],
]
// หลัง parse: เติม key ที่ map ได้ลง out.diseases (คงรหัส ICD-10 ไว้ด้วยเพื่อแสดงผล)
```

**(c) Pdx = `O800` → `rdu_context.push('NORMAL_LABOR')`**
เพื่อให้ RDU "ATB ในคลอดปกติ" (`rdu-normal-labor-atb`) คำนวณอัตโนมัติ ไม่ต้อง tick
> rule นี้ระบุ `icd10Note: 'ใช้เป็น Pdx เท่านั้น · IPD'` → ตรงกับที่ QR ส่งมาพอดี

---

## 2) ✅ Audit: ข้อมูลใน QR ถูกใช้ครบหรือยัง

IPD QR ส่ง **22 ฟิลด์** · `parseKeyedFields` แปลงได้ครบทุกตัว · แต่ **rule engine ใช้ไม่ครบ**

| Key | ค่า | scanner เก็บเป็น | rule engine ใช้? |
|-----|-----|------------------|------------------|
| `N` | AN | `an`,`hn` | ✅ |
| `R:` | icode ยา | `drugs[]` | ✅ |
| `A` `S` `W` | อายุ/เพศ/นน. | `age`,`sex`,`weight` | ✅ |
| `C` | CrCl | `crcl` | ✅ (10 จุด) |
| `Gf` | eGFR**[stage]** | `gfr` + **`ckd_stage`** | ⚠️ **`ckd_stage` ไม่ถูกใช้เลย (0 จุด)** |
| `I` | INR | `inr` | ✅ |
| `A1` | HbA1c | `labs.hba1c` | ✅ (7) |
| `G` | FBS | `labs.fbs` | ✅ |
| `O` `L` | AST/ALT | `labs.ast/alt` | ✅ |
| `Ab` | Albumin | `labs.albumin` | ✅ (13) |
| `Hb` | Hemoglobin | `labs.hb` | ⚠️ **ใช้แค่ 1 จุด** |
| `T` | Platelet | `labs.plt` | ✅ (4) |
| `K` | โพแทสเซียม | `labs.k` | ✅ |
| `Nc` `Ec` | ANC/AEC | `labs.anc/aec` | ✅ (4/3) |
| `6` | G6PD | `g6pd` | ✅ (28) |
| `Y` | แพ้ยา | `allergies[]` | ✅ |
| `D:` | **Pdx** | `diseases[]` | ⚠️ **เป็น ICD-10 → disease rule ไม่ match** (ดูข้อ 1b) |
| `P1` | ตั้งครรภ์ | `is_pregnant`,`is_lactating` | ✅ (key `P` จับ `P1` ได้) |

### 🔴 3 จุดที่ต้องแก้เพื่อ "ใช้ข้อมูลให้ครบ"
1. **`ckd_stage`** — QR ส่ง `Gf47[3]` (stage 3) แต่ระบบทิ้งค่า stage
   → เอาไปใช้: เตือน NSAIDs/metformin ตาม CKD stage · แสดง "CKD stage 3" บนหน้าจอ
2. **`labs.hb`** — ใช้แค่ที่เดียว
   → ควรใช้เตือน: Hb ต่ำ + ยาต้านเกล็ดเลือด/NSAID → เสี่ยงเลือดออก
3. **`diseases` (Pdx)** — เพิ่ม ICD→key mapper (ข้อ 1b) ให้ `buildDiseaseAlerts` ทำงาน

---

## 3) เช็คลิสต์สำหรับทีม RxScreen
- [ ] เพิ่ม `ICD_TO_KEY` mapper → เติม disease key ลง `out.diseases` หลัง parse
- [ ] Pdx `O800` → `rdu_context.push('NORMAL_LABOR')`
- [ ] ใช้ `ckd_stage` (ตอนนี้ทิ้ง) ในการเตือน/แสดงผล
- [ ] ใช้ `labs.hb` ในกฎเลือดออก (ร่วมกับ `labs.plt`)
- [ ] แสดง Pdx บนหน้าจอ (normalize no-dot → dotted ก่อน lookup ชื่อโรค)
- [ ] ยืนยัน `P1` ถูกอ่านเป็นตั้งครรภ์ (key `P` จับ prefix ได้ — ค่า `1` ถูกละทิ้ง ถูกต้อง)
