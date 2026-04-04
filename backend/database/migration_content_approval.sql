-- Migration: Add content approval system for booster packs and card templates
-- ============================================================

-- Booster packs: approval_status for admin review
ALTER TABLE booster_packs ADD COLUMN IF NOT EXISTS approval_status VARCHAR(32) NOT NULL DEFAULT 'pending';
ALTER TABLE booster_packs ADD COLUMN IF NOT EXISTS approval_note TEXT;
ALTER TABLE booster_packs ADD COLUMN IF NOT EXISTS approval_reviewed_at TIMESTAMPTZ;

-- Card templates: approval_status for admin review
ALTER TABLE card_templates ADD COLUMN IF NOT EXISTS approval_status VARCHAR(32) NOT NULL DEFAULT 'pending';
ALTER TABLE card_templates ADD COLUMN IF NOT EXISTS approval_note TEXT;
ALTER TABLE card_templates ADD COLUMN IF NOT EXISTS approval_reviewed_at TIMESTAMPTZ;

-- Sync existing published packs to approved
UPDATE booster_packs SET approval_status = 'approved' WHERE is_published = true AND approval_status = 'pending';

-- Sync existing active cards to approved
UPDATE card_templates SET approval_status = 'approved' WHERE is_active = true AND approval_status = 'pending';

-- Add constraints
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_bp_approval_status') THEN
    ALTER TABLE booster_packs ADD CONSTRAINT chk_bp_approval_status
      CHECK (approval_status IN ('pending', 'approved', 'rejected'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_ct_approval_status') THEN
    ALTER TABLE card_templates ADD CONSTRAINT chk_ct_approval_status
      CHECK (approval_status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;
