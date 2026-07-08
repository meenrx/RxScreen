/**
 * ฐานอ้างอิงคลินิก (built-in, generic-based) — ทำงานโดยไม่ต้องติ๊ก flag รายตัวใน DRUG_MASTER
 * จับคู่ด้วย generic_name (+ ชื่อยา) แหล่งอ้างอิงล่าสุด:
 *  - Beers: 2023 AGS Beers Criteria (J Am Geriatr Soc 2023)
 *  - Do-not-crush: ISMP Oral Dosage Forms That Should Not Be Crushed (2024)
 *  - G6PD: G6PDdeficiency.org / Luzzatto & Arese NEJM 2018 / Youngster 2010
 *  - Lactation: LactMed (NIH) / Hale's Medications & Mothers' Milk
 *  - Teratogen: FDA / TERIS / Briggs Drugs in Pregnancy & Lactation
 *
 * ⚠️ เป็นแนวทาง — เภสัชกรใช้ประกอบดุลยพินิจร่วมกับบริบทผู้ป่วย
 */

export interface RefEntry {
  re: RegExp
  note: string
}

/** ข้อความรวม generic + ชื่อยา (lowercase) สำหรับ match */
export function drugText(generic?: string, name?: string): string {
  return `${generic ?? ''} ${name ?? ''}`.toLowerCase()
}
export function findRef<T extends { re: RegExp }>(list: T[], generic?: string, name?: string): T | undefined {
  const hay = drugText(generic, name)
  return list.find((e) => e.re.test(hay))
}

// ================= Beers 2023 (avoid ในผู้สูงอายุ ≥65) =================
export const BEERS_2023: RefEntry[] = [
  { re: /chlorpheniramine|brompheniramine|diphenhydramine|dimenhydrinate|hydroxyzine|cyproheptadine|promethazine|chlorphenamine|cpm\b/, note: 'antihistamine รุ่นเก่า (anticholinergic) — สับสน/ท้องผูก/ปัสสาวะคั่ง' },
  { re: /amitriptyline|nortriptyline|imipramine|doxepin|clomipramine/, note: 'TCA (anticholinergic + hypotension) — เลี่ยงในสูงอายุ' },
  { re: /diazepam|lorazepam|alprazolam|clonazepam|chlordiazepoxide|midazolam|nitrazepam|temazepam/, note: 'benzodiazepine — เสี่ยงหกล้ม/สับสน' },
  { re: /zolpidem|zopiclone|eszopiclone/, note: 'Z-drug — เสี่ยงหกล้ม/สับสน' },
  { re: /glibenclamide|glyburide|chlorpropamide/, note: 'sulfonylurea ออกฤทธิ์นาน — hypoglycemia ยืดเยื้อ (ใช้ glipizide แทน)' },
  { re: /indomethacin|ketorolac/, note: 'NSAID เสี่ยงสูง — GI bleed/AKI (เลี่ยงในสูงอายุ)' },
  { re: /ibuprofen|naproxen|diclofenac|mefenamic|piroxicam|meloxicam|celecoxib|etoricoxib/, note: 'NSAID — เลี่ยงใช้ต่อเนื่อง (GI bleed/AKI/HF)' },
  { re: /orphenadrine|methocarbamol|cyclobenzaprine|tolperisone|chlorzoxazone|carisoprodol/, note: 'muscle relaxant — anticholinergic/ง่วง เสี่ยงหกล้ม' },
  { re: /haloperidol|risperidone|quetiapine|olanzapine|chlorpromazine/, note: 'antipsychotic — เพิ่มความเสี่ยง stroke/เสียชีวิตใน dementia' },
  { re: /dicyclomine|hyoscyamine|hyoscine|oxybutynin|tolterodine|solifenacin|atropine|belladonna/, note: 'anticholinergic — สับสน/ปัสสาวะคั่ง/ท้องผูก' },
  { re: /metoclopramide/, note: 'เสี่ยง extrapyramidal/tardive dyskinesia — เลี่ยงใช้ต่อเนื่อง' },
  { re: /nitrofurantoin/, note: 'เลี่ยงถ้า CrCl < 30 / ใช้ต่อเนื่อง — pulmonary/hepatic toxicity' },
  { re: /amiodarone/, note: 'ไม่ใช่ first-line AF ในสูงอายุ (toxicity หลายระบบ)' },
  { re: /digoxin/, note: 'เลี่ยง > 0.125 mg/วัน — เสี่ยง toxicity' },
  { re: /doxazosin|prazosin|terazosin/, note: 'alpha-blocker — orthostatic hypotension เสี่ยงหกล้ม' },
]

