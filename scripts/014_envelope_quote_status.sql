-- ============================================================
-- Migration: reemplaza requires_quote BOOLEAN por quote_status TEXT
-- ============================================================

ALTER TABLE envelopes
  ADD COLUMN IF NOT EXISTS quote_status TEXT NOT NULL DEFAULT 'not_required'
    CHECK (quote_status IN ('not_required','pending','informed','approved','rejected')),
  ADD COLUMN IF NOT EXISTS quote_informed_at TIMESTAMPTZ NULL;

-- Migrar datos existentes
UPDATE envelopes SET quote_status = 'pending' WHERE requires_quote = TRUE AND quote_status = 'not_required';

ALTER TABLE envelopes DROP COLUMN IF EXISTS requires_quote;
