-- Add ETT and CPR flags to visits table
ALTER TABLE visits ADD COLUMN IF NOT EXISTS had_ett boolean DEFAULT false;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS had_cpr boolean DEFAULT false;