// ================= ห้ามบด/เคี้ยว (ISMP Do-Not-Crush 2024) =================
// จับจากรูปแบบออกฤทธิ์นาน/เคลือบ + ยาเฉพาะ
export const NO_CRUSH: RefEntry[] = [
  { re: /\b(sr|er|xr|cr|mr|xl|la|sa|prolonged|sustained|extended|controlled)\b|ออกฤทธิ์นาน|ค่อยๆ|เอสอาร์/, note: 'ยาออกฤทธิ์นาน (SR/ER) — ห้ามบด/เคี้ยว/หัก' },
  { re: /enteric|\bec\b|เคลือบ|gastro-?resistant|delayed.?release/, note: 'ยาเคลือบ enteric — ห้ามบด (จะถูกทำลายในกระเพาะ/ระคายเคือง)' },
  { re: /omeprazole|esomeprazole|pantoprazole|lansoprazole|rabeprazole|dexlansoprazole/, note: 'PPI เคลือบ enteric — กลืนทั้งเม็ด (เปิด cap โรยได้บางชนิด)' },
  { re: /mycophenolate/, note: 'ห้ามบด — teratogen/ระคายเยื่อบุ' },
  { re: /diltiazem|verapamil|nifedipine|felodipine|isosorbide.?mononitrate|isosorbide.?dinitrate/, note: 'รูปออกฤทธิ์นาน (ถ้าเป็น SR) — ห้ามบด' },
  { re: /tamsulosin|oxybutynin.*(er|xl)|metformin.*(xr|sr)|gliclazide.*mr|quetiapine.*xr/, note: 'ห้ามบด (ออกฤทธิ์นาน)' },
]

// ================= G6PD-unsafe (oxidant) =================
export const G6PD_UNSAFE = /primaquine|tafenoquine|methylene\s*blue|methylthioninium|rasburicase|dapsone|nitrofurantoin|sulfamethoxazole|co-?trimoxazole|sulfadiazine|sulfasalazine|sulfacetamide|phenazopyridine|nalidixic|toluidine|methyldopa|primaquin/

// ================= ห้าม/เลี่ยงในหญิงให้นม (LactMed) =================
export const LACTATION_AVOID: RefEntry[] = [
  { re: /amiodarone/, note: 'iodine สะสม + t½ ยาวมาก — เลี่ยง' },
  { re: /methotrexate|cyclophosphamide|azathioprine|mycophenolate|chemotherapy|cytotoxic/, note: 'cytotoxic — ห้ามให้นม' },
  { re: /lithium/, note: 'ผ่านน้ำนมสูง — เลี่ยง/ติดตามระดับทารก' },
  { re: /isotretinoin|acitretin|retinoid/, note: 'retinoid — ห้ามให้นม' },
  { re: /ergotamine|cabergoline|bromocriptine/, note: 'ลดน้ำนม + ergot toxicity — เลี่ยง' },
  { re: /codeine|tramadol/, note: 'CYP2D6 ultra-rapid → เสี่ยงกดหายใจทารก — เลี่ยง' },
  { re: /(atorva|simva|rosuva|prava|lova)statin/, note: 'statin — เลี่ยงในระยะให้นม' },
  { re: /chloramphenicol/, note: 'เสี่ยง bone marrow ทารก — เลี่ยง' },
]

// ================= ต้องใช้ IBW คำนวณขนาด =================
export const IBW_REQUIRED = /gentamicin|amikacin|tobramycin|streptomycin|kanamycin|netilmicin|vancomycin/

