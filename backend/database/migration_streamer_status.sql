-- Migration: Add streamer status flow + admin system
-- ============================================================

-- Add streamer_status column (replaces simple is_streamer boolean for the flow)
-- Values: 'none' (viewer), 'pending' (requested), 'approved' (confirmed streamer), 'rejected'
ALTER TABLE users ADD COLUMN IF NOT EXISTS streamer_status VARCHAR(32) NOT NULL DEFAULT 'none';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS streamer_requested_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS streamer_reviewed_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS streamer_review_note TEXT;

-- Sync existing is_streamer = true users to 'approved' status
UPDATE users SET streamer_status = 'approved' WHERE is_streamer = true AND streamer_status = 'none';

-- Add constraint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_streamer_status') THEN
    ALTER TABLE users ADD CONSTRAINT chk_streamer_status
      CHECK (streamer_status IN ('none', 'pending', 'approved', 'rejected'));
  END IF;
END $$;
