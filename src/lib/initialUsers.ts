/**
 * รายชื่อเภสัชกร รพ.รือเสาะ — ฝังในแอปเพื่อให้ login ด้วย PIN ได้ทันที
 * PIN = เลขใบประกอบ 5 หลัก
 *
 * เพิ่ม/แก้รายชื่อได้ที่นี่ + redeploy
 */
import type { UserRole } from '@/types/user'

export interface InitialUser {
  id: string
  name: string
  pin: string
  role: UserRole
}

export const INITIAL_USERS: InitialUser[] = [
  { id: 'PHAR-001', name: 'ภก.นิอัซมี นิเลาะ',       pin: '44156', role: 'admin' },
  { id: 'PHAR-002', name: 'ภก.ลุกมาน เร็งมา',         pin: '10440', role: 'admin' },
  { id: 'PHAR-003', name: 'ภก.อัสมัน โต๊ะเกะ',         pin: '34380', role: 'admin' },
  { id: 'PHAR-004', name: 'ภญ.พูไซมะห์ หะยีสาและ',    pin: '49238', role: 'admin' },
  { id: 'PHAR-005', name: 'ภก.มะซอบัร ดาละ',          pin: '47436', role: 'admin' },
  { id: 'PHAR-006', name: 'ภญ.ฟัยโรส บอซู',           pin: '36619', role: 'admin' },
  { id: 'PHAR-007', name: 'ภญ.ตอฮีเราะ กอแล',         pin: '19944', role: 'admin' },
  { id: 'PHAR-008', name: 'ภญ.มาดานียาห์ สาแม',       pin: '21145', role: 'admin' },
]

/** PIN → email (สำหรับ Firebase Auth internal) */
export function pinToEmail(pin: string): string {
  return `${pin}@rxscreen.local`
}

/** PIN → password (สำหรับ Firebase Auth ต้อง ≥ 6 ตัวอักษร) */
export function pinToPassword(pin: string): string {
  return `rxs${pin}`
}

/** ค้น PIN ในรายชื่อที่ฝังไว้ */
export function findInitialUser(pin: string): InitialUser | undefined {
  return INITIAL_USERS.find((u) => u.pin === pin.trim())
}
