-- Add case_category and arrival_mode to rpc_register_patient
-- Run this in Supabase SQL Editor

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
  v_fast_track text DEFAULT NULL,
  v_case_category text DEFAULT NULL,
  v_arrival_mode text DEFAULT NULL
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
    case_category, arrival_mode, activated_at)
  VALUES (pid, v_esi, v_cc, v_status, v_tab, v_fast_track,
    v_case_category, v_arrival_mode,
    CASE WHEN v_tab = 'active' THEN now() ELSE NULL END)
  RETURNING id INTO vid;

  RETURN jsonb_build_object('patient_id', pid, 'visit_id', vid);
END;
$$;
