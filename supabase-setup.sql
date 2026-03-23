-- ══════════════════════════════════════════
-- ESPER INVICTUS — Supabase Table Setup
-- Run this in: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════

-- ── 1. PATIENTS TABLE ──
-- ข้อมูลพื้นฐานผู้ป่วย — ใช้ซ้ำทุกครั้งที่มาโรงพยาบาล
CREATE TABLE patients (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  hn          text UNIQUE NOT NULL,
  title       text,
  first_name  text NOT NULL,
  last_name   text NOT NULL,
  sex         text NOT NULL CHECK (sex IN ('M', 'F', 'X')),
  age_y       int DEFAULT 0,
  age_m       int DEFAULT 0,
  age_d       int DEFAULT 0,
  phone_1       text,
  phone_1_label text,
  phone_2       text,
  phone_2_label text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ── 2. VISITS TABLE ──
-- แต่ละครั้งที่ผู้ป่วยมา ER — 1 คนมาได้หลายครั้ง
CREATE TABLE visits (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id      uuid NOT NULL REFERENCES patients(id),
  esi             int NOT NULL CHECK (esi BETWEEN 1 AND 5),
  chief_complaint text NOT NULL,
  status          text NOT NULL DEFAULT 'รอตรวจ',
  tab             text NOT NULL DEFAULT 'waiting' CHECK (tab IN ('waiting', 'active', 'finalized')),
  fast_track      text CHECK (fast_track IN ('Trauma', 'ACS', 'Stroke', 'Sepsis', NULL)),
  arrived_at      timestamptz DEFAULT now(),
  activated_at    timestamptz,
  finalized_at    timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- ── 3. AUTO-UPDATE updated_at ──
-- อัพเดท updated_at อัตโนมัติเมื่อแก้ไขข้อมูล
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER visits_updated_at
  BEFORE UPDATE ON visits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 4. ROW LEVEL SECURITY (RLS) ──
-- เปิด RLS ทั้ง 2 ตาราง
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anon (public) to READ patients (for Public View — masked display)
CREATE POLICY "Public can read patients"
  ON patients FOR SELECT
  TO anon
  USING (true);

-- Policy: Allow anon to READ visits that are waiting or active (for Public View)
CREATE POLICY "Public can read active visits"
  ON visits FOR SELECT
  TO anon
  USING (tab IN ('waiting', 'active'));

-- Policy: Allow authenticated users (staff) full access to patients
CREATE POLICY "Staff full access patients"
  ON patients FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Allow authenticated users (staff) full access to visits
CREATE POLICY "Staff full access visits"
  ON visits FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── 5. INDEXES ──
-- เร่งความเร็วการค้นหา
CREATE INDEX idx_visits_patient_id ON visits(patient_id);
CREATE INDEX idx_visits_tab ON visits(tab);
CREATE INDEX idx_visits_status ON visits(status);
CREATE INDEX idx_patients_hn ON patients(hn);

-- ── 6. ENABLE REALTIME ──
-- เปิด real-time subscriptions สำหรับทั้ง 2 ตาราง
ALTER PUBLICATION supabase_realtime ADD TABLE patients;
ALTER PUBLICATION supabase_realtime ADD TABLE visits;
