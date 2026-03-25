-- Consult log — multiple consults per visit
CREATE TABLE IF NOT EXISTS consult_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  department text NOT NULL,
  doctor text NOT NULL,
  doctor_license text,
  consulted_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consult_visit ON consult_log(visit_id);
ALTER TABLE consult_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY consult_read ON consult_log FOR SELECT USING (true);
CREATE POLICY consult_write ON consult_log FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE consult_log;
