/**
 * Therapeutic Drug Monitoring (TDM) — common calculators
 */

// ====== Phenytoin — albumin-corrected level (Sheiner-Tozer) ======
export function phenytoinCorrected(measured: number, albumin: number, crcl?: number): number {
  // ปกติ: corrected = measured / (0.2 × albumin + 0.1)
  // ESRD (CrCl <10): corrected = measured / (0.1 × albumin + 0.1)
  if (crcl !== undefined && crcl < 10) {
    return +(measured / (0.1 * albumin + 0.1)).toFixed(2)
  }
  return +(measured / (0.2 * albumin + 0.1)).toFixed(2)
}

export function phenytoinInterpretation(corrected: number): { range: string; sev: 'red' | 'orange' | 'yellow' | 'green'; note: string } {
  if (corrected < 10) return { range: 'sub-therapeutic', sev: 'yellow', note: 'ขนาดต่ำกว่าช่วงรักษา — พิจารณาเพิ่มขนาด' }
  if (corrected <= 20) return { range: 'therapeutic', sev: 'green', note: 'อยู่ในช่วงรักษา (10-20 mcg/mL)' }
  if (corrected <= 30) return { range: 'high', sev: 'orange', note: 'สูงกว่าช่วงรักษา — เฝ้าระวัง nystagmus, ataxia' }
  return { range: 'toxic', sev: 'red', note: 'ระดับสูงเสี่ยง toxicity — coma, arrhythmia — หยุดยา + ส่งพบแพทย์' }
}

// ====== Vancomycin — trough interpretation ======
export function vancoTroughInterpretation(trough: number): { range: string; sev: 'red' | 'orange' | 'yellow' | 'green'; note: string } {
  if (trough < 10) return { range: 'sub-therapeutic', sev: 'orange', note: 'ต่ำเกินไป เสี่ยง resistance — เพิ่มขนาด/ลด interval' }
  if (trough <= 15) return { range: 'therapeutic (mild infection)', sev: 'green', note: 'เหมาะกับ infection ทั่วไป' }
  if (trough <= 20) return { range: 'therapeutic (serious infection)', sev: 'green', note: 'เหมาะกับ MRSA bacteremia, endocarditis, pneumonia' }
  if (trough <= 25) return { range: 'high', sev: 'orange', note: 'สูง — monitor SCr ทุก 2-3 วัน' }
  return { range: 'toxic', sev: 'red', note: 'เสี่ยง nephrotoxicity — หยุด 1-2 dose แล้ว recheck' }
}

// ====== Digoxin — level interpretation ======
export function digoxinInterpretation(level: number): { range: string; sev: 'red' | 'orange' | 'yellow' | 'green'; note: string } {
  if (level < 0.5) return { range: 'sub-therapeutic', sev: 'yellow', note: 'ต่ำกว่าช่วงรักษา — recheck timing (ควรเจาะ ≥6 ชม. หลัง dose)' }
  if (level <= 0.9) return { range: 'therapeutic (HF)', sev: 'green', note: 'เหมาะกับ Heart Failure (target 0.5-0.9)' }
  if (level <= 2.0) return { range: 'therapeutic (AF)', sev: 'green', note: 'เหมาะกับ Atrial Fibrillation (target 0.8-2.0)' }
  if (level <= 2.5) return { range: 'high', sev: 'orange', note: 'สูง — เฝ้าระวัง toxicity (คลื่นไส้, มอง vision สีเหลือง)' }
  return { range: 'toxic', sev: 'red', note: 'Toxic — หยุดยา + เช็ค K+, Mg++ + พิจารณา Digoxin immune Fab' }
}

// ====== Lithium ======
export function lithiumInterpretation(level: number): { range: string; sev: 'red' | 'orange' | 'yellow' | 'green'; note: string } {
  if (level < 0.5) return { range: 'sub-therapeutic', sev: 'yellow', note: 'ต่ำกว่าช่วงรักษา' }
  if (level <= 1.2) return { range: 'therapeutic', sev: 'green', note: 'อยู่ในช่วงรักษา (0.5-1.2 mEq/L)' }
  if (level <= 1.5) return { range: 'mild toxicity', sev: 'orange', note: 'เริ่มมี toxicity — tremor, GI upset' }
  if (level <= 2.0) return { range: 'moderate toxicity', sev: 'red', note: 'Toxicity ปานกลาง — confusion, drowsiness' }
  return { range: 'severe toxicity', sev: 'red', note: 'Severe — seizure, coma — hemodialysis indication' }
}

// ====== Vancomycin AUC24 (simplified Bayesian) ======
/** AUC24 ≈ (DailyDose / CrCl × 1.44) — for quick estimation only */
export function vancoAUC24(dailyDoseMg: number, crcl: number): number {
  if (crcl <= 0) return 0
  return +((dailyDoseMg / (crcl * 1.44 * 0.6)) * 100).toFixed(1)  // rough estimate
}

// ====== Aminoglycoside (Gentamicin/Amikacin) Peak/Trough ======
export interface AminoglycosideRange {
  drug: 'gentamicin' | 'amikacin' | 'tobramycin'
  peakTarget: string
  troughTarget: string
}

export const AMINO_RANGES: Record<string, AminoglycosideRange> = {
  gentamicin: { drug: 'gentamicin', peakTarget: '5-10 (conventional) / 15-20 (once daily)', troughTarget: '<2 (conv) / <1 (OD)' },
  tobramycin: { drug: 'tobramycin', peakTarget: '5-10 / 15-20', troughTarget: '<2 / <1' },
  amikacin: { drug: 'amikacin', peakTarget: '20-30 / 50-60', troughTarget: '<10 / <5' },
}
