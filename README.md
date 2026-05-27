# Drug Screen AI — รพ.รือเสาะ

ระบบคัดกรองใบสั่งยาด้วย AI สำหรับเภสัชกร แทนระบบเดิมที่เขียนด้วย Google Apps Script + Google Sheets

## คุณสมบัติ (Features)

| # | Feature | คำอธิบาย |
|---|---------|----------|
| 1 | **Quick/Full Screening** | กรอก icode ยา → ดึง drug info → แสดง DDI/LAB/Disease/DRP alerts |
| 2 | **Renal Dose Calculator** | Cockcroft-Gault + IBW (Devine) + parse `dose_meta` |
| 3 | **AI Summary** | เรียก Claude Haiku สรุปประเด็น + action items |
| 4 | **Warfarin Calculator** | คำนวณ weekly dose จาก INR ปัจจุบัน / target |
| 5 | **DDI Check** | เช็คคู่ยาทั้งหมดกับ DDI_OVERRIDE + local_note |
| 6 | **Pediatric Dose** | แสดง pediatric_dose จาก LAB_RULES |
| 7 | **PDF export** | ออกใบคัดกรองพร้อมชื่อเภสัชกร + เลขใบประกอบฯ |
| 8 | **Admin Panel** | จัดการ DRUG_MASTER / LAB_RULES / DDI_OVERRIDE / DRUG_COUNSELING / DISEASE_RULES |
| 9 | **Sticker/Counseling** | ดึงข้อมูล DRUG_COUNSELING พิมพ์ sticker ติดซอง |

## Tech stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4 + shadcn/ui
- **State**: TanStack Query + Zustand
- **Backend**: Firebase (Auth + Firestore) — **ไม่ใช้ Cloud Functions**
- **AI**: Claude Haiku 4.5 via `@anthropic-ai/sdk` (`dangerouslyAllowBrowser: true`)
- **PDF**: jsPDF + html2canvas

## Firestore collections

| Collection | คำอธิบาย |
|------------|----------|
| `users` | บัญชีผู้ใช้ + role (admin/pharmacist/viewer) |
| `DRUG_MASTER` | ตารางยาแม่ (icode, drug_name, drug_class) |
| `LAB_RULES` | กฎ Lab + dose_meta + pediatric_dose |
| `DDI_OVERRIDE` | คู่ยา DDI + local_note (94+ คู่) |
| `DRUG_COUNSELING` | ข้อมูล sticker / counseling |
| `DISEASE_RULES` | โรค ↔ ยา (contraindicated / avoid / caution) |
| `CONFIG` | Anthropic API key + ตั้งค่าระบบ |
| `DISPENSING_LOG` | บันทึกการคัดกรอง (append-only audit) |

---

## ติดตั้งทีละขั้น (สำหรับคนไม่ใช่โปรแกรมเมอร์)

### 1) สร้าง Firebase project ใหม่

1. เปิด https://console.firebase.google.com
2. คลิก **"Add project"** → ตั้งชื่อ เช่น `drug-screen-rh`
3. รอ Firebase สร้างเสร็จ (1-2 นาที)

### 2) เปิดใช้ Authentication

1. ในเมนูซ้าย → **Authentication** → **Get started**
2. ไปแท็บ **Sign-in method** → เปิดใช้ **"Email/Password"**

### 3) เปิดใช้ Firestore

1. เมนูซ้าย → **Firestore Database** → **Create database**
2. เลือก **"Start in production mode"** → **Next**
3. เลือก location: **asia-southeast1** (สิงคโปร์ ใกล้ที่สุด) → **Enable**

### 4) ลง Firestore rules

ใช้ Firebase CLI:
```bash
npm i -g firebase-tools
firebase login
firebase use --add   # เลือก project ที่สร้าง
npm run deploy:rules
```

หรือก๊อปเนื้อหาใน `firestore.rules` ไปวางใน Firebase Console → Firestore → Rules → Publish

### 5) เอา Firebase config มาวางในแอป

1. ใน Firebase Console → ⚙ Project settings → **General**
2. เลื่อนลงไปหา "Your apps" → คลิกไอคอน **`</>`** (Web)
3. ตั้งชื่อ app → **Register app** (ไม่ต้องตั้ง hosting)
4. ก๊อป `firebaseConfig` object มา

