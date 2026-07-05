-- ============================================================
--  RxScreen — ฐานข้อมูล "ทดสอบ" ในเครื่องนี้ (จำลอง HOSxP)
--  ให้ผู้สร้างระบบพัฒนา/ทดสอบได้โดยไม่ต้องต่อฐานจริงของ รพ.
--  ตารางตั้งชื่อ = ชื่อ VIEW จริง (rxs_*) → โค้ดแอปเหมือนกันทั้ง test/prod
--  ข้อมูลจำลองทั้งหมด (AN/HN สมมติ) — ไม่มีข้อมูลจริง
--  วิธีรัน: mysql -u root -p < test_hosxp_seed.sql   (MariaDB/MySQL ในเครื่อง)
-- ============================================================
CREATE DATABASE IF NOT EXISTS hos_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE hos_test;

DROP TABLE IF EXISTS rxs_admission, rxs_drug_order, rxs_lab, rxs_allergy, rxs_diagnosis;

CREATE TABLE rxs_admission (
  an VARCHAR(20), hn VARCHAR(20), ward VARCHAR(60),
  regdate DATE, dchdate DATE, spclty VARCHAR(40),
  age_years INT, sex CHAR(1),          -- '1'=ชาย '2'=หญิง (รหัส HOSxP)
  weight_kg DECIMAL(5,1)
);
CREATE TABLE rxs_drug_order (
  an VARCHAR(20), hn VARCHAR(20), icode VARCHAR(30),
  drug_name VARCHAR(150), generic_name VARCHAR(150), strength VARCHAR(40),
  qty DECIMAL(8,1), unit_code VARCHAR(20), usage_code VARCHAR(60), order_date DATE
);
CREATE TABLE rxs_lab (
  an VARCHAR(20), hn VARCHAR(20), lab_name VARCHAR(80),
  result VARCHAR(40), normal_value VARCHAR(60), report_date DATE
);
CREATE TABLE rxs_allergy (
  hn VARCHAR(20), agent VARCHAR(120), symptom VARCHAR(200), report_date DATE
);
CREATE TABLE rxs_diagnosis (
  an VARCHAR(20), hn VARCHAR(20), icd10 VARCHAR(10), diagtype VARCHAR(4)
);

-- ===== เคสทดสอบ (แต่ละ AN ทริกเกอร์กฎคัดกรองต่างกัน) =====
-- AN 6800001 : ผู้ใหญ่ 68/ชาย 60kg — warfarin + NSAID + INR สูง → DDI/เลือดออก
INSERT INTO rxs_admission VALUES
 ('6800001','000001','อายุรกรรมชาย',CURDATE(),NULL,'MED',68,'1',60.0),
 ('6800002','000002','อายุรกรรมหญิง',CURDATE(),NULL,'MED',72,'2',55.0),
 ('6800003','000003','กุมารเวช',CURDATE(),NULL,'PED',3,'1',14.0),
 ('6800004','000004','อายุรกรรมหญิง',CURDATE(),NULL,'MED',80,'2',48.0),
 ('6800005','000005','สูติกรรม',CURDATE(),NULL,'OBG',28,'2',60.0);

INSERT INTO rxs_drug_order (an,hn,icode,drug_name,generic_name,strength,qty,unit_code,usage_code,order_date) VALUES
 -- 6800001 warfarin + ibuprofen (+ omeprazole)
 ('6800001','000001','1600019','Warfarin 3mg','warfarin','3 mg',30,'TAB','1x1 pc',CURDATE()),
 ('6800001','000001','1430508','Ibuprofen','ibuprofen','400 mg',30,'TAB','1x3 pc',CURDATE()),
 -- 6800002 metformin + enalapril + spironolactone (CKD + hyperK)
 ('6800002','000002','1550050','Metformin','metformin','500 mg',60,'TAB','1x2 pc',CURDATE()),
 ('6800002','000002','1580005','Enalapril','enalapril','20 mg',30,'TAB','1x1',CURDATE()),
 ('6800002','000002','1000284','Spironolactone','spironolactone','25 mg',30,'TAB','1x1',CURDATE()),
 -- 6800003 เด็ก: amoxicillin syrup + paracetamol syrup + dicloxacillin syrup
 ('6800003','000003','1460566','Amoxycillin syrup 250','amoxicillin','250 mg/5ml',1,'BOT','1x3',CURDATE()),
 ('6800003','000003','1000230','Paracetamol syrup','paracetamol','120 mg/5ml',1,'BOT','prn q4-6h',CURDATE()),
 ('6800003','000003','1600004','Dicloxacillin dry syrup','dicloxacillin','62.5 mg/5ml',1,'BOT','1x4 ac',CURDATE()),
 -- 6800004 digoxin + furosemide + warfarin (dig toxicity + hypoK + QT)
 ('6800004','000004','1600018','Digoxin','digoxin','0.25 mg',30,'TAB','1x1',CURDATE()),
 ('6800004','000004','1000139','Furosemide','furosemide','40 mg',30,'TAB','1x1',CURDATE()),
 ('6800004','000004','1600019','Warfarin 3mg','warfarin','3 mg',30,'TAB','1x1 pc',CURDATE()),
 -- 6800005 ตั้งครรภ์ + warfarin (teratogen) + amoxicillin (แพ้ penicillin ข้ามกลุ่ม)
 ('6800005','000005','1600019','Warfarin 3mg','warfarin','3 mg',30,'TAB','1x1',CURDATE()),
 ('6800005','000005','1460566','Amoxicillin','amoxicillin','500 mg',20,'CAP','1x3',CURDATE());

INSERT INTO rxs_lab VALUES
 ('6800001','000001','INR','4.5','2.0-3.0',CURDATE()),
 ('6800001','000001','Cr','1.0','0.6-1.2',CURDATE()),
 ('6800001','000001','K','4.0','3.5-5.0',CURDATE()),
 ('6800002','000002','Cr','2.5','0.6-1.2',CURDATE()),
 ('6800002','000002','eGFR','22','>=90',CURDATE()),
 ('6800002','000002','K','5.8','3.5-5.0',CURDATE()),
 ('6800004','000004','K','3.0','3.5-5.0',CURDATE()),
 ('6800004','000004','INR','2.5','2.0-3.0',CURDATE()),
 ('6800004','000004','Cr','1.3','0.6-1.2',CURDATE());

INSERT INTO rxs_allergy VALUES
 ('000005','Penicillin','ผื่นลมพิษ',CURDATE());

INSERT INTO rxs_diagnosis VALUES
 ('6800001','000001','I48','1'),   -- AF
 ('6800002','000002','N18','1'),   -- CKD
 ('6800004','000004','I50','1'),   -- HF
 ('6800005','000005','Z34','1');   -- pregnancy

-- คาดหวังผลคัดกรอง (ไว้เช็คว่าระบบทำงานถูก):
--  6800001 → DDI warfarin+NSAID, INR สูง, เลือดออก
--  6800002 → Metformin ห้ามใช้ (eGFR22<30), K สูง+ACEI, Triple/hyperK
--  6800003 → ขนาดยาเด็ก (amox/para/diclox ตามน้ำหนัก 14kg)
--  6800004 → K ต่ำ+digoxin (toxicity), QT, warfarin
--  6800005 → warfarin teratogen (ตั้งครรภ์), แพ้ penicillin ข้าม amoxicillin
