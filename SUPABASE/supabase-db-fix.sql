-- ══════════════════════════════════════════
-- DATABASE FIX — Constraints + Cleanup
-- Run this in Supabase SQL Editor
-- ══════════════════════════════════════════

-- 1. Delete all test data
DELETE FROM visits;
DELETE FROM patients;

-- 2. Add age constraints
ALTER TABLE patients ADD CONSTRAINT chk_age_m CHECK (age_m BETWEEN 0 AND 11);
ALTER TABLE patients ADD CONSTRAINT chk_age_d CHECK (age_d BETWEEN 0 AND 30);
ALTER TABLE patients ADD CONSTRAINT chk_age_y CHECK (age_y BETWEEN 0 AND 150);

-- 3. Add sex constraint
ALTER TABLE patients ADD CONSTRAINT chk_sex CHECK (sex IN ('M', 'F', 'X'));

-- 4. Add ESI constraint (already exists but verify)
-- ALTER TABLE visits ADD CONSTRAINT chk_esi CHECK (esi BETWEEN 1 AND 5);
-- (skip if already exists from setup)

-- 5. Add tab constraint (already exists but verify)
-- ALTER TABLE visits ADD CONSTRAINT chk_tab CHECK (tab IN ('waiting', 'active', 'finalized'));
-- (skip if already exists from setup)