// ================= Teratogen (Pregnancy D/X) =================
export interface TeratEntry { re: RegExp; cat: 'X' | 'D'; note: string }
export const TERATOGEN: TeratEntry[] = [
  { re: /warfarin/, cat: 'X', note: 'warfarin embryopathy — ห้ามในไตรมาสแรก (ใช้ heparin/LMWH แทน)' },
  { re: /isotretinoin|acitretin|etretinate/, cat: 'X', note: 'retinoid — teratogen รุนแรง ห้ามเด็ดขาด' },
  { re: /(atorva|simva|rosuva|prava|lova|pitava|fluva)statin/, cat: 'X', note: 'statin — หยุดในหญิงตั้งครรภ์' },
  { re: /methotrexate|leflunomide|mycophenolate|thalidomide|misoprostol|mifepristone/, cat: 'X', note: 'teratogen/abortifacient — ห้ามใช้' },
  { re: /finasteride|dutasteride/, cat: 'X', note: 'เพศชายผิดปกติ — ห้ามในหญิงตั้งครรภ์' },
  { re: /ethinyl|estradiol|levonorgestrel|desogestrel/, cat: 'X', note: 'ฮอร์โมนเพศ — ไม่ใช้ขณะตั้งครรภ์' },
  { re: /\w*pril\b|\w*sartan\b/, cat: 'D', note: 'ACEI/ARB — พิษต่อไตทารก (ไตรมาส 2-3) หยุดยา' },
  { re: /valproate|valproic/, cat: 'D', note: 'neural tube defect สูง — เลี่ยง' },
  { re: /phenytoin|carbamazepine|phenobarbital/, cat: 'D', note: 'anticonvulsant — เสี่ยงพิการแต่กำเนิด (เสริม folate)' },
  { re: /lithium/, cat: 'D', note: 'Ebstein anomaly — ระวัง' },
  { re: /(gentamicin|amikacin|streptomycin|tobramycin|kanamycin)/, cat: 'D', note: 'aminoglycoside — เสี่ยงหูทารกหนวก' },
  { re: /tetracycline|doxycycline|minocycline/, cat: 'D', note: 'tetracycline — คราบฟัน/กระดูกทารก' },
  { re: /warfarin|methimazole|carbimazole/, cat: 'D', note: 'ระวังพิษต่อทารก' },
  { re: /ibuprofen|naproxen|diclofenac|indomethacin|mefenamic|piroxicam|meloxicam/, cat: 'D', note: 'NSAID ไตรมาส 3 — ปิด ductus arteriosus ก่อนกำหนด' },
]

