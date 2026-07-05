import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DrugMasterAdmin } from '@/features/admin/DrugMasterAdmin'
import { LabRuleAdmin } from '@/features/admin/LabRuleAdmin'
import { DdiAdmin } from '@/features/admin/DdiAdmin'
import { CounselingAdmin } from '@/features/admin/CounselingAdmin'
import { DiseaseAdmin } from '@/features/admin/DiseaseAdmin'
import { UsersAdmin } from '@/features/admin/UsersAdmin'
import { HadRuleAdmin } from '@/features/admin/HadRuleAdmin'
import { RenalRefAdmin } from '@/features/admin/RenalRefAdmin'
import { AlertMuteAdmin } from '@/features/admin/AlertMuteAdmin'

export default function AdminPage() {
  const [tab, setTab] = useState('drugs')
  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">จัดการฐานข้อมูล</h1>
        <p className="text-sm text-muted-foreground">เพิ่ม/แก้ไข/ลบข้อมูลยา กฎ Lab DDI โรค และผู้ใช้</p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="overflow-x-auto max-w-full">
          <TabsTrigger value="drugs">ยา (DRUG_MASTER)</TabsTrigger>
          <TabsTrigger value="lab">Lab/Dose</TabsTrigger>
          <TabsTrigger value="renal">💧 เกณฑ์ไต</TabsTrigger>
          <TabsTrigger value="ddi">DDI</TabsTrigger>
          <TabsTrigger value="had">🔴 HAD</TabsTrigger>
          <TabsTrigger value="counseling">Counseling</TabsTrigger>
          <TabsTrigger value="disease">Disease</TabsTrigger>
          <TabsTrigger value="mute">🔕 ปิดเตือน</TabsTrigger>
          <TabsTrigger value="users">ผู้ใช้</TabsTrigger>
        </TabsList>
        <TabsContent value="drugs"><DrugMasterAdmin /></TabsContent>
        <TabsContent value="lab"><LabRuleAdmin /></TabsContent>
        <TabsContent value="renal"><RenalRefAdmin /></TabsContent>
        <TabsContent value="ddi"><DdiAdmin /></TabsContent>
        <TabsContent value="had"><HadRuleAdmin /></TabsContent>
        <TabsContent value="counseling"><CounselingAdmin /></TabsContent>
        <TabsContent value="disease"><DiseaseAdmin /></TabsContent>
        <TabsContent value="mute"><AlertMuteAdmin /></TabsContent>
        <TabsContent value="users"><UsersAdmin /></TabsContent>
      </Tabs>
    </div>
  )
}
