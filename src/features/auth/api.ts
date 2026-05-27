import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
  getAuth,
} from 'firebase/auth'
import { initializeApp, getApps, getApp } from 'firebase/app'
import { doc, getDoc, setDoc, getFirestore, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import type { AppUser, UserRole } from '@/types/user'
import { findInitialUser, pinToEmail, pinToPassword } from '@/lib/initialUsers'

export async function signOut() {
  await fbSignOut(auth)
}

/** ระบบ initialized แล้วยัง — ใช้ CONFIG/system เป็น marker */
async function isFirstUser(): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'CONFIG', 'system'))
    return !snap.exists()
  } catch {
    return false
  }
}

/** สร้าง/อัปเดต user doc ถ้ายังไม่มี */
export async function ensureUserDoc(
  uid: string,
  email: string,
  displayName: string,
  licNumber: string,
  forcedRole?: UserRole,
  staffId?: string,
): Promise<AppUser> {
  const ref = doc(db, 'users', uid)
  const snap = await getDoc(ref)
  if (snap.exists()) {
    const data = snap.data()
    return {
      uid,
      email: data.email,
      displayName: data.displayName,
      licNumber: data.licNumber,
      role: data.role,
      active: data.active,
    }
  }
  // doc ยังไม่มี → สร้างใหม่
  const role: UserRole = forcedRole ?? ((await isFirstUser()) ? 'admin' : 'pharmacist')
  const active = forcedRole !== undefined || (await isFirstUser())
  const userData = {
    uid,
    email,
    displayName,
    licNumber,
    role,
    active,
    staffId: staffId ?? '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  await setDoc(ref, userData)
  // first user mark
  const first = await isFirstUser()
  if (first) {
    try {
      await setDoc(doc(db, 'CONFIG', 'system'), {
        initialized: true,
        firstAdminUid: uid,
        createdAt: serverTimestamp(),
      })
    } catch (e) {
      console.warn('mark CONFIG/system failed:', e)
    }
  }
  return { uid, email, displayName, licNumber, role, active }
}

/**
 * เข้าระบบด้วย PIN (เลขใบประกอบ 5 หลัก)
 * - ถ้า PIN อยู่ใน INITIAL_USERS และยังไม่เคย login → สร้างบัญชี + user doc ให้อัตโนมัติ (role = admin)
 * - ถ้าเคย login แล้ว → sign in ปกติ
 */
export async function signInWithPin(pin: string) {
  const trimmedPin = pin.trim()
  if (!trimmedPin) throw new Error('กรุณาใส่ PIN')

  const email = pinToEmail(trimmedPin)
  const password = pinToPassword(trimmedPin)
  const bundled = findInitialUser(trimmedPin)

  try {
    // ลอง sign in ก่อน
    const cred = await signInWithEmailAndPassword(auth, email, password)
    await ensureUserDoc(
      cred.user.uid,
      email,
      bundled?.name ?? cred.user.displayName ?? `เภสัชกร ${trimmedPin}`,
      trimmedPin,
      bundled?.role,
      bundled?.id,
    )
    return cred.user
  } catch (e) {
    const err = e as { code?: string; message?: string }
    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/invalid-login-credentials') {
      // ยังไม่เคย register → ถ้าอยู่ใน bundle ให้สร้างให้
      if (!bundled) {
        throw new Error(`ไม่พบ PIN "${trimmedPin}" ในระบบ — กรุณาติดต่อผู้ดูแลระบบ`)
      }
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(cred.user, { displayName: bundled.name })
      await ensureUserDoc(cred.user.uid, email, bundled.name, trimmedPin, bundled.role, bundled.id)
      return cred.user
    }
    throw e
  }
}

/**
 * admin สร้างผู้ใช้ใหม่ — ใช้ secondary Firebase app instance เพื่อไม่ให้ logout admin
 */
export async function adminCreateUser(pin: string, displayName: string, role: UserRole = 'pharmacist'): Promise<void> {
  const pinTrim = pin.trim()
  if (!pinTrim) throw new Error('กรุณาใส่ PIN')
  if (!displayName.trim()) throw new Error('กรุณาใส่ชื่อ-นามสกุล')

  // Secondary Firebase app — ป้องกัน logout main session
  const secondaryName = 'secondary-' + Date.now()
  const mainApp = auth.app
  const secondaryApp = getApps().some((a) => a.name === secondaryName)
    ? getApp(secondaryName)
    : initializeApp(mainApp.options, secondaryName)

  const secondaryAuth = getAuth(secondaryApp)
  const secondaryDb = getFirestore(secondaryApp)

  const email = pinToEmail(pinTrim)
  const password = pinToPassword(pinTrim)

  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password)
    await updateProfile(cred.user, { displayName })
    // เขียน user doc ผ่าน secondary session ของ user ใหม่เอง (rules: self-create allowed)
    await setDoc(doc(secondaryDb, 'users', cred.user.uid), {
      uid: cred.user.uid,
      email,
      displayName,
      licNumber: pinTrim,
      role,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  } finally {
    await fbSignOut(secondaryAuth)
  }
}

export async function fetchUserDoc(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return null
  const data = snap.data()
  return {
    uid,
    email: data.email,
    displayName: data.displayName,
    licNumber: data.licNumber,
    role: data.role,
    active: data.active,
    createdAt: data.createdAt?.toDate(),
    updatedAt: data.updatedAt?.toDate(),
  }
}
