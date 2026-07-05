-- ============================================================
--  RxScreen — ฐานข้อมูล "กลาง" ของระบบเอง (แยกจาก HOSxP)
--  เก็บ: ผลการคัดกรอง, pharmacist intervention, จุดสำคัญ (ME ฯลฯ)
--  วางบน LAN → ทุกเครื่องบันทึก/ดูข้อมูลเดียวกัน
--  ⚠️ ไม่เกี่ยวกับ HOSxP — RxScreen เขียนได้เฉพาะฐานนี้ (HOSxP ยัง read-only)
--  PDPA: เก็บแค่ AN/HN + ข้อมูลคัดกรอง ไม่มี ชื่อ/ที่อยู่/บัตร ปชช.
-- ============================================================

CREATE DATABASE IF NOT EXISTS rxscreen
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 1) ผลการคัดกรองแต่ละครั้ง
CREATE TABLE IF NOT EXISTS rxscreen.screening_log (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  an             VARCHAR(20)  NOT NULL,
  hn             VARCHAR(20),
  ward           VARCHAR(60),
  screened_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  pharmacist_id  VARCHAR(50),          -- เลขใบประกอบ/username (บุคลากร)
  pharmacist_name VARCHAR(120),
  drug_count     INT,
  red_count      INT DEFAULT 0,
  orange_count   INT DEFAULT 0,
  yellow_count   INT DEFAULT 0,
  alert_types    VARCHAR(255),         -- เช่น "DDI,RENAL,LAB,HAD"
  me_status      ENUM('none','confirmed','not_me') DEFAULT 'none',
  me_level       VARCHAR(4),           -- เช่น "B"
  me_note        VARCHAR(500),
  KEY idx_an (an),
  KEY idx_time (screened_at),
  KEY idx_me (me_status)
);

-- 2) การแทรกแซงของเภสัชกร (off / ปรับขนาด / เปลี่ยนยา / เพิ่ม / counsel)
CREATE TABLE IF NOT EXISTS rxscreen.intervention (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  screening_id   BIGINT,
  an             VARCHAR(20)  NOT NULL,
  hn             VARCHAR(20),
  drug_icode     VARCHAR(30),
  generic_name   VARCHAR(150),
  action         ENUM('off','adjust_dose','switch','add','monitor','counsel','other'),
  reason         VARCHAR(300),
  saving_baht    DECIMAL(10,2),        -- มูลค่ายาที่ประหยัด (ถ้ามี)
  doctor_accepted TINYINT,             -- 1=รับ / 0=ไม่รับ / NULL=รอ
  pharmacist_id  VARCHAR(50),
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_an (an),
  KEY idx_time (created_at),
  CONSTRAINT fk_iv_screen FOREIGN KEY (screening_id)
    REFERENCES rxscreen.screening_log(id) ON DELETE SET NULL
);

-- 3) จุดสำคัญ/alert ที่ต้องการเก็บรายละเอียด (optional — ทำ dashboard/สืบย้อน)
CREATE TABLE IF NOT EXISTS rxscreen.screening_alert (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  screening_id   BIGINT,
  alert_type     VARCHAR(20),          -- DDI / RENAL / LAB / HAD / DISEASE ...
  severity       VARCHAR(10),          -- red / orange / yellow
  title          VARCHAR(255),
  drug_icode     VARCHAR(30),
  CONSTRAINT fk_al_screen FOREIGN KEY (screening_id)
    REFERENCES rxscreen.screening_log(id) ON DELETE CASCADE
);

-- 4) (แนะนำ) view สำหรับ dashboard รวม — ทุกเครื่องเปิดดูได้
CREATE OR REPLACE VIEW rxscreen.v_daily_summary AS
  SELECT DATE(screened_at) AS d, COUNT(*) AS screenings,
         SUM(red_count) AS red, SUM(orange_count) AS orange,
         SUM(me_status='confirmed') AS me_confirmed
  FROM rxscreen.screening_log
  GROUP BY DATE(screened_at);

-- 5) user เขียนได้ "เฉพาะฐาน rxscreen" (คนละตัวกับ read-only ของ HOSxP)
--    host = subnet ของ รพ. → ทุกเครื่องในวง LAN ต่อได้
CREATE USER IF NOT EXISTS 'rxscreen_rw'@'10.10.1.%'
  IDENTIFIED BY 'CHANGE_ME_STRONG_PASSWORD';
GRANT SELECT, INSERT, UPDATE ON rxscreen.* TO 'rxscreen_rw'@'10.10.1.%';
-- ❌ ไม่ให้สิทธิ์ใด ๆ ใน HOSxP  ❌ ไม่ให้ DELETE/DROP (กันลบประวัติ)
FLUSH PRIVILEGES;

-- ตรวจ: SHOW GRANTS FOR 'rxscreen_rw'@'10.10.1.%';
--       → ต้องเห็นแค่ SELECT,INSERT,UPDATE ON `rxscreen`.*
