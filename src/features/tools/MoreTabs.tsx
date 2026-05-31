import { useState } from 'react'
import { ClipboardList, Save, Trash2, Upload, Loader2, Power } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DrugCombobox } from '@/components/DrugCombobox'
import { useDrugs } from '@/features/catalog/hooks'
import { useAuthStore } from '@/features/auth/authStore'
import { useSubstitutions, useSaveSubstitution, useDeleteSubstitution } from '@/features/substitution/hooks'
import { uploadSubstitutionImage } from '@/features/substitution/api'
import type { DrugSubstitution } from '@/types/drug'
import { toast } from 'sonner'

// ───────── ระบบแจ้งยาเปลี่ยนบริษัท/รูปลักษณ์ (แสดงตอนคัดกรอง พร้อมรูปก่อน/หลัง) ─────────
export function SubstitutionTab() {
  const { data: drugs = [] } = useDrugs()
  const { data: subs = [] } = useSubstitutions()
  const user = useAuthStore((s) => s.user)
  const saveMut = useSaveSubstitution()
  const delMut = useDeleteSubstitution()

  const [icode, setIcode] = useState('')
  const [drugName, setDrugName] = useState('')
  const [oldBrand, setOldBrand] = useState('')
  const [newBrand, setNewBrand] = useState('')
  const [note, setNote] = useState('')
  const [beforeImg, setBeforeImg] = useState('')
  const [afterImg, setAfterImg] = useState('')
  const [uploading, setUploading] = useState<'before' | 'after' | null>(null)

  function resetForm() {
    setIcode(''); setDrugName(''); setOldBrand(''); setNewBrand(''); setNote(''); setBeforeImg(''); setAfterImg('')
  }

  async function handleUpload(kind: 'before' | 'after', file: File | undefined) {
    if (!file || !icode) { if (!icode) toast.error('เลือกยาก่อนอัปโหลดรูป'); return }
    setUploading(kind)
    try {
      const url = await uploadSubstitutionImage(icode, kind, file)
      if (kind === 'before') setBeforeImg(url); else setAfterImg(url)
      toast.success('อัปโหลดรูปเรียบร้อย')
    } catch (e) {
      toast.error('อัปโหลดไม่สำเร็จ — ตรวจว่าเปิด Firebase Storage แล้ว: ' + (e as Error).message)
    } finally {
      setUploading(null)
    }
  }

  async function save() {
    if (!icode || !drugName) { toast.error('เลือกยาก่อน'); return }
    await saveMut.mutateAsync({
      icode, drug_name: drugName,
      old_brand: oldBrand, new_brand: newBrand, note,
      before_image: beforeImg, after_image: afterImg,
      active: true,
      pharmacist_uid: user?.uid, pharmacist_name: user?.displayName,
    })
    resetForm()
  }

  async function toggleActive(s: DrugSubstitution) {
    await saveMut.mutateAsync({ ...s, active: !s.active })
  }

  return (
    <div className="space-y-4">
      <Card className="soft-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ClipboardList className="size-5 text-amber-600" />แจ้งยาเปลี่ยนบริษัท/รูปลักษณ์</CardTitle>
          <CardDescription>บันทึกยาที่เปลี่ยน trade/บริษัท แนบรูปก่อน-หลัง — ระบบจะเตือน + แสดงรูปตอนคัดกรองยาตัวนี้</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="mb-1.5">ยา <span className="text-red-500">*</span></Label>
            <DrugCombobox drugs={drugs} value={icode} onChange={(ic, d) => { setIcode(ic); setDrugName(d?.drug_name ?? '') }} placeholder="พิมพ์ชื่อยา…" />
            {drugName && <div className="text-xs text-muted-foreground mt-1">เลือก: <b>{drugName}</b></div>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div><Label className="mb-1.5">บริษัท/ชื่อเดิม</Label><Input value={oldBrand} onChange={(e) => setOldBrand(e.target.value)} placeholder="เช่น ยี่ห้อ A" /></div>
            <div><Label className="mb-1.5">บริษัท/ชื่อใหม่</Label><Input value={newBrand} onChange={(e) => setNewBrand(e.target.value)} placeholder="เช่น ยี่ห้อ B" /></div>
          </div>

          <div><Label className="mb-1.5">หมายเหตุ</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="เช่น เม็ดสีเปลี่ยนจากขาวเป็นชมพู ขนาดเท่าเดิม" /></div>

          <div className="grid grid-cols-2 gap-2">
            <ImageUpload label="รูปก่อน (เดิม)" url={beforeImg} busy={uploading === 'before'} onPick={(f) => handleUpload('before', f)} />
            <ImageUpload label="รูปหลัง (ใหม่)" url={afterImg} busy={uploading === 'after'} onPick={(f) => handleUpload('after', f)} />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={resetForm}>ล้างฟอร์ม</Button>
            <Button onClick={save} disabled={saveMut.isPending || !icode}><Save className="size-4" /> บันทึก</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="soft-card">
        <CardHeader><CardTitle className="text-base">รายการที่บันทึกไว้ ({subs.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {subs.length === 0 && <p className="text-sm text-muted-foreground italic">ยังไม่มีรายการ</p>}
          {subs.map((s) => (
            <div key={s.id} className="flex items-center gap-2 rounded-lg border bg-card p-2.5">
              <Badge variant={s.active ? 'green' : 'secondary'} className="shrink-0">{s.active ? 'แสดง' : 'ปิด'}</Badge>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm truncate">{s.drug_name}</div>
                <div className="text-[11px] text-muted-foreground truncate">{[s.old_brand, s.new_brand].filter(Boolean).join(' → ') || s.note}</div>
              </div>
              {s.before_image && <img src={s.before_image} alt="" className="size-9 rounded object-cover border" />}
              {s.after_image && <img src={s.after_image} alt="" className="size-9 rounded object-cover border" />}
              <Button variant="ghost" size="icon" onClick={() => toggleActive(s)} title="เปิด/ปิดการแสดง"><Power className="size-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => delMut.mutate(s)}><Trash2 className="size-4 text-red-500" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function ImageUpload({ label, url, busy, onPick }: { label: string; url?: string; busy: boolean; onPick: (f: File | undefined) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {url ? (
        <img src={url} alt={label} className="w-full h-28 object-contain rounded-lg border bg-white" />
      ) : (
        <label className="w-full h-28 rounded-lg border border-dashed grid place-items-center cursor-pointer hover:bg-accent text-xs text-muted-foreground">
          {busy ? <Loader2 className="size-5 animate-spin" /> : <span className="flex flex-col items-center gap-1"><Upload className="size-5" /> อัปโหลด</span>}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => onPick(e.target.files?.[0])} />
        </label>
      )}
      {url && (
        <label className="text-[11px] text-primary cursor-pointer hover:underline">
          เปลี่ยนรูป
          <input type="file" accept="image/*" className="hidden" onChange={(e) => onPick(e.target.files?.[0])} />
        </label>
      )}
    </div>
  )
}
