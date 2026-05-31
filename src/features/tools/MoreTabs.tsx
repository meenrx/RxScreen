import { useState } from 'react'
import { ClipboardList, Save } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DrugCombobox } from '@/components/DrugCombobox'
import { useDrugs } from '@/features/catalog/hooks'
import { useAuthStore } from '@/features/auth/authStore'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { toast } from 'sonner'

// ─────────────────────────── Brand/Generic Substitution Log ───────────────────────────
export function SubstitutionTab() {
  const { data: drugs = [] } = useDrugs()
  const user = useAuthStore((s) => s.user)

  const [hn, setHn] = useState('')
  const [originalIcode, setOriginalIcode] = useState('')
  const [originalName, setOriginalName] = useState('')
  const [substituteIcode, setSubstituteIcode] = useState('')
  const [substituteName, setSubstituteName] = useState('')
  const [reason, setReason] = useState('out_of_stock')
  const [note, setNote] = useState('')

  async function save() {
    if (!user || !originalName || !substituteName) { toast.error('กรุณาใส่ยา original และ ยาที่เปลี่ยน'); return }
    try {
      await addDoc(collection(db, 'SUBSTITUTION_LOG'), {
        hn: hn || null,
        original_icode: originalIcode,
        original_name: originalName,
        substitute_icode: substituteIcode,
        substitute_name: substituteName,
        reason,
        note,
        pharmacist_uid: user.uid,
        pharmacist_name: user.displayName,
        createdAt: serverTimestamp(),
      })
      toast.success('บันทึกการเปลี่ยนยาเรียบร้อย')
      setHn(''); setOriginalIcode(''); setOriginalName(''); setSubstituteIcode(''); setSubstituteName(''); setNote('')
    } catch (e) {
      toast.error('บันทึกไม่สำเร็จ: ' + (e as Error).message)
    }
  }

  return (
    <Card className="soft-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ClipboardList className="size-5 text-amber-600" />Brand ↔ Generic Substitution Log</CardTitle>
        <CardDescription>บันทึกการเปลี่ยน trade/generic เมื่อยาไม่มี / ใช้แทน</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div><Label className="mb-1.5">HN (ไม่บังคับ)</Label><Input value={hn} onChange={(e) => setHn(e.target.value)} className="h-11" /></div>

        <div>
          <Label className="mb-1.5">ยาเดิม (ที่สั่ง) <span className="text-red-500">*</span></Label>
          <DrugCombobox drugs={drugs} value={originalIcode} onChange={(icode, d) => { setOriginalIcode(icode); setOriginalName(d?.drug_name ?? '') }} placeholder="พิมพ์ชื่อยาเดิม…" />
          {originalName && <div className="text-xs text-muted-foreground mt-1">เลือก: <b>{originalName}</b></div>}
        </div>

        <div>
          <Label className="mb-1.5">ยาที่ใช้แทน <span className="text-red-500">*</span></Label>
          <DrugCombobox drugs={drugs} value={substituteIcode} onChange={(icode, d) => { setSubstituteIcode(icode); setSubstituteName(d?.drug_name ?? '') }} placeholder="พิมพ์ชื่อยาแทน…" />
          {substituteName && <div className="text-xs text-muted-foreground mt-1">เลือก: <b>{substituteName}</b></div>}
        </div>

        <div>
          <Label className="mb-1.5">เหตุผล</Label>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger className="w-full h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="out_of_stock">ยาขาด</SelectItem>
              <SelectItem value="cost">ราคา / สิทธิ์เบิก</SelectItem>
              <SelectItem value="allergy">แพ้ยาเดิม</SelectItem>
              <SelectItem value="formulary">นอก formulary รพ.</SelectItem>
              <SelectItem value="patient_request">ผู้ป่วยขอเปลี่ยน</SelectItem>
              <SelectItem value="other">อื่นๆ</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div><Label className="mb-1.5">หมายเหตุ</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} /></div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={!originalName || !substituteName}><Save className="size-4" /> บันทึก</Button>
        </div>
      </CardContent>
    </Card>
  )
}
