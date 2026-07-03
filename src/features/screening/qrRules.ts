/**
 * qrRules — กฎคัดกรอง offline ที่รวม "ค่า lab จาก QR" กับ "กลุ่มยา (จับจาก generic_name)"
 * ตามคู่มือ Rx Screening from QR ข้อ 3–5 — ทำงานโดยไม่ต้องตั้ง LAB_RULE รายตัว
 *
 * ค่า lab อ่านจาก patient.labs / .egfr(CrCl) / .scr / .inr · กลุ่มยาจับจาก generic_name
 */
import type { DrugEntry, PatientInput, ScreeningAlert } from '@/types/screening'
import { parseLabDate } from './labDisplay'

// ===== นิยามกลุ่มยา (regex บน generic_name) =====
const G = {
  nsaid: /ibuprofen|naproxen|diclofenac|indomethacin|celecoxib|etoricoxib|meloxicam|piroxicam|mefenamic|ketorolac|nimesulide|sulindac/,
  aspirin: /aspirin|acetylsalicylic|\basa\b/,
  acei: /\w*pril\b/,        // enalapril, lisinopril, ramipril, captopril, ... (-pril)
  arb: /\w*sartan\b/,       // losartan, valsartan, candesartan, ... (-sartan)
  diuretic_loop: /furosemide|torsemide|bumetanide/,
  diuretic_thiazide: /hydrochlorothiazide|\bhctz\b|indapamide|chlorthalidone|metolazone/,
  k_sparing: /spironolactone|eplerenone|amiloride|triamterene/,
  warfarin: /warfarin/,
  doac: /dabigatran|rivaroxaban|apixaban|edoxaban/,
  antiplatelet: /clopidogrel|ticagrelor|prasugrel|ticlopidine|dipyridamole|cilostazol/,
  heparin: /heparin|enoxaparin|dalteparin|fondaparinux|nadroparin/,
  sulfonylurea: /glibenclamide|glyburide|glipizide|gliclazide|glimepiride/,
  insulin: /insulin|mixtard|humulin|novomix|novorapid|novolog|actrapid|insulatard|lantus|levemir|glargine|aspart|lispro|degludec|detemir|isophane|ryzodeg|tresiba|toujeo|apidra/,
  antidiabetic: /insulin|mixtard|humulin|novomix|novorapid|actrapid|insulatard|lantus|levemir|glargine|degludec|isophane|ryzodeg|tresiba|metformin|glipizide|glibenclamide|glyburide|gliclazide|glimepiride|pioglitazone|rosiglitazone|sitagliptin|vildagliptin|linagliptin|saxagliptin|gliptin|empagliflozin|dapagliflozin|canagliflozin|gliflozin|acarbose|voglibose/,
  statin: /\w*statin\b/,
  hepatotoxic: /\w*statin\b|isoniazid|rifampicin|pyrazinamide|methotrexate|valproate|valproic|amiodarone|carbamazepine|nevirapine|efavirenz|phenytoin|ketoconazole|itraconazole|fluconazole|paracetamol|acetaminophen/,
  protein_bound: /warfarin|phenytoin|valproate|valproic/,
  g6pd_oxidant: /primaquine|dapsone|nitrofurantoin|methylene\s*blue|methylthioninium|chloramphenicol|rasburicase|sulfamethoxazole|co-?trimoxazole|sulfadiazine|sulfasalazine|toluidine|quinolone|ciprofloxacin|norfloxacin|ofloxacin|levofloxacin/,
  qt: /azithromycin|clarithromycin|erythromycin|roxithromycin|levofloxacin|ciprofloxacin|moxifloxacin|ofloxacin|amiodarone|sotalol|haloperidol|risperidone|quetiapine|ondansetron|domperidone|citalopram|escitalopram|methadone/,
  opioid: /morphine|codeine|tramadol|fentanyl|pethidine|meperidine|oxycodone|methadone|hydromorphone|pholcodine/,
  bzd: /diazepam|lorazepam|alprazolam|clonazepam|midazolam|temazepam|chlordiazepoxide|nitrazepam|clorazepate/,
  gabapentinoid: /gabapentin|pregabalin/,
  digoxin: /digoxin/,
  marrow_suppress: /clozapine|carbimazole|methimazole|thiamazole|propylthiouracil|\bptu\b|ganciclovir|valganciclovir/,
  warfarin_potentiator: /co-?trimoxazole|sulfamethoxazole|fluconazole|ketoconazole|itraconazole|voriconazole|metronidazole|amiodarone|erythromycin|clarithromycin|azithromycin|ciprofloxacin/,
  metformin: /metformin/,
  ccb_nondihydro: /verapamil|diltiazem/,
  bb_nonselective: /propranolol|nadolol|sotalol|carvedilol|timolol/,
  glitazone: /pioglitazone|rosiglitazone/,
  renal_adjust: /enoxaparin|dalteparin|gabapentin|pregabalin|metformin|colchicine|digoxin|dabigatran|rivaroxaban|apixaban|edoxaban|gentamicin|amikacin|streptomycin|tobramycin|vancomycin|co-?trimoxazole|sulfamethoxazole|levofloxacin|ciprofloxacin|cefazolin|cefepime|ceftazidime|meropenem|imipenem|ertapenem|acyclovir|ranitidine|famotidine|allopurinol|tramadol|atenolol|fenofibrate/,
}

