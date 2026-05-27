import { BookOpen, Database, KeyRound, ScanLine, ListChecks, FileText, Sparkles } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/PageHeader'

export default function GuidePage() {
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <PageHeader
        icon={BookOpen}
        iconColor="from-violet-500 to-purple-600"
        title="คู่มือใช้งาน"
        description="ขั้นตอนการใช้งาน + วิธีกรอกข้อมูลในหน้าจัดการฐานข้อมูล"
      />

      {/* ใช้งานเบื้องต้น */}
      <Section title="🚀 เริ่มต้นใช้งาน">
        <Step n={1} title="เข้าสู่ระบบ" icon={KeyRound}>
          ใส่เลขใบประกอบ 5 หลัก ระบบจะ <b>login อัตโนมัติ</b> ทันทีที่ครบ 5 หลัก
        </Step>
        <Step n={2} title="คัดกรองใบสั่งยา" icon={ScanLine}>
          <ul className="list-disc list-inside text-sm space-y-1 mt-1">
            <li>กดปุ่ม <b className="text-emerald-700">"สแกน QR"</b> → ส่องกล้องที่ QR สติ๊กเกอร์ยา</li>
            <li>หรือกรอก icode ทีละตัวในช่อง icode</li>
            <li>ระบบจะแสดง "ระบบขอข้อมูลต่อไปนี้" — ช่องสีเหลืองคือต้องกรอก</li>
            <li>เมื่อกรอกครบ ดูผลในส่วน "📊 ผลคัดกรอง" (แยกตามหมวด)</li>
            <li>กดปุ่ม <b className="text-violet-700">"สรุปด้วย AI"</b> → Claude Haiku สรุปประเด็น</li>
            <li>พิมพ์สติ๊กเกอร์ 5×7 cm หรือ export PDF ใบคัดกรอง</li>
          </ul>
        </Step>
        <Step n={3} title="บันทึกประวัติ" icon={ListChecks}>
          กดปุ่ม <b>"บันทึกประวัติ"</b> → ระบบเก็บใน DISPENSING_LOG ดูได้ที่หน้า "ประวัติคัดกรอง" และ "ค้นประวัติผู้ป่วย"
        </Step>
      </Section>

      {/* QR Code Format */}
      <Section title="📷 รูปแบบ QR Code ที่รองรับ">
        <Card>
          <CardContent className="pt-6 space-y-3">
            <p className="text-sm">QR สติ๊กเกอร์ยาควรเข้ารหัสในรูปแบบใดรูปแบบหนึ่งต่อไปนี้:</p>
            <div className="space-y-3">
              <FormatBlock title="รูปแบบ 1 — JSON (แนะนำ)" example={`{"hn":"62012345","name":"นายสมชาย ใจดี","age":65,"sex":"M","drugs":[{"icode":"CEFTRX","sig":"1g IV q12h"},{"icode":"WARF","sig":"5 mg po hs"}]}`} />
              <FormatBlock title="รูปแบบ 2 — Pipe-delimited (เล็กกว่า)" example={`RXS|62012345|นายสมชาย|65|M|CEFTRX:1g IV q12h|WARF:5 mg po hs`} />
              <FormatBlock title="รูปแบบ 3 — รายการ icode (เร็วสุด)" example={`CEFTRX, AMOX, PARA`} />
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* Admin guide */}
      <Section title="🛠 คู่มือการระบุข้อมูลในหน้าจัดการฐานข้อมูล">
        <Card className="soft-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Database className="size-5 text-cyan-600" /> 1. ตาราง "ยา (DRUG_MASTER)"</CardTitle>
            <CardDescription>ตารางยาแม่ — ใส่ icode ของ รพ. + ข้อมูลพื้นฐาน</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Field name="icode" required>รหัสยาของโรงพยาบาล เช่น <code>CEFTRX</code></Field>
            <Field name="ชื่อยา" required>ชื่อยาเต็ม + strength เช่น <code>Amlodipine 5 mg tab</code></Field>
            <Field name="Generic name">ชื่อสามัญทางยา ใช้สำหรับตรวจซ้ำ generic + allergy</Field>
            <Field name="Drug class">กลุ่มยา เช่น <code>ACEI</code>, <code>Beta-blocker</code>, <code>NSAID</code> ใช้ตรวจซ้ำกลุ่ม</Field>
            <Field name="หน่วย">เช่น <code>tab</code>, <code>cap</code>, <code>ml</code>, <code>amp</code></Field>
            <div className="pt-2 mt-2 border-t">
              <div className="text-sm font-semibold mb-1">Safety flags (ติ๊กถ้าใช่)</div>
              <Field name="🔴 HAD (High Alert)">ยาเสี่ยงสูง เช่น Insulin, Warfarin, KCl injection, Opioids → ระบบจะเตือนสีแดงเสมอ</Field>
              <Field name="👴 Beers">ยาที่ <b>หลีกเลี่ยงในผู้สูงอายุ ≥65 ปี</b> ตาม Beers criteria เช่น Diphenhydramine, Benzodiazepine</Field>
              <Field name="🩸 G6PD unsafe">ยาที่ทำให้ <b>hemolysis ใน G6PD</b> เช่น Primaquine, Sulfonamide, Nitrofurantoin</Field>
              <Field name="🤱 ห้ามให้นมบุตร">ยาที่ผ่านน้ำนมและเป็นอันตรายต่อทารก</Field>
            </div>
            <div className="pt-2 mt-2 border-t">
              <div className="text-sm font-semibold mb-1">Pregnancy Category (FDA)</div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-xs">
                <Badge variant="green">A: ปลอดภัย</Badge>
                <Badge variant="green">B: ค่อนข้างปลอดภัย</Badge>
                <Badge variant="yellow">C: ใช้ระวัง</Badge>
                <Badge variant="orange">D: เสี่ยง</Badge>
                <Badge variant="red">X: ห้ามใช้</Badge>
              </div>
            </div>
            <div className="pt-2 mt-2 border-t">
              <Field name="LASA pairs">รายชื่อ icode ที่ชื่อ/หน้าตาคล้าย คั่นด้วย , เช่น <code>HYDROCH, HYDROX</code></Field>
              <Field name="Allergens">สาร allergen หลัก คั่นด้วย , เช่น <code>Penicillin, Beta-lactam</code></Field>
              <Field name="Cross-reactivity">ยาที่อาจ cross-react กับ allergen ข้างต้น เช่น <code>Cephalosporin, Carbapenem</code></Field>
              <Field name="🍽 Food / 🚬 Smoking / 🍺 Alcohol">คำอธิบายปฏิกิริยา (free text)</Field>
            </div>
          </CardContent>
        </Card>

        <Card className="soft-card mt-3">
          <CardHeader>
            <CardTitle>2. ตาราง "Lab/Dose (LAB_RULES)"</CardTitle>
            <CardDescription>กฎเชื่อมยา ↔ ค่า lab + dose adjustment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Field name="icode" required>รหัสยา (อ้างถึง DRUG_MASTER)</Field>
            <Field name="Param">ค่า lab ที่ต้อง monitor เช่น <code>SCr</code>, <code>K+</code>, <code>INR</code>, <code>Albumin</code>, <code>AST</code></Field>
            <Field name="หน่วย">เช่น <code>mg/dL</code>, <code>mEq/L</code></Field>
            <Field name="ช่วงปกติ">เช่น <code>0.6-1.3</code> (รูปแบบ: ต่ำ-สูง คั่นด้วย -)</Field>
            <Field name="Priority">
              <Badge variant="red">high</Badge> = เตือนเสมอ ·{' '}
              <Badge variant="orange">medium</Badge> = เตือนเมื่อค่าผิดปกติ ·{' '}
              <Badge variant="yellow">low</Badge> = ข้อมูลเสริม
            </Field>
            <Field name="dose_meta (สำคัญ)">
              <div className="text-sm mt-1">รูปแบบ renal adjustment คั่นด้วย <code>;</code> หรือขึ้นบรรทัดใหม่:</div>
              <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">CrCl&lt;10:hold; CrCl 10-50:1g q24h; CrCl&gt;50:1g q12h</pre>
              <div className="text-xs text-muted-foreground mt-1">
                Operators: <code>&lt;</code>, <code>&lt;=</code>, <code>&gt;</code>, <code>&gt;=</code>, <code>a-b</code> (ช่วง)
              </div>
            </Field>
            <Field name="pediatric_dose">ขนาดยาเด็ก เช่น <code>10-15 mg/kg/dose q6h, max 4 g/day</code></Field>
            <Field name="max_daily_dose / min_daily_dose">ขนาดสูงสุด/ต่ำสุดต่อวัน</Field>
            <Field name="tdm_range">ช่วง therapeutic เช่น <code>10-20</code> (สำหรับ Phenytoin, Vancomycin)</Field>
          </CardContent>
        </Card>

        <Card className="soft-card mt-3">
          <CardHeader>
            <CardTitle>3. ตาราง "DDI" (Drug-Drug Interaction)</CardTitle>
            <CardDescription>คู่ยาที่มีปฏิกิริยา + local note ของโรงพยาบาล</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Field name="Drug A / Drug B" required>icode หรือชื่อยา 2 ตัวที่ทำปฏิกิริยา</Field>
            <Field name="Severity">
              <Badge variant="red">contraindicated</Badge> ห้ามใช้ร่วม ·{' '}
              <Badge variant="red">major</Badge> รุนแรง ·{' '}
              <Badge variant="orange">moderate</Badge> ปานกลาง ·{' '}
              <Badge variant="yellow">minor</Badge> เล็กน้อย
            </Field>
            <Field name="Mechanism">กลไก เช่น "CYP3A4 inhibition", "Additive QT prolongation"</Field>
            <Field name="Local note">หมายเหตุของ รพ.รือเสาะ — แสดงเฉพาะใน alert</Field>
            <Field name="Recommendation">คำแนะนำการจัดการ เช่น "เปลี่ยนเป็น ... แทน"</Field>
          </CardContent>
        </Card>

        <Card className="soft-card mt-3">
          <CardHeader>
            <CardTitle>4. ตาราง "Counseling"</CardTitle>
            <CardDescription>ข้อมูลสำหรับ sticker คำแนะนำผู้ป่วย 5×7 cm</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Field name="icode" required>รหัสยา</Field>
            <Field name="Sticker label">ข้อความสั้น (1-2 บรรทัด) ที่จะอยู่บน sticker เช่น "กินก่อนอาหาร 30 นาที"</Field>
            <Field name="Counseling เต็ม">คำอธิบายเต็ม สำหรับ AI Summary และ Drug Info</Field>
            <Field name="การเก็บรักษา">เช่น "เก็บในตู้เย็น 2-8°C", "พ้นแสง"</Field>
            <Field name="คำเตือน">เช่น "อาจง่วงซึม ห้ามขับรถ"</Field>
          </CardContent>
        </Card>

        <Card className="soft-card mt-3">
          <CardHeader>
            <CardTitle>5. ตาราง "Disease" (โรคประจำตัว)</CardTitle>
            <CardDescription>กฎ "โรค X ห้าม/หลีกเลี่ยง/ระวัง ยา Y"</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Field name="โรค" required>ชื่อโรค เช่น <code>G6PD</code>, <code>Asthma</code>, <code>CKD</code></Field>
            <Field name="icode">ระบุ icode ตัวเดียว — <i>หรือ</i></Field>
            <Field name="Drug class">หรือทั้ง class เช่น <code>NSAID</code>, <code>Beta-blocker</code></Field>
            <Field name="Severity">
              <Badge variant="red">contraindicated</Badge> ห้ามใช้ ·{' '}
              <Badge variant="orange">avoid</Badge> หลีกเลี่ยง ·{' '}
              <Badge variant="yellow">caution</Badge> ใช้ระวัง
            </Field>
          </CardContent>
        </Card>
      </Section>

      <Section title="🤖 AI Summary (Claude Haiku)">
        <Card>
          <CardContent className="pt-6 space-y-2">
            <div className="flex items-center gap-2"><Sparkles className="size-5 text-violet-600" /><b>ต้องตั้งค่าก่อนใช้</b></div>
            <ol className="list-decimal list-inside text-sm space-y-1">
              <li>เข้าหน้า <b>ตั้งค่า</b> (เฉพาะ admin)</li>
              <li>ใส่ Anthropic API key (ขึ้นต้น <code>sk-ant-...</code>)</li>
              <li>กดบันทึก</li>
              <li>หลังจากนั้นกดปุ่ม "สรุปด้วย AI" ในหน้าคัดกรองได้</li>
            </ol>
          </CardContent>
        </Card>
      </Section>

      <Section title="📄 การพิมพ์สติ๊กเกอร์ 5×7 cm">
        <Card>
          <CardContent className="pt-6 space-y-2 text-sm">
            <p><b>ขั้นตอน:</b></p>
            <ol className="list-decimal list-inside space-y-1">
              <li>หลังคัดกรอง → เลื่อนลงไปยังส่วน <b>"🏷 Sticker คำแนะนำผู้ป่วย"</b></li>
              <li>ตรวจสอบเนื้อหา preview</li>
              <li>กดปุ่ม <b>"พิมพ์"</b> → browser จะเปิด print dialog</li>
              <li>ตั้งกระดาษ <b>A4 portrait, margin 0.5 cm</b></li>
              <li>1 หน้า A4 พิมพ์ได้ 6 ใบ (2×3 หรือ 3×2)</li>
            </ol>
            <p className="text-xs text-muted-foreground pt-2 border-t">
              💡 เคล็ดลับ: ใช้กระดาษสติ๊กเกอร์ A4 แล้วตัดตามแนวเส้นประ
            </p>
          </CardContent>
        </Card>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="text-xl font-bold">{title}</h2>
      {children}
    </div>
  )
}

function Step({ n, title, icon: Icon, children }: { n: number; title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <Card className="soft-card">
      <CardContent className="pt-5 flex gap-3">
        <div className="size-10 rounded-xl bg-gradient-to-br from-cyan-500 to-sky-600 text-white grid place-items-center shrink-0 font-bold">{n}</div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold flex items-center gap-2"><Icon className="size-4 text-primary" /> {title}</div>
          <div className="text-sm mt-1">{children}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function Field({ name, required, children }: { name: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-sm py-1 border-b last:border-0">
      <div className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded shrink-0 self-start">
        {name}{required && <span className="text-red-500">*</span>}
      </div>
      <div className="flex-1 text-sm">{children}</div>
    </div>
  )
}

function FormatBlock({ title, example }: { title: string; example: string }) {
  return (
    <div>
      <div className="text-sm font-semibold flex items-center gap-2"><FileText className="size-4" /> {title}</div>
      <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto whitespace-pre-wrap break-all">{example}</pre>
    </div>
  )
}
