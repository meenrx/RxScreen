// เก็บ "batch ล่าสุด" ที่แนบไว้ ในเครื่อง (IndexedDB) — ดูภายหลังได้, อัปใหม่ทับของเดิม
// เก็บ slot เดียว (KEY='latest') → ยึดเฉพาะข้อมูลที่แนบใหม่เสมอ
const DB = 'rxscreen-batch', STORE = 'batch', KEY = 'latest'

export interface SavedBatch {
  savedAt: number
  files: Record<string, { name: string; rows: Record<string, unknown>[] }>
}

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => res(req.result)
    req.onerror = () => rej(req.error)
  })
}

export async function saveBatch(b: SavedBatch): Promise<void> {
  const db = await open()
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(b, KEY)
    tx.oncomplete = () => res()
    tx.onerror = () => rej(tx.error)
  })
  db.close()
}

export async function loadBatch(): Promise<SavedBatch | undefined> {
  const db = await open()
  const r = await new Promise<SavedBatch | undefined>((res, rej) => {
    const rq = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY)
    rq.onsuccess = () => res(rq.result as SavedBatch | undefined)
    rq.onerror = () => rej(rq.error)
  })
  db.close()
  return r
}

export async function clearBatch(): Promise<void> {
  const db = await open()
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(KEY)
    tx.oncomplete = () => res()
    tx.onerror = () => rej(tx.error)
  })
  db.close()
}