function gen(d: DrugEntry): string {
  return `${d.master?.generic_name ?? ''} ${d.master?.drug_name ?? d.drug_name ?? ''}`.toLowerCase()
}
function inGroup(drugs: DrugEntry[], re: RegExp): DrugEntry[] {
  return drugs.filter((d) => re.test(gen(d)))
}
function names(list: DrugEntry[]): string {
  return list.map((d) => d.master?.drug_name ?? d.drug_name ?? d.icode).join(', ')
}
function icodes(list: DrugEntry[]): string[] {
  return list.map((d) => d.icode)
}

/** ค่าไตที่ใช้ตัดสิน (CrCl ก่อน ถ้าไม่มีใช้ GFR ที่รายงาน) */
function renalValue(p: PatientInput): number | undefined {
  return p.egfr ?? p.labs?.gfr
}

/** หมายเหตุ "ค่าเก่า" ถ้า lab เกิน 30 วัน */
function staleNote(p: PatientInput, key: string): string {
  const d = parseLabDate(p.labDates?.[key])
  if (!d) return ''
  const days = Math.floor((Date.now() - d.getTime()) / 86400000)
  return days > 30 ? ` · ⏳ ค่าเก่า ${days} วัน (อาจไม่เป็นปัจจุบัน)` : ''
}

