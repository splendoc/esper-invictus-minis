-- Migration: Rename status 'กู้ชีพ' → 'Resuscitate'
-- Run this ONCE in Supabase SQL editor

UPDATE visits SET status = 'Resuscitate' WHERE status = 'กู้ชีพ';
