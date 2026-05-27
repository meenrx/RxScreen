import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, UserPlus } from 'lucide-react'
import { adminCreateUser } from '@/features/auth/api'
import { updateUserRole } from '@/features/catalog/api'
import { HelpHint } from '@/components/HelpHint'
import { toast } from 'sonner'
import type { AppUser, UserRole } from '@/types/user'

export function UsersAdmin() {
  const qc = useQueryClient()
  const { data = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const snap = await getDocs(collection(db, 'users'))
      return snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as AppUser)
    },
  })

  const [open, setOpen] = useState(false)
  const [pin, setPin] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<UserRole>('pharmacist')
  const [creating, setCreating] = useState(false)

  const updateRole = useMutation({
    mutationFn: async ({ uid, role, active }: { uid: string; role: string; active: boolean }) => updateUserRole(uid, role, active),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('อัปเดตสำเร็จ')
    },
    onError: (e) => toast.error('ผิดพลาด: ' + (e as Error).message),
  })

  async function handleCreate() {
    if (!/^\d{5}$/.test(pin.trim())) { toast.error('PIN ต้องเป็นตัวเลข 5 หลัก'); return }
    setCreating(true)
    try {
      await adminCreateUser(pin.trim(), name.trim(), role)
      toast.success(`เพิ่มผู้ใช้ ${name} สำเร็จ — PIN: ${pin}`)
      setPin(''); setName(''); setRole('pharmacist')
      setOpen(false)
      qc.invalidateQueries({ queryKey: ['users'] })
    } catch (e) {
      const err = e as { code?: string; message?: string }
      if (err.code === 'auth/email-already-in-use') {
        toast.error('PIN นี้มีอยู่แล้วในระบบ')
      } else {
        toast.error('เพิ่มผู้ใช้ไม่สำเร็จ: ' + (err.message ?? String(e)))
      }
    } finally {
      setCreating(false)
    }
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="text-sm text-muted-foreground">{data.length} ผู้ใช้</div>
          <Button onClick={() => setOpen(true)} className="bg-gradient-to-r from-emerald-500 to-teal-600">
            <UserPlus className="size-4" /> เพิ่มผู้ใช้
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ชื่อ-นามสกุล</TableHead>
              <TableHead>PIN / ลข.</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead className="text-right">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((u) => (
              <TableRow key={u.uid}>
                <TableCell>
                  <div className="font-medium">{u.displayName}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </TableCell>
                <TableCell className="font-mono">{u.licNumber ?? '-'}</TableCell>
                <TableCell>
                  <Select value={u.role} onValueChange={(v) => updateRole.mutate({ uid: u.uid, role: v, active: u.active })}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">admin</SelectItem>
                      <SelectItem value="pharmacist">pharmacist</SelectItem>
                      <SelectItem value="viewer">viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Badge variant={u.active ? 'green' : 'yellow'}>{u.active ? 'ใช้งาน' : 'รออนุมัติ'}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant={u.active ? 'outline' : 'default'} onClick={() => updateRole.mutate({ uid: u.uid, role: u.role as UserRole, active: !u.active })}>
                    {u.active ? 'ระงับ' : 'อนุมัติ'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="size-5" /> เพิ่มผู้ใช้ใหม่</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="mb-1.5 flex items-center gap-2">
                ชื่อ-นามสกุล <span className="text-red-500">*</span>
                <HelpHint title="ชื่อ-นามสกุล">ใส่คำนำหน้า (ภก./ภญ.) + ชื่อ + นามสกุล เช่น "ภก.นิอัซมี นิเลาะ"</HelpHint>
              </Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ภก./ภญ. ชื่อ นามสกุล" className="h-11" />
            </div>
            <div>
              <Label className="mb-1.5 flex items-center gap-2">
                PIN (เลขใบประกอบ 5 หลัก) <span className="text-red-500">*</span>
                <HelpHint title="PIN">ใช้สำหรับ login — เลขใบประกอบวิชาชีพ 5 หลัก ผู้ใช้จะ login ด้วยเลขนี้</HelpHint>
              </Label>
              <Input
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 5))}
                placeholder="44156"
                className="h-11 font-mono text-xl tracking-widest text-center"
                inputMode="numeric"
              />
            </div>
            <div>
              <Label className="mb-1.5 flex items-center gap-2">
                บทบาท
                <HelpHint title="Role">
                  <b>admin</b> — จัดการระบบทั้งหมด<br />
                  <b>pharmacist</b> — คัดกรอง + แก้ฐานข้อมูล<br />
                  <b>viewer</b> — ดูอย่างเดียว
                </HelpHint>
              </Label>
              <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                <SelectTrigger className="w-full h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">admin (ผู้ดูแลระบบ)</SelectItem>
                  <SelectItem value="pharmacist">pharmacist (เภสัชกร)</SelectItem>
                  <SelectItem value="viewer">viewer (ผู้ใช้งานทั่วไป)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleCreate} disabled={creating || !pin || !name}>
              {creating ? 'กำลังเพิ่ม...' : 'เพิ่มผู้ใช้'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