// ================= ขนาดสูงสุดต่อวันในผู้ใหญ่ (mg/day) =================
// อ้างอิง Lexicomp / BNF (usual adult maximum). ใช้เตือน overdose จากขนาดที่แพทย์สั่งจริง
// ไม่รวม: ยา titrate ตามระดับ/น้ำหนัก (warfarin/insulin/morphine/lithium level), corticosteroid,
//        สมุนไพร, ยาทา/ตา/หู, สารน้ำ/เกลือแร่, วิตามิน, ARV สูตรผสม, ยา course-based
export interface MaxDoseEntry { re: RegExp; max: number; note?: string }
export const MAX_DOSE_ADULT: MaxDoseEntry[] = [
  // ── ยาแก้ปวด/NSAID ──
  { re: /paracetamol|acetaminophen/, max: 4000, note: 'ตับ/สูงอายุ ลดเหลือ 3000; รวมทุกแหล่ง' },
  { re: /ibuprofen/, max: 2400 },
  { re: /naproxen/, max: 1000 },
  { re: /diclofenac/, max: 150 },
  { re: /mefenamic/, max: 1500 },
  { re: /\baspirin\b/, max: 4000, note: 'ขนาดต้านเกล็ดเลือด 81–325 mg ปกติ' },
  { re: /tramadol/, max: 400 },
  { re: /colchicine/, max: 1.8, note: 'พิษง่าย — ลดในไต/ตับเสื่อม' },
  // ── หัวใจ/ความดัน ──
  { re: /amlodipine/, max: 10 },
  { re: /manidipine/, max: 20 },
  { re: /nifedipine/, max: 120 },
  { re: /\benalapril\b/, max: 40 },
  { re: /captopril/, max: 150 },
  { re: /losartan/, max: 100 },
  { re: /hydralazine/, max: 300 },
  { re: /methyldopa/, max: 3000 },
  { re: /doxazosin/, max: 16 },
  { re: /prazosin/, max: 20 },
  { re: /carvedilol/, max: 50 },
  { re: /metoprolol/, max: 400 },
  { re: /propranolol/, max: 320 },
  { re: /furosemide/, max: 600 },
  { re: /hydrochlorothiazide/, max: 100 },
  { re: /spironolactone/, max: 400 },
  { re: /mononitrate/, max: 240 },
  { re: /dinitrate/, max: 160 },
  { re: /digoxin/, max: 0.5, note: 'maintenance ปกติ 0.125–0.25 mg/วัน' },
  { re: /simvastatin/, max: 40 },
  { re: /atorvastatin/, max: 80 },
  { re: /rosuvastatin/, max: 40 },
  { re: /gemfibrozil/, max: 1200 },
  // ── เบาหวาน ──
  { re: /metformin/, max: 2550 },
  { re: /glipizide/, max: 40 },
  { re: /pioglitazone/, max: 45 },
  // ── ต่อมไทรอยด์ ──
  { re: /methimazol/, max: 60 },
  { re: /propylthiouracil/, max: 900 },
  { re: /finasteride/, max: 5 },
  // ── ระบบประสาท/จิตเวช/กันชัก ──
  { re: /phenytoin/, max: 600 },
  { re: /phenobarb/, max: 300 },
  { re: /valproate|valproic/, max: 3000 },
  { re: /levetiracetam/, max: 3000 },
  { re: /topiramate/, max: 400 },
  { re: /gabapentin/, max: 3600 },
  { re: /clonazepam/, max: 20 },
  { re: /\bdiazepam\b/, max: 40 },
  { re: /lorazepam/, max: 10 },
  { re: /clorazepate/, max: 90 },
  { re: /amitriptyline/, max: 150 },
  { re: /trazodone/, max: 600 },
  { re: /sertraline/, max: 200 },
  { re: /fluox/, max: 80 },
  { re: /haloperidol/, max: 30 },
  { re: /chlo?rpromazine/, max: 2000 },
  { re: /perphenazine/, max: 64 },
  { re: /trifluoperazine/, max: 40 },
  { re: /thioridazine/, max: 800 },
  { re: /quetiapine/, max: 800 },
  { re: /risperidone/, max: 16 },
  { re: /clozapine/, max: 900 },
  { re: /baclofen/, max: 80 },
  { re: /tolperisone/, max: 450 },
  { re: /benhexol|trihexyphenidyl/, max: 15 },
  { re: /flunarizine/, max: 10 },
  { re: /betahistine/, max: 48 },
  { re: /pyridostigmine/, max: 1500 },
  // ── ยาปฏิชีวนะ/เชื้อรา/ไวรัส (กิน) ──
  { re: /amoxicillin.*clav|clavulanic/, max: 1750, note: 'คิดเป็น amoxicillin' },
  { re: /amoxicillin|amoxycillin/, max: 4000 },
  { re: /dicloxacillin/, max: 2000 },
  { re: /cloxacillin/, max: 4000 },
  { re: /\bpenicillin\b/, max: 2000 },
  { re: /azithromycin/, max: 500 },
  { re: /clarithromycin/, max: 1000 },
  { re: /erythromycin/, max: 2000 },
  { re: /roxithromycin/, max: 300 },
  { re: /clindamycin/, max: 1800 },
  { re: /ciprofloxacin/, max: 1500 },
  { re: /levofloxacin/, max: 750 },
  { re: /norfloxacin/, max: 800 },
  { re: /ofloxacin/, max: 800 },
  { re: /metronidazole/, max: 4000 },
  { re: /doxycycline/, max: 200 },
  { re: /chloramphenicol/, max: 4000 },
  { re: /fluconazole/, max: 800 },
  { re: /itraconazole/, max: 400 },
  { re: /acyclovir/, max: 4000 },
  { re: /oseltamivir/, max: 150 },
  { re: /albendazole/, max: 800 },
  { re: /isoniazid/, max: 300 },
  { re: /rifamp/, max: 600 },
  { re: /pyrazinamide/, max: 2000 },
  { re: /quinine/, max: 1950 },
  { re: /primaquine/, max: 30 },
  // ── ทางเดินอาหาร ──
  { re: /omeprazole/, max: 80 },
  { re: /famotidine/, max: 80 },
  { re: /domperidone/, max: 30, note: 'EMA จำกัด; ระวัง QT' },
  { re: /misoprostol/, max: 800 },
  { re: /dicyclomine/, max: 160 },
  { re: /hyoscine/, max: 80 },
  // ── ทางเดินหายใจ/แก้ไอ/แพ้ ──
  { re: /theophylline/, max: 900, note: 'narrow index — คิดตามน้ำหนัก ~10 mg/kg' },
  { re: /\bsalbutamol\b/, max: 32, note: 'ชนิดกิน' },
  { re: /ambroxol/, max: 120 },
  { re: /carbocy?steine/, max: 2250 },
  { re: /dextromethorphan/, max: 120 },
  { re: /guaiac|guaifenesin/, max: 2400 },
  { re: /dimenhydrinate/, max: 400 },
  { re: /cetirizine/, max: 20 },
  { re: /hydroxyzine/, max: 400 },
  { re: /chlorpheniramine/, max: 24 },
  { re: /brompheniramine/, max: 24 },
  // ── อื่น ๆ ──
  { re: /allopurinol/, max: 800 },
  { re: /tranexamic/, max: 6000 },
  { re: /acetazolamide/, max: 1000 },
]

