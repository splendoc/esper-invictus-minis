-- ══════════════════════════════════════════════════════════════
-- ESPER INVICTUS — Disposition & Data Completion Migration
-- Run this AFTER the existing supabase-setup.sql / supabase-lock-pin.sql
-- ══════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────
-- 1. NEW COLUMNS ON visits TABLE
-- ──────────────────────────────────────────

-- Registration fields (triage adds these)
ALTER TABLE visits ADD COLUMN IF NOT EXISTS case_category text
  CHECK (case_category IN ('trauma','non_trauma','psych'));

ALTER TABLE visits ADD COLUMN IF NOT EXISTS arrival_mode text;

ALTER TABLE visits ADD COLUMN IF NOT EXISTS hospital_arrival_time timestamptz;
  -- Manual input: when patient registered at hospital (not triage time)

-- Bed request / Admit flow
ALTER TABLE visits ADD COLUMN IF NOT EXISTS bed_requested_at timestamptz;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS bed_requested_ward text;
  -- Current ward request. History tracked in bed_request_log table.

-- Refer flow
ALTER TABLE visits ADD COLUMN IF NOT EXISTS refer_contacted_at timestamptz;
  -- Auto-recorded on status change to ติดต่อส่งตัวโรงพยาบาลอื่น

ALTER TABLE visits ADD COLUMN IF NOT EXISTS referral_hospital text;
  -- Final accepted hospital (from refer_contact_log)

ALTER TABLE visits ADD COLUMN IF NOT EXISTS referral_reason text;

ALTER TABLE visits ADD COLUMN IF NOT EXISTS referral_doctor text;
  -- EP who refers the patient (e.g. พญ.เฌอมาลย์ จันทนโรจ)

ALTER TABLE visits ADD COLUMN IF NOT EXISTS referral_doctor_license text;
  -- เลข ว. of referring doctor

ALTER TABLE visits ADD COLUMN IF NOT EXISTS referral_receiving_dept text;
  -- Department at receiving hospital (e.g. Cardiology, จิตเวช)

-- Handover & move
ALTER TABLE visits ADD COLUMN IF NOT EXISTS handover_ward_at timestamptz;
  -- Manual button: ส่งเวรวอร์ด (admit handover)

ALTER TABLE visits ADD COLUMN IF NOT EXISTS handover_refer_at timestamptz;
  -- Manual button: ส่งเวร Refer (refer handover)
  -- Both can coexist; whichever moves first auto-cancels the other

ALTER TABLE visits ADD COLUMN IF NOT EXISTS actual_move_at timestamptz;
  -- Manual button: ย้ายผู้ป่วย / ส่งแล้ว → triggers finalization

-- Finalization fields (data completion in Finalized tab)
ALTER TABLE visits ADD COLUMN IF NOT EXISTS final_esi int
  CHECK (final_esi BETWEEN 1 AND 5);
  -- Defaults to initial ESI, editable at finalization

ALTER TABLE visits ADD COLUMN IF NOT EXISTS diagnosis text;
  -- Free text or picked from DX_LIST

ALTER TABLE visits ADD COLUMN IF NOT EXISTS diagnosis_icd10 text;
  -- Auto-filled from DX_LIST if matched, NULL for custom entries

ALTER TABLE visits ADD COLUMN IF NOT EXISTS department text;
  -- Admitting department (Admit cases only)

ALTER TABLE visits ADD COLUMN IF NOT EXISTS doctor text;
  -- Admitting doctor name (Admit cases only)

ALTER TABLE visits ADD COLUMN IF NOT EXISTS doctor_license text;
  -- เลข ว. (if available)

ALTER TABLE visits ADD COLUMN IF NOT EXISTS treatment_outcome text
  CHECK (treatment_outcome IN ('ดีขึ้น','คงเดิม','ไม่ดีขึ้น'));
  -- Discharge + Refer cases only

ALTER TABLE visits ADD COLUMN IF NOT EXISTS data_complete boolean DEFAULT false;
  -- true when all required fields filled → starts 90min auto-remove timer

ALTER TABLE visits ADD COLUMN IF NOT EXISTS data_completed_at timestamptz;
  -- When data_complete was set to true (for 90min timer)


