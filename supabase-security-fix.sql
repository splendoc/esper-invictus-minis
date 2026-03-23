-- ══════════════════════════════════════════
-- SECURITY FIX — PDPA Compliance
-- Run this in Supabase SQL Editor
-- ══════════════════════════════════════════

-- 1. REMOVE anon access to patients table (was too open)
DROP POLICY IF EXISTS "Public can read patients" ON patients;

-- 2. REMOVE anon access to visits table (was too open)
DROP POLICY IF EXISTS "Public can read active visits" ON visits;

-- 3. Create a SECURE VIEW for Public View
-- This view only exposes what patients/public should see:
--   - Last 3 digits of HN (masked)
--   - First 3 chars of first/last name (masked)
--   - Sex, age, ESI, status, tab
--   - NO full HN, NO full name, NO phone numbers
CREATE OR REPLACE VIEW public_board AS
SELECT
    v.id AS visit_id,
    '**' || RIGHT(p.hn, 3) AS hn_masked,
    LEFT(p.first_name, 3) || REPEAT('*', GREATEST(LENGTH(p.first_name) - 3, 0)) AS first_name_masked,
    LEFT(p.last_name, 3) || REPEAT('*', GREATEST(LENGTH(p.last_name) - 3, 0)) AS last_name_masked,
    p.sex,
    p.age_y,
    p.age_m,
    p.age_d,
    v.esi,
    v.status,
    v.tab,
    v.arrived_at,
    v.activated_at
FROM visits v
JOIN patients p ON p.id = v.patient_id
WHERE v.tab IN ('waiting', 'active');

-- 4. Grant anon access to the VIEW only (not the tables)
GRANT SELECT ON public_board TO anon;

-- 5. Verify: anon can ONLY read public_board
-- anon CANNOT read patients table → blocked by RLS
-- anon CANNOT read visits table → blocked by RLS
-- anon CAN read public_board → masked data only