```
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "drug-screen-rh.firebaseapp.com",
  projectId: "drug-screen-rh",
  ...
}
```

5. ก๊อปไฟล์ `.env.example` → `.env` แล้วใส่ค่าตามที่ Firebase ให้:

```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=drug-screen-rh.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=drug-screen-rh
VITE_FIREBASE_STORAGE_BUCKET=drug-screen-rh.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### 6) ติดตั้ง dependencies + รัน dev server

```bash
npm install
npm run dev
```

แล้วเปิด http://localhost:5174

### 7) สมัครบัญชีแรก (จะกลายเป็น admin อัตโนมัติ)

1. กดลิงก์ "สมัครสมาชิก"
2. กรอกชื่อ-นามสกุล / เลขใบประกอบฯ / อีเมล / รหัสผ่าน
3. **บัญชีแรก** จะได้ role = admin + active = true อัตโนมัติ

### 8) ใส่ Anthropic API key

1. เข้าระบบเป็น admin → เมนู **ตั้งค่า**
2. กรอก API key (ขึ้นต้น `sk-ant-...`) → บันทึก

> ⚠ **หมายเหตุความปลอดภัย:** key เก็บใน Firestore CONFIG/anthropic และเรียกจาก browser โดยตรง — เภสัชกรที่ login แล้ว สามารถดู key ผ่าน DevTools ได้ ใช้เฉพาะภายในโรงพยาบาลและจำกัด Firestore rules ให้อ่าน CONFIG เฉพาะ active user เท่านั้น

### 9) เพิ่มข้อมูลยา/DDI/LAB rules

1. เมนู **จัดการฐานข้อมูล** → แท็บ "ยา" → เพิ่ม icode + ชื่อยา + class
2. แท็บ "Lab/Dose" → เพิ่ม dose_meta เช่น `CrCl<10:hold; CrCl 10-50:1g q24h; CrCl>50:1g q12h`
3. แท็บ "DDI" → เพิ่มคู่ยา + severity
4. แท็บ "Disease" → เพิ่มโรค + ยา/class ที่ห้ามใช้

### 10) ใช้งานคัดกรอง

1. เมนู **คัดกรองใบสั่งยา**
2. เลือกโหมด Quick (เร็ว) หรือ Full (ใส่ข้อมูลผู้ป่วยครบ)
3. กรอก icode ยา ทีละตัว
4. ดู alerts → กดปุ่ม "สรุปด้วย AI" → กดปุ่ม "ออก PDF"

---

## รูปแบบ dose_meta

ใช้ใน `LAB_RULES.dose_meta` — คั่นด้วย `;` หรือขึ้นบรรทัดใหม่:

```
CrCl<10:hold; CrCl 10-50:1g q24h; CrCl>50:1g q12h
```

หรือ:

```
CrCl<30:avoid
CrCl 30-50:reduce 50%
CrCl>50:full dose
```

ระบบจะ parse แล้วเลือก rule ที่ตรงกับ CrCl ของผู้ป่วยอัตโนมัติ แสดงเป็น:

> ⚠️ CrCl = 11.1 mL/min → ปรับ Ceftazidime เป็น 1g q24h

---

## Build production + Deploy

```bash
npm run build
firebase deploy --only hosting
```

(ถ้าจะใช้ Firebase Hosting — แต่จะเป็น Spark/Blaze plan ก็ได้ ฟรี)

---

## โครงสร้างโปรเจกต์

```
src/
├── components/         # shared UI (shadcn) + layout
├── features/
│   ├── auth/           # login/register + role
│   ├── catalog/        # CRUD API + hooks สำหรับ Firestore collections
│   ├── admin/          # หน้า admin CRUD แต่ละ tab
│   ├── screening/      # หน้าคัดกรอง + engine + sticker + PDF
│   ├── renal/          # Cockcroft-Gault + dose_meta parser
│   ├── warfarin/       # weekly dose calc
│   ├── ai/             # Claude Haiku summary
│   └── history/        # DISPENSING_LOG
├── pages/              # route entry pages
├── types/              # TypeScript types
└── lib/                # firebase, router, utils, format (พ.ศ.)
```