-- ──────────────────────────────────────────
-- 2. NOTES TABLE (timeline per visit)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notes_visit ON notes(visit_id);
CREATE INDEX IF NOT EXISTS idx_notes_created ON notes(visit_id, created_at ASC);
  -- ASC = oldest on top (chronological like medical chart)

-- Auto-update timestamp
CREATE TRIGGER notes_updated
  BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY notes_read ON notes FOR SELECT USING (true);
CREATE POLICY notes_write ON notes FOR ALL USING (true) WITH CHECK (true);


-- ──────────────────────────────────────────
-- 3. BED REQUEST LOG (track ward changes)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bed_request_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  ward text NOT NULL,
  requested_at timestamptz DEFAULT now(),
  superseded boolean DEFAULT false
    -- true when a newer bed request replaces this one
);

CREATE INDEX IF NOT EXISTS idx_bed_log_visit ON bed_request_log(visit_id);

ALTER TABLE bed_request_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY bed_log_read ON bed_request_log FOR SELECT USING (true);
CREATE POLICY bed_log_write ON bed_request_log FOR ALL USING (true) WITH CHECK (true);


-- ──────────────────────────────────────────
-- 4. REFER CONTACT LOG (multiple hospital contacts)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refer_contact_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  hospital_name text NOT NULL,
  hospital_type text,  -- 'public' or 'private' (auto from HOSPITAL_LIST)
  result text NOT NULL CHECK (result IN ('รับ','ไม่รับ','รอตอบ')),
  reason text,         -- Why rejected, or notes
  contacted_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refer_log_visit ON refer_contact_log(visit_id);

ALTER TABLE refer_contact_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY refer_log_read ON refer_contact_log FOR SELECT USING (true);
CREATE POLICY refer_log_write ON refer_contact_log FOR ALL USING (true) WITH CHECK (true);


-- ──────────────────────────────────────────
-- 5. GEDWIN SNAPSHOTS (for post-implementation analysis)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gedwin_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  score numeric(5,2) NOT NULL,
  level text NOT NULL,
    -- 'Normal','Medium','Crowded','Very Crowded','Critical'
  total_patients int NOT NULL,
  active_patients int NOT NULL,
  waiting_patients int NOT NULL,
  occupancy_ratio numeric(5,2),
  acuity_ratio numeric(5,2),
  snapshot_type text NOT NULL CHECK (snapshot_type IN ('hourly','event')),
    -- 'hourly' = scheduled every hour
    -- 'event' = on patient arrival/departure/status change
  recorded_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gedwin_time ON gedwin_snapshots(recorded_at);
CREATE INDEX IF NOT EXISTS idx_gedwin_type ON gedwin_snapshots(snapshot_type);

ALTER TABLE gedwin_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY gedwin_read ON gedwin_snapshots FOR SELECT USING (true);
CREATE POLICY gedwin_write ON gedwin_snapshots FOR ALL USING (true) WITH CHECK (true);


-- ──────────────────────────────────────────
-- 6. ENABLE REALTIME on new tables
-- ──────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE notes;
ALTER PUBLICATION supabase_realtime ADD TABLE bed_request_log;
ALTER PUBLICATION supabase_realtime ADD TABLE refer_contact_log;
-- gedwin_snapshots does NOT need realtime (read-only for analytics)


-- ──────────────────────────────────────────
-- 7. UPDATE public_board VIEW (add case_category for public view)
-- ──────────────────────────────────────────
-- Note: If public_board view needs updating to include new fields,
-- run this after verifying current view definition:
--
-- CREATE OR REPLACE VIEW public_board AS
-- SELECT
--   v.id, v.esi, v.status, v.tab, v.fast_track, v.case_category,
--   v.arrived_at, v.activated_at, v.finalized_at,
--   p.title, p.first_name, p.last_name, p.sex, p.age_y
-- FROM visits v
-- JOIN patients p ON p.id = v.patient_id;


-- ──════════════════════════════════════════
-- DONE. Summary of changes:
-- • 16 new columns on visits
-- • 3 new tables: notes, bed_request_log, refer_contact_log
-- • 1 new table: gedwin_snapshots
-- • RLS + indexes on all new tables
-- • Realtime enabled on notes, bed_request_log, refer_contact_log
-- ══════════════════════════════════════════
