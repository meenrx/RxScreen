import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Megaphone, Plus, Trash2, ExternalLink, Save } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useAuthStore } from '@/features/auth/authStore'
import { collection, addDoc, query, orderBy, getDocs, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { formatBE } from '@/lib/format'
import { toast } from 'sonner'

interface RecallItem {
  id: string
  title: string
  drug_name?: string
  lot?: string
  reason?: string
  url?: string
  severity?: 'high' | 'medium' | 'low'
  createdAt: Date
  posted_by?: string
}

export function RecallTab() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'admin' || user?.role === 'pharmacist'

  const { data = [], isLoading } = useQuery({
    queryKey: ['drug-recalls'],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'DRUG_RECALL'), orderBy('createdAt', 'desc')))
      return snap.docs.map((d) => {
        const data = d.data()
        return { id: d.id, ...data, createdAt: data.createdAt?.toDate?.() ?? new Date() } as RecallItem
      })
    },
  })

  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [drugName, setDrugName] = useState('')
  const [lot, setLot] = useState('')
  const [reason, setReason] = useState('')
  const [url, setUrl] = useState('')
  const [severity, setSeverity] = useState<'high' | 'medium' | 'low'>('high')

  async function save() {
    if (!user || !title) return
    try {
      await addDoc(collection(db, 'DRUG_RECALL'), {
        title, drug_name: drugName, lot, reason, url, severity,
        posted_by: user.displayName,
        createdAt: serverTimestamp(),
      })
      qc.invalidateQueries({ queryKey: ['drug-recalls'] })
      toast.success('โพสต์ประกาศเรียกเก็บยาเรียบร้อย')
      setTitle(''); setDrugName(''); setLot(''); setReason(''); setUrl(''); setSeverity('high')
      setOpen(false)
    } catch (e) {
      toast.error('โพสต์ไม่สำเร็จ: ' + (e as Error).message)
    }
  }

  async function remove(id: string) {
    if (!confirm('ลบประกาศนี้?')) return
    await deleteDoc(doc(db, 'DRUG_RECALL', id))
    qc.invalidateQueries({ queryKey: ['drug-recalls'] })
  }

  return (
    <Card className="soft-card">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2"><Megaphone className="size-5 text-red-600" />ประกาศเรียกเก็บยา (Drug Recall)</CardTitle>
            <CardDescription>ประกาศของ อย. / กรมการแพทย์ / รพ. — เภสัชกรโพสต์ทีมรู้พร้อมกัน</CardDescription>
          </div>
          {isAdmin && <Button onClick={() => setOpen(true)}><Plus className="size-4" /> โพสต์ประกาศ</Button>}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">กำลังโหลด...</p>}
        {!isLoading && data.length === 0 && <p className="text-sm text-muted-foreground italic text-center py-6">ยังไม่มีประกาศเรียกเก็บยา</p>}
        {data.map((r) => (
          <div key={r.id} className={
            'rounded-xl border p-3 ' +
            (r.severity === 'high' ? 'alert-red' : r.severity === 'medium' ? 'alert-orange' : 'alert-yellow')
          }>
            <div className="flex items-start gap-3">
              <Megaphone className="size-5 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{r.title}</div>
                {r.drug_name && <div className="text-sm">ยา: <b>{r.drug_name}</b>{r.lot && ` · Lot: ${r.lot}`}</div>}
                {r.reason && <div className="text-sm mt-1">{r.reason}</div>}
                <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-2 items-center">
                  <span>โพสต์โดย {r.posted_by ?? '-'}</span>
                  <span>· {formatBE(r.createdAt)}</span>
                  {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><ExternalLink className="size-3" /> เปิด</a>}
                </div>
              </div>
              {isAdmin && <Button variant="ghost" size="icon" onClick={() => remove(r.id)}><Trash2 className="size-4 text-red-500" /></Button>}
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>โพสต์ประกาศเรียกเก็บยา</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="mb-1.5">หัวข้อ <span className="text-red-500">*</span></Label><Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-11" placeholder="เช่น 'อย. เรียกเก็บ Ranitidine ทุก lot'" /></div>
            <div><Label className="mb-1.5">ชื่อยา</Label><Input value={drugName} onChange={(e) => setDrugName(e.target.value)} className="h-11" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="mb-1.5">Lot/Batch</Label><Input value={lot} onChange={(e) => setLot(e.target.value)} className="h-11" /></div>
              <div>
                <Label className="mb-1.5">ระดับความรุนแรง</Label>
                <select value={severity} onChange={(e) => setSeverity(e.target.value as 'high' | 'medium' | 'low')} className="w-full h-11 rounded-md border bg-transparent px-3">
                  <option value="high">รุนแรง</option>
                  <option value="medium">ปานกลาง</option>
                  <option value="low">ทราบไว้</option>
                </select>
              </div>
            </div>
            <div><Label className="mb-1.5">เหตุผล</Label><Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} /></div>
            <div><Label className="mb-1.5">URL อ้างอิง</Label><Input value={url} onChange={(e) => setUrl(e.target.value)} className="h-11" placeholder="https://" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button>
            <Button onClick={save} disabled={!title}><Save className="size-4" /> โพสต์</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