export function buildQrRuleAlerts(drugs: DrugEntry[], p: PatientInput): ScreeningAlert[] {
  if (drugs.length === 0) return []
  const a: ScreeningAlert[] = []
  const labs = p.labs ?? {}
  const push = (x: ScreeningAlert) => a.push(x)

  // ---- 3.2 Warfarin + INR ----
  const warf = inGroup(drugs, G.warfarin)
  if (warf.length) {
    if (p.inr !== undefined) {
      if (p.inr > 4) push({ id: 'qr_inr_high', type: 'LAB', severity: 'red', title: `🩸 INR ${p.inr} > 4 — เสี่ยงเลือดออกสูง (warfarin)`, detail: `ทวนขนาด warfarin · งด NSAID/ASA${staleNote(p, 'inr')}`, recommendation: 'พิจารณาลด/หยุด warfarin ตามแนวทาง + ตรวจ INR ซ้ำ', drugs: icodes(warf) })
      else if (p.inr > 3) push({ id: 'qr_inr_supra', type: 'LAB', severity: 'orange', title: `INR ${p.inr} เกินเป้า (2–3)`, detail: `เฝ้าระวังเลือดออก${staleNote(p, 'inr')}`, drugs: icodes(warf) })
      else if (p.inr < 1.5) push({ id: 'qr_inr_low', type: 'LAB', severity: 'orange', title: `INR ${p.inr} ต่ำกว่าเป้า (subtherapeutic)`, detail: `เสี่ยงลิ่มเลือด — ทวนขนาด warfarin${staleNote(p, 'inr')}`, drugs: icodes(warf) })
    } else {
      push({ id: 'qr_inr_missing', type: 'LAB', severity: 'yellow', title: 'ได้ warfarin แต่ไม่มีผล INR ล่าสุด', detail: 'ควรติดตาม INR', drugs: icodes(warf) })
    }
    const pot = inGroup(drugs, G.warfarin_potentiator)
    if (pot.length) push({ id: 'qr_warf_interact', type: 'DDI', severity: 'orange', title: `ยาเสริมฤทธิ์ warfarin: ${names(pot)}`, detail: 'อาจเพิ่ม INR/เสี่ยงเลือดออก — ติดตาม INR ใกล้ชิด', drugs: icodes(pot) })
  }

  // ---- 3.5 Potassium ----
  const kRaise = [...inGroup(drugs, G.acei), ...inGroup(drugs, G.arb), ...inGroup(drugs, G.k_sparing)]
  if (labs.k !== undefined) {
    if (labs.k > 5.5) {
      const culprits = [...kRaise, ...inGroup(drugs, /potassium|\bkcl\b|kalimate/), ...inGroup(drugs, G.nsaid)]
      push({ id: 'qr_hyperk', type: 'LAB', severity: 'red', title: `⚡ K⁺ ${labs.k} > 5.5 — Hyperkalemia`, detail: `${culprits.length ? 'ยาที่เพิ่ม K: ' + names(dedupe(culprits)) + ' → ' : ''}ระวัง arrhythmia${inGroup(drugs, G.digoxin).length ? ' (ได้ digoxin ด้วย!)' : ''}${staleNote(p, 'k')}`, recommendation: 'หยุด/ลดยาที่เพิ่ม K + ติดตาม K/EKG', drugs: icodes(dedupe(culprits.length ? culprits : drugs)) })
    } else if (labs.k < 3.0) {
      const dig = inGroup(drugs, G.digoxin)
      push({ id: 'qr_hypok', type: 'LAB', severity: dig.length ? 'red' : 'orange', title: `K⁺ ${labs.k} < 3.0 — Hypokalemia`, detail: `${dig.length ? '+ digoxin → เสี่ยง digoxin toxicity/QT · ' : ''}ทวน diuretic${staleNote(p, 'k')}`, drugs: icodes(dig.length ? dig : drugs) })
    }
  }
  // RAAS ซ้อน
  if (kRaise.length >= 2) push({ id: 'qr_raas_stack', type: 'DDI', severity: 'orange', title: `RAAS/K-sparing ${kRaise.length} ตัว: ${names(kRaise)}`, detail: 'เสี่ยง hyperkalemia สะสม — ติดตาม K', drugs: icodes(kRaise) })

  // ---- 3.4 Liver (AST/ALT/Albumin) ----
  const hepDrugs = inGroup(drugs, G.hepatotoxic)
  const astalt = Math.max(labs.ast ?? 0, labs.alt ?? 0)
  if (astalt > 120 && hepDrugs.length) {
    push({ id: 'qr_hepatotoxic', type: 'LAB', severity: 'orange', title: `🫀 AST/ALT สูง (${labs.ast ?? '-'}/${labs.alt ?? '-'}) + ยาพิษต่อตับ`, detail: `ยา: ${names(hepDrugs)} — >3×ULN พิจารณาหยุด/ติดตาม LFT${staleNote(p, (labs.ast ?? 0) >= (labs.alt ?? 0) ? 'ast' : 'alt')}`, recommendation: 'ทบทวนความจำเป็น + ติดตาม LFT', drugs: icodes(hepDrugs) })
  }
  if (labs.albumin !== undefined && labs.albumin < 3.0) {
    const pb = inGroup(drugs, G.protein_bound)
    if (pb.length) push({ id: 'qr_albumin_low', type: 'LAB', severity: 'orange', title: `Albumin ${labs.albumin} < 3.0 + ยา protein-bound`, detail: `${names(pb)} — free fraction เพิ่ม เสี่ยงพิษ (เช่น phenytoin corrected)${staleNote(p, 'albumin')}`, drugs: icodes(pb) })
  }

  // ---- 3.6 Platelet ----
  const bloodDrugs = dedupe([...warf, ...inGroup(drugs, G.doac), ...inGroup(drugs, G.antiplatelet), ...inGroup(drugs, G.aspirin), ...inGroup(drugs, G.heparin), ...inGroup(drugs, G.nsaid)])
  if (labs.plt !== undefined && bloodDrugs.length) {
    if (labs.plt < 50) push({ id: 'qr_plt_50', type: 'LAB', severity: 'red', title: `🩸 Plt ${labs.plt} < 50 + ยากลุ่มเลือด`, detail: `หลีกเลี่ยงยาต้านเกล็ดเลือด/กันเลือดแข็ง: ${names(bloodDrugs)} — ปรึกษาแพทย์${staleNote(p, 'plt')}`, recommendation: 'หยุด/ทบทวนยากลุ่มเลือด', drugs: icodes(bloodDrugs) })
    else if (labs.plt < 100) push({ id: 'qr_plt_100', type: 'LAB', severity: 'orange', title: `Plt ${labs.plt} < 100 + ยากลุ่มเลือด`, detail: `ระวังเลือดออก: ${names(bloodDrugs)}${staleNote(p, 'plt')}`, drugs: icodes(bloodDrugs) })
  }

  // ---- 3.7 ANC ----
  const marrow = inGroup(drugs, G.marrow_suppress)
  if (labs.anc !== undefined && marrow.length) {
    if (labs.anc < 500) push({ id: 'qr_anc_500', type: 'LAB', severity: 'red', title: `⚠ ANC ${labs.anc} < 500 — Agranulocytosis`, detail: `หยุดยาต้นเหตุทันที: ${names(marrow)} + ป้องกันติดเชื้อ${staleNote(p, 'anc')}`, recommendation: 'หยุดยา + high alert', drugs: icodes(marrow) })
    else if (labs.anc < 1500) push({ id: 'qr_anc_1500', type: 'LAB', severity: 'orange', title: `ANC ${labs.anc} < 1500 — Neutropenia`, detail: `เฝ้าระวัง: ${names(marrow)}${staleNote(p, 'anc')}`, drugs: icodes(marrow) })
  }

  // ---- 3.8 AEC (DRESS) ----
  if (labs.aec !== undefined && labs.aec > 1500) {
    push({ id: 'qr_aec_dress', type: 'ALLERGY', severity: 'orange', title: `AEC ${labs.aec} สูงมาก — สงสัย DRESS/แพ้ยา`, detail: `ทบทวนยาใหม่ทุกตัว (โดยเฉพาะ allopurinol/sulfa/anticonvulsant/vancomycin)${staleNote(p, 'aec')}`, recommendation: 'ประเมิน DRESS + หยุดยาต้องสงสัย', drugs: icodes(drugs) })
  }

  // ---- 3.3 Diabetes — รวม HbA1c + น้ำตาล เป็น card เดียว ----
  const su = inGroup(drugs, G.sulfonylurea)
  const dmDrugs = inGroup(drugs, G.antidiabetic)  // ยาเบาหวานทุกชนิด (มี=ทบทวน · ไม่มี=ควรเริ่ม)
  const a1cHi = labs.hba1c !== undefined && labs.hba1c > 9
  const fbsHi = labs.fbs !== undefined && labs.fbs > 250
  if (a1cHi || fbsHi) {
    const parts: string[] = []
    if (labs.hba1c !== undefined) parts.push(`HbA1c ${labs.hba1c}%`)
    if (labs.fbs !== undefined) parts.push(`FBS ${labs.fbs}`)
    const vals = parts.join(' · ')
    // มียาเบาหวานอยู่แล้ว → ทบทวนยา · ยังไม่มี → ควรเริ่มยาเบาหวาน (รวมเป็นจุดเดียว)
    if (dmDrugs.length) {
      push({ id: 'qr_dm', type: 'LAB', severity: 'yellow', title: `เบาหวานคุมไม่ได้ — ${vals}`, detail: `ทบทวนขนาดยา/ความร่วมมือ${staleNote(p, a1cHi ? 'hba1c' : 'fbs')}`, recommendation: 'ทบทวนแผนการรักษาเบาหวาน', drugs: icodes(dmDrugs) })
    } else {
      push({ id: 'qr_dm_gap', type: 'OMIT', severity: 'yellow', title: `น้ำตาลสูง (${vals}) แต่ยังไม่มียาเบาหวาน`, detail: `ควรพิจารณาเริ่มยาเบาหวาน${staleNote(p, a1cHi ? 'hba1c' : 'fbs')}`, recommendation: 'เริ่ม/เพิ่มยาเบาหวาน', drugs: [] })
    }
  }
  if (labs.fbs !== undefined && labs.fbs < 70 && dmDrugs.length) push({ id: 'qr_dm_hypo', type: 'LAB', severity: 'orange', title: `⚠️ น้ำตาลต่ำ ${labs.fbs} < 70 + ${su.length ? 'sulfonylurea' : 'insulin'}`, detail: `เสี่ยง hypoglycemia: ${names(dmDrugs)}${(p.age ?? 0) >= 65 ? ' (สูงอายุ — ระวังมาก)' : ''}${staleNote(p, 'fbs')}`, recommendation: 'ระวัง/ลดขนาด โดยเฉพาะไตเสื่อม/สูงอายุ', drugs: icodes(dmDrugs) })

  // ---- 3.9 G6PD deficient + oxidant ----
  const g6pdDef = p.g6pd === true
  if (g6pdDef) {
    const ox = inGroup(drugs, G.g6pd_oxidant)
    if (ox.length) push({ id: 'qr_g6pd_ox', type: 'G6PD', severity: 'red', title: `🩸 G6PD พร่อง + ยา oxidant: ${names(ox)}`, detail: 'เสี่ยง hemolysis — ห้ามใช้', recommendation: 'เปลี่ยนยา', drugs: icodes(ox) })
  }

  // ---- 3.1 Renal generic (เสริม renalDoseRef) ----
  const rv = renalValue(p)
  if (rv !== undefined) {
    const met = inGroup(drugs, G.metformin)
    if (rv < 30 && met.length) push({ id: 'qr_metformin_renal', type: 'RENAL', severity: 'red', title: `🚫 Metformin + ${p.egfr !== undefined ? 'CrCl' : 'GFR'} ${rv} < 30`, detail: 'ห้ามใช้ — เสี่ยง lactic acidosis', recommendation: 'หยุด metformin', drugs: icodes(met) })
    if (rv < 30) {
      const nsaidR = inGroup(drugs, G.nsaid)
      if (nsaidR.length) push({ id: 'qr_nsaid_renal', type: 'RENAL', severity: 'red', title: `🚫 NSAID + ไตเสื่อมรุนแรง (${rv})`, detail: `หลีกเลี่ยง: ${names(nsaidR)} — เสี่ยง AKI/K⁺สูง`, recommendation: 'เปลี่ยนเป็น paracetamol', drugs: icodes(nsaidR) })
    }
  }

  // ===== 4. กฎผสม =====
  const nsaid = inGroup(drugs, G.nsaid)
  const raas = [...inGroup(drugs, G.acei), ...inGroup(drugs, G.arb)]
  const diuretic = [...inGroup(drugs, G.diuretic_loop), ...inGroup(drugs, G.diuretic_thiazide)]

  // 4.1 Triple Whammy
  if (nsaid.length && raas.length && diuretic.length) {
    push({ id: 'qr_triple_whammy', type: 'RENAL', severity: 'red', title: '🔺 Triple Whammy — NSAID + RAAS + Diuretic', detail: `${names([...nsaid, ...raas, ...diuretic])} → เสี่ยงไตวายเฉียบพลัน (AKI)`, recommendation: 'ทบทวน/หยุด NSAID', drugs: icodes(dedupe([...nsaid, ...raas, ...diuretic])) })
  }

  // 4.2 Bleeding stack
  if (bloodDrugs.length >= 2) {
    const critical = labs.plt !== undefined && labs.plt < 100 || (labs.hb !== undefined && labs.hb < 8) || (p.inr !== undefined && p.inr > 4)
    push({ id: 'qr_bleed_stack', type: 'DDI', severity: critical ? 'red' : 'orange', title: `🩸 ยากลุ่มเลือด ${bloodDrugs.length} ตัวร่วมกัน`, detail: `${names(bloodDrugs)}${critical ? ' + lab เสี่ยง (Plt/Hb ต่ำ หรือ INR สูง)' : ''} → เสี่ยงเลือดออก`, recommendation: 'ทบทวนความจำเป็นของยาต้านเกล็ดเลือด/กันเลือดแข็ง', drugs: icodes(bloodDrugs) })
  }

  // 4.3 QT prolongation
  if (labs.k !== undefined && labs.k < 3.5) {
    const qt = inGroup(drugs, G.qt)
    if (qt.length) push({ id: 'qr_qt', type: 'DDI', severity: inGroup(drugs, G.digoxin).length ? 'red' : 'orange', title: `⚡ K⁺ ต่ำ (${labs.k}) + ยา QT-prolong`, detail: `${names(qt)}${inGroup(drugs, G.digoxin).length ? ' + digoxin' : ''} → เสี่ยง QT/arrhythmia`, recommendation: 'แก้ K + ติดตาม EKG', drugs: icodes(qt) })
  }

  // 4.4 CNS depression (สูงอายุ)
  if ((p.age ?? 0) >= 65) {
    const cns = dedupe([...inGroup(drugs, G.opioid), ...inGroup(drugs, G.bzd), ...inGroup(drugs, G.gabapentinoid)])
    if (cns.length >= 2) push({ id: 'qr_cns', type: 'BEERS', severity: 'orange', title: `💤 ยากดประสาท ${cns.length} ตัว + สูงอายุ`, detail: `${names(cns)} → เสี่ยง over-sedation/หกล้ม`, recommendation: 'ลดจำนวน/ขนาดยากดประสาท', drugs: icodes(cns) })
  }

  // ===== Care gap — ค่าแล็บผิดปกติ แต่ยังไม่มียาที่ควรได้ (untreated indication) =====
  // K ต่ำ + ยังไม่มี KCl/K supplement (kalimate = ยาลด K ไม่นับ)
  const hasKSupp = inGroup(drugs, /potassium\s*chlor|\bkcl\b|k\.?c\.?l|potassium\s*(gluconate|citrate|bicarb)|เกลือแร่โพแทส/).length > 0
  if (labs.k !== undefined && labs.k < 3.5 && !hasKSupp) {
    push({ id: 'qr_gap_kcl', type: 'OMIT', severity: labs.k < 3.0 ? 'orange' : 'yellow', title: `💊 K⁺ ต่ำ (${labs.k}) แต่ยังไม่มียาโพแทสเซียม`, detail: `ควรพิจารณาให้ KCl / K supplement ทดแทน${staleNote(p, 'k')}`, recommendation: 'พิจารณาเพิ่ม KCl (ปรับตามระดับ K + การทำงานของไต + ทางให้ยา)', drugs: [] })
  }
  // Mg ต่ำ + ยังไม่มี Mg
  const hasMg = inGroup(drugs, /magnesium|แมกนีเซียม/).length > 0
  if (labs.mg !== undefined && labs.mg < 1.7 && !hasMg) {
    push({ id: 'qr_gap_mg', type: 'OMIT', severity: 'yellow', title: `💊 Mg ต่ำ (${labs.mg}) แต่ยังไม่มี Mg`, detail: `ควรพิจารณาให้ magnesium ทดแทน (โดยเฉพาะถ้า K ต่ำร่วมด้วย)${staleNote(p, 'mg')}`, recommendation: 'พิจารณาเพิ่ม magnesium', drugs: [] })
  }
  // (DM care-gap รวมอยู่ใน 3.3 แล้ว — ถ้าน้ำตาลสูง+ไม่มียาเบาหวาน จะเตือน "ควรเริ่มยา")
  // K สูงมาก แต่ยังไม่มี treatment ลด K
  const hasKLower = inGroup(drugs, /kalimate|polystyrene|calcium\s*gluconate|sodium\s*bicarb|dextrose|insulin/).length > 0
  if (labs.k !== undefined && labs.k > 6.0 && !hasKLower) {
    push({ id: 'qr_gap_hyperk', type: 'OMIT', severity: 'orange', title: `💊 K⁺ สูงวิกฤต (${labs.k}) แต่ยังไม่มี treatment ลด K`, detail: `ควรพิจารณา kalimate / calcium gluconate / insulin+glucose${staleNote(p, 'k')}`, recommendation: 'จัดการ hyperkalemia ตาม protocol', drugs: [] })
  }

  return a
}

function dedupe(list: DrugEntry[]): DrugEntry[] {
  const seen = new Set<string>()
  return list.filter((d) => (seen.has(d.icode) ? false : (seen.add(d.icode), true)))
}