export function findMaxDose(generic?: string, name?: string): MaxDoseEntry | undefined {
  return findRef(MAX_DOSE_ADULT, generic, name)
}

/** ยาที่ให้ "สัปดาห์ละครั้ง" — ถ้าสั่งรายวันคือผิดร้ายแรง */
export const WEEKLY_DOSING = /methotrexate/

// ================= ขนาดยาวัณโรค (H/R/Z/E) ตามน้ำหนัก — ผู้ใหญ่ >15 ปี =================
// อ้างอิง แนวทางการควบคุมวัณโรคประเทศไทย (DDC) ตารางขนาดยาแนะนำสำหรับผู้ใหญ่
// น้ำหนัก 35-70 กก. ใช้ขนาดตามช่วง · <35 หรือ >70 คำนวณตามน้ำหนัก (mg/kg)
export interface TbDoseRef { re: RegExp; label: string; perKg: string; dose: (wt: number) => { mg: number; byWeight?: boolean } }
export const TB_DOSE: TbDoseRef[] = [
  { re: /isoniazid|\binh\b/i, label: 'Isoniazid (H)', perKg: '4-6 มก./กก./วัน (สูงสุด 300)',
    dose: (w) => w < 35 ? { mg: Math.min(300, Math.round(5 * w)), byWeight: true } : { mg: 300 } },
  { re: /rifampicin|rifampin/i, label: 'Rifampicin (R)', perKg: '8-12 มก./กก./วัน (สูงสุด 600)',
    dose: (w) => w < 35 ? { mg: Math.round(10 * w), byWeight: true } : w <= 49 ? { mg: 450 } : { mg: 600 } },
  { re: /pyrazinamide/i, label: 'Pyrazinamide (Z)', perKg: '20-30 มก./กก./วัน',
    dose: (w) => w < 35 ? { mg: Math.round(25 * w), byWeight: true } : w <= 49 ? { mg: 1000 } : w <= 69 ? { mg: 1500 } : { mg: 2000 } },
  { re: /ethambutol/i, label: 'Ethambutol (E)', perKg: '15-20 มก./กก./วัน',
    dose: (w) => w < 35 ? { mg: Math.round(17.5 * w), byWeight: true } : w <= 49 ? { mg: 800 } : w <= 69 ? { mg: 1000 } : { mg: 1200 } },
]
export function findTbDose(generic?: string, name?: string): TbDoseRef | undefined {
  const hay = `${generic ?? ''} ${name ?? ''}`
  return TB_DOSE.find((t) => t.re.test(hay))
}

