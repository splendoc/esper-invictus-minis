-- ══════════════════════════════════════════════════════════════
-- ESPER INVICTUS — Dispo Flow v2 + Resuscitate Rename
-- Run this in Supabase SQL Editor (one-time)
-- ══════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────
-- 1. RENAME STATUS: กู้ชีพ → Resuscitate
-- ──────────────────────────────────────────
UPDATE visits SET status = 'Resuscitate' WHERE status = 'กู้ชีพ';

-- ──────────────────────────────────────────
-- 2. DISPO FLOW COLUMNS ON visits
-- ──────────────────────────────────────────
ALTER TABLE visits ADD COLUMN IF NOT EXISTS admit_decided_at timestamptz;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS refer_decided_at timestamptz;

-- ──────────────────────────────────────────
-- 3. BED REQUEST LOG — multi-bed with cancel
-- ──────────────────────────────────────────
ALTER TABLE bed_request_log ADD COLUMN IF NOT EXISTS cancelled boolean DEFAULT false;
ALTER TABLE bed_request_log ADD COLUMN IF NOT EXISTS cancel_reason text;

-- ──────────────────────────────────────────
-- 4. REFER CONTACT LOG — add ยกเลิก result
-- ──────────────────────────────────────────
ALTER TABLE refer_contact_log DROP CONSTRAINT IF EXISTS refer_contact_log_result_check;
ALTER TABLE refer_contact_log ADD CONSTRAINT refer_contact_log_result_check
  CHECK (result IN ('รับ','ไม่รับ','รอตอบ','ยกเลิก'));

-- ══════════════════════════════════════════
-- DONE. Summary:
-- • 1 data update (status rename)
-- • 2 new columns on visits (admit/refer decisions)
-- • 2 new columns on bed_request_log (cancel support)
-- • 1 constraint update on refer_contact_log
-- ══════════════════════════════════════════
