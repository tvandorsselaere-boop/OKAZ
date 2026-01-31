-- Table waitlist pour Recherche Futee
-- A executer dans Supabase SQL Editor

CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  will_pay BOOLEAN NOT NULL,
  source TEXT DEFAULT 'landing_page',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_will_pay ON waitlist(will_pay);

-- Activer RLS
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Policy: permettre l'insertion publique (anon)
CREATE POLICY "Allow public insert" ON waitlist
  FOR INSERT
  WITH CHECK (true);

-- Policy: lecture uniquement pour authenticated users (admin)
CREATE POLICY "Allow authenticated read" ON waitlist
  FOR SELECT
  USING (auth.role() = 'authenticated');
