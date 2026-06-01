import {
  collection,
  doc,
  getDocs,
  query,
  where,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  orderBy,
  limit as fbLimit,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { DrugMaster, LabRule, DdiOverride, DrugCounseling, DiseaseRule, AppConfig, HadRule } from '@/types/drug'

// === DRUG_MASTER ===
export async function listDrugs(): Promise<DrugMaster[]> {
  const snap = await getDocs(query(collection(db, 'DRUG_MASTER'), orderBy('icode')))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as DrugMaster) }))
}

export async function getDrugByIcode(icode: string): Promise<DrugMaster | null> {
  const snap = await getDocs(query(collection(db, 'DRUG_MASTER'), where('icode', '==', icode), fbLimit(1)))
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...(d.data() as DrugMaster) }
}

export async function saveDrug(drug: DrugMaster): Promise<string> {
  const id = drug.id ?? drug.icode
  await setDoc(doc(db, 'DRUG_MASTER', id), { ...drug, updatedAt: serverTimestamp() }, { merge: true })
  return id
}

export async function deleteDrug(id: string) {
  await deleteDoc(doc(db, 'DRUG_MASTER', id))
}

// === LAB_RULES ===
export async function listLabRules(): Promise<LabRule[]> {
  const snap = await getDocs(query(collection(db, 'LAB_RULES'), orderBy('icode')))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as LabRule) }))
}

export async function listLabRulesByIcode(icode: string): Promise<LabRule[]> {
  const snap = await getDocs(query(collection(db, 'LAB_RULES'), where('icode', '==', icode)))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as LabRule) }))
}

/** ดึง lab rules ของยา โดยลอง match หลายคีย์: icode → generic_name (lowercase) → generic_name (เดิม)
 *  เผื่อกรณี admin เก็บ rule.icode เป็น generic name ไม่ใช่เลข icode จริง */
export async function listLabRulesForDrug(master: { icode: string; generic_name?: string }): Promise<LabRule[]> {
  const keys = new Set<string>()
  if (master.icode) keys.add(master.icode)
  if (master.generic_name) {
    const g = master.generic_name.trim()
    if (g) {
      keys.add(g)
      keys.add(g.toLowerCase())
    }
  }
  const results: LabRule[] = []
  const seen = new Set<string>()
  for (const k of keys) {
    const snap = await getDocs(query(collection(db, 'LAB_RULES'), where('icode', '==', k)))
    for (const d of snap.docs) {
      if (seen.has(d.id)) continue
      seen.add(d.id)
      results.push({ id: d.id, ...(d.data() as LabRule) })
    }
  }
  return results
}

export async function saveLabRule(rule: LabRule): Promise<string> {
  const id = rule.id ?? `${rule.icode}_${rule.param ?? 'rule'}_${Date.now()}`
  await setDoc(doc(db, 'LAB_RULES', id), { ...rule, updatedAt: serverTimestamp() }, { merge: true })
  return id
}

export async function deleteLabRule(id: string) {
  await deleteDoc(doc(db, 'LAB_RULES', id))
}

// === DDI_OVERRIDE ===
export async function listDdiOverrides(): Promise<DdiOverride[]> {
  const snap = await getDocs(collection(db, 'DDI_OVERRIDE'))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as DdiOverride) }))
}

export async function saveDdiOverride(ddi: DdiOverride): Promise<string> {
  const id = ddi.id ?? `${ddi.drug_a}__${ddi.drug_b}`
  await setDoc(doc(db, 'DDI_OVERRIDE', id), { ...ddi, updatedAt: serverTimestamp() }, { merge: true })
  return id
}

export async function deleteDdiOverride(id: string) {
  await deleteDoc(doc(db, 'DDI_OVERRIDE', id))
}

// === DRUG_COUNSELING ===
export async function listCounseling(): Promise<DrugCounseling[]> {
  const snap = await getDocs(query(collection(db, 'DRUG_COUNSELING'), orderBy('icode')))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as DrugCounseling) }))
}

export async function getCounselingByIcode(icode: string): Promise<DrugCounseling | null> {
  const snap = await getDocs(query(collection(db, 'DRUG_COUNSELING'), where('icode', '==', icode), fbLimit(1)))
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...(d.data() as DrugCounseling) }
}

export async function saveCounseling(c: DrugCounseling): Promise<string> {
  const id = c.id ?? c.icode
  await setDoc(doc(db, 'DRUG_COUNSELING', id), { ...c, updatedAt: serverTimestamp() }, { merge: true })
  return id
}

export async function deleteCounseling(id: string) {
  await deleteDoc(doc(db, 'DRUG_COUNSELING', id))
}

// === DISEASE_RULES ===
export async function listDiseaseRules(): Promise<DiseaseRule[]> {
  const snap = await getDocs(collection(db, 'DISEASE_RULES'))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as DiseaseRule) }))
}

export async function saveDiseaseRule(r: DiseaseRule): Promise<string> {
  const id = r.id ?? `${r.disease}_${r.drug_icode ?? r.drug_class ?? Date.now()}`
  await setDoc(doc(db, 'DISEASE_RULES', id), { ...r, updatedAt: serverTimestamp() }, { merge: true })
  return id
}

export async function deleteDiseaseRule(id: string) {
  await deleteDoc(doc(db, 'DISEASE_RULES', id))
}

// === HAD_RULES (High Alert Drug) ===
export async function listHadRules(): Promise<HadRule[]> {
  const snap = await getDocs(query(collection(db, 'HAD_RULES'), orderBy('drug_name')))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as HadRule) }))
}

export async function saveHadRule(h: HadRule): Promise<string> {
  const id = h.id ?? h.drug_key.replace(/[^a-z0-9]/gi, '_').toLowerCase()
  await setDoc(doc(db, 'HAD_RULES', id), { ...h, updatedAt: serverTimestamp() }, { merge: true })
  return id
}

export async function deleteHadRule(id: string) {
  await deleteDoc(doc(db, 'HAD_RULES', id))
}

// === CONFIG ===
export async function getConfig(id: string): Promise<AppConfig | null> {
  const snap = await getDocs(query(collection(db, 'CONFIG'), where('__name__', '==', id)))
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...(d.data() as AppConfig) }
}

export async function saveConfig(id: string, data: Partial<AppConfig>) {
  await setDoc(doc(db, 'CONFIG', id), { ...data, updatedAt: serverTimestamp() }, { merge: true })
}

export async function updateUserRole(uid: string, role: string, active: boolean) {
  await updateDoc(doc(db, 'users', uid), { role, active, updatedAt: serverTimestamp() })
}
