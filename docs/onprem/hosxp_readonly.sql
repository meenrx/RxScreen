-- ============================================================
--  RxScreen — MySQL/MariaDB user "อ่านอย่างเดียว" สำหรับ HOSxP
--  เป้าหมาย: ให้ IT มั่นใจว่าระบบ "อ่านได้เท่านั้น + เห็นเฉพาะคอลัมน์คัดกรอง"
--  วิธีที่ปลอดภัยที่สุด = เปิดเผยผ่าน VIEW (IT คุมคอลัมน์) แล้ว grant เฉพาะ view
--  รันโดย DBA ของ รพ. — RxScreen ไม่ต้องมีสิทธิ์สร้าง view/สร้าง user เอง
-- ============================================================

-- ⚠️ แทน 10.10.1.100 = IP ของ "เครื่องที่รัน RxScreen" (จำกัด host ไม่ให้ต่อจากที่อื่น)
-- ⚠️ แทน hos = ชื่อฐาน HOSxP จริง

-- 1) VIEW เปิดเผยเฉพาะคอลัมน์ที่ใช้คัดกรอง (ไม่มี ชื่อ/ที่อยู่/บัตร ปชช./เบอร์โทร)
--    ชื่อคอลัมน์อ้างอิงสคีมา HOSxP — DBA ปรับให้ตรงเวอร์ชันของ รพ.

-- 1.1 การรับผู้ป่วยใน (AN ↔ HN, วอร์ด, วันรับ/จำหน่าย)
CREATE OR REPLACE SQL SECURITY DEFINER VIEW rxs_admission AS
  SELECT i.an, i.hn, i.ward, i.regdate, i.dchdate, i.spclty
  FROM ipt i
  WHERE i.dchdate IS NULL OR i.dchdate >= (CURRENT_DATE - INTERVAL 2 DAY);

-- 1.2 คำสั่งใช้ยาของแพทย์ (ผูก generic_name เพื่อคัดกรองข้ามกลุ่ม/ขนาด)
CREATE OR REPLACE SQL SECURITY DEFINER VIEW rxs_drug_order AS
  SELECT o.an, o.hn, o.icode, d.name AS drug_name, d.generic_name,
         d.strength, o.qty, o.unit_code, o.usage_code, o.order_date
  FROM  opitemrece o
  JOIN  drugitems  d ON d.icode = o.icode
  WHERE o.an IS NOT NULL;

-- 1.3 ผลแลป (ชื่อแลป + ค่า + วันที่ — ไม่มีข้อมูลระบุตัวตนอื่น)
CREATE OR REPLACE SQL SECURITY DEFINER VIEW rxs_lab AS
  SELECT h.an, h.hn, i.lab_items_name AS lab_name, i.lab_order_result AS result,
         i.lab_items_normal_value AS normal_value, h.report_date
  FROM  lab_head h
  JOIN  lab_order_result i ON i.lab_order_number = h.lab_order_number;

-- 1.4 ประวัติแพ้ยา
CREATE OR REPLACE SQL SECURITY DEFINER VIEW rxs_allergy AS
  SELECT a.hn, a.agent, a.symptom, a.report_date
  FROM opd_allergy a;

-- 1.5 การวินิจฉัย (ICD-10) ที่เกี่ยวข้องกับการคัดกรอง (เช่น CKD, ตั้งครรภ์, ตับ)
CREATE OR REPLACE SQL SECURITY DEFINER VIEW rxs_diagnosis AS
  SELECT x.an, x.hn, x.icd10, x.diagtype
  FROM ipt_diagnosis x;

-- 2) สร้าง user อ่านอย่างเดียว (จำกัดให้ต่อได้จากเครื่อง RxScreen เท่านั้น)
CREATE USER IF NOT EXISTS 'rxscreen_ro'@'10.10.1.100'
  IDENTIFIED BY 'CHANGE_ME_STRONG_PASSWORD';

-- 3) ให้สิทธิ์ SELECT เฉพาะ VIEW ข้างต้น — ห้ามแตะ base table, ห้าม INSERT/UPDATE/DELETE/DDL
GRANT SELECT ON hos.rxs_admission  TO 'rxscreen_ro'@'10.10.1.100';
GRANT SELECT ON hos.rxs_drug_order TO 'rxscreen_ro'@'10.10.1.100';
GRANT SELECT ON hos.rxs_lab        TO 'rxscreen_ro'@'10.10.1.100';
GRANT SELECT ON hos.rxs_allergy    TO 'rxscreen_ro'@'10.10.1.100';
GRANT SELECT ON hos.rxs_diagnosis  TO 'rxscreen_ro'@'10.10.1.100';
FLUSH PRIVILEGES;

-- 4) ตรวจสอบว่าเป็น read-only จริง (ควรเห็นแต่ SELECT ... ON <view>)
--    SHOW GRANTS FOR 'rxscreen_ro'@'10.10.1.100';

-- 5) ยกเลิกได้ทันทีเมื่อต้องการ (ระบบจะหยุดอ่าน โดยไม่กระทบ HOSxP)
--    DROP USER 'rxscreen_ro'@'10.10.1.100';
