-- ══════════════════════════════════════════
-- TEMPORARY: Allow anon to write (for testing only)
-- REMOVE THIS before going live with login
-- ══════════════════════════════════════════

-- Allow anon to insert/update patients (for registration)
CREATE POLICY "Temp anon write patients"
  ON patients FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Allow anon to insert/update visits (for status updates)
CREATE POLICY "Temp anon write visits"
  ON visits FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);
