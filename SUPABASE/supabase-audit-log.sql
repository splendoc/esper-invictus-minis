-- Audit log table
CREATE TABLE audit_log (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  visit_id     uuid        NOT NULL REFERENCES visits(id),
  patient_id   uuid        REFERENCES patients(id),
  actor_pin    text,
  actor_id     uuid,
  actor_role   text,
  action       text        NOT NULL,
  category     text        NOT NULL,
  severity     text        NOT NULL DEFAULT 'info',
  field        text,
  prev_value   text,
  new_value    text,
  reason       text,
  detail       jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  client_ts    timestamptz,
  session_id   text,
  checksum     text
);

CREATE INDEX idx_audit_visit     ON audit_log(visit_id, created_at);
CREATE INDEX idx_audit_patient   ON audit_log(patient_id, created_at);
CREATE INDEX idx_audit_action    ON audit_log(action, created_at);
CREATE INDEX idx_audit_category  ON audit_log(category, created_at);
CREATE INDEX idx_audit_time      ON audit_log(created_at);

-- Immutability triggers
CREATE OR REPLACE FUNCTION prevent_audit_modify()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is immutable — UPDATE and DELETE are prohibited';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER no_audit_update BEFORE UPDATE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modify();
CREATE TRIGGER no_audit_delete BEFORE DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modify();

-- Enable anon insert (temporary — will be replaced by edge functions)
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon insert" ON audit_log FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon select" ON audit_log FOR SELECT TO anon USING (true);