// ================= IV Y-site compatibility (คู่ที่เข้ากันไม่ได้) =================
// อ้างอิง Trissel's Handbook on Injectable Drugs (ASHP) + King Guide to Parenteral Admixtures
// รวมเฉพาะคู่ที่พบบ่อย/สำคัญในบัญชียาฉีด รพช. — severe=ตกตะกอน/ห้ามเด็ดขาด
export interface YSitePair { a: RegExp; b: RegExp; note: string; severe?: boolean }
export const YSITE_INCOMPAT: YSitePair[] = [
  // แคลเซียม/สารน้ำมีแคลเซียม
  { a: /ceftriaxone/, b: /calcium|ringer|hartmann|\bLRS?\b|acetated?\s*ringer/i, note: 'Ceftriaxone + แคลเซียม/Ringer’s lactate → ตกตะกอน ceftriaxone-calcium (FDA warning; อันตรายในทารก)', severe: true },
  { a: /sodium\s*bicarb|bicarbonate|NaHCO3/i, b: /calcium/, note: 'Sodium bicarbonate + แคลเซียม → ตกตะกอน CaCO₃', severe: true },
  { a: /calcium/, b: /phosphate|phosphat/i, note: 'Calcium + phosphate → ตกตะกอน calcium phosphate', severe: true },
  // Sodium bicarbonate / ด่าง กับ catecholamine + others
  { a: /sodium\s*bicarb|bicarbonate/i, b: /norepinephrine|noradrenaline|adrenaline|epinephrine|dopamine|dobutamine|midazolam|morphine/, note: 'Sodium bicarbonate (ด่าง) ทำให้ catecholamine เสื่อมฤทธิ์ / ตกตะกอน — ให้แยกสาย', severe: true },
  // Aminoglycoside + beta-lactam (inactivation) และ heparin
  { a: /gentamicin|amikacin|tobramycin|streptomycin/, b: /ampicillin|penicillin|cloxacillin|piperacillin|ceftriaxone|cefazolin|cefotaxime|ceftazidime/, note: 'Aminoglycoside + beta-lactam → inactivation ถ้าผสม/สายเดียว — ให้แยกเวลา/แยกสาย' },
  { a: /gentamicin|amikacin|tobramycin/, b: /heparin/, note: 'Aminoglycoside + heparin → เข้ากันไม่ได้' },
  // Heparin / Enoxaparin
  { a: /heparin/, b: /amiodarone|ciprofloxacin|levofloxacin|haloperidol|labetalol|dobutamine|gentamicin|amikacin|vancomycin/, note: 'Heparin เข้ากันไม่ได้กับยานี้ (Trissel) — แยกสาย' },
  // Amiodarone
  { a: /amiodarone/, b: /sodium\s*bicarb|bicarbonate|aminophylline|furosemide|heparin|piperacillin/, note: 'Amiodarone เข้ากันไม่ได้ (ตกตะกอน/เสื่อม) — ให้ใน D5W สายแยก', severe: true },
  // Furosemide (ด่าง) กับยากรด
  { a: /furosemide/, b: /midazolam|ondansetron|metoclopramide|ciprofloxacin|levofloxacin|labetalol|diltiazem|dobutamine|dopamine|morphine|gentamicin|hydralazine|amiodarone/, note: 'Furosemide (ด่าง) + ยากรด → ตกตะกอน — แยกสาย + flush', severe: true },
  // Vancomycin
  { a: /vancomycin/, b: /heparin|ceftriaxone|cefepime|cefazolin|cloxacillin|piperacillin|sodium\s*bicarb|bicarbonate/, note: 'Vancomycin + beta-lactam/heparin/ด่าง → ตกตะกอน — แยกสาย' },
  // Ciprofloxacin/Levofloxacin
  { a: /ciprofloxacin|levofloxacin/, b: /aminophylline|theophylline|furosemide|heparin|phenytoin/, note: 'Fluoroquinolone เข้ากันไม่ได้กับยานี้' },
  // Dobutamine / Dopamine
  { a: /dobutamine/, b: /sodium\s*bicarb|bicarbonate|furosemide|heparin|phenytoin|aminophylline|acyclovir/, note: 'Dobutamine เข้ากันไม่ได้ (ด่าง/ตกตะกอน)' },
  { a: /dopamine|norepinephrine|noradrenaline/, b: /aminophylline|phenytoin|furosemide/, note: 'Catecholamine เข้ากันไม่ได้กับยานี้' },
  // Midazolam
  { a: /midazolam/, b: /omeprazole|pantoprazole|dexamethasone|sodium\s*bicarb|bicarbonate|furosemide/, note: 'Midazolam เข้ากันไม่ได้ (ตกตะกอน) — แยกสาย' },
  // PPI (ต้องให้เดี่ยวใน NS)
  { a: /omeprazole|pantoprazole|esomeprazole/, b: /calcium|midazolam|dobutamine|norepinephrine|adrenaline|epinephrine|vancomycin/, note: 'PPI ฉีด ให้เดี่ยวใน NS — เข้ากันไม่ได้กับยานี้' },
  // Hydralazine
  { a: /hydralazine/, b: /furosemide|aminophylline|dextrose|hydrocortisone/, note: 'Hydralazine เข้ากันไม่ได้กับยานี้' },
  // Acyclovir (ด่าง)
  { a: /acyclovir/, b: /dobutamine|dopamine|morphine|ondansetron|diazepam/, note: 'Acyclovir (ด่าง) เข้ากันไม่ได้ — แยกสาย' },
]

