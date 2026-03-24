-- ══════════════════════════════════════════
-- ESPER INVICTUS — Screen Lock PIN
-- Run this in: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════

-- ── 1. CONFIG TABLE ──
-- Stores app-wide settings (like the staff PIN)
CREATE TABLE IF NOT EXISTS app_config (
  key   text PRIMARY KEY,
  value text NOT NULL
);

-- Insert the staff PIN (change 'minis2026' to whatever you want)
INSERT INTO app_config (key, value)
VALUES ('staff_pin', 'minis2026')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ── 2. RLS — block direct reads ──
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
-- No SELECT policy for anon = they can't read the table directly

-- ── 3. RPC FUNCTION — check PIN server-side ──
-- The client sends the PIN, the function returns true/false
-- The actual PIN never leaves the database
CREATE OR REPLACE FUNCTION check_staff_pin(input_pin text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM app_config
    WHERE key = 'staff_pin' AND value = input_pin
  );
$$;
