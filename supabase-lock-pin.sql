-- ══════════════════════════════════════════
-- ESPER INVICTUS — Lock Screen + Secure Writes
-- Run this in: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════

-- ── 1. CONFIG TABLE ──
CREATE TABLE IF NOT EXISTS app_config (
  key   text PRIMARY KEY,
  value text NOT NULL
);

-- Staff PIN (share with ER team — you can change anytime)
INSERT INTO app_config (key, value)
VALUES ('staff_pin', 'minis2026')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Master PIN (only you — never auto-locks)
INSERT INTO app_config (key, value)
VALUES ('master_pin', 'docd9999')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ── 2. RLS — block direct reads of config ──
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
-- No SELECT policy for anon = can't read PINs

-- ── 3. CHECK PIN — returns 'staff', 'master', or 'invalid' ──
CREATE OR REPLACE FUNCTION check_staff_pin(input_pin text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM app_config WHERE key = 'master_pin' AND value = input_pin)
      THEN 'master'
    WHEN EXISTS (SELECT 1 FROM app_config WHERE key = 'staff_pin' AND value = input_pin)
      THEN 'staff'
    ELSE 'invalid'
  END;
$$;

-- ── 4. SECURE WRITE FUNCTIONS ──
-- All writes go through these — they check the PIN first

-- 4a. Register or update patient + create visit
CREATE OR REPLACE FUNCTION rpc_register_patient(
  pin text,
  p_hn text,
  p_title text,
  p_first_name text,
  p_last_name text,
  p_sex text,
  p_age_y int DEFAULT 0,
  p_age_m int DEFAULT 0,
  p_age_d int DEFAULT 0,
  v_esi int DEFAULT 3,
  v_cc text DEFAULT '',
  v_status text DEFAULT 'รอตรวจ',
  v_tab text DEFAULT 'waiting',
  v_fast_track text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pid uuid;
  vid uuid;
  pin_role text;
BEGIN
  -- Check PIN
  SELECT check_staff_pin(pin) INTO pin_role;
  IF pin_role = 'invalid' THEN
    RETURN jsonb_build_object('error', 'invalid_pin');
  END IF;

  -- Find or create patient
  SELECT id INTO pid FROM patients WHERE hn = p_hn;

  IF pid IS NOT NULL THEN
    UPDATE patients SET
      title = p_title, first_name = p_first_name, last_name = p_last_name,
      sex = p_sex, age_y = p_age_y, age_m = p_age_m, age_d = p_age_d
    WHERE id = pid;
  ELSE
    INSERT INTO patients (hn, title, first_name, last_name, sex, age_y, age_m, age_d)
    VALUES (p_hn, p_title, p_first_name, p_last_name, p_sex, p_age_y, p_age_m, p_age_d)
    RETURNING id INTO pid;
  END IF;

  -- Create visit
  INSERT INTO visits (patient_id, esi, chief_complaint, status, tab, fast_track,
    activated_at)
  VALUES (pid, v_esi, v_cc, v_status, v_tab, v_fast_track,
    CASE WHEN v_tab = 'active' THEN now() ELSE NULL END)
  RETURNING id INTO vid;

  RETURN jsonb_build_object('patient_id', pid, 'visit_id', vid);
END;
$$;

-- 4b. Update visit status
CREATE OR REPLACE FUNCTION rpc_update_visit(
  pin text,
  visit_id uuid,
  new_status text,
  new_tab text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pin_role text;
BEGIN
  SELECT check_staff_pin(pin) INTO pin_role;
  IF pin_role = 'invalid' THEN
    RETURN jsonb_build_object('error', 'invalid_pin');
  END IF;

  UPDATE visits SET
    status = new_status,
    tab = new_tab,
    activated_at = CASE
      WHEN new_tab = 'active' AND activated_at IS NULL THEN now()
      ELSE activated_at
    END,
    finalized_at = CASE
      WHEN new_tab = 'finalized' THEN now()
      ELSE finalized_at
    END
  WHERE id = visit_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 4c. Update patient info (name, age, title, phones, etc.)
CREATE OR REPLACE FUNCTION rpc_update_patient(
  pin text,
  patient_id uuid,
  p_title text DEFAULT NULL,
  p_first_name text DEFAULT NULL,
  p_last_name text DEFAULT NULL,
  p_sex text DEFAULT NULL,
  p_age_y int DEFAULT NULL,
  p_age_m int DEFAULT NULL,
  p_age_d int DEFAULT NULL,
  p_phone_1 text DEFAULT NULL,
  p_phone_1_label text DEFAULT NULL,
  p_phone_2 text DEFAULT NULL,
  p_phone_2_label text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pin_role text;
BEGIN
  SELECT check_staff_pin(pin) INTO pin_role;
  IF pin_role = 'invalid' THEN
    RETURN jsonb_build_object('error', 'invalid_pin');
  END IF;

  UPDATE patients SET
    title      = COALESCE(p_title, title),
    first_name = COALESCE(p_first_name, first_name),
    last_name  = COALESCE(p_last_name, last_name),
    sex        = COALESCE(p_sex, sex),
    age_y      = COALESCE(p_age_y, age_y),
    age_m      = COALESCE(p_age_m, age_m),
    age_d      = COALESCE(p_age_d, age_d),
    phone_1       = COALESCE(p_phone_1, phone_1),
    phone_1_label = COALESCE(p_phone_1_label, phone_1_label),
    phone_2       = COALESCE(p_phone_2, phone_2),
    phone_2_label = COALESCE(p_phone_2_label, phone_2_label)
  WHERE id = patient_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── 5. REMOVE ANON WRITE POLICIES ──
-- (Run these AFTER you're done testing with direct writes)
-- Uncomment when ready:
--
-- DROP POLICY IF EXISTS "Temp anon write patients" ON patients;
-- DROP POLICY IF EXISTS "Temp anon write visits" ON visits;