/** ยาฉีดที่ "เข้ากันไม่ได้กับยาฉีดส่วนใหญ่" → ควรให้แยกสายเสมอ */
export const YSITE_SOLO: { re: RegExp; note: string }[] = [
  { re: /phenytoin/, note: 'Phenytoin ตกตะกอนกับยาฉีดส่วนใหญ่ + สารละลาย dextrose — ให้ใน NS สายเดี่ยว + flush ก่อน/หลัง' },
  { re: /diazepam/, note: 'Diazepam (ตัวทำละลายพิเศษ) ตกตะกอนง่ายมาก — ฉีดช้าสายตรง ห้ามผสม/ห้ามเจือ' },
]

// ================= ขนาดยาผู้ใหญ่ที่คิดตามน้ำหนัก (นอกจากวัณโรค) =================
// อ้างอิง Lexicomp / Sanford / IDSA — คำนวณจากน้ำหนักผู้ป่วยเป็นค่าแนะนำ (ปรับตาม CrCl/level)
export interface AdultWtDoseRef { re: RegExp; label: string; text: (wt: number) => string }
const r0 = (n: number) => Math.round(n)
export const ADULT_WT_DOSE: AdultWtDoseRef[] = [
  { re: /enoxaparin/, label: 'Enoxaparin', text: (w) => `รักษา: 1 mg/kg SC q12h → ${r0(w)} mg q12h (หรือ 1.5 mg/kg OD → ${r0(1.5 * w)} mg) · ป้องกัน 40 mg SC OD · CrCl<30 → 1 mg/kg OD` },
  { re: /gentamicin|tobramycin/, label: 'Gentamicin/Tobramycin', text: (w) => `Extended-interval 5-7 mg/kg/วัน → ${r0(5 * w)}-${r0(7 * w)} mg OD · conventional 1.7 mg/kg q8h → ${r0(1.7 * w)} mg · ปรับตาม CrCl · ใช้ IBW/AdjBW ถ้าอ้วน` },
  { re: /amikacin/, label: 'Amikacin', text: (w) => `15 mg/kg/วัน → ${r0(15 * w)} mg OD (extended-interval) · ปรับตาม CrCl · ใช้ IBW/AdjBW ถ้าอ้วน` },
  { re: /vancomycin/, label: 'Vancomycin', text: (w) => `15-20 mg/kg/ครั้ง (ABW) → ${r0(15 * w)}-${r0(20 * w)} mg q8-12h · loading 25-30 mg/kg → ${r0(25 * w)}-${r0(30 * w)} mg · ปรับตาม level/CrCl` },
]
export function findAdultWtDose(generic?: string, name?: string): AdultWtDoseRef | undefined {
  const hay = `${generic ?? ''} ${name ?? ''}`
  return ADULT_WT_DOSE.find((x) => x.re.test(hay))
}
