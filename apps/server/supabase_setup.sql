-- =============================================
-- AURA Cloud Pulse — Supabase Setup Script
-- =============================================
-- Run this in your Supabase SQL Editor to set up the Cloud Vault.
-- Dashboard: https://supabase.com/dashboard → SQL Editor

-- 1. Create the track index table
CREATE TABLE IF NOT EXISTS aura_tracks (
   id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
   vibe        TEXT NOT NULL,
   mood        TEXT NOT NULL,
   track_urls  TEXT[] NOT NULL,
   created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create index for fast vibe+mood lookups
CREATE INDEX IF NOT EXISTS idx_aura_vibe_mood ON aura_tracks(vibe, mood);

-- 3. Enable Row Level Security (recommended by Supabase)
ALTER TABLE aura_tracks ENABLE ROW LEVEL SECURITY;

-- 4. Allow the service role to do everything (server-side only)
CREATE POLICY "Service role full access" ON aura_tracks
   FOR ALL
   TO service_role
   USING (true)
   WITH CHECK (true);

-- 5. (Optional) Allow anonymous reads if you want public access
CREATE POLICY "Public read access" ON aura_tracks
   FOR SELECT
   TO anon
   USING (true);
