export type UserRole = 'admin' | 'pharmacist' | 'viewer'

export interface AppUser {
  uid: string
  email: string
  displayName: string
  licNumber?: string  // เลขใบประกอบฯ
  role: UserRole
  active: boolean
  createdAt?: Date
  updatedAt?: Date
}
