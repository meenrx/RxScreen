const KEY = 'AIzaSyByiqG28PnPqPkaC8ZCwXT_gtqR-3lf708', PROJ = 'rxscreen'
const APPLY = process.argv.includes('--apply')
const auth = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: '44156@rxscreen.local', password: 'rxs44156', returnSecureToken: true }) }).then(r => r.json())
const T = auth.idToken
const H = { Authorization: `Bearer ${T}`, 'Content-Type': 'application/json' }
const base = `https://firestore.googleapis.com/v1/projects/${PROJ}/databases/(default)/documents`
const sv = (f) => f && (f.stringValue ?? f.doubleValue ?? f.integerValue ?? f.booleanValue)

async function fetchAll(coll) {
  let tok = '', all = []
  do {
    const r = await fetch(`${base}/${coll}?pageSize=300${tok ? '&pageToken=' + tok : ''}`, { headers: H }).then(r => r.json())
    all.push(...(r.documents || [])); tok = r.nextPageToken || ''
  } while (tok)
  return all
}
// PATCH เฉพาะ field ที่ระบุ (updateMask) — ไม่แตะ field อื่น
async function patch(name, fieldsObj) {
  // encode เฉพาะ docId (segment สุดท้าย) — กัน '+' ใน id (เช่น "1580005_K+_31") ถูก decode เป็น space
  const encName = name.replace(/\/([^/]+)$/, (_, id) => '/' + encodeURIComponent(id))
  const mask = Object.keys(fieldsObj).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&')
  const fields = Object.fromEntries(Object.entries(fieldsObj).map(([k, v]) => [k, { stringValue: String(v) }]))
  if (!APPLY) return true
  const r = await fetch(`https://firestore.googleapis.com/v1/${encName}?${mask}`, { method: 'PATCH', headers: H, body: JSON.stringify({ fields }) })
  if (!r.ok) { console.log('ERR', r.status, (await r.text()).slice(0, 150)); return false }
  return true
}

// ---- โหลด master เพื่อรู้ generic ของแต่ละ icode ----
const masters = await fetchAll('DRUG_MASTER')
const genByIcode = new Map()
for (const d of masters) {
  const f = d.fields || {}
  genByIcode.set(String(sv(f.icode) ?? '').toLowerCase(), `${sv(f.generic_name) ?? ''} ${sv(f.drug_name) ?? ''}`.toLowerCase())
}

const rules = await fetchAll('LAB_RULES')

// ---- ทิศทางการเตือน K ตามคลาสยา ----
const K_HIGH = '>=5:K⁺ ≥5 mEq/L — ยาเพิ่มโพแทสเซียม พิจารณาลดขนาด/หยุดยา + ติดตาม; >=5.5:K⁺ ≥5.5 mEq/L สูงวิกฤต — หยุดยา + รักษา hyperkalemia'
const K_LOW_DIG = '<3.5:K⁺ <3.5 mEq/L — hypokalemia เพิ่มความเสี่ยง Digoxin toxicity แก้ไข K⁺ (เป้าหมาย ≥4); <3:K⁺ <3 วิกฤต — แก้ไขด่วน'
const K_LOW_DIU = '<3.5:K⁺ <3.5 mEq/L — ยาขับโพแทสเซียม เสี่ยง hypokalemia เสริม K⁺/ติดตาม; <3:K⁺ <3 วิกฤต — แก้ไขด่วน'

function kMeta(text) {
  if (/\bpril\b|pril |sartan|spironolact|eplerenone|amiloride|triamterene|aliskiren|losartan|enalapril|lisinopril|ramipril|valsartan/.test(text)) return K_HIGH
  if (/digoxin|lanoxin/.test(text)) return K_LOW_DIG
  if (/furosemide|bumetanide|torsemide|hydrochlorothiazide|\bhctz\b|indapamide|chlorthalidone|metolazone|thiazide|lasix|spirono/.test(text)) return K_LOW_DIU
  return null
}

// ยาอื่นที่ระบุทิศทางไว้ใน normal_range เดิม (เช่น "<3.5", ">5") แต่ยังไม่ทำงาน → แปลงเป็น alert_meta ตาม reason ของยานั้น
function kMetaFromRange(nr, reason) {
  const m = (nr || '').match(/^\s*(<=|>=|<|>)\s*(\d+(?:\.\d+)?)/)
  if (!m) return null
  const msg = (reason || (m[1].startsWith('<') ? 'K⁺ ต่ำ — แก้ไขก่อนให้ยา' : 'K⁺ สูง — ระวัง hyperkalemia')).slice(0, 90)
  return `${m[1]}${m[2]}:${msg}`
}

let kFix = 0, kSkip = [], crclFix = 0
for (const d of rules) {
  const f = d.fields || {}
  const param = (sv(f.param) || '').trim()
  const icode = String(sv(f.icode) ?? '').toLowerCase()
  const text = `${sv(f.drug_name) ?? ''} ${genByIcode.get(icode) ?? ''}`.toLowerCase()

  // ----- K / K+ : ให้ทิศทางตามคลาสยา -----
  if (/^k\+?$/i.test(param)) {
    const meta = kMeta(text) || kMetaFromRange(sv(f.normal_range), sv(f.reason))
    if (!meta) { kSkip.push(`${sv(f.drug_name) || icode} (param ${param})`); continue }
    const ok = await patch(d.name, { alert_meta: meta, normal_range: '3.5-5.0', unit: 'mEq/L' })
    if (ok) { kFix++; console.log(`K  ✓ ${sv(f.drug_name) || icode}: ${meta.match(/^>/) ? 'เตือนเมื่อสูง' : 'เตือนเมื่อต่ำ'}`) }
    continue
  }

  // ----- CrCl : normal ปกติ ≥90 mL/min (แก้ค่าที่ปน SCr) -----
  if (/^crcl$/i.test(param) || /cockcroft|cr\s*cl/i.test(param)) {
    const ok = await patch(d.name, { normal_range: '≥90', unit: 'mL/min' })
    if (ok) crclFix++
    continue
  }
  // ----- eGFR : normal ≥90 mL/min/1.73m² (แก้ unit ที่ผิดเป็น mg/dL) -----
  if (/^egfr$|^gfr$/i.test(param)) {
    const ok = await patch(d.name, { normal_range: '≥90', unit: 'mL/min/1.73m²' })
    if (ok) crclFix++
    continue
  }
}

console.log(`\n${APPLY ? 'อัปเดตแล้ว' : '(dry-run) จะอัปเดต'}: K ${kFix} rules, CrCl/eGFR ${crclFix} rules`)
if (kSkip.length) console.log('K ที่ไม่ได้แตะ (ไม่เข้าคลาส ACEI/ARB/Digoxin/ยาขับปัสสาวะ):', kSkip.join(', '))
